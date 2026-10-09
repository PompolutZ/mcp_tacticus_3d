# Step 6: Login

Detailed plan of step 6 in `docs/plans/implement-backend.md`. The design is in `docs/feature-auth.md` ("Login flow", "Session", "Users", "Security", "Discord application", "Local testing", "Code layout", "Phases" 1) and `docs/feature-backend.md` ("API", "Secrets and config", "Local development").

## Goal

A player can log in with Discord in local dev. Two testers on one Mac can log in as two users with the dev login. The API with the auth routes is deployed. Production shows no login, because Netlify has no `VITE_DISCORD_CLIENT_ID`.

Step 7 (online rooms) needs a logged-in user for every room route. So login comes first. The routes of step 7 use the user middleware of this step.

## Scope

In the step:
- `apps/api`: the users store (memory and Mongo), the session token, the user middleware, `POST /auth/discord`, `GET /me`, `DELETE /me`, the dev login `POST /auth/dev` in `local.ts`, the config from SSM and from `.env`. Tests. Discord is mocked.
- `apps/web`: the API client, the session (login redirect, callback, token, logout), `useUser`, the avatar URL, `UserMenu.jsx` in the lobby header, the dev login field.
- `.gitignore`: `.env.local`.
- Docs: auth doc, backend doc, the backend plan, `README.md`, `infra/README.md`.

Left for later steps:
- **Delete account** in the user menu, and the privacy page: step 12. The route `DELETE /me` comes now. Step 7 adds the rooms part of it (delete own rooms, free seats).
- The login button outside the lobby (join page): step 7.
- Names and avatars in the room toolbar: step 8.
- The production redirect URI and `VITE_DISCORD_CLIENT_ID` in Netlify: step 12.

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 6"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server. The user checks the app.
- Do not run `aws`, `cdk deploy` or `put-secrets`. `cdk synth` is fine.
- Do not call Discord. Tests mock it.
- Do not commit and do not push. The main model commits each finished phase.
- Temporary files go in the session's scratchpad directory.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: TypeScript, strict, in `apps/api`. Plain JavaScript in `apps/web`. Plain, short comments that say why. Match the style of the code around you.
- Never log a code, a token, a secret or the `Authorization` header.
- After a code change: `pnpm format` and `pnpm lint`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| New API dependencies | `zod` (used as `zod/mini`, decision 17), `@hono/zod-validator` (the latest versions whose peer ranges fit Hono 4) |
| Dev Mongo | `apps/api/compose.yaml`, scripts `db:up`, `db:down` (decision 16) |
| Routes | `POST /auth/discord`, `GET /me`, `DELETE /me`. Local only: `POST /auth/dev` |
| Session token | JWT, HS256, `hono/jwt`. Claims `sub` (user id), `iat`, `exp` = `iat` + 30 days |
| Token renewal | `GET /me` returns a new token when `iat` is more than 1 day old |
| User id | `u_` + 16 base64url characters (12 random bytes) |
| User expiry | `expiresAt` = 12 months after the last login or token renewal (decision 6) |
| Dev user | `discordId: 'dev:<name>'`, `username` and `name` = `<name>`, `avatar: null` |
| API env (local) | `SESSION_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` in `apps/api/.env`. Without `SESSION_SECRET`: the fixed value `dev-session-secret-local-only` |
| SSM (Lambda) | `session-secret`, `discord-client-id`, `discord-client-secret` under `/mcptacticus/prod/` |
| Web env | `VITE_DISCORD_CLIENT_ID` in `apps/web/.env.local` (git ignores it) |
| Token in the browser | `localStorage` key `mcp-assist-3d/session` |
| Login state | `sessionStorage` key `mcp-assist-3d/login`: `{ state, returnHash }` |
| Discord URLs | Authorize `https://discord.com/oauth2/authorize`. Token `https://discord.com/api/v10/oauth2/token`. User `https://discord.com/api/v10/users/@me` |

API answers:

| Request | Body | Answer |
|---|---|---|
| `POST /auth/discord` | `{ code, redirectUri }` | 200 `{ token, user }`. 400 bad body. 401 Discord rejected the code. 502 Discord failed. 503 Discord not configured (local only) |
| `GET /me` | | 200 `{ user, token? }`. 401 no token, bad token, or the user is gone |
| `DELETE /me` | | 204. 401 as above |
| `POST /auth/dev` | `{ name }` | 200 `{ token, user }`. 400 bad name |

`user` in an answer is `{ id, discordId, username, name, avatar }`. Errors are `{ error }` (step 2).

Files:

