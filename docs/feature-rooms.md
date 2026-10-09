# Feature: Rooms

Status: done, 2026-10-07. Not checked in a browser.

## Goal

The app opens on a lobby. The lobby lists the rooms of this browser. A player creates a room with a map and the rosters, enters it later, and finds the table as they left it. The table without a room is the Sandbox: the app as it was before this feature.

There is no server yet. Each room is a record in `localStorage`, and its table is a Yjs document in IndexedDB. The peer-to-peer feature (`docs/feature-peer-to-peer.md`) will let a second player join a room.

## Terms

| Term | Meaning |
|---|---|
| Lobby | The start page. Lists the rooms, creates a room, opens the Sandbox |
| Room | A saved table with a fixed map, the Blue roster and, if given, the Red roster. The record is in `localStorage`, the table in IndexedDB |
| Sandbox | A table with every control: map picker, both roster fields. Not saved |
| Owner | The user who created the room. Only the owner can delete it |
| Room code | The id of a room, for example `K7Q2-M9XD`. The same format as the room code of the peer-to-peer plan |

## Pages

The URL hash selects the page. So the browser back button works, and a reload stays on the same page.

| Hash | Page |
|---|---|
| none | Lobby |
| `#room=K7Q2-M9XD` | Room |
| `#sandbox` | Sandbox |

- `#room=<code>` is the link format of the peer-to-peer plan ("Connect flow"). So the same link can invite the second player later.
- A room code that is not in this browser opens the lobby with the message "Room K7Q2-M9XD is not in this browser".
- Each room and the Sandbox mount a new table, so nothing from the last table stays.

## Lobby

- **Rooms:** a **+** tile, then a tile for each room, the last changed room first. A tile shows the map card, the map name, the room code and the time of the last change. A click on the tile enters the room.
- **Blue** and **Red** on a tile show that roster of the room in the roster popup of the table (`docs/feature-roster.md`). A button shows only when the room has that roster. The popup opens on the first tab with cards, usually Characters. Escape, **×** or a click on the backdrop closes it. The left and right arrows show the previous or next card. **Red** added on 2026-10-07.
- On a narrow tile, **Delete** goes to a second line.
- **Delete** on a tile removes the room. It shows only on rooms that this user owns. Now that is every room. A browser confirm asks first, the same as **Remove** on a character tray.
- **Sandbox:** a button that opens the Sandbox.

## New room

The **+** tile opens a dialog on a blurred backdrop, the same style as the roster popup.

- **Random map** switch, on by default. While it is on, the dialog shows the back of a map card. The app picks the map when the player creates the room.
- With the switch off, a carousel shows the map cards. The card in the middle is the map of the room. It is the same carousel as in the roster popup.
- **Blue roster** and **Red roster:** a text field for the MCT code of each player. Under each field, the dialog shows what it found, for example "10 characters · 10 tactic cards · 5 Secure · 5 Extract", and the unknown codes. The parse rules are the ones of `docs/feature-roster.md`. The Red field was added on 2026-10-07, because the game setup (`docs/feature-setup-game.md`) needs both rosters.
- When the app has no 3D model for a character or no image for a Team Tactic card of a roster, a warning box under its summary names these cards, for example "No 3D model for 2 characters: Angela, Bishop". On the table, these cards show as plates, and a character without a model cannot be spawned. The box is only a warning: **Create room** still works. Added on 2026-10-07.
- **Create room** works when the Blue code has a known card. The Red roster is optional, because the Red field of the toolbar can load it later. A Red text without a known card blocks **Create room**, so a wrong paste does not make a room without Red. **Create room** saves the room and enters it.
- **Cancel**, Escape, **×** or a click on the backdrop closes the dialog.

The carousel shows only maps that the app has (`apps/web/src/terrain/maps.js`). A map card image comes from the TTS mod. `apps/web/scripts/migrate-terrain.mjs` copies it with the map.

## Room

- The player is Blue, the same as before.
- The map is the room map. The toolbar has no map picker. The mat turn buttons stay.
- The rosters come from the room. The Roster group has only the Red field. It loads, replaces or removes the Red roster of the room. The field is empty when the room opens, also when the room has a Red roster.
- With a server, each player will load their own roster when they join. Then the new room dialog will have only the roster of the player who creates the room, and the Red field will be only in the Sandbox.
- **← Lobby** at the start of the toolbar writes the room record and opens the lobby. The toolbar also shows the room code.

## Sandbox

- The app as before: map picker, both roster fields, the same start map.
- Nothing is saved. **← Lobby** asks with a browser confirm first, because the table is lost.

## Loading

