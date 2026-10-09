# Feature: Login with Discord

Status: phase 1 (login) is done and checked locally (step 6 of the plan). Phase 2 (multiplayer rooms, step 7) is built. The browser check is open. The rest is plan. See [Open questions](#open-questions) at the end.

The backend (repo, stack, AWS, deploy) is in `docs/feature-backend.md`. The order of the work is in `docs/plans/implement-backend.md`.

## Goal

A player can log in with their Discord account. Multiplayer play needs login. The Sandbox and single player rooms work without login, as today.

Login adds two things:

1. **Player identity in peer-to-peer games.** The opponent sees your Discord name and avatar. The server checks the name, so a player cannot pretend to be someone else.
2. **Multiplayer rooms.** A logged-in player hosts a room on the server. The room has the map, the rosters, two seats and the table. So both players see the same room on every device, also when the other player is not connected. Only the host can delete the room. The host creates the room. The guest joins it.

In TTS, the Steam account gives each player a name and an avatar. Here, the Discord account does the same. Most MCP players have a Discord account already.

## Summary

| Part | Choice |
|---|---|
| Provider | Discord only, scope `identify`. No email |
| Flow | OAuth2 authorization code. The browser goes to Discord and comes back with a code. The Lambda exchanges the code with the client secret |
| Backend | The API of `docs/feature-backend.md`: one Lambda, and the `assist3d` database in an Atlas Free cluster. Signaling (`docs/feature-peer-to-peer.md`) uses the same API. No new vendor |
| Session | Our own signed token (JWT), 30 days. Kept in `localStorage`, sent in the `Authorization` header |
| Users | Collection `users`. Our own user id, the Discord id is a unique field |
| Rooms | Collection `rooms`: setup, host, two seats, and a snapshot of the table (Yjs) |
| Single player rooms | Stay in `localStorage`, as today. They never connect to another player |
| Site | `https://mcptacticus3d.netlify.app` |
| Cost | $0. See [Cost](#cost) |

## Terms

| Term | Meaning |
|---|---|
| Single player room | A room in `localStorage` of one browser: the rooms of today (`docs/feature-rooms.md`). For trying maps and rosters. It never connects to another player. Before 2026-10-09 the docs called it an offline room |
| Multiplayer room | A room in the `rooms` collection. Only a logged-in player can create or join one. Peer-to-peer games happen only in multiplayer rooms. Before 2026-10-09 the docs called it an online room |
| Host | The user who creates a multiplayer room. Only the host can delete it |
| Guest | The user who joins a multiplayer room with the link |
| Seat | The Blue or the Red player of a multiplayer room. A seat holds a user id or is free |
| Session token | The token that our Lambda gives after login. It proves the user id to the Lambda |

## Options that were checked

| Option | Result |
|---|---|
| **Own code in our Lambda** | Chosen. About 150 lines. Signaling uses the same Lambda, database and deploy |
| Supabase Auth | Supports Discord with no code. 50,000 MAU free. But a free project pauses after 7 days with no requests, and someone must restore it by hand in the dashboard. A hobby app can have a week with no players. It is also a second backend next to the signaling Lambda |
| Firebase Auth | Has no Discord provider. Our Lambda would make a Firebase custom token with the Admin SDK. The Lambda can run the Admin SDK, so the Blaze plan is not needed. But Firebase then only adds a second vendor and gives nothing that our own token does not give |
| Amazon Cognito | Has no Discord provider. Discord would be a custom OIDC provider. Cognito gives only 50 free MAU per month to OIDC users (10,000 only to direct and social sign-ins). Discord also has no standard OIDC endpoints, so it needs a wrapper |

## Login flow

Discord's OAuth2 docs say that the token endpoint needs the client secret. They do not describe PKCE. So the browser cannot exchange the code itself, and the exchange runs in the Lambda.

1. The player presses **Log in with Discord**. The browser makes a random `state` and saves `{ state, returnHash }` in `sessionStorage`. `returnHash` is the page the player was on, for example `#room=K7Q2-M9XD`.
2. The browser goes to `https://discord.com/oauth2/authorize` with `response_type=code`, `client_id`, `scope=identify`, `redirect_uri=<origin>/`, `state` and `prompt=none`. With `prompt=none`, Discord skips the consent screen when the player approved the app before. Checked on 2026-10-09: the first login of a new player also works with `prompt=none`.
3. Discord sends the browser to `<origin>/?code=...&state=...`. When the player says no, it sends `?error=access_denied&state=...`.
4. `Root.jsx` reads the query before the hash. It checks that `state` is the saved one, and removes the query from the address bar (`history.replaceState`). It posts the code to `POST /auth/discord`.
5. The Lambda posts the code, the client id, the client secret and the redirect URI to `https://discord.com/api/oauth2/token`. It gets a Discord access token. It reads `GET https://discord.com/api/users/@me` with that token.
6. The Lambda creates or updates the user in `users` (key: Discord id). It signs a session token and returns `{ token, user }`. It does not store the Discord access token, because the app makes no other Discord calls.
7. The browser saves the token and opens `returnHash`.

The `state` check stops a login that another site started (login CSRF).

Next to the login button, the lobby says: "Your opponent sees your Discord name and avatar." The privacy page says the same. See [Privacy](#privacy).

## Session

- The session token is a JWT signed with HS256 (`hono/jwt`). The key is the SSM parameter `/mcptacticus/prod/session-secret` (backend doc, "Secrets and config"). Claims: `sub` (our user id), `iat`, `exp` (30 days).
- The browser keeps it in `localStorage` (`mcp-assist-3d/session`) and sends `Authorization: Bearer <token>`.
- On app start, the browser calls `GET /me`. The answer has the user, and a new token when the old one is more than 1 day old. The same call moves `expiresAt` of the user (see [Users](#users)). So a player who opens the app at least once in 30 days stays logged in.
- The Lambda checks the signature and `exp`, then reads the user by `_id`. A deleted user gets 401, and the browser logs out.
- **Log out** deletes the token in the browser. There is no server call. A copied token stays valid until `exp`.
- A new session secret logs out every player at once. Use it if the key leaks.

### Why not a cookie

The Lambda function URL (`*.lambda-url.<region>.on.aws`) is a different site than the app. So a cookie from the Lambda is a third-party cookie, and Safari and Firefox block third-party cookies by default.

A Netlify proxy rule (`/api/* -> function URL`, status 200) would make the API same-origin. But Netlify forum threads report that `Set-Cookie` from a proxied API is not always kept, and the signaling polls would also go through Netlify. The `Authorization` header has neither problem.

The cost of `localStorage`: a script that runs in the page (XSS) can read the token. The app loads no third-party scripts and renders no HTML from users. React renders Discord names as text.

## Users

```js
{
  _id: 'u_9fK2...',                  // our id, random
  discordId: '80351110224678912',    // unique index
  username: 'nelly',                 // Discord username
  name: 'Nelly',                     // Discord global_name, or username when global_name is null
  avatar: '8342729096ea3675442027381ff50dfe',   // hash, or null
  createdAt, lastLoginAt,            // Date
  expiresAt,                         // Date: last login or token renewal + 12 months. TTL index
}
```

- Every login updates `username`, `name` and `avatar`. So a changed Discord name shows at the next login. This is also how a player updates their data, which the Discord terms require.
- Our own `_id` keeps Discord out of the other collections. A second provider later adds a field, not a migration.
- Avatar URL: `https://cdn.discordapp.com/avatars/<discordId>/<avatar>.png?size=64`. With no avatar: `https://cdn.discordapp.com/embed/avatars/<index>.png`, with `index = (discordId >> 22) % 6` (`BigInt`, because the id has more than 53 bits).
- The avatar shows only in HTML (`<img>`). It does not go into a 3D texture, because that needs CORS headers from the Discord CDN, and this is not checked.

## Multiplayer rooms

### Data

```js
{
  _id: 'K7Q2-M9XD',               // room code, the same format as today
  version: 1,
  host: '<user id>',
  players: { blue: '<user id>' | null, red: '<user id>' | null },
  mapId: 'vibranium-heist',
  rosters: { blue: null | { code }, red: null | { code } },
  table: Binary,                  // Yjs snapshot, always set. See "Table on the server"
  tableRev: 0,                    // +1 on each table write
  createdAt, updatedAt,           // Date
  expiresAt,                      // Date: updatedAt + 12 months. TTL index
}
```

- The Lambda makes the room code. It inserts the room and tries a new code when the code exists already (at most 5 times).
- Indexes: unique `{ host: 1 }` (one hosted room per user), `{ 'players.blue': 1 }`, `{ 'players.red': 1 }`, and the TTL index on `expiresAt`. `GET /rooms` finds the rooms of a user with `$or` on both seats. It returns the 100 rooms changed last. The list leaves out `table` (projection), so the list stays small.
- A user who no longer exists keeps the seat. The answer shows `{ id, gone: true }`, and the UI shows "Deleted player". A room whose host no longer exists is deleted when it is read next time, and the route answers 404.
- Limits: the table is at most 1 MB. The roster `code` has 1 to 1000 characters. `mapId` matches `^[a-z0-9-]{1,64}$`. The server does not check that the map exists or that the roster code is valid.

### Rules

- Only a logged-in player can create or join a multiplayer room.
- The host creates the room with the map, a side, their own roster and the start table. The other seat is free.
- A user hosts at most one room. `POST /rooms` answers 409 "You host a multiplayer room already. Delete it first." when the user hosts one. A user can be the guest in any number of rooms.
- Anyone with the link sees the setup of the room: the map, the host's name and avatar, and the host's roster. Only a seated player gets the table.
- A logged-in player who opens the link of a room with a free seat sees the join page: the map card, the host, the host's roster (the same roster popup as on a lobby tile), a field for their own roster, and **Join**. The roster field is required. **Join** takes the free seat. A user who has a seat already gets 200 and no change, so a second click or a reload does no harm.
- A room with two players shows "This room has two players already" to a third user (409).
- After the join, both seats and both rosters are fixed. There is no **Leave**, no **Remove**, and no roster change. To change a player or a roster, the host deletes the room and creates a new one.
- Only the host can **Delete** the room. The guest sees the room in their list and can open it again, until the host deletes it.
- The guest finds out about a delete at their next table write, which gets 404. The browser then opens the lobby with "The host deleted room K7Q2-M9XD." and deletes its local copy. A guest who changes nothing stays on the table until the next write. In step 8, the host's browser tells the guest's browser at once over the peer-to-peer connection.
- The link is the secret, the same as in the peer-to-peer plan. A code has about 40 bits of randomness, so nobody can guess it.

### Rosters

- Each roster is its own key in the table (`rosters.blue`, `rosters.red`). Each browser writes only the key of its own seat. So the two players never write the same key.
- The host gives their roster at creation. It is in the start table and in the server record.
- The guest gives their roster to join. It goes into the server record. The first time the guest's browser opens the table, it writes the roster into the guest's key, when that key is empty. The setup does not restart, because a key that changes from empty to a roster does not change any card that the setup chose.
- The server record keeps a copy of both rosters for the lobby tile and the join page.
- A roster change in the room can come later, if players ask for it.

### Table on the server

The setup (map and rosters) is fixed when the room is created and when a player joins. The table changes during the game. The server keeps a snapshot of the table, so:

- a player who opens the room sees the table as it was last saved, also when the other player is not connected,
- a player can continue the game on another device.

How it works:

- The table is a Yjs document, saved in IndexedDB per room. The snapshot is this document as one Yjs update (`Y.encodeStateAsUpdate`). The body is `application/octet-stream`.
- **Start table:** the host's browser builds it at creation and sends it with `POST /rooms` (base64). So a room always has a table. Only the host's browser builds it, because each terrain piece gets a random id, and two start tables would merge into two sets of pieces.
- **Read:** when a seated player opens the room, the browser gets `GET /rooms/{code}/table` and applies it to the local document (`Y.applyUpdate`, origin `'server'`). Yjs merges it with the IndexedDB copy. A table of another schema gets a new start table. When the server does not answer, the room does not open: the lobby shows "Could not load room K7Q2-M9XD. Try again." For 403 and 404, the browser deletes its local copy. Then the peer-to-peer sync starts, if the other player is connected (step 8).
- **Write:** `PUT /rooms/{code}/table` with the full update.
  - The first change starts a 60-second timer. When it ends, the browser sends the write. A change during a write starts the next timer.
  - **← Lobby** and a hidden tab (`visibilitychange`) write at once when the table changed. The hidden write uses `keepalive` when the body is at most 60 KB (the limit for a page is 64 KB).
  - A failed write (no answer, 409, 5xx) keeps the change and tries again after 60 s.
  - 404 ends the room for this player (see Rules).
  - 403 or 413 stops the writer. The HUD shows "This table is no longer saved on the server: <error>" until the player closes it. The IndexedDB copy still saves.
  - At open, the browser compares the document with the server table (`Y.equalSnapshots`). If they differ, for example after a closed page, the browser writes at once. A state vector alone is not enough, because a delete does not change it.
  - There is no write on page close, because a table can pass 64 KB in a long game. The IndexedDB copy has the last changes.
  - When both players are connected (step 8), only the host writes, because both browsers have the same document.
- **Merge on the server:** the Lambda reads `table` and `tableRev`, merges the new update into it (`Y.mergeUpdates`), and writes with the filter `{ _id, tableRev }`. If the other player wrote in between, the filter finds no document. Then the Lambda reads again, merges again and writes once more. If that fails too, it answers 409 "The table changed. Try again." The browser tries again with its next write. So no change is lost, also when both players write at the same time.
- **Size:** the Lambda rejects a body above 1 MB (413). It also does not write a merged table above 1 MB (413). It logs the size of the body and of the merged table for each write. A table of 6 rounds is 22 KB, and of 18 rounds 34 KB (open question 5). Atlas M0 has 512 MB, so it holds a few thousand rooms.
- **Lambda:** a function URL sends a binary body as base64, and `@hono/aws-lambda` decodes it and encodes the `application/octet-stream` answer. `apps/api/test/lambda-binary.test.ts` tests both directions with a fake event. The real function URL is first used with a token in step 12.

### Endpoints

| Request | Login | Does |
|---|---|---|
| `POST /auth/discord` | no | `{ code, redirectUri }`. Login flow steps 5 and 6. Answers 200 `{ token, user }`, 400 bad body, 401 Discord rejected the code, 502 Discord failed, 503 Discord not configured (local only) |
| `GET /me` | yes | Answers 200 `{ user, token? }`, with a new token when the old one is more than 1 day old. 401: no token, bad token, or the user is gone |
| `DELETE /me` | yes | Deletes the user and the room that the user hosts, with its table. Answers 204. The user's guest seats keep the user id. See [Privacy](#privacy) |
| `GET /rooms` | yes | `{ rooms }`: the rooms where the user has a seat, the last changed first, at most 100, with both players' names and avatars. No table. 401 |
| `POST /rooms` | yes | `{ mapId, side, roster, table }`. `table` is base64. Answers 201 `{ room }`. 400 bad body or bad table, 409 the user hosts a room already, 413 table too large |
| `GET /rooms/{code}` | no | 200 `{ room }`: map, rosters, players' names and avatars, free seats. No table. 404 |
| `POST /rooms/{code}/join` | yes | `{ roster }`, required. Takes the free seat. 200 `{ room }`, also when the user has a seat already. 400 no roster, 409 no free seat, 404 |
| `GET /rooms/{code}/table` | yes, seat | 200, the table bytes. 403 no seat, 404 |
| `PUT /rooms/{code}/table` | yes, seat | The table bytes. Merges them into the stored table. 204. 400 not a Yjs update, 409 the merge lost twice, 413 too large, 403, 404. See [Table on the server](#table-on-the-server) |
| `DELETE /rooms/{code}` | yes, host | Deletes the room and its table. 204. 403 not the host, 404 |

A `room` in an answer is `{ code, host, players: { blue, red }, mapId, rosters: { blue, red }, createdAt, updatedAt }`. A player is `{ id, name, avatar, discordId }`, `{ id, gone: true }` when the user no longer exists, or `null` for a free seat. A room code that is not `XXXX-XXXX` (Crockford base32) answers 404. Errors are `{ error }`.

The signaling paths `/rooms/{code}/messages` of the peer-to-peer plan fit under the same `/rooms/{code}` prefix.

## Identity in peer-to-peer games

- Peer-to-peer games happen only in multiplayer rooms. So every signaling request (`hello`, `offer`, `answer`, `bye`, and the polls) sends the session token.
- The Lambda accepts signaling requests only from users with a seat in the room. To avoid an Atlas read on every 2-second poll, each Lambda instance keeps the seats of a room in memory for 30 seconds.
- The Lambda adds `user: { id, name, avatar, discordId }` to each message that it stores. It ignores a `user` field that the browser sends.
- The browser accepts an `offer` or an `answer` only when its `user` is the same as the `user` of the peer's `hello`.
- The SDP of the offer and the answer has the fingerprint of the sender's DTLS certificate. The browsers check this fingerprint when the data channels connect. So the data channels are connected to the user that the Lambda added to the offer or the answer.
- The player name comes from Discord. The typed player name of the peer-to-peer plan is not needed.
- When a browser opens a room code that is not a single player room of this browser, it asks `GET /rooms/{code}`. A multiplayer room opens the room (with a seat) or the join page (with a free seat). With no free seat, the lobby shows "This room has two players already.". An unknown code shows "Room K7Q2-M9XD not found.". With login off, no API call is made, and the lobby shows "Room K7Q2-M9XD is not in this browser.".

## Lobby and room UI

- **Header of the lobby:** **Log in with Discord** when logged out, with the line "Your opponent sees your Discord name and avatar." When logged in: avatar and name, with a menu: **Log out**, **Delete account**. A **Privacy** link in the footer.
- **Room list:** one list with the multiplayer rooms and the single player rooms, the last changed room first. The list loads from the server each time the lobby shows. A multiplayer tile shows the map card, the map name, the code, the last change, and each seat: avatar and name, "Free seat", or "Deleted player". A single player tile shows "Single player".
- **+ (new room):** with login off, the dialog makes a single player room, as today. With login on, the dialog has a choice at the top: **Single player** or **Multiplayer**.
  - When logged in, **Multiplayer** is the default. When logged out, it is disabled, with "Log in with Discord to play multiplayer". A dev build without `VITE_DISCORD_CLIENT_ID` says "Log in to play multiplayer".
  - **Multiplayer:** **Blue** or **Red** for the own side, and only the own roster field. It is required.
  - **Single player:** both roster fields, as today.
  - When the user hosts a room already, **Multiplayer** shows "You host room K7Q2-M9XD already. Delete it to create a new one." and **Create room** is disabled.
- **Tile buttons:** **Blue** and **Red** show the roster. **Delete** only for the host, with a browser confirm. **Copy link** while the guest seat is free.
- **Copy link:** copies `<origin>/#room=<code>`. The button shows "Link copied" or "Copy failed" for 2 s. It is in the lobby tile and in the toolbar of a multiplayer room, next to the room code. It disappears when the guest seat is taken. The toolbar knows the seats from the time the room opened, so if the guest joins while the host is in the room, the button stays until the room opens again.
- **Link of a multiplayer room when logged out:** the join page shows the setup of the room, with **Log in with Discord to join**. In a dev build without Discord, it says "Log in above to join". After login, the player comes back to the same link (`returnHash`).
- **Server not available:** the lobby shows the single player rooms and the message "Could not load your multiplayer rooms". **Multiplayer** in the dialog is disabled.
- **Room toolbar of a multiplayer room:** no map picker (the map is fixed) and no Roster group. The room code and **Copy link** show. The avatar and name of each player come in step 8.
- **Local copy:** the IndexedDB database of a multiplayer room is `mcp-assist-3d/multiplayer/<user id>/<code>`. Each time `GET /rooms` succeeds, the lobby deletes the databases of this user whose code is not in the list. So a room that the host deleted leaves no copy in the guest's browser. A browser without `indexedDB.databases()` skips this.

## Privacy

The Discord Developer Terms of Service (effective 2024-07-08, section 5) apply to all data that the app gets from Discord ("API Data"). Here, that is the Discord id, username, display name and avatar hash. The site is public, so the GDPR also applies. The terms require:

| Requirement (section) | How the app does it |
|---|---|
| A privacy policy that says what data the app collects, how it uses the data and shares it with Discord and third parties, and how a user can ask for deletion (5a) | The page `https://mcptacticus3d.netlify.app/#privacy` |
| A public link to the privacy policy in the Developer Portal, and easy to reach from the app (5a) | The Privacy Policy URL field of the Discord application. The **Privacy** link in the lobby footer |
| Share API Data only with service providers, when the law requires it, or when the user directs it (5b) | AWS and MongoDB Atlas are service providers. The opponent sees the name and avatar because the player joins a game with them. The lobby and the privacy page say this |
| Update the data when the user asks (5b) | Each login updates the name and the avatar |
| Delete the data promptly when the user asks, when it is not needed any more, when Discord asks, or when the app stops (5b). An easy way to ask for deletion | **Delete account**. The retention rules below. When the app stops, drop the `assist3d` database |
| Encryption at rest, and other safeguards (5c) | Atlas encrypts all cluster storage with AES-256 by default. SSM stores the secrets as `SecureString`, encrypted with the AWS managed key `aws/ssm` |
| Report unauthorized access to users (as the law requires) and to Discord (5c) | By hand, if it happens |
| Keep developer credentials secret. No credentials in open source projects (2) | The client secret only in `apps/api/.env` and `infra/.env` (git ignores both) and in SSM. The terms list the Application ID as a credential too, so the client id comes from a Netlify env var at build time, not from a file in git |

- **Delete account** asks with a browser confirm first. `DELETE /me` deletes the user, deletes the room that the user hosts with its table. The user's seat in other rooms stays, and the room shows "Deleted player". The browser deletes the token. The privacy page also says that the player can remove the app in Discord under Settings → Authorized Apps.
- **Retention:** a user with no login and no app start for 12 months is deleted by the TTL index (`expiresAt`). A room with no change for 12 months is deleted the same way, with its table. The seat rules in [Data](#data) handle rooms of deleted users.
- **Region:** Discord EU data that goes to a country outside the EEA with no adequacy decision falls under the standard contract clauses of section 11. The Lambda and the Atlas cluster are both in `eu-central-1` (backend doc), so the data stays in the EEA.
- Scope `identify` only. No email, no guilds, no friends list.
- Logs do not contain codes or tokens. CloudWatch keeps logs 1 week (backend doc).

## Security

- The Discord client id, the client secret and the session secret are SSM `SecureString` parameters. The Lambda reads them at cold start (backend doc, "Secrets and config"). They are not Lambda env vars, because CDK writes env var values in plain text into the template.
- The browser reads the client id from `VITE_DISCORD_CLIENT_ID`: a Netlify env var in production, `apps/web/.env.local` in dev.
- Discord accepts only the redirect URIs registered in the Developer Portal: `https://mcptacticus3d.netlify.app/` and `http://localhost:5173/`. So a Netlify deploy preview (another origin) cannot log in.
- CORS is set in the function URL config, for the origin `https://mcptacticus3d.netlify.app` only (backend doc, "McpTacticusApi"). In dev, Vite forwards `/api` to the local API, so there is no CORS.
- The Lambda checks every write against the seat rules. The browser hides buttons, but the Lambda decides.
- Same as the peer-to-peer plan: no protection against cheating inside a game.

## Site name

The site needs a fixed address before the Discord application gets its production redirect URI. No own domain for now.

- Rename the existing Netlify site to `mcptacticus3d`: Site configuration → General → Site details → **Change site name**. A new site is not needed. Check that the name is free.
- After the rename, the old `*.netlify.app` address returns 404. Netlify does not redirect it.
- `localStorage` belongs to one origin. So the single player rooms that were saved on the old address do not show on the new one.
- The rename happens in step 1 of the plan (`docs/plans/implement-backend.md`), so the address is final from the start. The lost single player rooms do not matter before the first release, because all data is test data.

## Discord application

Created once, by hand, in the Discord Developer Portal:

1. **New Application**. Use a name like the site (`mcptacticus3d`), because Discord shows the name on the consent screen.
2. **OAuth2 → Redirects:** `http://localhost:5173/` now, `https://mcptacticus3d.netlify.app/` in phase 4.
3. **Privacy Policy URL:** `https://mcptacticus3d.netlify.app/#privacy`, in phase 4.
4. Copy the client id to `VITE_DISCORD_CLIENT_ID` in `apps/web/.env.local`. Copy the client id and the client secret to `apps/api/.env` and `infra/.env`. Git ignores these files. `put-secrets` writes them to SSM (backend doc, "Secrets and config").
5. No bot user. No other scopes.

## Local testing

The rules of the peer-to-peer plan apply: everything works on one Mac, and each player is a different browser.

| Part | Production | Local |
|---|---|---|
| Auth and rooms endpoints | The Lambda | The same Hono app in a Node process, with the memory store. Vite forwards `/api/*` to it |
| Discord login | Discord, redirect `https://mcptacticus3d.netlify.app/` | The same Discord app, redirect `http://localhost:5173/`. Needs internet |
| Secrets | SSM | `apps/api/.env` (git ignores it). Only the API process reads it. The web app gets only `VITE_DISCORD_CLIENT_ID`, from `apps/web/.env.local` |
| `users`, `rooms` | Atlas, database `assist3d` | Memory store (default), or the dev Mongo in Docker (see below) |

**Dev login.** A two-browser test needs two users, and a tester usually has one Discord account. So the local API has `POST /auth/dev { name }`. It creates or reads the user `dev:<name>` and returns a normal session token. In dev builds, the lobby header shows a **Dev login** field next to **Log in with Discord**. The route is in `local.ts`, not in `app.ts`. The Lambda bundle has only the code that `lambda.ts` imports, so it does not contain the route. The field shows in every dev build, also when `VITE_DISCORD_CLIENT_ID` is not set. The **Log in with Discord** button shows only when it is set.

**Session secret.** Without `SESSION_SECRET` in `apps/api/.env`, the local API uses a fixed dev value and logs one line. `tsx watch` restarts the API after each code change, and a random key per start would log the testers out each time. The fixed value is only in `local.ts`.

**Multiplayer rooms.** A test needs two browsers with two dev logins, for example Chrome as `alice` and Firefox as `bob`. Alice creates a multiplayer room and copies the link. Bob opens it and joins. Each dev login is a different user, so the two browsers never share a session. The rooms are in the API store. With the memory store, a restart of the API deletes them. The dev Mongo keeps them.

**Dev Mongo.** With the memory store, a restart of the API empties the users. The browser token is still valid, but `GET /me` finds no user and answers 401, so the tester is logged out. To keep the users, run `pnpm --filter api db:up` (Mongo 8 in Docker, `apps/api/compose.yaml`, a named volume) and set `STORE=mongo` in `apps/api/.env`. `pnpm --filter api db:down` stops it and keeps the data. `docker compose down -v` in `apps/api` deletes the data.

## Cost

Assumptions of the peer-to-peer plan ("Use per game"): 2 players, a 2-hour game.

| Item | Use |
|---|---|
| Login | 1 Lambda request, 2 Discord calls, 1 Atlas write. About once per player per 30 days |
| `GET /me` | 1 Lambda request and 1 Atlas read per app start |
| Rooms | A few requests per game: list, create, join |
| Table writes | About 120 Lambda requests per game: one writer, once a minute. Each write reads and writes about 100 KB in Atlas |
| Signaling | The token check needs only CPU. The seats come from memory for 30 s |
| Storage | A user is about 200 bytes. A room is about 500 bytes plus its table |

With signaling (about 100 requests), a game uses about 220 Lambda requests. The 1,000,000 free requests per month are enough for about 4,500 games. The table writes move about 25 MB per game between the Lambda and Atlas. The Free cluster allows 10 GB out per 7 days, so this is about 400 games a week (backend doc, "Free cluster limits").

## Code layout

```
apps/web/src/api/
  client.js        base URL (VITE_API_URL), JSON, errors, the Authorization header
apps/web/src/auth/
  session.js       token in localStorage, login redirect, callback, logout
  oauth.js         authorize URL, callback check (pure functions)
  useUser.js       React hook: the current user or null
  avatar.js        Discord avatar URL
apps/web/src/rooms/
  serverStore.js   multiplayer rooms API: list, get, create, join, delete, table
  serverTable.js   the table writer (60 s timer, flush, retry) and hasLocalChanges
  roomPage.js      which page a room link opens
  roomList.js      one list of single player and multiplayer rooms
  startTable.js    the bytes of the start table
  base64.js        bytes to base64 and back
  localDocs.js     the IndexedDB names of multiplayer rooms and their cleanup
apps/web/src/components/
  UserMenu.jsx     login button, avatar, menu, dev login
  JoinRoom.jsx     the join page of a multiplayer room
  CopyLinkButton.jsx  Copy link
  RoomRosterPopup.jsx  the roster popup of a tile and of the join page
  Privacy.jsx      the privacy page
apps/api/src/
  auth/            token (sign and verify the session token), discord (the Discord client)
  routes/          auth (Discord code exchange), devAuth (local only), me, rooms (seat rules), table (merge), signal (step 8)
  rooms/           code (room code), table (Yjs checks and merge), read (room read, 404, host-gone cleanup)
  middleware/      user: checks the session token with hono/jwt. validate: body check
  stores/          users and rooms: memory and MongoDB. Rooms need `yjs`
  local.ts         the Node entry for dev. Also the dev login route
```

The rest of `apps/api` is in the backend doc ("Code"). Auth, rooms, the table and signaling are one API. New packages in `apps/api`: `yjs`. `hono/jwt` is part of `hono`.

## Phases

Each phase ends with a working app. Check with type checks, tests and `pnpm --filter web build`. The user checks the result in the browser.

The plan `docs/plans/implement-backend.md` gives the order of the phases and their steps. The API, the AWS parts and the deploy come first, in its steps 2 to 4. From step 3 on, each backend change is deployed when its step is done. Production shows no login until phase 4, because the web app shows the login button only when `VITE_DISCORD_CLIENT_ID` is set.

1. **Login.** Discord application with the localhost redirect. The users store (memory and MongoDB), `POST /auth/discord`, `GET /me`, `DELETE /me`, the dev login. Lobby header with login, avatar and menu.
2. **Multiplayer rooms.** After peer-to-peer phase 1, so the table is a Yjs document. Rooms store (memory and MongoDB, with indexes and TTL indexes) and endpoints, seats, the table snapshot, one room list in the lobby, the **Single player** or **Multiplayer** choice in the new room dialog, the join page, **Copy link**. Done in step 7.
3. **Identity in peer-to-peer.** Together with peer-to-peer phase 2. Token and seat check on signaling requests, `user` on messages, the offer and answer check, names and avatars in the room toolbar. Signaling only for multiplayer rooms.
4. **First release.** The production redirect URI and Privacy Policy URL, **Delete account**, the privacy page, and `VITE_DISCORD_CLIENT_ID` in Netlify. Delete account and the privacy page must be live before the first real player logs in. The site rename moved to step 1 of the plan, and the deploy to steps 3 and 4.

## Relation to other features

- `docs/feature-rooms.md`: the rooms there become single player rooms. They stay in `localStorage` and never connect. Two lines there change: "Peer-to-peer will add rooms that this browser joined" (now these are multiplayer rooms), and "the Red field will be only in the Sandbox" (single player rooms keep both roster fields).
- `docs/feature-peer-to-peer.md`: games happen only in multiplayer rooms, and both players are logged in. "No accounts" and the typed player name in "Room and players" go away. The host shares the link of a multiplayer room, not of a single player room ("Connect flow"). The signaling routes get the token and seat check. They are in the same API (`apps/api`, backend doc). The IndexedDB copy of the Yjs document stays, and the server snapshot comes in addition.

## Decisions

Made on 2026-10-08:

1. Login unlocks player identity in peer-to-peer games and multiplayer rooms. Rosters, settings and custom model uploads stay out of this plan.
2. Multiplayer play needs login. The Sandbox and single player rooms work without it.
3. Single player rooms stay in the browser. They are for trying maps and rosters, and they never move into an account.
4. Discord is the only provider.
5. Our own Lambda and Atlas do the auth. No Supabase, Firebase or Cognito.
6. Authorization code flow. The Lambda exchanges the code with the client secret.
7. Our own JWT in `localStorage`, sent as a Bearer token. No cookie.
8. Our own user id. The Discord id is a unique field.
9. The Discord access token is not stored.
10. The server keeps the setup and a snapshot of the table of each multiplayer room. A player who joins sees the map and the host's roster at once.
11. The site is `https://mcptacticus3d.netlify.app`: the existing Netlify site, renamed. No own domain.

Made on 2026-10-09 (step 7):

12. Three kinds of table: Sandbox, single player room, multiplayer room. "Offline room" and "online room" go away.
13. The host's browser builds the start table and sends it with `POST /rooms`. A room never has `table: null`.
14. Seats and rosters are fixed after the join. No leave, remove or roster change. Only the host deletes the room.
15. A user hosts one room at a time.
16. There is no Save game and no Load game. A single player room keeps its table in IndexedDB. A multiplayer room keeps it on the server, with a copy in IndexedDB.

## Open questions

1. **Localhost redirect.** Answered on 2026-10-09: Discord accepts `http://localhost:5173/`. The first save failed because the browser filled the field with the Discord email. Typed by hand, it saved.
2. **Session length.** 30 days, renewed once a day on app start. Fine?
3. **Retention.** 12 months for users with no login and rooms with no change. Fine?
4. **Region.** Answered in `docs/feature-backend.md`: the Atlas cluster and the Lambda are in `eu-central-1`.
5. **Table size.** Answered in step 5 (`docs/plans/implement-backend/05-yjs-state.md`, Phase 4 Result). `pnpm --filter web yjs-size` builds a full game with 12 characters, 30 terrain pieces, and many moves, damage and token changes, and prints the snapshot size.
   - 6 rounds: 21930 bytes, 2.1% of 1 MB. 18 rounds: 34363 bytes, 3.3%.
   - The snapshot grows about 1 KB per round. The JSON of the same table grows only 0.2 KB per round. The rest is the history of overwritten fields, which Yjs keeps.
   - The average update is about 70 bytes. A 6-round game has 804 updates.
   - The 1 MB limit is far away. The size does not limit the write interval of step 7. The interval can be chosen for other reasons: the number of Lambda requests, the Atlas transfer, and how much of a game a player can lose.

## Out of scope

- Email login, Google and other providers.
- Rosters, settings and the player name on the server.
- Custom model uploads (`docs/feature-custom-models.md`). They need file storage per user.
- Discord friends list, Discord Social SDK, rich presence.
- The app as a Discord Activity inside a voice channel. Discord's Embedded App SDK has its own login with the same code exchange. Not checked: whether WebRTC works inside an Activity.
- Spectator seats.
- An admin page.

## Sources

- [Discord Developer Terms of Service](https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service), effective 2024-07-08: section 5 (privacy policy, sharing, deletion, encryption at rest), section 2 (credentials), section 11 (EEA transfers). Read on 2026-10-08 through the help center API, because the page returns 403 to scripts.
- [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2): authorization code and implicit grant; token endpoint needs the client secret; no PKCE in the docs; `prompt=none`; `expires_in` 604800 in the examples.
- [Discord image formatting](https://docs.discord.com/developers/reference): avatar URL, default avatar index `(user_id >> 22) % 6`, sizes 16–4096.
- [Amazon Cognito pricing](https://aws.amazon.com/cognito/pricing/): 10,000 free MAU for direct and social sign-in; 50 free MAU for SAML and OIDC federation.
- [Discord OIDC wrapper (community)](https://github.com/Erisa/discord-oidc-worker): shows that Discord has no own OIDC endpoints for login.
- [Supabase free tier limits 2026 (third party)](https://automationatlas.io/answers/supabase-free-tier-limits-2026/) and [Supabase pricing guide 2026](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/): 50,000 MAU; pause after one week with no activity. Not checked on the Supabase site.
- [Netlify rewrites and proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/) and [forum: lost cookies in proxy redirect](https://answers.netlify.com/t/lost-cookies-in-proxy-redirect/8163): cookies through a proxy rule.
- [Netlify forum: site URL broken after rename](https://answers.netlify.com/t/website-url-broken-after-changing-sites-randomly-generated-netlify-name/81839): the old `netlify.app` name returns 404 after a rename.
- [Atlas encryption at rest](https://www.mongodb.com/docs/atlas/security-encryption-at-rest-overview/): all cluster storage encrypted with AES-256 by default, cannot be turned off. The page does not name M0 directly.