```
.gitignore                     + .env.local, .env.*.local
apps/api/
  .env.example                 + SESSION_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
  package.json                 + zod, @hono/zod-validator
  src/
    app.ts                     Deps + discord. Routes auth and me
    config.ts                  Config + sessionSecret, discord. configFromEnv, configFromSsm
    lambda.ts                  config from SSM, Discord client
    local.ts                   dev session secret, Discord client, dev login route
    auth/
      token.ts                 signSession, verifySession
      discord.ts               createDiscordClient(discord, fetch): exchangeCode, getProfile
    middleware/
      user.ts                  requireUser: Bearer token → c.var.user
      validate.ts              zod body check with the { error } answer
    routes/
      auth.ts                  POST /auth/discord
      me.ts                    GET /me, DELETE /me
      devAuth.ts               POST /auth/dev. Only local.ts imports it
    stores/
      store.ts                 + UsersStore, UserDoc, publicUser
      memory.ts                + users
      mongo.ts                 + users, indexes
  test/
    token.test.ts, me.test.ts, auth.test.ts, dev-auth.test.ts, discord.test.ts
    config.test.ts             + configFromEnv, configFromSsm
    users.mongo.test.ts        the Mongo users store
apps/web/
  .env.development             + comment: VITE_DISCORD_CLIENT_ID goes in .env.local
  src/
    api/client.js              base URL, JSON, ApiError, token header, 401 handler
    auth/
      oauth.js                 authorizeUrl, readCallback, randomState. No browser globals
      oauth.test.js
      avatar.js                avatarUrl(user, size)
      avatar.test.js
      session.js               the session store: start, login, dev login, logout, subscribe
      useUser.js               useSyncExternalStore over the session
    components/
      UserMenu.jsx             login button, avatar, name, menu with Log out, dev login
      Lobby.jsx                UserMenu in the header
    Root.jsx                   starts the session, opens returnHash, login error → notice
    index.css                  user menu styles
```

## Decisions that fill gaps in the design

1. **Store shape.** `Store` gets a `users` field of type `UsersStore`. Step 7 adds `rooms` the same way. `UsersStore`:
   - `upsertDiscord(profile, now)`: finds the user by `discordId`. Creates it with a new id, or updates `username`, `name`, `avatar`, `lastLoginAt`, `expiresAt`. Returns the user. One `findOneAndUpdate` with `upsert` in Mongo, with `$setOnInsert` for `_id` and `createdAt`.
   - `get(id)`: the user or `null`.
   - `touch(id, now)`: sets `expiresAt` (decision 6).
   - `delete(id)`.
   The dev login uses `upsertDiscord` with the dev profile.
2. **Mongo indexes.** `users`: unique `{ discordId: 1 }`, TTL `{ expiresAt: 1 }` with `expireAfterSeconds: 0`. The Mongo store creates them once, before the first users call, with one shared promise. A failure clears the promise, so the next call tries again. Reason: `/health` must still answer 503 (not crash) when Atlas is down at cold start. The design says "indexes created at cold start". This is the same, but lazy.
3. **Config.** `Config` = `{ version, sessionSecret, discord: { clientId, clientSecret } | null }`.
   - Lambda (`configFromSsm`): all three SSM values are required. A missing one stops the cold start with the name of the parameter (`requireParam`). Reason: a deploy without the secrets must fail at once, not later at the first login. So the user runs `put-secrets` before the deploy.
   - Local (`configFromEnv`): `discord` is `null` when one of the two values is not set. Then `POST /auth/discord` answers 503, and the dev login still works. `SESSION_SECRET` falls back to a fixed dev value, with one log line. Reason: `tsx watch` restarts the API on each change. A random secret per start would log out the testers each time. The fixed value is only in `local.ts`, which the Lambda bundle does not contain.
