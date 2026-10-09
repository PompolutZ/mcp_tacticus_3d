# Step 7: Multiplayer rooms

Detailed plan of step 7 in `docs/plans/implement-backend.md`. The design is in `docs/feature-auth.md` ("Online rooms", "Lobby and room UI", "Identity in peer-to-peer games" (last point), "Privacy" (Delete account), "Code layout", "Phases" 2) and `docs/feature-rooms.md` ("Lobby", "New room", "Storage"). The user changed parts of the design on 2026-10-09. See decisions 1, 2, 5, 6, 10, 12, 13, 14 and 15.

## Goal

A logged-in player hosts a multiplayer room on the server. A second player opens the link, joins with their roster, and sees the map and the host's roster. Each browser writes its table to the server, so the same user on another browser gets the saved table.

There is no live sync yet. Each browser has its own copy of the table, and the server merges the copies. A player sees the other player's changes the next time the room opens. Step 8 adds the live sync, and it needs the rooms and seats of this step: signaling accepts only seated players.

## Scope

In the step:
- `apps/api`: the rooms store (memory and Mongo, with indexes and the TTL index), the room and seat routes, the table snapshot (`GET`, `PUT`, merge), the rooms part of `DELETE /me`. Tests.
- `apps/web`: one room list in the lobby, the **Single player** and **Multiplayer** choice in the new room dialog, the join page, the room link for multiplayer rooms, **Copy link**, the table read and the table writes, the guest's roster.
- Remove **Save game** and **Load game** from the app (decision 13).
- Docs: auth doc, rooms doc, peer-to-peer doc, backend doc, the backend plan, `README.md`. The names "offline room" and "online room" become "single player room" and "multiplayer room".