The loading screen stays until the files of the map and the models are loaded:

- the mat image, and the mesh, texture and collider of each terrain piece,
- the models of every character in both rosters, and of the characters on the stored table,
- everything that the scene loads outside its own Suspense boundaries: table, light, dice trays, scoring board, roster cards.

The table mounts after that, in one commit. So the terrain colliders and the saved models start in the same frame, and a model that stood on a roof does not fall through it.

How it works:

- `Preload.jsx` sits in the Canvas next to the scene. It loads each file with the same loader and the same input as the component that uses the file. R3F caches a load by the loader and the input, so the component then gets the file at once. A component that loads a list of files (a standee loads its 2 images) uses the same list here.
- The input of each file comes from one helper next to its component: `pieceUrls` in `Terrain.jsx`, `modelUrls` in `CharacterModel.jsx`, `matUrl` in `Scene.jsx`. So the two lists cannot disagree.
- `Ready` comes after the scene in the Canvas. Its effect runs when the scene commits, and the loading screen hides then.
- three.js counts loaded files for the whole page life. The loading screen shows the files since it mounted.
- The Sandbox uses the same screen, with the files of its start map.

Character trays, crisis cards, tokens and tactic cards are not in the list. They are small, and each has its own Suspense, so each shows when its image is in.

## Storage

A room has two parts. The room record is in `localStorage`. The table is a Yjs document in IndexedDB.

| Where | Key or name | Value |
|---|---|---|
| `localStorage` | `mcp-assist-3d/user` | `{ id }`: a random id of the user of this browser, made once |
| `localStorage` | `mcp-assist-3d/room/<code>` | One room record |
| IndexedDB | `mcp-assist-3d/room/<code>` | The Yjs document of the table (`y-indexeddb`) |

The lobby finds the rooms by the key prefix. One key per room, so a room cannot be half written, and there is no list that can disagree with the rooms.

```js
{
  version: 2,
  id: 'K7Q2-M9XD',
  owner: '<user id>',
  createdAt, updatedAt,           // ms since 1970
  mapId: 'vibranium-heist',       // key in MAPS
  rosters: { blue: { code }, red: null | { code } },   // docs/feature-roster.md, "State"
}
```

- The record keeps only the setup and the dates. `mapId` and `rosters` are a copy of the document, for the lobby tile. The lobby does not open the documents.
- The table is in the document. Its layout is in `docs/feature-peer-to-peer.md` ("Yjs document"). The document has the map, the rosters, the characters, the tokens, the cards, the terrain pieces and the model poses.
- `terrain` stores the place of each piece in the map data (`index`, `locked`), not the whole placement. So a fix of the map data reaches old rooms. A deleted piece is not in the list.
- A model writes its pose to `poses` when its body falls asleep. A lifted model (R) writes the place under the lift. A model that moves when the page closes keeps its last rest pose.
- A saved model starts at its pose, asleep. So it does not move before the terrain under it has its colliders. A touch, a drag or a removed terrain piece wakes it.
- A record of version 1 opens with a new table, with its map and rosters. Its old `table` is not read. A document with another `game.schema` gets a new start table.

Not saved: dice, tools, selection, camera, open popups, spectator view, labels, debug mode. The dice are empty when the room opens.

### When the room saves

- The document: at each change. `y-indexeddb` stores each update at once. There is no poll.
- The room record: at most every 2 seconds after a change of the document, when the page closes or reloads (`pagehide`), and when the table unmounts. **← Lobby** writes it first, so the lobby shows the last change. `updatedAt` changes only then, not when a room only opens.
- **Delete** also deletes the IndexedDB database of the room.

### When IndexedDB does not work

- The room waits at most 5 seconds for IndexedDB, with the loading screen. IndexedDB can be turned off (blocked site data), and then it never answers.
- After 5 seconds, or after an error, the table opens in memory. The HUD shows a warning: "Room not saved: browser storage is not available. Changes on this table are lost when the page closes." It stays until the player closes it.
- The browser gives a site much more room in IndexedDB than the 5 MB of `localStorage`. A table of 6 rounds is about 22 KB (`docs/feature-auth.md`, open question 5).

Two tabs with the same room store their changes in the same database. They do not see each other's changes while open. The next open of the room has both.

### Save game and Load game

The toolbar can write the document to a file and read it back (`docs/feature-peer-to-peer.md`, "Save and load a game"). **Load game** replaces the table, the map and the rosters of the room. The room record gets the map and the rosters of the file.

## Owner

There are no accounts. The user id in `localStorage` is the owner of every room that this browser creates. So now every room in the list can be deleted. Peer-to-peer will add rooms that this browser joined. Their owner is another user, so they show no **Delete**.