4. **Discord client.** `createDiscordClient(discord, fetch)` has `exchangeCode(code, redirectUri)` and `getProfile(accessToken)`. `createApp` gets it in `Deps` as `discord` (or `null`). Tests pass a fake client. `discord.test.ts` tests the client with a fake `fetch`.
   - The token request is form-encoded: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`.
   - Each call has a 5-second timeout (`AbortSignal.timeout`). The Lambda timeout is 10 seconds.
   - Discord answers 400 or 401 to the token request → `401 { error: 'Discord login failed' }`. Any other failure (network, timeout, 429, 5xx, a profile without `id`) → `502 { error: 'Discord is not available' }`.
   - The log gets the Discord status only, never the body.
5. **Profile to user.** `name` = `global_name ?? username`. `avatar` = the hash or `null`. The Discord access token is dropped after `getProfile` (auth doc decision 9).
6. **User expiry.** The design says "a user with no login for 12 months is deleted". But a player who opens the app every week renews the token through `GET /me` and never logs in through Discord again. The TTL would then delete an active player after 12 months. So the token renewal in `GET /me` also calls `touch`, which moves `expiresAt` to 12 months later. This adds at most one Atlas write per user per day. The auth doc text changes to "no login and no app start for 12 months".
7. **User middleware.** `requireUser` reads `Authorization: Bearer <token>`, checks it with `verify(token, secret, 'HS256')`, and reads the user by `sub`. Any failure answers `401 { error: 'Not logged in' }`: no header, a bad signature, an expired token, another algorithm, a user that is gone. It sets `c.var.user` (the `UserDoc`) and `c.var.tokenIat`. Our own middleware, not Hono's `jwt()`, because the user read and the error answer are ours anyway.
8. **Body checks.** `validate(schema)` wraps `zValidator('json', ...)`. A bad body answers `400 { error: 'Invalid request' }`, without the zod details. Schemas:
   - `/auth/discord`: `code` a string of 1 to 200 characters. `redirectUri` an `http:` or `https:` URL of at most 200 characters. Discord checks that it is a registered redirect URI.
   - `/auth/dev`: `name` trimmed, 1 to 32 characters.
9. **Dev login route.** `routes/devAuth.ts` exports `devAuthRoutes(deps)`. Only `local.ts` imports it and adds it with `app.route('/', ...)` after `createApp`. The step 2 test shows that a route added after `createApp` gets the error and 404 handlers. The Phase 2 check greps the Lambda bundle for `auth/dev`.
10. **Web: login only when it is on.** `AUTH_ON` = `VITE_DISCORD_CLIENT_ID` is set, or a dev build (`import.meta.env.DEV`).
    - Off (production now): the session does nothing and makes no API call. `UserMenu` renders nothing. So production looks and works as before.
    - The **Log in with Discord** button shows only when `VITE_DISCORD_CLIENT_ID` is set. The dev login shows only in a dev build. So a tester without a Discord application can still use the dev login.
11. **API client.** `client.js` keeps the token in module state (`setToken`). `api(path, { method, json })` adds the `Authorization` header when there is a token, sends and parses JSON, and throws `ApiError { status, message }`. A 401 on a request with a token calls the handler that `session.js` sets with `onUnauthorized`. So `client.js` imports nothing from `auth/`, and there is no import cycle. The base URL is `VITE_API_URL` without a trailing `/` (step 3, decision 18).
12. **Session store.** `session.js` has a state `{ status, user }`, with `status` one of `off`, `loading`, `out`, `in`, `error`, and `subscribe` and `getSnapshot` for `useSyncExternalStore`.
    - `startSession()` runs once per page load. It keeps its promise at module level, because React StrictMode runs effects twice in dev, and a Discord code works only once.
    - It first handles a login callback in the query (decision 13). Then, with a token, it calls `GET /me`: `in` with the user, and a new token is stored. A 401 removes the token: `out`. A network error or 5xx keeps the token: `error`. Without a token: `out`.
    - It resolves to `{ returnHash, error }` for `Root.jsx`.
    - `login()` saves `{ state, returnHash: location.hash }` in `sessionStorage` and goes to the authorize URL with `prompt=none`.
    - `devLogin(name)`, `logout()`. Logout removes the token, with no server call (design).
13. **Callback.** `readCallback(search, saved)` in `oauth.js` is a pure function. It returns `null` (no callback), `{ code, returnHash }`, or `{ error }`.
    - `error=access_denied` → "Login cancelled."
    - A `state` that is not the saved one, a missing saved state, or another `error` → "Login failed. Try again."
    - The session removes the query with `history.replaceState` before the API call, and removes the saved state. So a reload does not post the code again.
    - `POST /auth/discord` failure → "Login failed. Try again."
    - `Root.jsx` shows the error text as the lobby `notice`, and opens `returnHash` after a login.
14. **Avatar.** `avatarUrl(user, size = 64)`. With a hash: `https://cdn.discordapp.com/avatars/<discordId>/<avatar>.png?size=<size>`. Without: `https://cdn.discordapp.com/embed/avatars/<index>.png`, with `index = (BigInt(discordId) >> 22n) % 6n`. A `discordId` that is not a number (dev users) uses the sum of its character codes `% 6`, so two dev users usually look different.
15. **User menu.** In the lobby header, at the right, next to the title.
    - `out`: **Log in with Discord** and the line "Your opponent sees your Discord name and avatar." In a dev build also a name field and **Dev login**.
    - `loading`: nothing, so the header does not jump. The lobby works at once.
    - `in`: avatar (28 px, round) and name. A click opens a small menu with **Log out**. Escape and a click outside close it.
    - `error`: "Login not available: the server does not answer." A reload tries again.

Added on 2026-10-09, after the user checks of Phase 3:

