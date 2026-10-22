# Plan: Usage analytics

Requested by the user on 2026-10-22. Status: in progress. Branch `analytics`, worktree `../mcp_assist_3d-analytics`, from main.

Each step makes one commit and writes its **Result** below. Web paths are under `apps/web/`.

Checks of every code step: `pnpm format`, `pnpm lint` (no new warnings), `pnpm test`, `pnpm typecheck`, `pnpm --filter web build`.

## Request

The user wants to know how often people use the app: how many people try it, and whether they use the Sandbox or create a room (solo or versus). The data must stay small and must be easy to extend later.

## Facts

- The app already sends error reports to its own API: `POST /errors`, no login, zod check, body limit, rate limit per IP (`apps/api/src/routes/errors.ts`). The browser side is `src/crash/reporter.js`. `infra/scripts/errors.ts` prints the reports from Atlas.
- Stores have a memory and a Mongo version (`apps/api/src/stores/`). The Mongo store creates collections and indexes at cold start.
- Sandbox opens in `src/Root.jsx` (`page === 'sandbox'`). Rooms are created in `src/rooms/NewRoomDialog.jsx` (solo: `rooms/store.js` `createRoom`, versus: `rooms/serverStore.js` `createRoom`). A guest joins with `rooms/serverStore.js` `joinRoom`.
- `api()` in `src/api/client.js` adds the session token when there is one.

## Decisions

1. **Own API, no third party.** The same pattern as the error reports. The data stays in our Atlas database, and the cost is zero.
2. **No id on the device.** Nothing is written to `localStorage` or cookies for analytics. So the app needs no consent notice. The user may add a device id later.
3. **Visitor hash on the server.** The server stores `visitor = sha256(dailySalt + ip + userAgent)`, cut to 16 hex characters. The IP and the user agent are never stored. The salt is random, one per UTC day, and stored in Mongo (`salts`, TTL 2 days), so all Lambda instances use the same salt in one day. After the salt is deleted, nobody can find the IP from a hash. Result: unique visitors per day. The same person counts again on the next day. Plausible uses the same method.
4. **Fixed event names and fields, no free data.** The body is `{ name, kind?, version }`. `name` is one of a list on the server. `kind` is `solo` or `versus`. A new event adds a name to the list and one `track()` call. A new field adds a field to the schema. So the browser cannot store any text it wants.
5. **Events:**

   | Name | When | `kind` |
   |---|---|---|
   | `app_open` | Once per page load | - |
   | `sandbox_open` | The Sandbox opens | - |
   | `room_create` | A room is created | `solo` or `versus` |
   | `room_open` | A room opens (also a reload) | `solo` or `versus` |
   | `room_join` | A guest takes the free seat of a versus room | `versus` |

6. **No user id in events,** also when the user is logged in. The route does not read the token.
7. **Bots:** the route drops events with a user agent that matches `bot|crawler|spider|headless` and answers 204.
8. **Retention:** events have a TTL of 13 months (`time` index). One event is about 150 bytes, so the Free cluster has enough space.
9. **Reading:** a script prints one line per day: visitors, then the count of each event and kind. No dashboard.
10. **Own visits count too.** The dev server sends to the local API (memory store), so local work does not count. The user's visits to the deployed app do count. Accepted.

## Steps

### Step 1. API: `POST /events`

- Move `callerIp` and `createRateLimit` from `routes/errors.ts` to a shared file (for example `middleware/rateLimit.ts`). `errors.ts` imports them. No copy.
- Store (`stores/store.ts`, `memory.ts`, `mongo.ts`):
  - `salts.forDay(day)`: returns the salt of the day. Mongo: `findOneAndUpdate` with `upsert` and `$setOnInsert` of a random salt, so two instances get the same salt. `expiresAt` 2 days later, TTL index. Each instance keeps the salt of the current day in memory.
  - `events.add(event)`. Mongo: collection `events`, TTL index on `time` (13 months).
- `routes/events.ts`: `POST /events`. No login. Rate limit (own instance, 60 a minute per IP), body limit 1 KB, strict zod schema (Decision 4), bot filter (Decision 7). Builds the document field by field: `{ time, name, kind?, version, visitor }`. Answers 204.
- `app.ts`: mount the route.
- Tests (`test/events.test.ts`): a good event gives 204 and one stored event without IP or user agent; an unknown name or field gives 400; a big body gives 413; a bot agent stores nothing; two events of one IP and agent on one day have the same visitor; on the next day the visitor is different.
- Docs: new `docs/features/analytics.md` (Status: partly built) with the decisions above. `docs/features/backend.md`: the new route, and `events` and `salts` in the collections list.

**Result:** Done, not committed. `POST /events` in `routes/events.ts` (clock injectable: `eventRoutes({ store, now })`). `callerIp` and `createRateLimit` moved to `middleware/rateLimit.ts`. Store has `events.add` and `salts.forDay` (memory and Mongo, TTL indexes). Tests in `test/events.test.ts` and `test/mongo.mongo.test.ts`. Docs written. Checks pass; lint warnings same as main (39).

### Step 2. Web: send the events

- `src/analytics/track.js`: `track(name, kind)`. It sends `POST /events` with `keepalive`, and the build id as `version`. A failed send is ignored and never reported as an error. Same style as `crash/reporter.js`.
- Calls:
  - `main.jsx`: `app_open`, next to `startErrorReporter()`.
  - `Root.jsx`: `sandbox_open` when the Sandbox page mounts, `room_open` with the kind when a room page opens.
  - `rooms/NewRoomDialog.jsx`: `room_create` after a successful create, solo or versus.
  - The guest join path that calls `joinRoom`: `room_join` after success.
- Tests: `track` sends the right body; a rejected send does not throw.
- Docs: `analytics.md` lists where each event is sent.

**Result:** Done, not committed. `src/analytics/track.js` (`createTracker` with injected `send`, lazy `api` import), tests in `track.test.js`. Calls in `main.jsx`, `Root.jsx` (sandbox and room open), `NewRoomDialog.jsx`, `JoinRoom.jsx` (the caller of `joinRoom`). `analytics.md` lists them. Checks pass.

### Step 3. Read the data

- `infra/scripts/stats.ts` (`pnpm --filter infra stats [days]`, default 30). Reads the Mongo URI like `errors.ts`. Prints one line per UTC day, newest first: date, unique visitors, `app_open`, `sandbox_open`, `room_create` solo/versus, `room_open` solo/versus, `room_join`. Last line: totals (visitors as a sum of the daily counts, with a note).
- `infra/scripts/delete-test-data.ts`: also clears `events` and `salts`.
- Docs: `analytics.md` Status: built. `backend.md`: the stats command.

**Result:**

## Deploy

The user runs `pnpm --filter infra cdk:deploy` after step 1. The web app goes out with the next Netlify build. A web app with step 2 against an API without step 1 gets 404 for each event and ignores it.
