# Plan: random map of a multiplayer room spawns when the guest joins

Requested by the user on 2026-10-14. Status: Not started.

Three coder steps, one commit each. Branch `random-map-on-join`, worktree `../mcp_assist_3d-random-map-on-join`.

## Request

1. Multiplayer room with **Random map**: no player knows the map before both players are in the room.
   - The host enters the room: no board on the mat. A note says: "Random map: it spawns automatically when the second player joins the room."
   - The guest opens the link: the join page shows the back of a map card.
   - The guest joins: the app picks the map at random, and the board spawns.
2. Multiplayer room with a chosen map: as today. The board spawns when the host enters. The join page shows the map.
3. New room dialog: **Random map** is a switch, not a chip button. A button invites a click, and that confuses.

## Facts

- `NewRoomDialog.jsx` picks the map at creation for both kinds of room. Multiplayer: `startTableBytes(mapId, rosters)` builds the start table, and `POST /rooms` sends `{ mapId, roster, table }`.
- The API (`apps/api/src/routes/rooms.ts`, `stores/*.ts`) stores `mapId: string`, required. `join` sets the guest seat and roster only when the seat is free (one atomic write).
- The map in the table is the Yjs field `game.mapId`. App reads it with `useYField`, so a change of the field reaches App in both browsers.
- `mapTerrain(mapId)` gives each terrain piece a random id (`crypto.randomUUID()`). Therefore only the host's browser builds the start table: two fills would merge into two sets of pieces. Terrain is a list keyed by id.
- `MAPS[mapId]` is read without a check in App, Scene, Toolbar, preload, Lobby, JoinRoom, roomList and Root.
- No switch component exists. `.chip` and `.roster-toggle` are buttons.
- The rooms feature doc says "Random map switch" already, but the code has a chip.

## Decisions

1. **The server picks the map** at join, not a browser. So neither the host nor the guest can know it earlier.
   - `POST /rooms` takes either `mapId` or `maps`: the list of map ids that the host's browser has (`Object.keys(MAPS)`). Exactly one of the two. `maps`: 1 to 50 ids, each matches the `mapId` regex.
   - The room stores `mapId: null` and `maps`. `GET /rooms/{code}` and the room list answer `mapId: null` and do not send `maps`.
   - `POST /rooms/{code}/join`: when `mapId` is null, the server picks one id from `maps` and writes it in the same atomic write as the seat. The join answer has the `mapId`.
2. **Terrain ids are fixed per map:** `<mapId>:<index>`, not random. Therefore two browsers that fill the same map write the same keys, and the pieces merge into one set. The Sandbox map picker uses the same ids. Old tables keep their random ids.
3. **The start table of a random room has no map:** `game.mapId` is null and `terrain` is empty.
4. **Map fill:** when a multiplayer table opens with `game.mapId` null in the document and a `mapId` in the room, the browser writes `game.mapId` and the terrain of that map in one change. The guest's browser does it right after **Join**. The host's browser gets the map from the guest over peer-to-peer. A host who opens the room later fills the map too, if the document still has none. Because of decision 2, two fills do no harm.
5. **Table without a map** (host waits): no mat image, no terrain. The table, trays and HUD show as usual. A note in the middle of the HUD: "Random map: it spawns automatically when the second player joins the room." It goes away when `game.mapId` is set. The mat and terrain then load in their own Suspense, with no full loading screen.
6. **Join page, lobby tile with `mapId` null:** the map card back, the name "Random map". The join page also says: "The map spawns when you join."
7. **Switch:** a new `Switch` component: a `<button role="switch" aria-checked>` with a track and a knob, and the label "Random map" next to it. Uses the existing color tokens. The hint under the card back:
   - Single player: "The app picks the map when it creates the room." (as today)
   - Multiplayer: "The map spawns when the second player joins the room."
8. **Single player rooms do not change.** Random still picks at creation.
9. **No migration.** Rooms on the server keep their `mapId`. A record with no `maps` field behaves as today.

## Step 1: API

Work:
1. `stores/store.ts`: `RoomDoc.mapId: string | null`, `RoomDoc.maps?: string[]`, `NewRoom` the same. `PublicRoom.mapId: string | null`. `publicRoom` leaves out `maps`.
2. `join(code, side, userId, roster, now, mapId?)`: when `mapId` is given, it also sets `mapId`, in the same write. `memory.ts` and `mongo.ts`.
3. `routes/rooms.ts`: create schema per decision 1 (`mapId` or `maps`, not both, not none: 400). Join: when the room `mapId` is null and `maps` is set, pick one at random (`crypto.randomInt`) and pass it to `join`.
4. Tests: create with `maps`, create with both or none (400), `GET` answers `mapId: null` without `maps`, join sets a `mapId` from the list, a second join (same user) does not change it. Existing tests stay green.
5. Docs: `docs/features/auth.md`, the room record, the `POST /rooms` and join rows, and "Start table" (decision 2 removes the reason "random id").

Checks: `pnpm format`, `pnpm lint`, API tests.

## Step 2: New room dialog, join page, lobby

Work:
1. `components/Switch.jsx` + CSS (decision 7). `NewRoomDialog.jsx` uses it for **Random map**.
2. `NewRoomDialog.jsx`, multiplayer and random: `createServerRoom({ maps: MAP_IDS, roster, table })`. The start table has no map (decision 3): `startTable(null)` gives `mapId: null` and `terrain: []`. `serverStore.createRoom` sends `maps` instead of `mapId`.
3. `rooms/table.js`: `mapTerrain` ids `<mapId>:<index>` (decision 2). Update the comment in `startTable.js`.
4. `JoinRoom.jsx`, `Lobby.jsx`, `rooms/roomList.js`, `Root.jsx`: `mapId` null per decision 6. The lobby keeps a multiplayer tile with `mapId` null in the list. The delete confirm says "Random map".
5. Tests: `mapTerrain` ids, `roomList` with `mapId` null.
6. Docs: `docs/features/rooms.md`, "New room" (switch, multiplayer hint) and "Lobby".

Checks: `pnpm format`, `pnpm lint`, web tests, `pnpm --filter web build`.

## Step 3: Table without a map, and the map fill

Work:
1. `Table.jsx`: the map fill of decision 4, after the server table is applied and the schema check. One `doc.transact`.
2. App, Scene, Toolbar, `rooms/preload.js`, `withPlacements`: `mapId` null means no mat, no terrain, and no mat files to preload. Scene keeps the mat and terrain in their own Suspense, so a later map load does not show the full loading screen.
3. HUD note of decision 5.
4. Tests: a pure helper for the fill (`fillMap(table, mapId)` in `rooms/table.js`) with tests: writes once, a second call with the map set does nothing, two docs that fill and merge have one set of pieces.
5. Docs: `docs/features/rooms.md`, "Room" (the note and the fill), `docs/features/peer-to-peer.md` if it names the start table rule.

Checks: `pnpm format`, `pnpm lint`, web tests, `pnpm --filter web build`.

## User checks

- [ ] New room dialog: Random map is a switch.
- [ ] Multiplayer, random: the host's table has no board and shows the note. The lobby tile shows the card back.
- [ ] The guest's link: the join page shows the card back and "Random map".
- [ ] The guest joins: the board spawns for the guest, and for the host without a reload.
- [ ] Multiplayer, chosen map: the board shows for the host at once, and the join page shows the map.
- [ ] Single player, random: as before.

## Results

Not started.
