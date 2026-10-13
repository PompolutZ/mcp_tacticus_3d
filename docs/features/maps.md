# Maps

Status: partly built. OBJ pieces work. Bundle pieces are not built yet.

A map is a mat (the ground image) and a list of terrain pieces. The data is in `src/terrain/maps.js` and `src/terrain/pieces.js`. The map comes from the TTS mod. `scripts/README.md` tells how to add one.

## Maps of the app

| Map | Mat rotation |
|---|---|
| Vibranium Heist | 180 |
| Battle For Asgard | 180 |
| Hydra Vs Wakanda | 180 |
| Dimensional Assault | 180 |
| Dark Dimension on Mars Base | 90 |

Survival of the Fittest has the same placements as Hydra Vs Wakanda. It is not in the list.

## Map list

- The new room dialog and the Sandbox toolbar list every map in `MAPS`. A new map shows up there with no other change.
- Each map has a card image in `src/assets/maps`. The dialog shows it.

## Mat rotation

- `matRotation` is the TTS rotation of the mat around Y, in degrees.
- The app turns the mat image by `-(matRotation - 180)` degrees around Y. So 180 is no turn.
- The pieces do not turn. The placements are relative to the mat center, as TTS gives them.
- The user mat turn (`matTurns`) comes on top. It turns the mat and its pieces together.

## Pieces

- An OBJ piece has a mesh and one texture. It has a collider from the mesh, or from one collider mesh.
- A bundle piece has a GLB with its own materials and a list of colliders. The app does not draw bundle pieces yet. A map with a bundle piece is not in the app.
- `tint` on a placement multiplies the texture, as in TTS. A tint is left out when the map card shows another color. The tints of the app maps were compared with the cards.
