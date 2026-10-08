# Feature: Login with Discord

Status: plan. Not started. See [Open questions](#open-questions) at the end.

## Goal

A player can log in with their Discord account. Online play needs login. The Sandbox and offline rooms work without login, as today.

Login adds two things:

1. **Player identity in peer-to-peer games.** The opponent sees your Discord name and avatar. The server checks the name, so a player cannot pretend to be someone else.
2. **Online rooms.** A logged-in player creates a room on the server. The room has the map, the rosters, two seats and the table. So both players see the same room on every device, also when the other player is not connected. Only the owner can delete the room.

In TTS, the Steam account gives each player a name and an avatar. Here, the Discord account does the same. Most MCP players have a Discord account already.

## Summary

| Part | Choice |
|---|---|
| Provider | Discord only, scope `identify`. No email |
| Flow | OAuth2 authorization code. The browser goes to Discord and comes back with a code. The Lambda exchanges the code with the client secret |
| Backend | The Lambda and the `assist3d` database of the peer-to-peer plan (`docs/feature-peer-to-peer.md`). No new vendor |
| Session | Our own signed token (JWT), 30 days. Kept in `localStorage`, sent in the `Authorization` header |
| Users | Collection `users`. Our own user id, the Discord id is a unique field |
| Rooms | Collection `rooms`: setup, owner, two seats, and a snapshot of the table (Yjs) |
| Offline rooms | Stay in `localStorage`, as today. They never connect to another player |
| Site | `https://mcptacticus.netlify.app` |
| Cost | $0. See [Cost](#cost) |

## Terms

| Term | Meaning |
|---|---|
| Offline room | A room in `localStorage` of one browser: the rooms of today (`docs/feature-rooms.md`). For trying maps and rosters. It never connects to another player |
| Online room | A room in the `rooms` collection. Only a logged-in player can create or join one. Peer-to-peer games happen only in online rooms |
| Seat | The Blue or the Red player of an online room. A seat holds a user id or is free |
| Session token | The token that our Lambda gives after login. It proves the user id to the Lambda |

## Options that were checked

| Option | Result |
|---|---|
| **Own code in our Lambda** | Chosen. About 150 lines. The Lambda, the database and the deploy exist already for signaling |
| Supabase Auth | Supports Discord with no code. 50,000 MAU free. But a free project pauses after 7 days with no requests, and someone must restore it by hand in the dashboard. A hobby app can have a week with no players. It is also a second backend next to the signaling Lambda |
| Firebase Auth | Has no Discord provider. Our Lambda would make a Firebase custom token with the Admin SDK. The Lambda can run the Admin SDK, so the Blaze plan is not needed. But Firebase then only adds a second vendor and gives nothing that our own token does not give |
| Amazon Cognito | Has no Discord provider. Discord would be a custom OIDC provider. Cognito gives only 50 free MAU per month to OIDC users (10,000 only to direct and social sign-ins). Discord also has no standard OIDC endpoints, so it needs a wrapper |

## Login flow

Discord's OAuth2 docs say that the token endpoint needs the client secret. They do not describe PKCE. So the browser cannot exchange the code itself, and the exchange runs in the Lambda.

1. The player presses **Log in with Discord**. The browser makes a random `state` and saves `{ state, returnHash }` in `sessionStorage`. `returnHash` is the page the player was on, for example `#room=K7Q2-M9XD`.
2. The browser goes to `https://discord.com/oauth2/authorize` with `response_type=code`, `client_id`, `scope=identify`, `redirect_uri=<origin>/`, `state` and `prompt=none`. With `prompt=none`, Discord skips the consent screen when the player approved the app before.
3. Discord sends the browser to `<origin>/?code=...&state=...`. When the player says no, it sends `?error=access_denied&state=...`.
4. `Root.jsx` reads the query before the hash. It checks that `state` is the saved one, and removes the query from the address bar (`history.replaceState`). It posts the code to `POST /auth/discord`.
5. The Lambda posts the code, the client id, the client secret and the redirect URI to `https://discord.com/api/oauth2/token`. It gets a Discord access token. It reads `GET https://discord.com/api/users/@me` with that token.
6. The Lambda creates or updates the user in `users` (key: Discord id). It signs a session token and returns `{ token, user }`. It does not store the Discord access token, because the app makes no other Discord calls.
7. The browser saves the token and opens `returnHash`.

The `state` check stops a login that another site started (login CSRF).

Next to the login button, the lobby says: "Your opponent sees your Discord name and avatar." The privacy page says the same. See [Privacy](#privacy).

## Session

- The session token is a JWT signed with HS256 (`jose` package). The key is the Lambda env var `SESSION_SECRET`. Claims: `sub` (our user id), `iat`, `exp` (30 days).
- The browser keeps it in `localStorage` (`mcp-assist-3d/session`) and sends `Authorization: Bearer <token>`.
- On app start, the browser calls `GET /me`. The answer has the user, and a new token when the old one is more than 1 day old. So a player who opens the app at least once in 30 days stays logged in.
- The Lambda checks the signature and `exp`, then reads the user by `_id`. A deleted user gets 401, and the browser logs out.
- **Log out** deletes the token in the browser. There is no server call. A copied token stays valid until `exp`.
- A new `SESSION_SECRET` logs out every player at once. Use it if the key leaks.

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
  expiresAt,                         // Date: lastLoginAt + 12 months. TTL index
}
```

- Every login updates `username`, `name` and `avatar`. So a changed Discord name shows at the next login. This is also how a player updates their data, which the Discord terms require.
- Our own `_id` keeps Discord out of the other collections. A second provider later adds a field, not a migration.
- Avatar URL: `https://cdn.discordapp.com/avatars/<discordId>/<avatar>.png?size=64`. With no avatar: `https://cdn.discordapp.com/embed/avatars/<index>.png`, with `index = (discordId >> 22) % 6` (`BigInt`, because the id has more than 53 bits).
- The avatar shows only in HTML (`<img>`). It does not go into a 3D texture, because that needs CORS headers from the Discord CDN, and this is not checked.

## Online rooms

### Data

```js
{
  _id: 'K7Q2-M9XD',               // room code, the same format as today
  version: 1,
  owner: '<user id>',
  players: { blue: '<user id>' | null, red: '<user id>' | null },
  mapId: 'vibranium-heist',
  rosters: { blue: null | { code }, red: null | { code } },
  table: null | Binary,           // Yjs snapshot, see "Table on the server"
  tableRev: 0,                    // +1 on each table write
  createdAt, updatedAt,           // Date
  expiresAt,                      // Date: updatedAt + 12 months. TTL index
}
```

- The Lambda makes the room code. It inserts the room and tries a new code when the code exists already.
- Indexes: `{ 'players.blue': 1 }` and `{ 'players.red': 1 }`. `GET /rooms` finds the rooms of a user with `$or` on both. The list leaves out `table` (projection), so the list stays small.
- Each player sets only the roster of their own seat. `docs/feature-rooms.md` planned this already: "With a server, each player will load their own roster when they join."
- A seat whose user no longer exists counts as free. A room whose owner no longer exists is deleted when it is read next time.

### Rules

- Only a logged-in player can create or join an online room.
- The owner creates the room with the map, a side and their own roster. The other seat is free.
- Anyone with the link sees the setup of the room: the map, the owner's name and avatar, and the owner's roster. Only a seated player gets the table.
- A logged-in player who opens the link of a room with a free seat sees the join page: the map card, the owner, the owner's roster (the same roster popup as on a lobby tile), a field for their own roster, and **Join**. **Join** takes the free seat. The roster field is optional, because the Red field of the toolbar can load it later.
- A room with two players shows "This room has two players already" to a third user.
- A player who is not the owner can **Leave**. The seat becomes free, and the room leaves their list.
- The owner can **Remove** the other player, for example when the wrong person took the seat. The seat becomes free.
- Only the owner can **Delete** the room.
- The link is the secret, the same as in the peer-to-peer plan. A code has about 40 bits of randomness, so nobody can guess it.

### Table on the server

The setup (map and rosters) is fixed when the room is created and when a player joins. The table changes during the game. The server keeps a snapshot of the table, so:

- a player who opens the room sees the table as it was last saved, also when the other player is not connected,
- a player can continue the game on another device.

How it works:

- After phase 1 of the peer-to-peer plan, the table is a Yjs document, saved in IndexedDB per room. The snapshot is this document as one Yjs update (`Y.encodeStateAsUpdate`).
- **Read:** when a seated player opens the room, the browser gets `GET /rooms/{code}/table` and applies it to the local document (`Y.applyUpdate`). Yjs merges it with the IndexedDB copy. Then the peer-to-peer sync starts, if the other player is connected.
- **Write:** `PUT /rooms/{code}/table` with the full update, every 60 s when the document changed, on **← Lobby**, and when the tab becomes hidden (`visibilitychange`). When both players are connected, only the owner writes, because both browsers have the same document.
- **Merge on the server:** the Lambda reads `table` and `tableRev`, merges the new update into it (`Y.mergeUpdates`), and writes with the filter `{ _id, tableRev }`. If the other player wrote in between, the filter finds no document. Then the Lambda reads again and merges again, one time. So no change is lost, also when both players write at the same time.
- **Page close:** a `fetch` with `keepalive` allows at most 64 KB of body, and a table is bigger. So the browser does not write on page close. The IndexedDB copy has the last changes. The next time the room opens on that device, the merged document goes to the server with the next write.
- **Size:** the Lambda rejects a snapshot above 1 MB (413) and logs the size of each write. A table is probably 50–200 KB. This is not measured yet. Atlas M0 has 512 MB, so it holds a few thousand rooms.
- A new room has `table: null`. The browser builds the start table from the setup, as an offline room does today (`src/rooms/table.js`).

### Endpoints

| Request | Login | Does |
|---|---|---|
| `POST /auth/discord` | no | `{ code, redirectUri }`. Login flow steps 5 and 6. Returns `{ token, user }` |
| `GET /me` | yes | Returns the user, and a new token when the old one is more than 1 day old |
| `DELETE /me` | yes | Deletes the account. See [Privacy](#privacy) |
| `GET /rooms` | yes | The rooms where the user has a seat, with both players' names and avatars. No table |
| `POST /rooms` | yes | `{ mapId, side, roster }`. Creates a room |
| `GET /rooms/{code}` | no | The setup: map, rosters, players' names and avatars, free seats. No table |
| `GET /rooms/{code}/table` | yes, seat | The table snapshot |
| `PUT /rooms/{code}/table` | yes, seat | Merges a table snapshot. See [Table on the server](#table-on-the-server) |
| `PATCH /rooms/{code}` | yes, seat | Changes the roster of the own seat |
| `POST /rooms/{code}/join` | yes | `{ roster }`. Takes the free seat |
| `POST /rooms/{code}/leave` | yes, seat | Frees the own seat. The owner cannot leave, only delete |
| `POST /rooms/{code}/remove` | yes, owner | Frees the other seat |
| `DELETE /rooms/{code}` | yes, owner | Deletes the room and its table |

The signaling paths `/rooms/{code}/messages` of the peer-to-peer plan fit under the same `/rooms/{code}` prefix.

## Identity in peer-to-peer games

- Peer-to-peer games happen only in online rooms. So every signaling request (`hello`, `offer`, `answer`, `bye`, and the polls) sends the session token.
- The Lambda accepts signaling requests only from users with a seat in the room. To avoid an Atlas read on every 2-second poll, each Lambda instance keeps the seats of a room in memory for 30 seconds.
- The Lambda adds `user: { id, name, avatar, discordId }` to each message that it stores. It ignores a `user` field that the browser sends.
- The browser accepts an `offer` or an `answer` only when its `user` is the same as the `user` of the peer's `hello`.
- The SDP of the offer and the answer has the fingerprint of the sender's DTLS certificate. The browsers check this fingerprint when the data channels connect. So the data channels are connected to the user that the Lambda added to the offer or the answer.
- The player name comes from Discord. The typed player name of the peer-to-peer plan is not needed.
- When a browser opens a room code that is not an offline room of this browser, it asks `GET /rooms/{code}`. An online room opens the room (with a seat) or the join page (without a seat). Otherwise the page says "Room K7Q2-M9XD not found".

## Lobby and room UI

- **Header of the lobby:** **Log in with Discord** when logged out, with the line "Your opponent sees your Discord name and avatar." When logged in: avatar and name, with a menu: **Log out**, **Delete account**. A **Privacy** link in the footer.
- **Room list:** one list with the online rooms and the offline rooms, the last changed room first. An online room tile shows the avatar and name of each seat. An offline room tile shows "Offline".
- **+ (new room):** the dialog has an **Online** switch at the top. When logged in, it is on by default. When logged out, it is off and cannot be changed, with the text "Log in with Discord to play online".
  - Online: **Blue** or **Red** for the own side, and only the own roster field.
  - Offline: both roster fields, as today.
- **Tile buttons:** **Delete** for the owner, **Leave** for the other player of an online room.
- **Link of an online room when logged out:** the page shows the setup of the room, with "Log in with Discord to join". After login, the player comes back to the same link (`returnHash`).
- **Server not available:** the lobby shows the offline rooms and the message "Could not load your online rooms".
- **Room toolbar:** the avatar and name of each player, next to the room code.

## Privacy

The Discord Developer Terms of Service (effective 2024-07-08, section 5) apply to all data that the app gets from Discord ("API Data"). Here, that is the Discord id, username, display name and avatar hash. The site is public, so the GDPR also applies. The terms require:

| Requirement (section) | How the app does it |
|---|---|
| A privacy policy that says what data the app collects, how it uses the data and shares it with Discord and third parties, and how a user can ask for deletion (5a) | The page `https://mcptacticus.netlify.app/#privacy` |
| A public link to the privacy policy in the Developer Portal, and easy to reach from the app (5a) | The Privacy Policy URL field of the Discord application. The **Privacy** link in the lobby footer |
| Share API Data only with service providers, when the law requires it, or when the user directs it (5b) | AWS and MongoDB Atlas are service providers. The opponent sees the name and avatar because the player joins a game with them. The lobby and the privacy page say this |
| Update the data when the user asks (5b) | Each login updates the name and the avatar |
| Delete the data promptly when the user asks, when it is not needed any more, when Discord asks, or when the app stops (5b). An easy way to ask for deletion | **Delete account**. The retention rules below. When the app stops, drop the `assist3d` database |
| Encryption at rest, and other safeguards (5c) | Atlas encrypts all cluster storage with AES-256 by default. Lambda encrypts its env vars with an AWS managed key by default |
| Report unauthorized access to users (as the law requires) and to Discord (5c) | By hand, if it happens |
| Keep developer credentials secret. No credentials in open source projects (2) | The client secret only in `.env` (git ignores it) and in Lambda env vars. The terms list the Application ID as a credential too, so the client id comes from a Netlify env var at build time, not from a file in git |

- **Delete account** asks with a browser confirm first. `DELETE /me` deletes the user, deletes the rooms that the user owns with their tables, and frees the user's seat in other rooms. The browser deletes the token. The privacy page also says that the player can remove the app in Discord under Settings → Authorized Apps.
- **Retention:** a user with no login for 12 months is deleted by the TTL index (`expiresAt`). A room with no change for 12 months is deleted the same way, with its table. The seat rules in [Data](#data) handle rooms of deleted users.
- **Region:** Discord EU data that goes to a country outside the EEA with no adequacy decision falls under the standard contract clauses of section 11. The Lambda and the Atlas cluster in an EU region avoid this. The Atlas region is still open in the peer-to-peer plan (open question 5).
- Scope `identify` only. No email, no guilds, no friends list.
- Logs do not contain codes or tokens. CloudWatch keeps logs 7 days (peer-to-peer plan).

## Security

- `DISCORD_CLIENT_SECRET` and `SESSION_SECRET` are Lambda env vars, passed by `sam deploy` as `NoEcho` parameters from a local `.env`, the same as `MONGODB_URI` in the peer-to-peer plan.
- The browser reads the client id from `VITE_DISCORD_CLIENT_ID`: a Netlify env var in production, `.env.local` in dev.
- Discord accepts only the redirect URIs registered in the Developer Portal: `https://mcptacticus.netlify.app/` and `http://localhost:5173/`. So a Netlify deploy preview (another origin) cannot log in.
- CORS of the function URL allows the `Authorization` and `Content-Type` headers, from `https://mcptacticus.netlify.app` and `http://localhost:5173` only.
- The Lambda checks every write against the seat rules. The browser hides buttons, but the Lambda decides.
- Same as the peer-to-peer plan: no protection against cheating inside a game.

## Site name

The site needs a fixed address before the Discord application gets its production redirect URI. No own domain for now.

- Rename the existing Netlify site to `mcptacticus`: Site configuration → General → Site details → **Change site name**. A new site is not needed. Check that the name is free.
- After the rename, the old `*.netlify.app` address returns 404. Netlify does not redirect it.
- `localStorage` belongs to one origin. So the offline rooms that were saved on the old address do not show on the new one.
- Rename before phase 4. Phases 1 to 3 use only `http://localhost:5173/`.

## Discord application

Created once, by hand, in the Discord Developer Portal:

1. **New Application**. Use a name like the site (`mcptacticus`), because Discord shows the name on the consent screen.
2. **OAuth2 → Redirects:** `http://localhost:5173/` now, `https://mcptacticus.netlify.app/` in phase 4.
3. **Privacy Policy URL:** `https://mcptacticus.netlify.app/#privacy`, in phase 4.
4. Copy the client id to `VITE_DISCORD_CLIENT_ID`, and the client secret to `.env`. Git ignores both files.
5. No bot user. No other scopes.

## Local testing

The rules of the peer-to-peer plan apply: everything works on one Mac, and each player is a different browser.

| Part | Production | Local |
|---|---|---|
| Auth and rooms endpoints | The Lambda | The same handler in the Vite dev server, with the in-memory store |
| Discord login | Discord, redirect `https://mcptacticus.netlify.app/` | The same Discord app, redirect `http://localhost:5173/`. Needs internet |
| Secrets | Lambda env vars | `.env.local` (git ignores it). Vite gives only `VITE_` vars to the browser, so the secrets stay in the dev server |
| `users`, `rooms` | Atlas, database `assist3d` | In-memory store. `mongo` in Docker to test the MongoDB store |

**Dev login.** A two-browser test needs two users, and a tester usually has one Discord account. So the dev server has `POST /auth/dev { name }`. It creates or reads the user `dev:<name>` and returns a normal session token. In dev builds, the lobby header shows a **Dev login** field next to **Log in with Discord**. The route is in `vitePlugin.mjs`, not in `handler.mjs`, so the Lambda bundle does not contain it.

## Cost

Assumptions of the peer-to-peer plan ("Use per game"): 2 players, a 2-hour game.

| Item | Use |
|---|---|
| Login | 1 Lambda request, 2 Discord calls, 1 Atlas write. About once per player per 30 days |
| `GET /me` | 1 Lambda request and 1 Atlas read per app start |
| Rooms | A few requests per game: list, create, join, roster |
| Table writes | About 120 Lambda requests per game: one writer, once a minute. Each write reads and writes about 100 KB in Atlas |
| Signaling | The token check needs only CPU. The seats come from memory for 30 s |
| Storage | A user is about 200 bytes. A room is about 500 bytes plus its table |

With signaling (about 100 requests), a game uses about 220 Lambda requests. The 1,000,000 free requests per month are enough for about 4,500 games. The table writes move about 25 MB per game between the Lambda and Atlas. Check this against the network limits of the cluster tier (peer-to-peer plan, open question 5).

## Code layout

```
src/auth/
  session.js       token in localStorage, login redirect, callback, logout, fetch with Authorization
  useUser.js       React hook: the current user or null
  avatar.js        Discord avatar URL
src/rooms/
  serverStore.js   online rooms API: list, create, join, leave, remove, delete, roster
  serverTable.js   read and write the table snapshot
src/components/
  UserMenu.jsx     login button, avatar, menu, dev login
  JoinRoom.jsx     the join page of an online room
  Privacy.jsx      the privacy page
infra/api/          (named infra/signal/ in the peer-to-peer plan)
  handler.mjs      routes: auth, me, rooms, table, signaling
  auth.mjs         Discord code exchange, JWT sign and verify
  users.mjs        users store: memory and MongoDB
  rooms.mjs        rooms store, seat rules, table merge
  vitePlugin.mjs   runs the handler in the dev server. Also the dev login route
```

The peer-to-peer plan names the folder `infra/signal/`. With auth and rooms, it is one API, so `infra/api/` is a better name. New packages in the Lambda: `jose`, `yjs`.

## Phases

Each phase ends with a working app. Check with `npx vite build`. The user checks the result in the browser.

1. **Login in dev.** Discord application with the localhost redirect. `auth.mjs`, the users store in memory, `POST /auth/discord`, `GET /me`, the dev login. Lobby header with login, avatar and menu. Needs the handler and the Vite plugin of peer-to-peer phase 2. If auth starts first, this phase adds them.
2. **Online rooms.** After peer-to-peer phase 1, so the table is a Yjs document. Rooms store and endpoints, seats, the table snapshot, one room list in the lobby, the **Online** switch in the new room dialog, the join page.
3. **Identity in peer-to-peer.** After peer-to-peer phase 2. Token and seat check on signaling requests, `user` on messages, the offer and answer check, names and avatars in the room toolbar. Signaling only for online rooms.
4. **Deploy.** With peer-to-peer phase 5. Rename the Netlify site. MongoDB stores for `users` and `rooms` (tested first against local `mongo`), indexes and TTL indexes, the production redirect URI and Privacy Policy URL, the secrets in the SAM template, **Delete account**, the privacy page. Delete account and the privacy page must be live before the first real player logs in.

## Relation to other features

- `docs/feature-rooms.md`: the rooms there become offline rooms. They stay in `localStorage` and never connect. Two lines there change: "Peer-to-peer will add rooms that this browser joined" (now these are online rooms), and "the Red field will be only in the Sandbox" (offline rooms keep both roster fields).
- `docs/feature-peer-to-peer.md`: games happen only in online rooms, and both players are logged in. "No accounts" and the typed player name in "Room and players" go away. The host shares the link of an online room, not of an offline room ("Connect flow"). The signaling handler gets the token and seat check. The folder name changes to `infra/api/`. The IndexedDB copy of the Yjs document stays, and the server snapshot comes in addition.

## Decisions

Made on 2026-10-08:

1. Login unlocks player identity in peer-to-peer games and online rooms. Rosters, settings and custom model uploads stay out of this plan.
2. Online play needs login. The Sandbox and offline rooms work without it.
3. Offline rooms stay offline. They are for trying maps and rosters, and they never move into an account.
4. Discord is the only provider.
5. Our own Lambda and Atlas do the auth. No Supabase, Firebase or Cognito.
6. Authorization code flow. The Lambda exchanges the code with the client secret.
7. Our own JWT in `localStorage`, sent as a Bearer token. No cookie.
8. Our own user id. The Discord id is a unique field.
9. The Discord access token is not stored.
10. The server keeps the setup and a snapshot of the table of each online room. A player who joins sees the map and the host's roster at once.
11. The site is `https://mcptacticus.netlify.app`: the existing Netlify site, renamed. No own domain.

## Open questions

1. **Localhost redirect.** Does Discord accept `http://localhost:5173/` as a redirect URI? Guides say yes. Check when the application is created.
2. **Session length.** 30 days, renewed once a day on app start. Fine?
3. **Retention.** 12 months for users with no login and rooms with no change. Fine?
4. **Region.** Is the Atlas cluster in an EU region? If not, put the `assist3d` data in a new free cluster in an EU region, or accept the section 11 clauses.
5. **Table size.** Measure the snapshot size of a full game in peer-to-peer phase 1. Then check the 1 MB limit and the write interval.

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
