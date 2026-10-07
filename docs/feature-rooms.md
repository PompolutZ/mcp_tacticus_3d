# Feature: Rooms

Status: done, 2026-10-07. Not checked in a browser.

## Goal

The app opens on a lobby. The lobby lists the rooms of this browser. A player creates a room with a map and their roster, enters it later, and finds the table as they left it. The table without a room is the Sandbox: the app as it was before this feature.

There is no server yet. Each room is a record in `localStorage`. The peer-to-peer feature (`docs/feature-peer-to-peer.md`) will let a second player join a room.

## Terms

| Term | Meaning |
|---|---|
| Lobby | The start page. Lists the rooms, creates a room, opens the Sandbox |
| Room | A saved table with a fixed map and the Blue roster. Saved in `localStorage` |
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
- **Roster** on a tile shows the Blue roster of the room in the roster popup of the table (`docs/feature-roster.md`). It opens on the first tab with cards, usually Characters. Escape, **×** or a click on the backdrop closes it. The left and right arrows show the previous or next card.
- **Delete** on a tile removes the room. It shows only on rooms that this user owns. Now that is every room. A browser confirm asks first, the same as **Remove** on a character tray.
- **Sandbox:** a button that opens the Sandbox.

## New room

The **+** tile opens a dialog on a blurred backdrop, the same style as the roster popup.

- **Random map** switch, on by default. While it is on, the dialog shows the back of a map card. The app picks the map when the player creates the room.
- With the switch off, a carousel shows the map cards. The card in the middle is the map of the room. It is the same carousel as in the roster popup.
- **Blue roster:** a text field for the MCT code. Under it, the dialog shows what it found, for example "10 characters · 10 tactic cards · 5 Secure · 5 Extract", and the unknown codes. The parse rules are the ones of `docs/feature-roster.md`.
- **Create room** works only when the code has a known card. It saves the room and enters it.
- **Cancel**, Escape, **×** or a click on the backdrop closes the dialog.

The carousel shows only maps that the app has (`src/terrain/maps.js`). A map card image comes from the TTS mod. `scripts/migrate-terrain.mjs` copies it with the map.

## Room

- The player is Blue, the same as before.
- The map is the room map. The toolbar has no map picker. The mat turn buttons stay.
- The Blue roster comes from the room. The Roster group has only the Red field. With a server, the Red field will be only in the Sandbox, because the second player loads their own roster.
- **← Lobby** at the start of the toolbar saves the room and opens the lobby. The toolbar also shows the room code.

## Sandbox

- The app as before: map picker, both roster fields, the same start map.
- Nothing is saved. **← Lobby** asks with a browser confirm first, because the table is lost.

## Loading

The loading screen stays until the files of the map and the models are loaded:

- the mat image, and the mesh, texture and collider of each terrain piece,
- the models of every character in both rosters, and of the characters on the saved table,
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

| `localStorage` key | Value |
|---|---|
| `mcp-assist-3d/user` | `{ id }`: a random id of the user of this browser, made once |
| `mcp-assist-3d/room/<code>` | One room record |

The lobby finds the rooms by the key prefix. One key per room, so a room cannot be half written, and there is no list that can disagree with the rooms.

```js
{
  version: 1,
  id: 'K7Q2-M9XD',
  owner: '<user id>',
  createdAt, updatedAt,           // ms since 1970
  mapId: 'vibranium-heist',       // key in MAPS
  rosters: { blue: { code }, red: null | { code } },   // docs/feature-roster.md, "State"
  table: null | {
    matTurns, deployLine, crisis, characters, tokens, scoreMarkers, affiliations,
    looseTokens, tokenPiles, tacticCards,
    terrain: [{ index, locked }],  // index in MAPS[mapId].placements
    poses: { [modelId]: { x, y, z, qx, qy, qz, qw } },
  },
}
```

- `table` is `null` until the first save. The fields have the same names and shapes as the state in `App.jsx`.
- `terrain` stores the place of each piece in the map data, not the whole placement. So a fix of the map data reaches old rooms. A deleted piece is not in the list.
- `poses` has the pose of each model: position and rotation of its physics body. A lifted model (R) saves the place under the lift. Model positions live only in the physics engine, not in App state, so the save reads them from the bodies.
- A saved model starts at its pose, asleep. So it does not move before the terrain under it has its colliders. A touch, a drag or a removed terrain piece wakes it. A model that was in a drag at the save hangs 0.3" above the ground until a player touches it.
- A record with another `version` opens with an empty table.

Not saved: dice, tools, selection, camera, open popups, spectator view, labels, debug mode. The dice are empty when the room opens.

### When the room saves

- Every 2 seconds. The save builds the JSON of `rosters` and `table` and writes it only when it changed. `updatedAt` changes only then.
- On **← Lobby**, when the page closes or reloads (`pagehide`), and when the table unmounts (for example after the back button).
- The bodies may be gone when the table unmounts. Then a model keeps the pose of the last save, at most 2 seconds old.

A poll is used because a model move does not change React state. Reading about 20 bodies and writing a string every 2 seconds costs less than a millisecond.

When the browser storage is full, the save fails, and the HUD message says "Room not saved: browser storage is full". A room with an empty table is about 1 KB. Each character, token and card adds a few hundred bytes. The browser gives a site about 5 MB.

Two tabs with the same room both write. The last write wins.

## Owner

There are no accounts. The user id in `localStorage` is the owner of every room that this browser creates. So now every room in the list can be deleted. Peer-to-peer will add rooms that this browser joined. Their owner is another user, so they show no **Delete**.

## Relation to peer-to-peer

- The room code and the link format are the ones of the peer-to-peer plan.
- Phase 1 of that plan moves the table into a Yjs document, saved in IndexedDB per room. Then `table` moves out of the room record into that document. The room record keeps the setup: map, rosters, owner, dates. The `table` fields already follow the categories of the plan ("State").
- The room record keeps `rosters`. In a game with two players, each player loads their own roster.

## Code

| File | Content |
|---|---|
| `src/Root.jsx` | The page of the URL hash: Lobby, Room or Sandbox |
| `src/rooms/store.js` | `localStorage`: user id, room code, list, read, create, save, delete |
| `src/rooms/table.js` | The table state that a new or saved table starts with, and the saved form of it |
| `src/rooms/preload.js` | The files to load before a table shows |
| `src/components/Lobby.jsx` | The lobby page, and the roster popup of a room |
| `src/components/NewRoomDialog.jsx` | The new room dialog: map switch, map carousel, roster field |
| `src/components/Carousel.jsx` | The Embla carousel, taken out of `RosterPopup.jsx`. The roster popup and the map picker use it |
| `src/components/Preload.jsx` | `Preload` and `Ready`, see [Loading](#loading) |
| `src/terrain/files.js` | `mapCard(id)` and `MAP_CARD_BACK` |
| `scripts/migrate-terrain.mjs` | Copies the map card (face and back) with the map |

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

## Out of scope

- Room names, rename, export and import.
- A second player, spectators. See `docs/feature-peer-to-peer.md`.
- A saved Sandbox.
- A change of the Blue roster in a room.