## Relation to peer-to-peer

- The room code and the link format are the ones of the peer-to-peer plan.
- Phase 1 of that plan (step 5 of `docs/plans/implement-backend.md`) moved the table into a Yjs document, saved in IndexedDB per room. The room record keeps the setup: map, rosters, owner, dates. It has no `table`.
- Step 8 syncs this document between two browsers. The code of one player and of two players is the same.
- The room record keeps `rosters`. In a game with two players, each player loads their own roster.

## Code

| File | Content |
|---|---|
| `apps/web/src/Root.jsx` | The page of the URL hash: Lobby, Room or Sandbox |
| `apps/web/src/Table.jsx` | Opens the document of a room or the Sandbox, shows the loading screen, mounts `App`. Replaces the document on Load game |
| `apps/web/src/rooms/store.js` | `localStorage`: user id, room code, list, read, create. `saveRoomRecord`, `roomDocName`, `deleteRoom` (also deletes the IndexedDB database). `createRoom` takes both rosters |
| `apps/web/src/rooms/tableDoc.js` | `openTableDoc`: the document with IndexedDB, the 5-second timeout and the in-memory fallback. `watchRoomRecord`: writes the room record |
| `apps/web/src/rooms/table.js` | The table state that a new table starts with (`startTable`), `withPlacements`, `poseOf` |
| `apps/web/src/net/doc.js` | The layout of the document, `createTable`, `fillTable`, the game file (`encodeGame`, `readGame`) |
| `apps/web/src/net/collections.js` | The list and record stores over a `Y.Map`. No React |
| `apps/web/src/net/useY.js` | `useYList`, `useYRecord`, `useYField`: React hooks over the stores |
| `apps/web/src/rooms/preload.js` | The files to load before a table shows |
| `apps/web/src/components/Lobby.jsx` | The lobby page, and the roster popup of a room |
| `apps/web/src/components/NewRoomDialog.jsx` | The new room dialog: map switch, map carousel, Blue and Red roster fields |
| `apps/web/src/components/Carousel.jsx` | The Embla carousel, taken out of `RosterPopup.jsx`. The roster popup and the map picker use it |
| `apps/web/src/components/Preload.jsx` | `Preload` and `Ready`, see [Loading](#loading) |
| `apps/web/src/terrain/files.js` | `mapCard(id)` and `MAP_CARD_BACK` |
| `apps/web/scripts/migrate-terrain.mjs` | Copies the map card (face and back) with the map |

## Decisions

Made on 2026-10-07:

1. A saved room keeps the full table, also the model poses. Dice and tools reset.
2. The Sandbox is not saved. Leaving it asks first.
3. The URL hash selects the page. The room code has the format of the peer-to-peer plan.
4. One `localStorage` key per room. The lobby lists the keys with the room prefix.
5. The room saves every 2 seconds when something changed, and on leave and page close.
6. The poses come from the physics bodies at save time. A saved model starts at its pose.
7. A new room has no name. Its tile shows the map, the code and the time of the last change.
8. **Create room** enters the new room at once.
9. With **Random map** on, the dialog shows a card back, and the map is picked at creation.
10. The carousel of the roster popup became a shared component.
11. A file list for the loading screen comes from helpers next to the components that load the files.
12. The new room dialog takes both rosters, until players join a room from a server. Red is optional. The lobby tile shows each roster.

Made on 2026-10-09 (step 5):

13. The table is a Yjs document in IndexedDB (`y-indexeddb`), one database per room. It replaces decisions 5 and 6 above, and decision 4 for the table. Reasons: it is the final storage of the peer-to-peer plan, so there is no temporary format. It stores each change at once, so the 2-second save poll is gone.
14. The room record is version 2 and has no `table`. It keeps `mapId` and `rosters` for the lobby tile. A record of version 1 opens with a new table. Before the first release, all data is test data, so nothing is migrated.
15. The room record is written at most every 2 seconds after a change of the document, on `pagehide`, and when the table unmounts.
16. IndexedDB gets 5 seconds to load. After that, or after an error, the table opens in memory, with a warning that stays until the player closes it. Reason: a database that cannot open never answers, and the room must still open.
17. Load game replaces the whole table: the table, the map and the rosters. A browser confirm asks first. Reason: a Yjs update adds to a document and cannot replace it, so the room gets a new database.

## Out of scope

- Room names, rename, export and import.
- A second player, spectators. See `docs/feature-peer-to-peer.md`.
- A saved Sandbox.
- A change of the Blue roster in a room.