16. **Dev Mongo.** With `STORE=memory`, a restart of the local API empties the users. The browser token is still valid, but `GET /me` finds no user and answers 401, so the tester is logged out. `tsx watch` restarts the API after each code change. So the fixed dev secret of decision 3 alone does not keep a tester logged in. Step 7 has the same problem with online rooms. Fix: a dev Mongo in Docker, defined in `apps/api/compose.yaml`:
    - One `mongo:8` service. Port `127.0.0.1:27017`, so only this Mac reaches it (it has no password). A named volume, so the data survives restarts of the API, the container and the Mac.
    - `apps/api` scripts `db:up` (`docker compose up -d --wait`) and `db:down` (`docker compose down`, keeps the volume). `docker compose down -v` deletes the data.
    - The user sets `STORE=mongo` in `apps/api/.env`. `STORE=memory` stays the default, so `pnpm dev` works without Docker.
    - Testcontainers stays for `test:mongo`. Tests need a new, empty database each run. Dev needs data that stays. The two do not share a port or a database.
17. **`zod/mini`.** `zod` grew the Lambda bundle from 852 KB to 1.32 MB (Phase 2 Result). `zod/mini` has the same checks with a function API, and esbuild can drop the parts that the API does not use. Goal: the bundle close to its size before step 6. The schemas and the `{ error: 'Invalid request' }` answer stay the same.
    - If `@hono/zod-validator` does not accept `zod/mini` schemas, use `@hono/standard-validator` instead (`zod/mini` implements Standard Schema), and remove `@hono/zod-validator`.

## Phase 1: Users, session token, `/me`, dev login

Read: auth doc "Session", "Users", "Local testing". Backend doc "API". `apps/api/src/*`, `apps/api/test/*`. Hono docs for `hono/jwt` (`sign`, `verify`), `c.set` and `Variables`, `@hono/zod-validator`.

Work:
1. `pnpm --filter api add zod @hono/zod-validator`.
2. `stores/store.ts`: `UserDoc`, `DiscordProfile`, `UsersStore` (decision 1), `publicUser(doc)`, `newUserId()`. `Store` gets `users`.
3. `stores/memory.ts`: users in a `Map`, with a second map by `discordId`. No TTL.
4. `stores/mongo.ts`: the users store, the indexes (decision 2).
5. `config.ts`: the new `Config` and `configFromEnv` (decision 3). `configFromSsm` comes in Phase 2.
6. `auth/token.ts`: `signSession(userId, secret, now)`, `verifySession(token, secret)`.
7. `middleware/user.ts` (decision 7), `middleware/validate.ts` (decision 8).
8. `routes/me.ts`: `GET /me` with renewal and `touch` (decision 6), `DELETE /me`.
9. `routes/devAuth.ts` and its use in `local.ts` (decisions 3, 9).
10. `app.ts`: `Deps` gets `discord` (type from Phase 2, `null` for now). Mount `me`.
11. `.env.example`: the three new names, each with a comment.
12. Tests:
    - `token.test.ts`: round trip. An expired token, another secret, and a token with `alg: none` fail.
    - `me.test.ts`: no header, a bad token and a deleted user give 401. `GET /me` gives the user and no token when `iat` is new. With `iat` older than 1 day it gives a new token, and `expiresAt` moved. `DELETE /me` gives 204, then `GET /me` gives 401.
    - `dev-auth.test.ts`: a name gives a token and a user. The same name gives the same id. An empty or a 33-character name gives 400. The token works on `GET /me`.
    - `users.mongo.test.ts`: `upsertDiscord` twice with one `discordId` keeps one user with the same `_id` and the new name. `get`, `touch`, `delete`. The two indexes exist, the TTL one with `expireAfterSeconds: 0`.
    - `app.test.ts`, `mongo.mongo.test.ts`: update for the new `Store` and `Config`.

Checks:
- `pnpm --filter api typecheck`, `pnpm --filter api test`, `pnpm --filter api test:mongo` pass.
- `pnpm format`, `pnpm lint`: no new errors.
- `grep -rn "console\.\(log\|error\)" apps/api/src` shows no line that prints a token, a code or a secret.

### Result

Status: done. Not committed.

Files changed:
- New: `apps/api/src/auth/token.ts`, `auth/discord.ts` (only the `DiscordClient` type), `middleware/user.ts`, `middleware/validate.ts`, `routes/me.ts`, `routes/devAuth.ts`.
- New tests: `token.test.ts` (7), `me.test.ts` (4), `dev-auth.test.ts` (4), `users.mongo.test.ts` (3), `helpers.ts`.
- Changed: `stores/store.ts`, `memory.ts`, `mongo.ts`, `config.ts`, `app.ts`, `lambda.ts`, `local.ts`, `.env.example`, `package.json`, `pnpm-lock.yaml`, `app.test.ts`, `config.test.ts`, `mongo.mongo.test.ts`.

