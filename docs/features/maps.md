# Maps

Status: built.

A map is a mat (the ground image) and a list of terrain pieces. The maps are JSON files in `src/terrain/maps/`, one per map. `src/terrain/maps/index.js` imports them and exports `MAPS`. The pieces are in `src/terrain/pieces.js`. The map comes from the TTS mod. `scripts/README.md` tells how to add one.

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
| Oscrop Chemical | 180 |
| A Hulk Cornered | 180 |
| Dockyard Destruction! Spider-Man to Blame! | 0 |
| Night Time Patrol | 180 |
| Sand Scrap | 270 |
| Swing Into Action | 180 |

Survival of the Fittest has the same placements as Hydra Vs Wakanda. It is not in the list.

Sinister Showdown has no token piece: the mod has a `Custom_Token` on the map, and it is in `skipped`.

Oscrop Chemical has no barrels: the mod pieces `barrel-size-1-3` (6 placements) have dead file URLs (a CDN prefix glued to a Steam URL, 404), so they are in `skipped`.

## JSON format

A map is `src/terrain/maps/<id>.json`. The fields:

- `id`: the file name without `.json`, and the key in `MAPS`.
- `name`: the name in the app.
- `ttsMap`: the id of the map in the mod's Terrain Database. Left out for a map not made from the mod.
- `note`: optional text about the map.
- `mat`: the mat name. The image is `src/assets/<mat>-mat.webp` (`matImage` in `files.js`).
- `matRotation`: see "Mat rotation".
- `placements`: the pieces. Each has `piece` (a key in `TERRAIN_PIECES`), `position` and `rotation` (degrees), `scale` (a number, or 3 numbers), and optional `size`, `tint` and `note`.
  - Position and rotation are TTS values, as in the mod, so they can be compared with the source. `Terrain.jsx` converts them to Three.js. Positions are relative to the mat center.
  - `size` is the game Size from the mod piece name. It is on the placement, because two mod pieces with the same files but another Size get one entry in `TERRAIN_PIECES`.
  - `tint` multiplies the texture, as in TTS. A tint is left out when the map card shows another color, and the placement has a `note`.
- `skipped`: optional list of placements that the script did not convert. Each has `piece`, `position`, `rotation`, `scale`, optional `size`, and `note` with the reason. No `note` means the mod type is not supported (`Custom_Token`: the app does not draw tokens as map pieces). These are not drawn.

`index.js` also exports `TTS_MAT_TOP`: the mat tile sits at y = 0.96 in TTS and is 0.1 thick, so the mat top is 1.06.

The order of the imports in `index.js` is the order of the maps in the lists. A new map: `<id>.json` in the folder, and its import in `index.js` (`migrate-terrain.mjs` does both).

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
- A bundle piece (`bundle: true`) has a GLB with its own materials and textures (from its secondary bundle too, when the mod gives one; `scripts/README.md`), no texture file, and a list of `colliders`. The app keeps the GLB materials (a copy for each placement). The footprint shader, shadows, outline, label and pointer handling are the same as for an OBJ piece.
- A scan piece (`scan: true`) comes from photos (`custom-models.md`, "Terrain pieces"). Its GLB has its texture inside, so it is drawn like a bundle piece. It has no `colliders`: the collider is the convex hull of the visible mesh, as for an OBJ piece with `convex: true`. Its `size` is the default Size of a piece that no map places.
- A prefab part that uses a Unity built-in mesh (cube, cylinder, capsule, ...) is drawn too: AssetRipper cannot write those meshes, so the migration generates them in Unity's sizes (`scripts/README.md`). The Campus Light is such a piece; a particle effect's placeholder cube is not drawn.
- `tint` on a bundle piece multiplies the color of each material, as TTS does. The tint is sRGB, as for an OBJ piece.
- A bundle piece has no collider from its visible mesh. Each `colliders` entry is one Rapier collider: box, cylinder, capsule and sphere are Rapier shapes, and a mesh entry is the hull or the triangles of one mesh (`mesh: n`, node n) in the one collider GLB of the piece. The entries are in GLB space, so the same turn of 180° around Y as for the mesh applies, and then the placement scale. The size of a box, cylinder, capsule or sphere follows the scale. A non-uniform scale on a turned shape is only approximate, because a Rapier shape cannot skew. A collider mesh is exact for any scale, because the transform (entry scale, turn and position, the import turn, the placement scale) is applied to its vertices. The maps so far have uniform scales on turned shapes only.
- A bundle piece whose GLB has no mesh (smoke, fire, sea weed, coral) has `colliders: []`: nothing visible, nothing solid. The migration drops its prefab colliders. Reason: the invisible collider of Smoke on Oscorp Chemical stopped a Throw (playtest 6). `src/terrain/noMeshCollider.test.js` checks it.
- All explicit colliders (also the collider mesh of an OBJ piece) sit directly under the RigidBody, never in the scaled group, because @react-three/rapier scales them a second time there. See `src/terrain/bundleColliders.js`.
- `tint` on an OBJ piece multiplies the texture, as in TTS. A tint is left out when the map card shows another color. The tints of the app maps were compared with the cards.

