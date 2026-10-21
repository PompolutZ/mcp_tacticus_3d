# Map builder

Status: partly built. The shared code, the dev page `#terrain` and the board in the document (no UI yet) work. The Sandbox mode, the save in the account and the room card are not built (`docs/plans/map-builder.md`).

The builder makes a board: a mat, its rotation and a list of terrain pieces, in the map JSON format (`maps.md`, "JSON format"). The same edit code serves the dev page and, later, the Sandbox.

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
