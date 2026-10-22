# Analytics

Status: partly built.

The app counts how often people use it: how many try it, and whether they use the Sandbox or create a room (solo or versus). The data stays small and is easy to extend.

Built: the API route that takes events, and the browser side that sends them. Not built: the script that reads them.

## Why this way

- **Own API, no third party.** Same pattern as the error reports (`docs/features/backend.md`, "Error reports"). The data stays in our Atlas database, and the cost is zero.
- **No id on the device.** Nothing is written to `localStorage` or cookies for analytics, so the app needs no consent notice.
- **Visitor hash on the server.** The server stores `visitor`, a short hash of a daily salt, the IP and the user agent. The IP and the user agent are never stored.
  - The salt is random, one per UTC day, and kept in Mongo (collection `salts`). So all Lambda instances use the same salt in one day.
  - The salt is deleted two days after its day starts. After that nobody can find the IP from a hash.
  - Result: unique visitors per day. The same person counts again on the next day.
- **Fixed names and fields, no free data.** The body has `name`, an optional `kind` and `version`. The server has the list of names and kinds (`apps/api/src/stores/store.ts`). A new event adds a name to the list. A new field adds a field to the schema (`apps/api/src/routes/events.ts`). So the browser cannot store any text it wants.
- **No user id in events,** also when the user is logged in. The route does not read the token.
- **Bots are dropped.** A user agent with `bot`, `crawler`, `spider` or `headless` gets 204 and nothing is stored.
- **Own visits count too.** The dev server uses the memory store, so local work does not count. Visits to the deployed app do count.

## Events

| Name | When | `kind` |
|---|---|---|
| `app_open` | Once per page load | none |
| `sandbox_open` | The Sandbox opens | none |
| `room_create` | A room is created | `solo` or `versus` |
| `room_open` | A room opens (also a reload) | `solo` or `versus` |
| `room_join` | A guest takes the free seat of a versus room | `versus` |

## Where events are sent

The browser calls `track(name, kind)` from `apps/web/src/analytics/track.js`. It sends `POST /events` with `keepalive` and the build id as `version`. A failed send is ignored and never goes to the error reporter.

- `app_open`: `src/main.jsx`.
- `sandbox_open`: `src/Root.jsx`, when the Sandbox page opens.
- `room_open`: `src/Root.jsx`, when a single player or multiplayer room page opens.
- `room_create`: `src/rooms/NewRoomDialog.jsx`, after the room is created.
- `room_join`: `src/rooms/JoinRoom.jsx`, after `joinRoom` succeeds.

## API

- `POST /events`: no login, body limit, rate limit per IP, strict body check. A good event gives 204. See `docs/features/backend.md`, "Events".
- The stored document is `{ time, name, kind?, version, visitor }`. The server sets `time`. The route builds it field by field.
- Events are deleted after 13 months (TTL index on `time`, value in `apps/api/src/stores/store.ts`).