## Delete

- The Delete key over an unlocked piece is the only way a piece leaves the table. It is the same for a Throw, the player deletes the piece.
- What stood on the piece goes straight down to the next surface (another piece, or the mat). Nothing is pushed: a model gets its new place at once, with no speed, and keeps its heading. So nothing is bumped.
- A piece that stood on it gets a new height, stored as `y` in the document (`rooms.md`). Both players see it. A piece or model that stands on a piece that falls goes down with it by the same distance.
- What stands on a piece: a surface of it within 0.2 in under the bottom of the thing (casts down from several points under a piece, and from the base of a model).
- Only the browser that deletes plans it. The other one gets the document and the model poses. A model that the other player moves, or that is dragged, is not moved. A lifted model (R) stays up, and lowers onto the new surface. The undo raises its lift place too, so it lowers onto the piece. Tokens are not moved.
- The delete has a log entry with an **Undo** button (`game-log.md`, "Panel"). The undo puts the piece back and lifts what fell with it, if it has not moved since.
- Not covered: a thing that stands on the deleted piece and on a second piece that falls too. Such a thing may stay in the air.

## Terrain page

Status: built.

- Dev only, at `#terrain` (`src/debug/TerrainPage.jsx`). The production build does not have it, and the lobby has no link to it. A reload clears the placed pieces.
- Its own small scene: table, mat, backdrop, lights, `Terrain` and physics, with the camera of the game (mouse, W A S D, arrows, wheel). No characters, dice, tools or room.
- The side panel has the mat list (one row per mat, by name, 21). A click shows the mat, turned by the `matRotation` of the first map that uses it. A new mat keeps the placed pieces, and the pieces do not turn with the mat (the placements are relative to the mat center).
- Below it, a filter field (by piece name) and the piece list in groups: size 1 to 5, then "No size". A group header shows the number of pieces. A piece with two sizes is in both groups. A piece with a default `size` that no map places (a scan piece) is in the group of that size, with scale 1 and no tint.
- A click on a piece row adds the piece at the mat center, on the mat top, turned 0°, with the scale and tint that its placements at that size use most often (`src/terrain/catalog.js`). The new piece is selected. A click on a placed piece selects it, a click on the empty table clears the selection.
- A drag moves a placed piece on the mat (left button, after 4 px, the camera does not turn). The piece keeps its place under the pointer, and follows the plane of the mat top, so it does not climb on other pieces. Pieces do not push each other. The drop writes the new position (the height stays), and the piece is mounted again with its fixed body.
- Q and E turn the selected piece by 15° around Y (Q counter-clockwise seen from above). Delete or Backspace removes it. The keys do nothing while the filter field has the focus. The "Clear" button above the piece list removes all placed pieces.
- The "Map" block at the top of the panel: a list to load a map, the fields `id` and `name`, and the "Export" button. Loading replaces the mat, the `matRotation` (not the catalog one) and the placed pieces, and keeps `id`, `name`, `ttsMap`, `note` and `skipped` for export. A note on a placement stays on it. The page does not edit these kept fields.
- A fresh mat (no map loaded) has empty `id` and `name`, and the catalog rotation of the mat. A click on a mat in the list after a load sets the catalog rotation.
- "Export" downloads `<id>.json`, in the format above. It is disabled while `id` is empty or not kebab-case (`a-b-c`, lower case letters and digits). `src/terrain/exportMap.js` writes the file: the field order and number rounding of the migrate script (positions 3 decimals, rotations 2), 2-space indent, trailing newline. The script uses the same writer. The page-only fields (`id`, `rev`, `locked`) are dropped. A loaded map that is exported without change gives its file byte for byte (a test checks all maps).

### Add a new map to the app

1. Open `#terrain` in the dev server, pick a mat, place the pieces (or load a map and change it).
2. Fill `id` (kebab-case, the file name) and `name`, click "Export".
3. Put `<id>.json` in `src/terrain/maps/` and add its import to `src/terrain/maps/index.js` (the order of the imports is the order in the new room dialog).
4. Optional: the card image `src/assets/maps/<id>.webp`. Without it, the new room dialog shows the card back (`maps/back.webp`).
5. A new release ships the map.