Left for later steps:
- Live sync, names and avatars in the room toolbar, the camera turn for the Red player: step 8.
- The guest leaves at once when the host deletes the room: step 8 (decision 15).
- **Delete account** in the user menu, and the privacy page: step 12. The route `DELETE /me` gets its rooms part now.
- A roster change after create or join: later, if players ask for it (decision 10).

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 7"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server. The user checks the app.
- Do not run `aws`, `cdk deploy` or `put-secrets`. `cdk synth` is fine. `infra/` does not change in this step.
- Do not commit and do not push. The main model commits each finished phase.
- Temporary files go in the session's scratchpad directory.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: TypeScript, strict, in `apps/api`. Plain JavaScript in `apps/web`. Plain, short comments that say why. Match the style of the code around you.
- Web tests run with `node --test` (step 5, decision 14). A module under test must not import `api/client.js` or other modules that read `import.meta.env`. Pass the API calls in as arguments.
- Never log a token, a secret or the `Authorization` header.
- After a code change: `pnpm format` and `pnpm lint`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| Kinds of table | Sandbox, single player room, multiplayer room (decision 2). In code: `multiplayer` |
| Players | The host creates the room. The guest joins it. The data field is `host` (the design's `owner`) |
| New API dependency | `yjs`, the version of the web app (`13.6.33`) |
| Collection | `rooms` |
| Room code | `XXXX-XXXX`: 8 random characters of Crockford base32 (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`), the format of `apps/web/src/rooms/store.js`. A path with another format answers 404 |
| Room doc | The design's "Data", with `host` instead of `owner`, `table` always set (decision 1), and `version: 1` |
| Limits | A user hosts at most 1 room (409, decision 6). Table 1 MB (413). Roster `code` 1 to 1000 characters. `mapId` matches `^[a-z0-9-]{1,64}$`. `GET /rooms` returns the 100 last changed |
| Table body | `application/octet-stream`: the bytes of `Y.encodeStateAsUpdate` |
| IndexedDB of a multiplayer room | `mcp-assist-3d/multiplayer/<user id>/<code>` (decision 12). Single player rooms keep `mcp-assist-3d/room/<code>` |
| Table write | 60 s after the first change. At once on **← Lobby** and when the tab is hidden. `keepalive` when the body is at most 60 KB |

API answers:

| Request | Body | Answer |
|---|---|---|
| `GET /rooms` | | 200 `{ rooms: [room] }`, the last changed first. 401 |
| `POST /rooms` | `{ mapId, side, roster, table }` | 201 `{ room }`. 400 bad body or bad table. 409 the user hosts a room already. 413 table too large. 401 |
| `GET /rooms/{code}` | | 200 `{ room }`. 404. No login needed |
| `POST /rooms/{code}/join` | `{ roster }` | 200 `{ room }`. Also when the user has a seat already. 409 no free seat. 400. 401. 404 |
| `DELETE /rooms/{code}` | | 204. 403 not the host. 401. 404 |
| `GET /rooms/{code}/table` | | 200, the bytes. 401. 403 no seat. 404 |
| `PUT /rooms/{code}/table` | the bytes | 204. 400 not a Yjs update. 409 the merge lost twice (decision 8). 413. 401. 403. 404 |
| `DELETE /me` | | 204. Also deletes the room that the user hosts (decision 11) |

- `side`: `'blue'` or `'red'`, the host's seat. `roster`: `{ code }`, required in both bodies. `table`: base64 of the bytes.
- `room` in an answer: `{ code, host, players: { blue, red }, mapId, rosters: { blue, red }, createdAt, updatedAt }`. Dates are ISO strings. Never the table.
- A player in an answer: `{ id, name, avatar, discordId }`. `{ id, gone: true }` when the user no longer exists (decision 5). `null` for a free seat.
- Error texts: `Room not found`, `No seat in this room`, `Only the host can do this`, `This room has two players already`, `You host a multiplayer room already. Delete it first.`, `Invalid table`, `Table too large`, `The table changed. Try again.` Errors are `{ error }` (step 2).

Files:

```
apps/api/
  package.json                 + yjs
  src/
    app.ts                     mounts rooms and table routes
    rooms/code.ts              newRoomCode, isRoomCode
    rooms/table.ts             isYjsUpdate, mergeTables
    routes/rooms.ts            room and seat routes
    routes/table.ts            GET and PUT of the table
    routes/me.ts               DELETE /me: rooms part
    stores/store.ts            + RoomsStore, RoomDoc, RoomPlayer, publicRoom. UsersStore + getMany
    stores/memory.ts           + rooms
    stores/mongo.ts            + rooms, indexes
  test/
    rooms.test.ts, table.test.ts, lambda-binary.test.ts
    me.test.ts                 + the rooms part of DELETE /me
    rooms.mongo.test.ts        the Mongo rooms store, two table writes at the same time
apps/web/src/
  api/client.js                + bytes body, bytes answer, keepalive
  rooms/
    serverStore.js             the multiplayer rooms API: list, get, create, join, delete, table
    base64.js (+ test)         bytes to base64 and back, works in the three browsers
    roomList.js (+ test)       one list of single player and multiplayer rooms
    startTable.js (+ test)     the bytes of a start table (startTableBytes)
    roomPage.js (+ test)       which page a room link opens
    serverTable.js (+ test)    the table writer, hasLocalChanges
    localDocs.js (+ test)      the IndexedDB names of multiplayer rooms, the cleanup of decision 12
    store.js                   + multiplayerDocName, deleteDoc
    tableDoc.js                openTableDoc takes the database name, no game argument
  Root.jsx                     the room link of a multiplayer room
  Table.jsx                    opens a multiplayer room, starts the writer, the server warning. No Load game path
  App.jsx                      multiplayer: the guest's roster at the first open. No Save and Load game
  net/doc.js (+ test)          encodeGame → encodeTable. No readGame
  components/
    Lobby.jsx                  one list, multiplayer tiles, Delete
    RoomRosterPopup.jsx        moved out of Lobby.jsx, also used by the join page
    NewRoomDialog.jsx          Single player or Multiplayer, side, own roster
    JoinRoom.jsx               the join page
    CopyLinkButton.jsx         Copy link, in the lobby tile and the room toolbar
    Toolbar.jsx                no Save and Load game. Multiplayer: no Roster group
  index.css                    styles of the new parts
```

## Decisions that fill gaps in the design

1. **Start table at creation.** The host's browser builds the start table and sends it with `POST /rooms`. A room always has a table, never `null`. The design's `table: null` and "A new room has `table: null`" go away. The user agreed on 2026-10-09. Reasons:
   - Only the host's browser may build a start table. `mapTerrain` gives each terrain piece a random id, so two start tables merge into two sets of pieces.
   - The design text lets any browser build it when the table is `null`. A guest who opens the link before the host's first write (up to 60 s) would do that.
   - The host's browser has the start table at creation anyway. So neither the API nor the web app needs a `null` case.
   - The browser builds it in a new `Y.Doc` with `fillTable(table, { ...startTable(mapId), rosters })`, and sends `encodeGame(table)` as base64. A start table is a few KB.
2. **Three kinds of table.** The user decided on 2026-10-09. The names are known to TTS players, where a game is single player or multiplayer.
   - **Sandbox:** in this browser only. Not saved. No roster needed. As today.
   - **Single player room:** in this browser only. Today's offline room, with no change.
   - **Multiplayer room:** on the server. Always created by the host.
   - The UI and the docs use these names. "Offline room" and "online room" go away.
3. **Store shape.** `Store` gets `rooms: RoomsStore`. `UsersStore` gets `getMany(ids)`, for the players of a list (one `$in` query). `RoomsStore`:
   - `create(room)`: inserts with a new code. A duplicate code tries a new one, at most 5 times. A second room of the same host fails with a `HostingError` (decision 6).
   - `get(code)`: the room without `table`, or `null`.
   - `getTable(code)`: `{ table, tableRev }` or `null`.
   - `listForUser(userId, limit)`: the rooms where the user has a seat, the last changed first, without `table`. `$or` on both seats.
   - `join(code, side, userId, roster, now)`: sets the seat and the roster of that side only when the seat is still `null`. Returns `true` when it wrote.
   - `replaceTable(code, expectedRev, table, now)`: writes only when `tableRev` is still `expectedRev`, and adds 1 to it. Returns `true` when it wrote.
   - `delete(code)`, `deleteHostedBy(userId)`.
   - Each write sets `updatedAt` and `expiresAt` (`updatedAt` + 12 months).
   - The memory store has the same rules. It has no TTL.
4. **Mongo indexes.** `rooms`: unique `{ host: 1 }` (decision 6), `{ 'players.blue': 1 }`, `{ 'players.red': 1 }`, TTL `{ expiresAt: 1 }` with `expireAfterSeconds: 0`. They are created in the same shared promise as the users indexes (step 6, decision 2). `table` is BSON binary. A list read leaves it out with a projection.
5. **Seats are locked after the join.** The user decided on 2026-10-09.
   - The host takes a seat at creation, with their roster. The guest takes the other seat with **Join**, with their roster.
   - After the join, both seats and both rosters are fixed. There is no **Leave**, no **Remove**, and no roster change. To change a player or a roster, the host deletes the room and creates a new one. The routes `PATCH /rooms/{code}`, `/leave` and `/remove` of the design go away.
   - Only the host deletes the room. The guest sees the room in their list and can open it again, until the host deletes it.
   - A user with a seat who calls join gets 200 and no change. So a second click or a reload does no harm. Another user gets 409.
   - Join sets the seat only when it is still `null` (`join` of decision 3). If another user took it in between, the route answers 409.
   - A guest whose user no longer exists keeps the seat. The answer shows `{ id, gone: true }`, and the UI shows "Deleted player". The design's "A seat whose user no longer exists counts as free" goes away, because the room is locked.
   - A room whose host no longer exists is deleted when a route reads it, and the route answers 404. The list leaves it out and deletes it. This is the design's rule.
6. **One hosted room per user.** The user decided on 2026-10-09, to keep the cost down. To host a new room, the user deletes the old one first. `POST /rooms` answers 409. The unique index on `host` makes sure of it also for two requests at the same time. The memory store checks it in `create`. A user can be the guest in any number of rooms. `GET /rooms` returns at most 100 rooms.
7. **Body checks.** `mapId` and the roster `code` have the limits of "Names". The server does not check that the map exists or that the code is a valid roster. The web app leaves out rooms of a map that it does not have, as today.
8. **Table merge.** `PUT /rooms/{code}/table`:
   - `bodyLimit` of Hono with 1 MB answers 413.
   - `isYjsUpdate(bytes)` decodes the bytes with `Y.decodeUpdate`. An error answers 400 `Invalid table`. `POST /rooms` checks its table the same way.
   - The route reads `{ table, tableRev }`, merges with `Y.mergeUpdates([table, bytes])`, and writes with `replaceTable(code, tableRev, merged)`. If that fails, it reads, merges and writes once more. If that fails too, it answers 409. The browser tries again with its next write.
   - A merged table above 1 MB is not written (413), so a stored table never passes the limit.
   - One log line per write with the size of the body and of the merged table.
9. **Binary in the Lambda.** A function URL sends a binary body as base64 with `isBase64Encoded: true`. `@hono/aws-lambda` decodes it. It encodes an `application/octet-stream` answer as base64 (`defaultIsContentTypeBinary`). Checked in its source on 2026-10-09. `lambda-binary.test.ts` sends a fake function URL event through `handle(createApp(...))` and checks both directions. So no deploy is needed to test it.
10. **Rosters of a multiplayer room.** The user decided on 2026-10-09.
    - Each roster is its own key in the table (`rosters.blue`, `rosters.red`). Each browser writes only the key of its own seat. The host never writes the guest's key. So the two players never write the same key.
    - The host gives their roster at creation. It is in the start table (decision 1) and in the server record.
    - The guest gives their roster to join. It is required. It goes into the server record. The first time the guest's browser opens the table, App writes it into the guest's key, when that key is empty. The setup does not restart: a key that changes from empty to a roster does not change any card that the setup chose.
    - After that, both rosters are fixed (decision 5). The server record keeps a copy only for the lobby tile and the join page.
    - A roster change in the room can come later, if players ask for it.
11. **`DELETE /me`.** In this order: `deleteHostedBy(user)`, then the user. The user's guest seats keep the id (decision 5). If a step fails, the route answers 500, and a second call finishes the work.
12. **IndexedDB of a multiplayer room.**
    - The database is `mcp-assist-3d/multiplayer/<user id>/<code>`. So single player and multiplayer tables never share a database, and two users of one browser never share one.
    - `deleteDoc(name)` deletes it after **Delete**, and when the server answers 403 or 404 for the room or its table.
    - Cleanup: each time `GET /rooms` succeeds, the lobby deletes the databases of this user whose code is not in the list. So a room that the host deleted leaves no copy in the guest's browser. `indexedDB.databases()` lists the names. A browser without it skips the cleanup. The user asked on 2026-10-09 that the list shows deletes at once. This applies the same rule to the copies.
13. **No Save game and no Load game.** The user decided on 2026-10-09: the app does not need a game file. A single player room keeps its table in IndexedDB. A multiplayer room keeps it on the server, with a copy in IndexedDB.
    - Removed: the two toolbar buttons, `handleSaveGame` and `handleLoadGame` in `App.jsx`, the game path of `Table.jsx` (`handleLoadGame`, the `game` state), the `game` argument of `openTableDoc`, the `changed` argument of `watchRoomRecord`, and `readGame` with its tests.
    - `encodeGame` stays: it makes the bytes of the start table and of the table writes. It is renamed `encodeTable`. `scripts/yjs-size.mjs` uses the new name.
    - In step 5 the file was also a test tool: the same test case in each browser pair. The user sets up each test by hand now.
    - **Toolbar of a multiplayer room:** no map picker (fixed map, as in a single player room) and no Roster group (decision 10).
14. **Open a multiplayer room** (`Table.jsx`).
    1. Open the IndexedDB document, with the 5-second rule of today.
    2. `GET /rooms/{code}/table`. Apply it with the origin `'server'`.
    3. The schema check of today. A table of another schema gets a new start table.
    4. Mount App. Start the writer (decision 16).
    - 403 or 404: the lobby with "Room K7Q2-M9XD not found." or "You have no seat in room K7Q2-M9XD.", and the database is deleted.
    - No answer or 5xx: the lobby with "Could not load room K7Q2-M9XD. Try again." The table does not open from the IndexedDB copy alone. The user decided on 2026-10-09: when the server is down, multiplayer rooms cannot be used. Reason: `Root.jsx` needs the server to find the seat anyway (decision 17), so a second offline path would only add code.
15. **The host deletes the room while the guest is in it.** The user asked on 2026-10-09 that the guest must then leave the room. In step 7 there is no connection between the two browsers, and a poll would add Lambda requests. So:
    - The guest's next table write gets 404. The guest's browser then opens the lobby with "The host deleted room K7Q2-M9XD.", and deletes its copy.
    - The guest finds out only at that write: 60 s after their next change, or when the tab is hidden. A guest who changes nothing stays on the table until then.
    - Step 8: when both players are connected, the host's browser tells the guest's browser at once over the connection. No server request.
    - A check when the tab shows again, or a poll, can come later if real games show a need.
16. **Table writer** (`serverTable.js`, `watchServerTable`).
    - A document update with an origin other than `'server'` marks the table as changed.
    - The first change starts a 60-second timer. When it ends, the writer sends `PUT` with `Y.encodeStateAsUpdate(doc)`.
    - `flush()` writes at once when the table changed: on **← Lobby**, and when the tab is hidden (`visibilitychange`). The hidden write uses `keepalive` when the body is at most 60 KB, because the tab can close next. `keepalive` allows 64 KB per page.
    - One write at a time. A change during a write starts the next timer.
    - A failed write (no answer, 409, 5xx) keeps the change and tries again after 60 s.
    - 404 ends the room for this player (decision 15).
    - 403 or 413 stops the writer. The HUD shows a warning until the player closes it: "This table is no longer saved on the server: <error>". The IndexedDB copy still saves.
    - At open, `hasLocalChanges(doc, serverBytes)` compares `Y.snapshot` of the document with the snapshot of a document made from the server bytes (`Y.equalSnapshots`). If they differ, this browser has changes that the server does not have, for example from a closed page. Then the writer writes at once. A state vector alone is not enough, because a delete does not change it.
    - No write on page close (design, "Page close").
    - `watchServerTable({ doc, put, onGone, onStop, setTimer, ... })` gets `put` and the timers as arguments, so `node --test` can test it with `mock.timers`.
17. **Room link** (`Root.jsx`, `roomPage.js`). `#room=<code>` opens, in this order:
    1. A single player room of this browser: that room, as today.
    2. Login off (production now): the lobby with "Room K7Q2-M9XD is not in this browser.", as today. No API call.
    3. The session is `loading`: wait, with `LoadingOverlay`.
    4. `GET /rooms/{code}`. 404: the lobby with "Room K7Q2-M9XD not found.". No answer: "Could not load room K7Q2-M9XD: the server does not answer.".
    5. The user has a seat: the multiplayer room.
    6. A free seat: the join page. Logged out: the join page with a login button instead of **Join**.
    7. No free seat: the lobby with "This room has two players already.".
    - `roomPage({ singleRoom, authOn, session, room })` is a pure function with tests. It returns the kind of page. `Root.jsx` does the calls.
    - The page is found again when the user changes. So a dev login on the join page shows **Join** at once.
18. **Lobby.** One list of single player and multiplayer rooms, the last changed first (`roomList.js`).
    - The list loads from the server each time the lobby shows. No cache.
    - A multiplayer tile: the map card, the map name, the code, the last change, and each seat: avatar and name, "Free seat", or "Deleted player".
    - Buttons: **Blue** and **Red** show the roster (as today, from the server record). **Delete** only for the host, with a browser confirm.
    - A single player tile shows "Single player".
    - Login off or logged out: only the single player rooms. No API call.
    - `GET /rooms` fails: the single player rooms, and the message "Could not load your multiplayer rooms".
    - The roster popup of a tile moves to `RoomRosterPopup.jsx`, because the join page uses it too.
19. **New room dialog.**
    - Login off: no choice. The dialog makes a single player room, as today.
    - A choice at the top: **Single player** or **Multiplayer**.
    - Logged in: **Multiplayer** by default.
    - Logged out: **Multiplayer** is disabled, with "Log in with Discord to play multiplayer". In a dev build without `VITE_DISCORD_CLIENT_ID`: "Log in to play multiplayer", because the login there is the dev login.
    - Session `error`: **Multiplayer** is disabled, with "Multiplayer is not available: the server does not answer.".
    - The user hosts a room already (from the lobby list): **Multiplayer** shows "You host room K7Q2-M9XD already. Delete it to create a new one.", and **Create room** is disabled. The server checks it too (decision 6).
    - **Single player:** both roster fields, as today.
    - **Multiplayer:** **Blue** and **Red** chips choose the own side (Blue by default). One roster field, in the color of that side. It is required, with the rules of the Blue field today.
    - **Create room** with **Multiplayer**: the start table (decision 1), `POST /rooms`, then the room link. An error shows in the dialog: "Could not create the room: <error>".
20. **Join page** (`JoinRoom.jsx`).
    - The lobby header with `UserMenu`, so the dev login works there too.
    - The map card and name, the room code, the host's avatar and name, and the host's roster chip, which opens `RoomRosterPopup`.
    - A roster field for the free side. Required (decision 10). **Join** works when the text has a known code, the same rule as the Blue field of the new room dialog.
    - The text: "After you join, the players and the rosters of this room cannot change."
    - **Join**: `POST /rooms/{code}/join`, then the multiplayer room. An error shows on the page.
    - Logged out: **Log in with Discord to join** (`login()`, which keeps the room link as `returnHash`). In a dev build without Discord: the text "Log in above to join".
    - **← Lobby** goes back without joining.
21. **API client.** `api(path, { method, json, bytes, keepalive, binary })`. `bytes`: a `Uint8Array` body with `Content-Type: application/octet-stream`. `binary: true`: the answer is a `Uint8Array`. Errors stay `ApiError`. `serverStore.js` is the only caller for rooms.
22. **Side in a multiplayer room.** App gets `room = { id, multiplayer: true, side, host, mapId, rosters, players }`. `side` is the seat of the user. App uses it for the guest's roster (decision 10). The camera turn for Red and the names in the toolbar come in step 8.
23. **Copy link.** The user asked on 2026-10-09 for the same button in the lobby tile and in the toolbar of a multiplayer room.
    - One component, `CopyLinkButton.jsx`, with the room code as its prop. It copies `<origin>/#room=<code>` with `navigator.clipboard.writeText`.
    - It shows only while the guest seat is free, because after the join nobody else can use the link.
    - The button itself shows the result for 2 s: "Link copied", or "Copy failed" when the browser refuses. So it works the same in the lobby, which has no HUD, and in the room.
    - In the toolbar it is next to the room code. The toolbar knows the seats from the room at open. If the guest joins while the host is in the room, the button stays until the room opens again. No server request for it.

## Phase 1: Rooms store and seat routes

Read: auth doc "Online rooms" ("Data", "Rules", "Endpoints"), "Privacy" (Delete account). Decisions 3 to 7 and 11. `apps/api/src/*`, `apps/api/test/*`. Hono docs for `bodyLimit`. Yjs docs for `decodeUpdate`.

Work:
1. `pnpm --filter api add yjs@13.6.33`.
2. `rooms/code.ts`: `newRoomCode()` with `crypto.randomInt` over the alphabet, `isRoomCode(text)`.
3. `rooms/table.ts`: `isYjsUpdate(bytes)` (decision 8). `mergeTables` comes in Phase 2.
4. `stores/store.ts`: `RoomDoc`, `RoomPlayer`, `RoomsStore`, `HostingError` (decision 3), `publicRoom(doc, users)`, `UsersStore.getMany`. `Store` gets `rooms`.
5. `stores/memory.ts`, `stores/mongo.ts`: the rooms store, the indexes (decision 4).
6. `routes/rooms.ts`: `GET /rooms`, `POST /rooms`, `GET /rooms/{code}`, `POST /rooms/{code}/join`, `DELETE /rooms/{code}` (decisions 5 to 7). One helper reads the room, deletes it when the host is gone, and answers 404.
7. `routes/me.ts`: `DELETE /me` (decision 11).
8. `app.ts`: mount the rooms routes. `requireUser` on each route that needs login, not on `GET /rooms/{code}`.
9. Tests:
   - `rooms.test.ts`: create (201, code format, the host in the chosen seat, the other seat `null`). A bad body, a missing roster, a bad `mapId` and a bad table give 400. No token gives 401. A second room of the same host gives 409. After the host deletes the first room, a new one works. The list has the user's rooms as host and as guest, the last changed first, with names and avatars, and without `table`. `GET /rooms/{code}` works without a token. A bad code format and an unknown code give 404. Join: a free seat gives 200 with the roster. Join again gives 200 and no change. A third user gets 409. Join without a roster gives 400. Delete: the host gets 204, then 404, and the room leaves the guest's list. The guest gets 403. A deleted guest shows as `{ id, gone: true }`, and the seat is not free. A deleted host's room answers 404 and leaves the list.
   - `me.test.ts`: after `DELETE /me`, the user's hosted room is gone. In another room, the user's guest seat shows `gone`.
   - `rooms.mongo.test.ts`: the store calls on Mongo. The four indexes exist, `host` unique, the TTL one with `expireAfterSeconds: 0`. A list read has no `table`. `join` on a taken seat writes nothing. A second room of one host fails with `HostingError`. A duplicate code tries a new one (pass a code maker that gives the same code first).

Checks:
- `pnpm --filter api typecheck`, `pnpm --filter api test`, `pnpm --filter api test:mongo` pass.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

Added `yjs@13.6.33`, `rooms/code.ts`, `rooms/table.ts` (`isYjsUpdate`), the rooms store (types, memory, Mongo with the four indexes), `routes/rooms.ts`, the rooms part of `DELETE /me`, and the mount in `app.ts`.

Tests: `pnpm --filter api test` 81 pass (new: `rooms.test.ts`, one case in `me.test.ts`). `test:mongo` 15 pass (new: `rooms.mongo.test.ts`, 9 cases). typecheck, format and lint show no new errors.

Notes, no change of decisions:
- `UsersStore.getMany` returns a `Map` by id. `publicRoom(doc, users)` takes that map.
- `host` in a room answer is the host's user id. The host's name and avatar are in `players`.
- `create(room, now, makeCode?)` takes `now` as an argument.
- `POST /rooms` has a `bodyLimit` of about 1.4 MB (base64 size of 1 MB). A bigger body gives 413. The exact 1 MB check runs after the decode.

## Phase 2: Table snapshot

Read: auth doc "Table on the server". Decisions 8 and 9. `apps/api/src/lambda.ts`. `@hono/aws-lambda` `handle` (its `dist/handler.js`). Yjs docs for `mergeUpdates`.

Work:
1. `rooms/table.ts`: `mergeTables(stored, update)`.
2. `routes/table.ts`: `GET` and `PUT /rooms/{code}/table` (decision 8). The `GET` answer has `Content-Type: application/octet-stream`.
3. `app.ts`: mount the table routes.
4. Tests:
   - `table.test.ts`: `GET` gives the bytes of the start table. No token gives 401. No seat gives 403. Unknown room gives 404. A `PUT` with a new change, then `GET`: the table has the start table and the change. Bytes that are not a Yjs update give 400. A body above 1 MB gives 413. Two `PUT`s at the same time, each with another change: the table has both. For the memory store, a test store wraps `getTable` so that the second write happens between the read and the write of the first. `tableRev` goes up, `updatedAt` moves. A `PUT` after the host deleted the room gives 404.
   - `lambda-binary.test.ts`: `handle(createApp(...))` with a fake function URL event (version 2.0, `isBase64Encoded: true`) for `PUT`, then `GET`. The `GET` result has `isBase64Encoded: true`, and its body decodes to a table with the change.
   - `rooms.mongo.test.ts`: two `PUT`s at the same time through the app with the Mongo store keep both changes.

Checks:
- `pnpm --filter api typecheck`, `pnpm --filter api test`, `pnpm --filter api test:mongo` pass.
- `pnpm --filter infra test` and `pnpm --filter infra synth` pass. Give the size of the Lambda `index.mjs` before and after (882,867 bytes after step 6).
- `pnpm format`, `pnpm lint`: no new errors.

### Result

Added `mergeTables` in `rooms/table.ts`, `routes/table.ts` (`GET` and `PUT /rooms/{code}/table`), and the mount in `app.ts`. `rooms/read.ts` has the shared room read (404, host-gone cleanup). `routes/rooms.ts` uses it now.

Tests: `pnpm --filter api test` 93 pass (new: `table.test.ts`, `lambda-binary.test.ts`). `test:mongo` 16 pass (one new case in `rooms.mongo.test.ts`). `pnpm --filter infra test` 16 pass, `synth` passes. typecheck, format and lint show no new errors.

Lambda `index.mjs`: 882,867 bytes after step 6, 952,356 bytes at b4b8e6d (yjs imports from Phase 1), 956,348 bytes after Phase 2.

Notes, no change of decisions:
- Extra cases in `table.test.ts`: merged table above 1 MB gives 413 and no write, two lost writes give 409, a log line with sizes and no token.
- `helpers.ts` has `addUser`, `tableUpdate` and `tableEntries` for the table tests.
- Order in `PUT`: login, `bodyLimit` (413), seat and room (403, 404), Yjs check (400).

## Phase 3: Lobby list and new multiplayer room

Read: decisions 1, 2, 12, 18, 19, 21, 23. Auth doc "Lobby and room UI". `apps/web/src/api/client.js`, `auth/session.js`, `auth/useUser.js`, `auth/avatar.js`, `components/Lobby.jsx`, `components/NewRoomDialog.jsx`, `components/UserMenu.jsx`, `rooms/store.js`, `rooms/table.js`, `net/doc.js`, `index.css` (lobby styles).

Work:
1. `api/client.js`: `bytes`, `binary`, `keepalive` (decision 21).
2. `rooms/base64.js`: `toBase64(bytes)`, `fromBase64(text)`. No `Uint8Array.toBase64`, because Safari and Firefox have it only in new versions.
3. `rooms/startTable.js`: `startTableBytes(mapId, rosters)` (decision 1).
4. `rooms/serverStore.js`: one function per route of "Names". The table calls take `keepalive`.
5. `rooms/store.js`: `multiplayerDocName(userId, code)`, `deleteDoc(name)`. `deleteRoom` uses `deleteDoc`.
6. `rooms/localDocs.js`: `staleDocNames(names, userId, codes)` (pure), and `deleteStaleDocs(userId, codes)` with `indexedDB.databases()` (decision 12).
7. `rooms/roomList.js`: `roomList(single, multiplayer)`. One list, the last changed first. Multiplayer `updatedAt` is an ISO string, single player is ms. Rooms of a map that the app does not have are left out, as today.
8. `components/RoomRosterPopup.jsx`: moved out of `Lobby.jsx`, no change.
9. `components/CopyLinkButton.jsx` (decision 23). `components/Lobby.jsx`: one list, the multiplayer tile, **Delete**, **Copy link**, the error message, the cleanup after each list load (decisions 12, 18). It reads `useUser()` and loads `GET /rooms` when the user is logged in.
10. `components/NewRoomDialog.jsx`: the choice, the side chips, the one roster field, the hosted-room message, the multiplayer create (decision 19).
11. `index.css`: the styles of the multiplayer tile, the seats, the choice and the side chips.
12. Tests (`node --test`): `base64.test.js` (round trip, empty, 100 KB). `startTable.test.js` (a new document with the bytes applied has the map, the rosters, and the terrain of the map. Not `readGame`, which goes in Phase 5). `roomList.test.js` (order across both kinds, unknown map left out). `localDocs.test.js` (only this user's multiplayer names whose code is not in the list. Never single player names, never another user's names).

After this phase, a multiplayer room can be created and shows in the lobby. Its link opens in Phase 4.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.
- With login off, the lobby and the dialog make no API call. The **Result** names the check in the code that makes sure of this.

### Result

Added `bytes`, `binary` and `keepalive` in `api/client.js`, and in `rooms/`: `base64.js`, `startTable.js`, `serverStore.js`, `localDocs.js`, `roomList.js`, plus `multiplayerDocName` and `deleteDoc` in `store.js`. Added `RoomRosterPopup.jsx` (moved), `CopyLinkButton.jsx`, the one list and multiplayer tile in `Lobby.jsx`, the choice, side chips and multiplayer create in `NewRoomDialog.jsx`, and the styles in `index.css`.

Tests: `pnpm --filter web test` 37 pass (new: `base64`, `startTable`, `roomList`, `localDocs`). `pnpm --filter web build` passes. Lint: 44 warnings before and after, none in the new files.

Login-off check: `Lobby.jsx` loads `GET /rooms` in an effect that starts with `if (!loggedIn) return`, where `loggedIn = status === 'in'`. With login off, `status` is `'off'`. `NewRoomDialog.jsx` calls the API only in `handleCreate`, and only when `multiplayer` is true, which needs `loggedIn`.

Deviation: `scoreboard/affiliations.js` now imports its JSON with `with { type: 'json' }`. Without it, `node --test` cannot load `rooms/table.js`, which `startTable.js` needs. The build is fine with it.

Choices where the plan was open:
- Dialog while the session is `loading`: Multiplayer is disabled with "Checking your login".
- A failed **Delete** of a multiplayer room shows "Could not delete the room: <error>" as a lobby notice. A 404 counts as deleted.
- The dialog calls `onCreate({ id: code })`, and the lobby opens `#room=<code>`.

## Phase 4: Open a multiplayer room, join, write the table

Read: decisions 14 to 17, 20, 22, 23. `apps/web/src/Root.jsx`, `Table.jsx`, `rooms/tableDoc.js`, `rooms/store.js`, `components/LoadingOverlay.jsx`, the storage warning in `App.jsx` (`storageFailed`). Yjs docs for `snapshot`, `equalSnapshots`. Node docs for `mock.timers`.

Work:
1. `rooms/tableDoc.js`: `openTableDoc(name)` takes the database name (`null` for the Sandbox). The `game` argument goes in Phase 5.
2. `rooms/serverTable.js`: `hasLocalChanges`, `watchServerTable` (decision 16).
3. `rooms/roomPage.js`: `roomPage(...)` (decision 17).
4. `Root.jsx`: the room link (decision 17). The multiplayer room gets the `room` of decision 22. The writer's 404 opens the lobby with the notice of decision 15.
5. `Table.jsx`: open a multiplayer room (decision 14). Start and stop the writer. `flush()` before `onExit`. A writer stop gives App a `serverWarning` text.
6. `App.jsx`: `serverWarning` shows like the storage warning.
7. `components/Toolbar.jsx`: a multiplayer room has no Roster group (decision 13), and **Copy link** next to the room code while the guest seat is free (decision 23). Single player rooms and the Sandbox as today.
8. `components/JoinRoom.jsx` (decision 20). `index.css`: its styles.
9. Tests (`node --test`):
   - `roomPage.test.js`: each case of decision 17.
   - `serverTable.test.js`: no write without a change. One write 60 s after the first change, not before. `flush()` writes at once, and not again without a new change. A change during a write gives one more write later. A failure tries again after 60 s. 404 calls `onGone`. 403 and 413 stop the writer and report the error. `keepalive` only for bodies of at most 60 KB. `hasLocalChanges`: false for the same bytes, true after a local insert, true after a local delete only.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.
- `grep -rn "localStorage\|sessionStorage" apps/web/src/rooms apps/web/src/components` shows only `rooms/store.js`.

### Result

Added `rooms/serverTable.js` (`hasLocalChanges`, `watchServerTable`), `rooms/roomPage.js` (`roomPage`, `seatOf`, `multiplayerRoom`), `components/JoinRoom.jsx` and its styles, `components/LobbyHeader.jsx` and `components/RosterField.jsx` (both moved out of `Lobby.jsx` and `NewRoomDialog.jsx`, so the join page shares them). `openTableDoc(name, game)` takes the database name. `Root.jsx` finds the page of a room link and fetches `GET /rooms/{code}`. `Table.jsx` opens a multiplayer room and runs the writer. `App.jsx` shows `serverWarning`. `Toolbar.jsx` has no Roster group in a multiplayer room, and **Copy link** while the guest seat is free.

Tests: `pnpm --filter web test` 62 pass (37 before; new: `roomPage` 10, `serverTable` 15). `pnpm --filter web build` passes. Lint: 44 warnings before and after, none new. The `localStorage` grep shows only `rooms/store.js`.

Notes:
- `hasLocalChanges` rebuilds both docs with `gc: false`. A delete-only change shows in the test.
- `roomPage` also takes `code`, for the notice texts. `room` is `undefined` (not asked), `{ notFound: true }`, `{ failed: true }`, or the API room. It returns `single`, `wait`, `fetch`, `multiplayer`, `join` or `lobby` with a notice.
- `watchServerTable` has an option `changed` (the first `flush()` writes it) and `delay`. A `flush()` during a write is queued and writes when that write ends. `stop()` drops it, so the change stays in IndexedDB and `hasLocalChanges` finds it at the next open.
- `Table.jsx` does the 403/404 cleanup and the writer 404 itself (it has the open document, which must close before the database is deleted). `Root` only shows the notice: `onExit(notice)`.
- UI choices: while the room link loads, `LoadingOverlay`. The server warning stays closed for the same text and shows again for a new one. The join page shows "Deleted player" for a host that is gone. The host roster chip reads "Blue roster" or "Red roster".


## Phase 5: The guest's roster, no game file

Read: decisions 10 and 13. `apps/web/src/App.jsx` (`rosters`, `handleRosterLoad`, `handleSaveGame`, `handleLoadGame`), `Table.jsx`, `rooms/tableDoc.js`, `components/Toolbar.jsx`, `net/doc.js`, `net/doc.test.js`, `scripts/yjs-size.mjs`.

Work:
1. `App.jsx`: at mount of a multiplayer room, when the key of `room.side` in the table is empty and the server record has a roster for that side, write it into that key only. No setup restart, no confirm, no HUD message.
2. Remove **Save game** and **Load game** (decision 13).

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `grep -rn "readGame\|encodeGame\|LoadGame\|SaveGame" apps/web` finds nothing.
- `pnpm --filter web yjs-size` runs.
- `pnpm format`, `pnpm lint`: no new errors.

### Result

Added an effect in `App.jsx`: in a multiplayer room, when `table.rosters` has no roster for `room.side` and the server record has one, it writes that key with `setField`. It never writes the other side.

Removed Save game and Load game: the two toolbar buttons and the file input, `handleSaveGame`, `handleLoadGame`, the `game` state and `handleLoadGame` in `Table.jsx`, the `game` argument of `openTableDoc`, the `changed` argument of `watchRoomRecord`, and `readGame` with its tests. `encodeGame` is now `encodeTable` (`net/doc.js`, `startTable.js`, `yjs-size.mjs`, tests). No CSS used only by these.

Tests: `pnpm --filter web test` 60 pass (62 before: 3 `readGame` tests removed, 1 `encodeTable` test added). Build passes, `yjs-size` runs, the grep finds nothing. Lint: 44 warnings before and after.

No setup restart: the setup restarts only in `restartSetup`, which only `handleRosterLoad` and `handleRosterRemove` call. No effect watches `rosters`. The new write calls neither, so there is no confirm and no HUD message. A key that goes from empty to a roster changes no card that the setup chose.

No deviation.

## Phase 6: Docs

Work:
1. `docs/feature-auth.md`:
   - Status line.
   - "Terms": single player room and multiplayer room replace offline room and online room. Host and guest.
   - "Data": `host`, `table` always set (decision 1), `version`. "Rules": the lock (decision 5), one hosted room (decision 6), the guest after a delete (decision 15).
   - "Table on the server": the start table comes with `POST /rooms`. The writer rules of decision 16. The merge retry and 409.
   - "Endpoints": the answers of "Names". `PATCH`, `/leave` and `/remove` go away.
   - "Lobby and room UI": the list, the tile, **Copy link**, the dialog choice, the join page.
   - New text: the rosters (decision 10).
   - "Code layout": the new files.
2. `docs/feature-rooms.md`: the three kinds of table. The lobby has one list. The new room dialog has the choice. "Relation to peer-to-peer": multiplayer rooms. "Save game and Load game" goes away (decision 13).
3. `docs/feature-peer-to-peer.md`: the names. "Save and load a game" goes away, and "Local testing" no longer names it (decision 13). "Yjs document": the IndexedDB name of a multiplayer room. "Connect flow": the host's browser tells the guest when it deletes the room (decision 15).
4. `docs/feature-backend.md`: "Code" (`rooms/`, `routes/rooms.ts`, `routes/table.ts`), "Stack" (`yjs` in the API, the bundle size).
5. `docs/plans/implement-backend.md`: the step name, a short **Result** under step 7, and the note for step 8 of decision 15.
6. `README.md`: multiplayer rooms in local dev: two browsers, two dev logins, the dev Mongo keeps the rooms.

Checks:
- `pnpm test` at the root passes.
- `pnpm format`, `pnpm lint`: no new errors.
- `grep -rn "offline room\|online room" docs/feature-*.md` finds only text that explains the rename.

### Result

Docs changed: `docs/feature-auth.md` (terms, data, rules, rosters, table, endpoints, lobby UI, local testing, code layout, phases, decisions 12 to 16), `docs/feature-rooms.md`, `docs/feature-peer-to-peer.md`, `docs/feature-backend.md`, `docs/plans/implement-backend.md` (step name, Result, note for step 8), `README.md` (multiplayer rooms in local dev).

The names are single player room, multiplayer room, host and guest. The old names stay only where the docs explain the rename. `table: null`, `PATCH`, `/leave`, `/remove`, Save game and Load game are gone from the docs. `feature-rooms.md` decision 17 now says Load game was removed.

Deviation from the plan: none. The Lambda size in the backend doc is 956,348 bytes (Phase 2 Result).

## User

After Phase 2, in this order:
1. `pnpm --filter infra cdk:deploy`.
2. Checks against the deployed API (`<ApiUrl>` without the trailing `/`):
   - `curl <ApiUrl>/health` → `db: "ok"`.
   - `curl -i <ApiUrl>/rooms` → 401 `{"error":"Not logged in"}`.
   - `curl -i <ApiUrl>/rooms/AAAA-AAAA` → 404 `{"error":"Room not found"}`.
   - `curl -i <ApiUrl>/rooms/AAAA-AAAA/table` → 401.

After Phase 5, with `pnpm --filter api db:up`, `STORE=mongo` and `pnpm dev`. Chrome is Alice, Firefox is Bob, Safari is the third browser:
3. Chrome: dev login `alice`. **+** → **Multiplayer** is selected → **Red**, a roster → **Create room**. The room opens with the map and Alice's characters in the Red tray. The toolbar has no Roster group, no **Save game** and no **Load game**. **Copy link** next to the room code shows "Link copied", and the clipboard has the link. Move a model. **← Lobby**: the tile shows Alice in Red, "Free seat" in Blue, and **Copy link**.
4. Chrome: **+** → **Multiplayer**: "You host room ... already", and **Create room** is disabled. **Single player** still works.
5. Firefox: dev login `bob`. Open Alice's link: the join page shows the map, Alice, and her roster. **Join** is disabled without a roster. Paste a roster, **Join**. The table has Alice's moved model and both rosters. The toolbar has no **Copy link**.
6. Firefox: move a model, **← Lobby**. The tile has no **Delete**. Chrome: open the room again. It has Bob's roster and his move.
7. Safari: dev login `alice`. The lobby lists the room. Open it: the same table.
8. Safari: log out, open the link: the join page with the login text. Dev login `carol`: "This room has two players already.".
9. Firefox: open the room and leave it open. Chrome: **Delete** the room. Firefox: move a model, wait 60 s: the lobby with "The host deleted room ...". The tile is gone.
10. Chrome: create a new multiplayer room. Change the table, switch to another tab, and wait 2 s. DevTools → Network shows one `PUT .../table`.
11. Stop `pnpm dev`, run only `pnpm --filter web dev`: the lobby shows the single player rooms and "Could not load your multiplayer rooms". The new room dialog has **Multiplayer** disabled.
12. Single player rooms and the Sandbox work as before.

After the Netlify build of the merged code:
13. Production shows no login button and no **Multiplayer** choice. DevTools → Network shows no request to the API.

### User check results

None yet.

## Done when

- `pnpm test`, `pnpm typecheck`, `pnpm --filter web build` pass. `pnpm lint` has no new errors.
- The user checks pass.
- The API with the room routes is deployed. Production shows no login and no multiplayer rooms.
- The **Result** of each phase is filled in.

## Risks and open questions

1. **Binary bodies in the Lambda.** Decision 9 tests the adapter with a fake event. The real function URL is first used with a token in step 12. Until then, the `curl` checks show only the routes and the auth.
2. **Lambda bundle.** `yjs` adds to the bundle. Phase 2 measures it.
3. **Table growth.** `Y.mergeUpdates` does not remove deleted content the way a document does. Each browser writes the whole document, so the merged table should stay close to the size of one document. The log line of each write shows it.
4. **No live sync.** Both players can change the same model before step 8. Yjs keeps one value per field. A player sees the other's change only when the room opens again.
5. **Guest after a delete.** The guest finds out at their next write, not at once (decision 15).
6. **Lobby time.** **← Lobby** starts the table write and opens the lobby at once. The lobby can show the time of the write before.
7. **`indexedDB.databases()`.** Chrome, Safari and Firefox (since version 126) have it. Without it, the copies of deleted rooms stay. A table is about 30 KB.