Facts:
- Installed: `zod@4.6.5`, `@hono/zod-validator@0.9.1`, `hono@4.13.13`. Peer ranges of the validator: `hono >=4.11.2`, `zod ^3.25.0 || ^4.0.0`. They fit.
- `configFromEnv(env, fallbackSessionSecret)` takes the fallback as an argument. The value `dev-session-secret-local-only` is only in `local.ts`. `lambda.ts` does not import `configFromEnv`.
- `lambda.ts` builds `Config` with `session-secret` from SSM and `discord: null`. Phase 2 replaces it with `configFromSsm`.
- `Deps.discord` is typed `DiscordClient | null`. `auth/discord.ts` has only the interface for now.
- `verify` gets `'HS256'`. A token with `alg: none` or `HS384` fails.
- `requireUser` is mounted on `/me` inside `meRoutes`.

Checks:
- `pnpm --filter api typecheck`: pass.
- `pnpm --filter api test`: pass, 32 of 32.
- `pnpm --filter api test:mongo`: pass, 5 of 5.
- `pnpm lint`: 0 errors, 44 warnings (the same as before).
- `pnpm format:check`: pass.
- `grep console.log/error apps/api/src`: no line prints a token, a code or a secret.

Changes from the plan: none. `.gitignore` is left for Phase 3 (no web env file exists yet).

Open issues: none.

## Phase 2: Discord login and the Lambda

Read: auth doc "Login flow", "Security". Discord OAuth2 docs ("Authorization Code Grant"). `apps/api/src/lambda.ts`, `infra/README.md` ("Secrets").

Work:
1. `auth/discord.ts` (decisions 4 and 5).
2. `routes/auth.ts`: `POST /auth/discord`. Exchange the code, read the profile, `upsertDiscord`, sign, answer `{ token, user }`. 503 when `deps.discord` is `null`.
3. `config.ts`: `configFromSsm(params, env)` (decision 3).
4. `lambda.ts`: config from `configFromSsm`, `createDiscordClient(config.discord, fetch)`.
5. `local.ts`: the Discord client when `config.discord` is set.
6. Tests:
    - `discord.test.ts`: the form body and the headers of the token request. 400 from Discord → the "rejected" error. 500, a timeout and a network error → the "not available" error. The profile maps to `name` and `avatar`, with `global_name` `null`.
    - `auth.test.ts`: a new user is created. A second login updates the name and keeps the id. Rejected → 401. Not available → 502. A bad body → 400. No Discord client → 503. The token works on `GET /me`. The log line has no code.
    - `config.test.ts`: `configFromSsm` with all values, and the error that names a missing parameter.

Checks:
- `pnpm --filter api typecheck`, `pnpm --filter api test` pass.
- `pnpm --filter infra test` and `pnpm --filter infra cdk synth` pass (no credentials needed, step 3 Result).
- `grep -rl "auth/dev" infra/cdk.out` finds nothing. `grep -rl "dev-session-secret" infra/cdk.out` finds nothing.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

Status: done. Not committed.

Files changed:
- New: `apps/api/src/routes/auth.ts`, `test/discord.test.ts` (11), `test/auth.test.ts` (12).
- Changed: `auth/discord.ts` (now has `createDiscordClient` and `DiscordError`), `config.ts` (`configFromSsm`), `app.ts` (mounts `authRoutes`), `lambda.ts`, `local.ts`, `test/config.test.ts` (+4).

Facts:
- `DiscordError` has `kind`: `rejected` (route answers 401) or `unavailable` (route answers 502). Other errors go to the error handler.
- `configFromSsm(params, env, prefix)` returns `Config & { discord: DiscordConfig }`, so `lambda.ts` needs no null check. `prefix` only shapes the error message.
- Discord logs: the status only. A test checks that the body and the code are not in the log.
- Lambda bundle: `index.mjs` 1.3 MB (synth warns about size, as before).
- `lambda.ts` does not import `local.ts`, `devAuth.ts` or the dev secret.

Checks:
- `pnpm --filter api typecheck`: pass.
- `pnpm --filter api test`: pass, 59 of 59.
- `pnpm --filter api test:mongo`: pass, 5 of 5.
- `pnpm --filter infra test`: pass, 16 of 16.
- `pnpm --filter infra synth`: pass.
- grep of the synth output for `auth/dev` and for `dev-session-secret`: nothing.
- `pnpm lint`: 0 errors, 44 warnings (same as before). `pnpm format:check`: pass.

Changes from the plan: none. The infra script is named `synth`.

