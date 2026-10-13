# Maps

Status: built.

A map is a mat (the ground image) and a list of terrain pieces. The data is in `src/terrain/maps.js` and `src/terrain/pieces.js`. The map comes from the TTS mod. `scripts/README.md` tells how to add one.

## Maps of the app

| Map | Mat rotation |
|---|---|
| Vibranium Heist | 180 |
| Battle For Asgard | 180 |
| Hydra Vs Wakanda | 180 |
| Dimensional Assault | 180 |
| Dark Dimension on Mars Base | 90 |
| Will He get away with it | 180 |
| Savageland Unleashed | 180 |
| Old Town Road | 90 |
| Hells Kitchen | 270 |
| Pool Party at the Mansion | 270 |
| Demons Downtown | 270 |
| Cosmic Downtown | 270 |
| Busy City Disturbed | 180 |
| Savage Land Research Site | 270 |
| Sunk Ship Sheltering Sinister Secrets | 0 |
| Sinister Showdown | 270 |

Survival of the Fittest has the same placements as Hydra Vs Wakanda. It is not in the list.

Sinister Showdown has no token piece: the mod has a `Custom_Token` on the map (the app does not draw tokens as map pieces), and it is left out.

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
- A bundle piece (`bundle: true`) has a GLB with its own materials, no texture file, and a list of `colliders`. The app keeps the GLB materials (a copy for each placement). The footprint shader, shadows, outline, label and pointer handling are the same as for an OBJ piece.
- `tint` on a bundle piece multiplies the color of each material, as TTS does. The tint is sRGB, as for an OBJ piece.
- A bundle piece has no collider from its visible mesh. Each `colliders` entry is one Rapier collider: box, cylinder, capsule and sphere are Rapier shapes, and a mesh entry is the hull or the triangles of a collider GLB. The entries are in GLB space, so the same turn of 180° around Y as for the mesh applies, and then the placement scale. The size of a box, cylinder, capsule or sphere follows the scale. A non-uniform scale on a turned shape is only approximate, because a Rapier shape cannot skew. A collider mesh is exact for any scale, because the transform (entry scale, turn and position, the import turn, the placement scale) is applied to its vertices. The maps so far have uniform scales on turned shapes only.
- All explicit colliders (also the collider mesh of an OBJ piece) sit directly under the RigidBody, never in the scaled group, because @react-three/rapier 1.5 scales them a second time there. See `src/terrain/bundleColliders.js`.
- `tint` on an OBJ piece multiplies the texture, as in TTS. A tint is left out when the map card shows another color. The tints of the app maps were compared with the cards.
