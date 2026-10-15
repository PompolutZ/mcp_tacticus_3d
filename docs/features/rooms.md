# Feature: Rooms

Status: built.

## Goal

The app opens on a lobby. The lobby lists the rooms of this browser. A player creates a room with a map and the rosters, enters it later, and finds the table as they left it. The table without a room is the Sandbox: the app as it was before this feature.

There are three kinds of table:

- **Sandbox:** in this browser only. Not saved.
- **Single player room:** in this browser only. A record in `localStorage`, and its table is a Yjs document in IndexedDB. This doc describes it.
- **Multiplayer room:** on the server. The host creates it, and a guest joins it with a link. The table is on the server, with a copy in IndexedDB. `docs/features/auth.md` describes it.

The peer-to-peer feature (`docs/features/peer-to-peer.md`) syncs the table of a multiplayer room between the two players.

## Terms

| Term | Meaning |
|---|---|
| Lobby | The start page. Lists the rooms, creates a room, opens the Sandbox |
| Room | A saved table with a fixed map, the Blue roster and, if given, the Red roster. A single player room has its record in `localStorage` and its table in IndexedDB. A multiplayer room is on the server |
| Sandbox | A table with every control: map picker, both roster fields. Not saved |
| Owner | The user who created a single player room. Only the owner can delete it. In a multiplayer room this user is the host |
| Room code | The id of a room, for example `K7Q2-M9XD`. The same format as the room code of the peer-to-peer doc |

## Pages

The URL hash selects the page. So the browser back button works, and a reload stays on the same page.

| Hash | Page |
|---|---|
| none | Lobby |
| `#room=K7Q2-M9XD` | Room |
| `#sandbox` | Sandbox |
| `#terrain` | Terrain page (dev only, `docs/features/maps.md`). The production build does not have it. |

- `#room=<code>` is the link format of the peer-to-peer doc ("Connect flow"). So the same link invites the second player.
- A room code that is not in this browser opens the lobby with the message "Room K7Q2-M9XD is not in this browser". With login on, the app asks the server first: a multiplayer room opens, or the join page shows (`docs/features/auth.md`, "Identity in peer-to-peer games").
- Each room and the Sandbox mount a new table, so nothing from the last table stays.

## Lobby

- **Rooms:** a **+** tile, then one list with a tile for each single player room and each multiplayer room, the last changed room first. A single player tile shows "Single player". A multiplayer tile shows the seats, **Copy link** and **Delete** for the host (`docs/features/auth.md`, "Lobby and room UI"). With login off, the list has only single player rooms and makes no API call. A tile shows the map card, the map name, the room code and the time of the last change. A random multiplayer room shows the card back and "Random map" until the guest joins. A click on the tile enters the room.
- **Blue** and **Red** on a tile show that roster of the room in the roster popup of the table (`docs/features/roster.md`). A button shows only when the room has that roster. The popup opens on the first tab with cards, usually Characters. Escape, **×** or a click on the backdrop closes it. The left and right arrows show the previous or next card.
- On a narrow tile, **Delete** goes to a second line.
- **Delete** on a tile removes the room. It shows only on rooms that this user owns. In a multiplayer room, that is the host. A browser confirm asks first, the same as **Remove** on a character tray.
- **Sandbox:** a button that opens the Sandbox.

## New room

The **+** tile opens a dialog on a blurred backdrop, the same style as the roster popup.

- With login on, a choice at the top: **Single player** or **Multiplayer** (`docs/features/auth.md`, "Lobby and room UI"). With login off, the dialog makes a single player room. The rest of this list describes **Single player**.
- **Random map** is a switch, on by default. While it is on, the dialog shows the back of a map card. Single player: the app picks the map when the player creates the room. Multiplayer: the hint says "The map spawns when the second player joins the room". The server picks the map when the guest joins, so nobody knows it before.
- With the switch off, a carousel shows the map cards. The card in the middle is the map of the room. It is the same carousel as in the roster popup.
- **Blue roster** and **Red roster:** a text field for the MCT code of each player. Under each field, the dialog shows what it found, for example "10 characters · 10 tactic cards · 5 Secure · 5 Extract", and the unknown codes. The parse rules are the ones of `docs/features/roster.md`. The game setup (`docs/features/setup-game.md`) needs both rosters.
- When the app has no 3D model for a character or no image for a Team Tactic card of a roster, a warning box under its summary names these cards, for example "No 3D model for 2 characters: Angela, Bishop". On the table, these cards show as plates, and a character without a model cannot be spawned. The box is only a warning: **Create room** still works.
- **Create room** works when the Blue code has a known card. The Red roster is optional, because the Red field of the toolbar can load it later. A Red text without a known card blocks **Create room**, so a wrong paste does not make a room without Red. **Create room** saves the room and enters it.
- **Cancel**, Escape, **×** or a click on the backdrop closes the dialog.

The carousel shows only maps that the app has (`apps/web/src/terrain/maps/index.js`). A map card image comes from the TTS mod. `apps/web/scripts/migrate-terrain.mjs` copies it with the map.

## Room