Open issues: none.

## Phase 3: Web login

Read: auth doc "Login flow", "Session", "Lobby and room UI" (header only), "Users" (avatar). `apps/web/src/Root.jsx`, `components/Lobby.jsx`, `index.css` (lobby styles), `net/useY.js` (the `useSyncExternalStore` pattern).

Work:
1. `.gitignore`: `.env.local`, `.env.*.local`. `apps/web/.env.development`: a comment that names `VITE_DISCORD_CLIENT_ID` and `.env.local`.
2. `api/client.js` (decision 11).
3. `auth/oauth.js`: `randomState()`, `authorizeUrl({ clientId, redirectUri, state })`, `readCallback(search, saved)` (decision 13).
4. `auth/avatar.js` (decision 14).
5. `auth/session.js` (decisions 10, 12, 13), `auth/useUser.js`.
6. `components/UserMenu.jsx` (decision 15). `Lobby.jsx`: the header gets it. `index.css`: the styles.
7. `Root.jsx`: calls `startSession()` once. After it resolves: `error` → `setNotice`. `returnHash` → `go(returnHash, true)`.
8. Tests (`node --test`):
    - `oauth.test.js`: the authorize URL has `response_type=code`, `scope=identify`, `prompt=none`, `redirect_uri`, `state`. `readCallback`: no query → `null`. Code with the right state → code and `returnHash`. Wrong state → error. `access_denied` → "Login cancelled.". No saved state → error.
    - `avatar.test.js`: with a hash. Without a hash, for the Discord example id `80351110224678912` → index from the BigInt formula. A dev id gives an index from 0 to 5.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.
- `git check-ignore apps/web/.env.local` prints the path.
- `grep -rn "localStorage\|sessionStorage" apps/web/src/auth` shows only `session.js`.
- A production build without `VITE_DISCORD_CLIENT_ID`: `grep -l "auth/dev\|Dev login" apps/web/dist/assets/*.js` finds nothing. (Vite removes code under `import.meta.env.DEV` from a production build.)

### Result

Status: done. Not committed.

Files changed:
- New: `apps/web/src/api/client.js`, `auth/oauth.js`, `auth/avatar.js`, `auth/session.js`, `auth/useUser.js`, `components/UserMenu.jsx`.
- New tests: `auth/oauth.test.js` (8), `auth/avatar.test.js` (4).
- Changed: `.gitignore`, `apps/web/.env.development`, `components/Lobby.jsx`, `Root.jsx`, `index.css`.

Facts:
- `session.js` exports `AUTH_ON`, `DISCORD_ON` (client id set), `startSession`, `login`, `devLogin`, `logout`, `subscribe`, `getSnapshot`. It is the only file with `localStorage` and `sessionStorage`.
- `startSession()` resolves to `{ returnHash, error }`. `returnHash` has no `#`, so `Root.jsx` passes it to `go`. It is set only after a successful login.
- On a callback error or a failed `POST /auth/discord`, the session still tries `GET /me` with a stored token.
- `readCallback` checks the state first. So `access_denied` with a wrong state gives "Login failed. Try again.".
- `client.js` throws `ApiError` with status 0 when the server does not answer. The session maps that to `error`.
- `devLogin` returns an error text or `null`. It returns at once in a production build, so Vite drops the `/auth/dev` call.
- `Lobby.jsx` header is a flex row: the title block at the left, `UserMenu` at the right.

Checks:
- `pnpm --filter web test`: pass, 30 of 30.
- `pnpm --filter web build`: pass.
- `pnpm lint`: 0 errors, 44 warnings (same as before). `pnpm format:check`: pass.
- `git check-ignore apps/web/.env.local`: prints the path.
- `grep localStorage|sessionStorage apps/web/src/auth`: only `session.js`.
- Production build without `VITE_DISCORD_CLIENT_ID` (no `.env.local` exists): `grep -l "auth/dev\|Dev login" apps/web/dist/assets/*.js` finds nothing.

Changes from the plan: none.

Open issues: none. The browser flow is not tested (user checks 7 to 12).

## Phase 4: `zod/mini` and dev Mongo

Read: decisions 16 and 17. `apps/api/src/middleware/validate.ts`, `routes/auth.ts`, `routes/devAuth.ts`, `src/local.ts`, `.env.example`, `package.json`. The `zod/mini` docs.

Work:
1. `zod/mini` in `validate.ts`, `auth.ts` and `devAuth.ts` (decision 17). Check that `@hono/zod-validator` accepts the schemas. If not, use the fallback of decision 17.
2. `apps/api/compose.yaml` and the scripts `db:up`, `db:down` (decision 16).
3. `apps/api/.env.example`: a comment at `STORE` that `mongo` needs `pnpm --filter api db:up` first.
4. Do not edit `apps/api/.env`. The user sets `STORE` there.

