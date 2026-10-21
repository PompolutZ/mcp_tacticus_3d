# Map builder

Status: partly built. The shared code, the dev page `#terrain`, the board in the document and the Sandbox Build mode work. The save in the account and the "My board" room card work. `#terrain` is not removed yet (`docs/plans/map-builder.md`).

The builder makes a board: a mat, its rotation and a list of terrain pieces, in the map JSON format (`maps.md`, "JSON format"). The same edit code serves the dev page and the Sandbox.

## Shared code

- `src/terrain/builder.js`: the edit actions as pure functions on a plain list of placements (add, move, turn, remove, clear, load a map, export). They return a new list. Reason: the dev page keeps the list in React state, and the Sandbox keeps it in the table document, so the actions must not own the state.
- `src/terrain/BuilderPanel.jsx`: the side panel. It takes the board data and callbacks as props and owns only the piece filter.
- `src/terrain/useTerrainDrag.js`: the drag of a placed piece. `src/terrain/useBuilderKeys.js`: Q, E and Delete.

## Add

A new piece stands with the bottom of its mesh on the mat top. The piece is a model whose origin is often in the middle of the mesh, so a position at the mat top would put half of it under the mat. The height comes from the bounding box of the mesh with the placement scale and turn, as the piece is drawn (`restY` in `src/terrain/placementMove.js`). The piece files load async, so the add waits for the box (`src/terrain/pieceBox.js`) and then places the piece at its final height. It never shows at a wrong height first. The piece goes to the mat center, turned 0°.

## Drag

The drag plane is the horizontal plane through the point where the press grabbed the piece. The grabbed point stays under the pointer, also when the piece is grabbed on its side or top and the camera looks at an angle. A plane at the mat top would not do this: the move on that plane is not the move under the pointer. The height of the piece does not change, and the piece does not climb on other pieces. A drag moves the piece on the table only; the drop writes the position and mounts the piece again with its fixed body. Esc puts the piece back.

## Board in the document

The table document holds the board (`rooms.md`, "Storage"; `peer-to-peer.md`, "Yjs document").

- A stored terrain piece is a map piece `{ id, index, locked, y? }` or a custom piece `{ id, piece, position, rotation, scale, size?, tint?, locked, y? }`. A piece with `piece` is custom. `withPlacements` in `src/rooms/table.js` reads both and keeps the same object for an unchanged piece. Reason: old tables keep working, a fix of the map data still reaches map pieces, and a board with no map can be stored.
- A map piece that the builder moves or turns becomes a custom piece: `toCustomPiece(mapId, stored)` gives it with the same id, lock and placement. Map pieces need a map: with `mapId` null they are left out, custom pieces stay.
- `game.mat` is `{ name, rotation }` or null. `tableMat(mapId, mat)` gives the mat of a table (null: the mat and rotation of the map; no map and no mat: none). Every reader uses it: the scene, and the preload (`tableFiles`).

## Sandbox: Empty mat

The Map select of the Sandbox has two groups: **Maps** and **Empty mat** (one row per mat, by name). An empty mat sets `game.mat` and clears the terrain in one change, and `mapId` becomes null. A map sets `game.mat` back to null, so the mat of the map shows. A board with no map but with pieces (built or imported) shows as a disabled row, **Custom board**. Reason: the select must name what is on the table.

## Sandbox: Build mode

The **Build** button next to the Map select (Sandbox only) turns Build mode on and off. A side panel (`BuilderPanel.jsx`) opens on the right.

- **Unlock is a view flag.** In Build mode every terrain piece acts unlocked: it can be hovered, selected and dragged. The locks in the document are not written, so leaving Build mode locks the pieces again with no write, and a piece the player unlocked with L stays unlocked. A piece added in Build mode is stored locked, for the same reason.
- **Click** selects a piece, a **drag** moves it (see "Drag"), **Q / E** turn the selected piece by 15°, **Delete** removes it. Delete is the same removal as the game's (`handleTerrainRemove`): what stood on the piece drops down, the log has an Undo. Models, tools and dice stay as they are.
- **Keys.** In Build mode the game's Q / E (turn a character or tool) and Delete (remove the hovered thing) do nothing (`keyAction`, state `building`), and the builder's keys act on the selected terrain piece. Outside Build mode nothing changes: Delete removes an unlocked hovered terrain piece as before, and Q / E do not turn terrain. The builder keys are fixed to Q, E and Delete / Backspace (they do not follow a rebinding), and do nothing while a popup is open or a field has the focus.
- A moved or turned map piece becomes a custom piece (`toCustomPiece`). Every edit writes the stored pieces and `game.mat`. A move or turn raises `rev` of the piece (stored), so the other browser mounts the piece again with its fixed body.
- **Add** writes a custom piece at the mat center, at its rest height (see "Add").
- **Panel:** the mat list (sets `game.mat`, keeps the pieces), **Clear** (removes all pieces at once; models that stood on them do not drop), the filter, the pieces by size with the scanned ones, **Load map** (sets the map and its terrain, `game.mat` null), the `id` and `name` fields, **Export** (the map JSON file, with the mat of the table), **Import**, and, only when logged in, **Save to account** and **Load from account**.
- Each piece has its own Suspense, so a piece that loads its files does not hide the others.

## Import

**Import** reads a `.json` file in the map format. `validateBoard` (`src/terrain/builder.js`) checks it before anything changes: an object, a known mat name, a list of at most 300 placements, each with a piece key of `TERRAIN_PIECES`, a position and rotation of 3 numbers, a scale, and optional size and tint. A good file sets `game.mat` from the file (the rotation of the mat when the file has none), makes its placements custom pieces with new ids, locked, sets `mapId` to null and fills the `id` and `name` fields. A bad file shows its first problem in the panel and changes nothing. The `ttsMap`, `note` and `skipped` fields of a file are not kept.

## Save in the account

A logged-in player keeps one board in the account (`docs/features/auth.md`, "Endpoints"). **Save to account** sends the export object of the current board (`exportBoard`, the same as the Export file) with `PUT /me/board`. **Load from account** reads `GET /me/board` and runs the same path as Import (`useBuilderEdits`, `importData`: `validateBoard`, then `applyBoard`). The panel shows a line when there is no saved board or a call fails. Saving again replaces the board. The API checks the shape again (`apps/api/src/routes/board.ts`) and stores the fields one by one. `DELETE /me` deletes the board.

## Board in a new room

A logged-in player with a saved board (`GET /me/board`, checked with `validateBoard`) sees a card "My board" after the maps in the new room dialog. It shows the card back (`maps/back.webp`) and the board name, or "My board" when the board has none. No login, no saved board, or a saved board that fails the check: no card. Reason: the board needs the account to be fetched, and a bad record must not open a broken table.

- A room on it has `mapId: 'custom'`. `startTable(mapId, board)` (`src/rooms/table.js`) gives `game.mat` of the board and its placements as custom pieces (`boardPieces`, ids `custom:<n>`).
- The board is copied into the room at creation. Solo: the checked board is in the room record (`board`), and the table is built from it when the room opens. Versus: the host builds the document with the board, and the guest gets it with the document sync. A later save of the board changes no existing room.
- A random room never gets the board: the `maps` list and the random pick use the maps of `MAPS` only (`MAP_IDS` in `src/rooms/myBoard.js`). `fillMap` does nothing for `'custom'`, because the table has a `mapId` already.
- `'custom'` is not a key of `MAPS`. A reader of `mapId` checks `isPlayableMap` (room list, room page) or handles the missing key (`withPlacements`, `tableMat`, `fillMap`). The lobby and join page show the card back and "My board" (`mapFace`): the room does not keep the board name.