- The player is Blue, the same as before.
- The map is the room map. The toolbar has no map picker.
- In a multiplayer room, the toolbar has no Setup chip (the crisis card dropdowns, the roster fields) and no mat turn buttons (↺ ↻), so the Mat group is gone. The crisis cards come from the rosters of the players, through the game setup. The player with Priority turns the mat in the setup step "edge", with ↺ **Select board edge** ↻. Both players see these buttons, and they agree who turns. **Select board edge** puts the crisis cards on the board and their tokens on the mat. After that, the mat turn stays fixed. **Restart setup** rolls off again, so Priority and the deployment edge can change, and the step "edge" comes back with the mat turn. Sandbox and single player rooms keep the Crisis dropdowns and the ↺ ↻.
- The rosters come from the room. The Roster group has only the Red field. It loads, replaces or removes the Red roster of the room. The field is empty when the room opens, also when the room has a Red roster.
- A multiplayer room has no Roster group and no map picker. Each player gives their own roster when they create or join the room. The new room dialog with **Multiplayer** has only the roster of the host. The join page has the roster of the guest. Single player rooms keep both roster fields.
- A multiplayer room with **Random map** has no map when the host enters. The table, trays and HUD show as usual, with no mat and no terrain. A note on the table, in the middle of the mat, facing the host, in the style of the setup panel, says: "Random map: it spawns automatically when the second player joins the room." The note goes away when the map is set.
- The map fill: the server picks the map when the guest joins. The guest's browser then writes the map and its terrain in one change, right after **Join**. The host's browser gets them over peer-to-peer, and the mat and terrain load with no loading screen. A player who opens the room later fills the map too, if the table still has none. Terrain ids are fixed (`<mapId>:<index>`), so two fills of the same map merge into one set of pieces.
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
  version: 3,
  id: 'K7Q2-M9XD',
  owner: '<user id>',
  createdAt, updatedAt,           // ms since 1970
  mapId: 'vibranium-heist',       // key in MAPS
  rosters: { host: { code }, guest: null | { code } },   // docs/features/roster.md, "State"
}
```

- The record keeps only the setup and the dates. `mapId` and `rosters` are a copy of the document, for the lobby tile. The lobby does not open the documents.
- The table is in the document. Its layout is in `docs/features/peer-to-peer.md` ("Yjs document"). The document has the map, the rosters, the characters, the tokens, the cards, the terrain pieces, the model poses and the tools.
- `terrain` stores the place of each piece in the map data (`index`, `locked`), not the whole placement. So a fix of the map data reaches old rooms. A deleted piece is not in the list. A piece that fell when what it stood on was deleted has `y`: the height of its position, as in the map data. Without `y` the piece is at the map height (an older document has none).
- A model writes its pose to `poses` when its body falls asleep. A lifted model (R) writes the place under the lift. A model that moves when the page closes keeps its last rest pose.
- A saved model starts at its pose, asleep. So it does not move before the terrain under it has its colliders. A touch, a drag or a removed terrain piece wakes it.
- A record of version 1 opens with a new table, with its map and rosters. Its old `table` is not read. A document opens by its `game.schema`: empty gets the start table, an older one is migrated (a missing step gets the start table, so a room of schema 1 starts with a new table), a newer one is not opened and not written (the lobby asks to reload the page; decision 18). A single player record of version 2 or older is not listed or opened (saved rooms are not migrated).

- The tools (range, movement, Toward / Away) are in `tools`, per side (`tools.host`, `tools.guest`). An entry has the pose, the bend, the snap target and the mode. A tool writes it after it rested for 0.3 s. A saved tool comes back where it was. Place, Throw, the Bend button and the selection of a tool are not saved.

- The dice are in `dice`, per side (`dice.host`, `dice.guest`). The room keeps the shelf: the dice that have a result, with their face. Dice in the well and in the air are not kept. They go away when the room opens.

Not saved: dice in the well and in the air, selection, camera, open popups, spectator view, labels, debug mode.

### When the room saves

- The document: at each change. `y-indexeddb` stores each update at once. There is no poll.
- The room record: at most every 2 seconds after a change of the document, when the page closes or reloads (`pagehide`), and when the table unmounts. **← Lobby** writes it first, so the lobby shows the last change. `updatedAt` changes only then, not when a room only opens.
- **Delete** also deletes the IndexedDB database of the room.

### When IndexedDB does not work

- The room waits at most 5 seconds for IndexedDB, with the loading screen. IndexedDB can be turned off (blocked site data), and then it never answers.
- After 5 seconds, or after an error, the table opens in memory. The HUD shows a warning: "Room not saved: browser storage is not available. Changes on this table are lost when the page closes." It stays until the player closes it.
- The browser gives a site much more room in IndexedDB than the 5 MB of `localStorage`. A table of 6 rounds is about 22 KB (`docs/features/auth.md`, open question 5).

Two tabs with the same room store their changes in the same database. They do not see each other's changes while open. The next open of the room has both.

## Owner

In a single player room, the user id in `localStorage` is the owner of every room that this browser creates. So every single player room in the list can be deleted. A multiplayer room has a host (a logged-in user). Only the host sees **Delete** on its tile. The guest sees the tile with no **Delete**.

## Relation to peer-to-peer

- The room code and the link format are the ones of the peer-to-peer doc.
- The table is a Yjs document, saved in IndexedDB per room. The room record keeps the setup: map, rosters, owner, dates. It has no `table`.
- The peer-to-peer feature syncs this document between two browsers. The code of one player and of two players is the same.
- Multiplayer rooms keep the room record on the server, not in `localStorage`. Their IndexedDB database is `mcp-assist-3d/multiplayer/<user id>/<code>`. In a game with two players, each player has their own roster key in the table.

## Code

| File | Content |
|---|---|
| `apps/web/src/Root.jsx` | The page of the URL hash: Lobby, Room or Sandbox |
| `apps/web/src/Table.jsx` | Opens the document of a room or the Sandbox, shows the loading screen, mounts `App`. Opens a multiplayer room from the server and runs the table writer |
| `apps/web/src/rooms/store.js` | `localStorage`: user id, room code, list, read, create. `saveRoomRecord`, `roomDocName`, `deleteRoom` (also deletes the IndexedDB database). `createRoom` takes both rosters |
| `apps/web/src/rooms/tableDoc.js` | `openTableDoc`: the document with IndexedDB, the 5-second timeout and the in-memory fallback. `watchRoomRecord`: writes the room record |
| `apps/web/src/rooms/table.js` | The table state that a new table starts with (`startTable`), `withPlacements`, `poseOf` |
| `apps/web/src/net/doc.js` | The layout of the document, `createTable`, `fillTable`, `encodeTable` |
| `apps/web/src/net/collections.js` | The list and record stores over a `Y.Map`. No React |
| `apps/web/src/net/useY.js` | `useYList`, `useYRecord`, `useYField`: React hooks over the stores |
| `apps/web/src/rooms/preload.js` | The files to load before a table shows |
| `apps/web/src/components/Lobby.jsx` | The lobby page: one list of single player and multiplayer rooms |
| `apps/web/src/components/RoomRosterPopup.jsx` | The roster popup of a room. The lobby and the join page use it |
| `apps/web/src/components/NewRoomDialog.jsx` | The new room dialog: map switch, map carousel, Blue and Red roster fields |
| `apps/web/src/components/Switch.jsx` | An on/off switch with a label. The new room dialog uses it for **Random map** |
| `apps/web/src/components/Carousel.jsx` | The Embla carousel, taken out of `RosterPopup.jsx`. The roster popup and the map picker use it |
| `apps/web/src/components/Preload.jsx` | `Preload` and `Ready`, see [Loading](#loading) |
| `apps/web/src/terrain/files.js` | `mapCard(id)` and `MAP_CARD_BACK` |
| `apps/web/scripts/migrate-terrain.mjs` | Copies the map card (face and back) with the map |

## Decisions

1. A saved room keeps the full table, also the model poses. The shelf of each tray stays. Dice in the well and in the air reset. The tools stay.
2. The Sandbox is not saved. Leaving it asks first.
3. The URL hash selects the page. The room code has the format of the peer-to-peer doc.
4. One `localStorage` key per room. The lobby lists the keys with the room prefix.
5. The room saves every 2 seconds when something changed, and on leave and page close.
6. The poses come from the physics bodies at save time. A saved model starts at its pose.
7. A new room has no name. Its tile shows the map, the code and the time of the last change.
8. **Create room** enters the new room at once.
9. With **Random map** on, the dialog shows a card back. Single player: the map is picked at creation. Multiplayer: the server picks it when the guest joins (`docs/features/auth.md`).
10. The carousel of the roster popup became a shared component.
11. A file list for the loading screen comes from helpers next to the components that load the files.
12. The new room dialog takes both rosters, until players join a room from a server. Red is optional. The lobby tile shows each roster.

13. The table is a Yjs document in IndexedDB (`y-indexeddb`), one database per room. It replaces decisions 5 and 6 above, and decision 4 for the table. Reasons: it is the final storage of the peer-to-peer doc, so there is no temporary format. It stores each change at once, so the 2-second save poll is gone.
14. The room record is version 2 and has no `table`. It keeps `mapId` and `rosters` for the lobby tile. A record of version 1 opens with a new table. Before the first release, all data is test data, so nothing is migrated.
15. The room record is written at most every 2 seconds after a change of the document, on `pagehide`, and when the table unmounts.
16. IndexedDB gets 5 seconds to load. After that, or after an error, the table opens in memory, with a warning that stays until the player closes it. Reason: a database that cannot open never answers, and the room must still open.
17. There is no Save game and no Load game: the app does not need a game file. A single player room keeps its table in IndexedDB. A multiplayer room keeps it on the server.
18. A table with a newer `game.schema` than the app does not open, and nothing is written, locally or to the server. A table of an older schema is migrated, not reset, when a step exists. Reasons: an old tab must not reset a newer room and sync the reset to the server and the peer. A reset loses the game; before the first release that is accepted only for schemas with no step (the chain is empty).

## Out of scope

- Room names, rename, export and import.
- Spectators. See `docs/features/peer-to-peer.md`.
- A saved Sandbox.
- A change of the Blue roster in a room.