Checks:
- `pnpm --filter api typecheck`, `pnpm --filter api test`, `pnpm --filter api test:mongo` pass. The body tests of `auth.test.ts` and `dev-auth.test.ts` pass with no change.
- `pnpm --filter infra synth` passes. Give the size of the Lambda `index.mjs` before and after.
- `grep -rln "from 'zod'" apps/api/src` finds nothing.
- `docker compose -f apps/api/compose.yaml config` passes. Do not start the container.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

Status: done. Not committed.

Files changed:
- New: `apps/api/compose.yaml` (project `mcptacticus`, `mongo:8`, `127.0.0.1:27017`, volume `mongo-data`, health check for `--wait`).
- Changed: `middleware/validate.ts`, `routes/auth.ts`, `routes/devAuth.ts` (all `zod/mini`), `package.json` (`db:up`, `db:down`), `.env.example` (comment at `STORE`).

Facts:
- `@hono/zod-validator` 0.9.1 accepts `zod/mini` schemas, types and runtime. It calls `safeParseAsync`, which mini schemas have. No fallback needed. `zod` and `@hono/zod-validator` stay in `package.json`.
- Mini API used: `z.string().check(z.minLength(1), z.maxLength(200))`, `z.trim()`, `z.url({ protocol })`.
- Tests did not change. Lambda `index.mjs`: 1,320,732 bytes before, 882,867 after (852 KB before step 6). About 31 KB is left over. Not checked where it comes from.
- Checks: typecheck ok, `test` 59 passed, `test:mongo` 5 passed, no `from 'zod'` in `apps/api/src`, `docker compose config` ok, synth ok, lint 0 errors.
- `apps/api/.env` not touched. The container was not started.

## Phase 5: Docs

Work:
1. `docs/feature-auth.md`:
   - "Users": `expiresAt` also moves on token renewal (decision 6). "Privacy" → "Retention": the same.
   - "Local testing": the dev login shows in a dev build also without `VITE_DISCORD_CLIENT_ID` (decision 10). The fixed dev session secret (decision 3). The dev Mongo (decision 16): without it, a restart of the API logs the testers out.
   - "Code layout": `apps/web/src/auth/oauth.js`, `apps/api/src/auth/`, `routes/devAuth.ts`.
   - "Endpoints": the answers of "Names" for the three routes.
   - Open question 1 (localhost redirect): answered (see "User check results").
   - Risk 1 of this plan: the first login worked with `prompt=none` (see "User check results").
   - Status line at the top.
2. `docs/feature-backend.md`: "Code" (`auth/`, `devAuth.ts`), "Stack" (`zod/mini` and the validator), "Local development" (the dev Mongo with `compose.yaml`, next to the memory store).
3. `docs/plans/implement-backend.md`: a short **Result** under step 6.
4. `README.md`: local login: `apps/api/.env`, `apps/web/.env.local`, the dev login, the dev Mongo (`db:up`, `STORE=mongo`, `docker compose down -v` to reset).
5. `infra/README.md`: the Discord values in "Secrets", and the order: `put-secrets` before the deploy (decision 3).

Checks:
- `pnpm test` at the root passes.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

Status: done. Not committed.

Files changed:
- `docs/feature-auth.md`: status line. "Session" and "Users": `GET /me` moves `expiresAt`. "Retention": "no login and no app start for 12 months". "Endpoints": the answers of three routes. "Local testing": dev login in every dev build, the fixed dev session secret, the dev Mongo. "Code layout": `oauth.js`, `auth/`, `devAuth`, `validate`. Open question 1 answered. `prompt=none` checked.
- `docs/feature-backend.md`: "Stack" (`zod/mini`, versions, bundle sizes), "Code" (`auth/`, `devAuth`, `validate`, `log`), "Local development" (the dev Mongo).
- `docs/plans/implement-backend.md`: **Result** under step 6.
- `README.md`: new "Login" and "Dev Mongo" sections (env files, dev login, `db:up`, `db:down`, `down -v`). The `docker run` command is replaced.
- `infra/README.md`: new "Secrets" section (four values, `put-secrets` before the deploy).

Facts:
- Lambda `index.mjs`: 851,963 bytes before step 6, 1,320,732 with `zod`, 882,867 with `zod/mini`.
- Versions: `zod@4.6.5` (as `zod/mini`), `@hono/zod-validator@0.9.1`.
- User checks 13 and 14 were not done when this phase ended. They passed later (see "User check results").

Checks:
- `pnpm test`: pass (api 59, web 30, infra 16). `pnpm format`: ok. `pnpm lint`: 0 errors, 44 warnings.

