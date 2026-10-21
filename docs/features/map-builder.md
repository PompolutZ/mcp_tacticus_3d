# Map builder

Status: partly built. The shared code and the dev page `#terrain` work. The Sandbox mode, the board in the document, the save in the account and the room card are not built (`docs/plans/map-builder.md`).

The builder makes a board: a mat, its rotation and a list of terrain pieces, in the map JSON format (`maps.md`, "JSON format"). The same edit code serves the dev page and, later, the Sandbox.

## Shared code

- `src/terrain/builder.js`: the edit actions as pure functions on a plain list of placements (add, move, turn, remove, clear, load a map, export). They return a new list. Reason: the dev page keeps the list in React state, and the Sandbox keeps it in the table document, so the actions must not own the state.
- `src/terrain/BuilderPanel.jsx`: the side panel. It takes the board data and callbacks as props and owns only the piece filter.
- `src/terrain/useTerrainDrag.js`: the drag of a placed piece. `src/terrain/useBuilderKeys.js`: Q, E and Delete.

## Add

A new piece stands with the bottom of its mesh on the mat top. The piece is a model whose origin is often in the middle of the mesh, so a position at the mat top would put half of it under the mat. The height comes from the bounding box of the mesh with the placement scale and turn, as the piece is drawn (`restY` in `src/terrain/placementMove.js`). The piece files load async, so the add waits for the box (`src/terrain/pieceBox.js`) and then places the piece at its final height. It never shows at a wrong height first. The piece goes to the mat center, turned 0°.

## Drag

The drag plane is the horizontal plane through the point where the press grabbed the piece. The grabbed point stays under the pointer, also when the piece is grabbed on its side or top and the camera looks at an angle. A plane at the mat top would not do this: the move on that plane is not the move under the pointer. The height of the piece does not change, and the piece does not climb on other pieces. A drag moves the piece on the table only; the drop writes the position and mounts the piece again with its fixed body. Esc puts the piece back.