Changes from the plan: none.

Open issues: none.

## User

Before Phase 3 (any time):
1. Discord Developer Portal: **New Application** named `mcptacticus3d`. **OAuth2 → Redirects**: `http://localhost:5173/`. Record if Discord accepts it (auth doc open question 1).
2. Copy the client id and the client secret:
   - `apps/api/.env`: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.
   - `apps/web/.env.local`: `VITE_DISCORD_CLIENT_ID`.
   - `infra/.env`: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`.

After Phase 2, in this order:
3. `pnpm --filter infra put-secrets`. It prints `Wrote: mongodb-uri, session-secret, discord-client-id, discord-client-secret`.
4. `pnpm --filter infra cdk:deploy`.
5. Checks against the deployed API (`<ApiUrl>` without the trailing `/`):
   - `curl <ApiUrl>/health` → `db: "ok"`.
   - `curl -i <ApiUrl>/me` → 401 `{"error":"Not logged in"}`.
   - `curl -i -X POST <ApiUrl>/auth/discord -H 'content-type: application/json' -d '{"code":"x","redirectUri":"http://localhost:5173/"}'` → 401 `{"error":"Discord login failed"}`. This shows that the Lambda has the Discord values and reaches Discord.
   - `curl -i -X POST <ApiUrl>/auth/dev -H 'content-type: application/json' -d '{"name":"a"}'` → 404.
6. Do not set `VITE_DISCORD_CLIENT_ID` in Netlify.

After Phase 3, with `pnpm dev`:
7. Lobby: **Log in with Discord** → Discord → back in the lobby with avatar and name. The first login shows the consent screen (Risk 1).
8. Reload: still logged in. **Log out**: the login button shows again. Log in again: no consent screen.
9. On the Discord page, press **Cancel**: the lobby says "Login cancelled."
10. A second browser: **Dev login** with the name `bob`. Each browser shows its own user.
11. Run only the web app (`pnpm --filter web dev`) and reload: "Login not available". Run `pnpm dev` again and reload: logged in.
12. The Sandbox and offline rooms work as before.

After Phase 4:
13. `pnpm --filter infra cdk:deploy` (the bundle changed). Then check 5 again.
14. `pnpm --filter api db:up`, and `STORE=mongo` in `apps/api/.env`. `pnpm dev`, log in, stop `pnpm dev`, start it again, reload: still logged in.

After the Netlify build of the merged code:
15. Production shows no login button, and DevTools → Network shows no request to the API.

### User check results

On 2026-10-09:
- Discord accepted `http://localhost:5173/` as a redirect (auth doc open question 1). The first save failed, because the browser autofilled the redirect field with the Discord email. Typed by hand, it saved.
- Discord's **Verification Qualifications** page (Team, Terms of Service, install link, and more) is for bots in more than 100 servers. Login with `identify` works without it.
- `put-secrets` and the deploy worked. `POST /auth/discord` with a fake code answered 401 `Discord login failed`.
- Checks 7 to 12 passed, also the first login with `prompt=none`. One problem: after a restart of `pnpm dev`, the tester was logged out. Cause and fix: decision 16.
- After Phase 4: the deploy and the `curl` checks passed again (check 13). With the dev Mongo and `STORE=mongo`, the tester stayed logged in after a restart of `pnpm dev` (check 14).
- Check 15 (production after the Netlify build) waits for the push.

## Done when

- `pnpm test`, `pnpm typecheck`, `pnpm --filter web build` pass. `pnpm lint` has no new errors.
- The user checks pass.
- The API with the auth routes is deployed. Production shows no login.
- The **Result** of each phase is filled in.

## Risks and open questions

1. **`prompt=none` on the first login.** The Discord docs say that `none` skips the consent screen when the player approved the app before. They do not say what happens for a new player. If the first login fails with an error, `authorizeUrl` drops `prompt`, and Discord shows the consent screen each time. User check 7 shows it.
2. **Localhost redirect.** Auth doc open question 1. If Discord refuses `http://localhost:5173/`, try `http://127.0.0.1:5173/`, and the dev server then runs on that host.
3. **Two tabs.** A login in one tab does not update another open tab until it reloads. Accepted for now. A `storage` event listener could fix it later.
4. **Token in `localStorage`.** Accepted in the design ("Why not a cookie").
5. **Lambda cold start.** The first request after a cold start reads SSM, then calls Discord twice. That must finish within 10 seconds. The 5-second timeout per Discord call keeps one slow call from using all of it. The log `REPORT` line of the user check shows the time.
6. **Delete account.** `DELETE /me` deletes only the user in this step. Step 7 must extend it for rooms before any room of a deleted user exists. Before the first release, all data is test data.
