# Plan: Terrain page

Requested on 2026-10-13. The user asked for a new page that lists all terrain pieces by their size, and places them on a mat. Each mat must be selectable.

The user also said that the page will probably become a map editor. Later, maps move to MongoDB and the app loads them from there. For now, a map is edited locally and exported as JSON. The JSON file is then added to the app code, and a new release ships it.

## Facts

Checked on 2026-10-13, after the merge of 4 more maps:

- The app has 22 maps, 21 distinct mats and 259 pieces (72 bundles). Every piece is used by at least one map.
- `src/terrain/maps.js` is JS code. It has one `MAPS` object with all maps, and comments with notes. Examples: skipped token placements, and a tint that is left out because the map card shows another color.
- `migrate-terrain.mjs` prints entries for `pieces.js` and `maps.js`. These entries are pasted by hand.
- 11 files import `maps.js`, also Node tests (`rooms/startTable.test.js`, `rooms/roomList.test.js`). Node is v26, so a JSON import with `with { type: 'json' }` works in Node tests and in Vite.
- `NewRoomDialog` lists the maps in the key order of `MAPS`, and shows `maps/<id>.webp` as the card.
- `pieces.js` has no size and no scale. Both come from the placement in `maps.js`. The reason is that the mod uses the same files for pieces with different sizes.
- 2 pieces have two sizes: `storage-container-size-2-3` (2 and 3) and `bulldozer-size-3` (3 and 4). 13 placements have no `size`.
- 44 piece and size pairs have more than one scale. For example, `panther-statue` at size 3 has scale 3, 1.5 and 2.5.
- Piece keys per size: size 1: 46, size 2: 92, size 3: 63, size 4: 40, size 5: 13, no size: 7.
- `Terrain.jsx` draws a placement list without room or P2P state. A click selects a piece. Pieces cannot be dragged, because each one is a fixed Rapier body. A fixed body does not follow its parent, so the game remounts `Terrain` when the mat turns.
- `Mat`, the backdrop and the lights are private functions in `Scene.jsx`. `Mat` takes a map id, not a mat name.
- `Root.jsx` selects the page by URL hash. `#tactic-faces` is a dev-only page (`debug/TacticFaces.jsx`), loaded with `lazy()` only when `import.meta.env.DEV` is set.
- `drag/pointerDrag.js` and `drag/tablePoint.js` are the drag helpers of characters and tokens.

## Decisions

1. **One JSON file per map.** Each map is `src/terrain/maps/<id>.json`. This is the same shape as a MongoDB document later. Fields:
   - `id`: the file name, for example `vibranium-heist`.
   - `name`, `mat`, `matRotation`, `placements`: as in `maps.js` today.
   - `ttsMap`: the id in the mod's Terrain Database, for example 285. Left out for a map made in the app.
   - `note`: optional text, on the map or on a placement. It takes the place of the comments in `maps.js`.
   - `skipped`: optional list of placements that the script did not convert (Custom_Token pieces), with piece key, position, rotation and scale.
2. **Map list.** `src/terrain/maps/index.js` imports each JSON file and exports `MAPS` with the same keys as today. So the 11 importers do not change, other than the path. The order of the imports is the order in the new room dialog. `TTS_MAT_TOP` moves to `index.js`.
3. **Script.** `migrate-terrain.mjs` writes the JSON file of the map, and adds its import to `index.js`. It still prints the `pieces.js` entries.
4. **Dev only page.** The page is at `#terrain`, and only in the dev build, as `#tactic-faces` is. The production build does not have it. The Lobby has no link to it.
5. **No save in the browser.** A reload clears the mat. Export is the only way to keep a map.
6. **Own small scene.** The page has its own Canvas: camera, OrbitControls, keyboard and wheel camera, Physics, table, mat and `Terrain`. It does not mount `App` or `Scene`, so there are no characters, dice, tools or Yjs doc.
7. **Mat list.** One row per mat (21), by mat name. A mat turns by the `matRotation` of the first map that uses it, so it looks the same as in that map. The first mat is selected when the page opens. A new mat keeps the placed pieces.
8. **Piece list.** Groups for size 1 to 5, then "No size". A piece with two sizes is in both groups. Each row shows the piece name. A filter field above the list filters by name.
9. **Default scale and tint.** A piece in a size group gets the scale that its placements at that size use most often. If two scales tie, it gets the first one in map order. The tint is chosen the same way. The scale is the size in the game, so the page does not offer another scale.
10. **Add.** A click on a row adds the piece at the mat center, on the mat top, turned 0°. The new piece is selected.
11. **Move, turn, remove.** A click selects a placed piece (the outline of the game). Drag moves it on the mat. Q and E turn the selected piece by 15°, as in TTS. Delete removes it. A "Clear" button removes all pieces.
12. **Drag of a fixed body.** During a drag, the page moves only the visible group. On drop, the placement gets its new position, and the piece remounts with its body. Pieces do not push each other.
13. **Load map.** A map list loads the mat, mat rotation and placements of a map. Its `id`, `name`, `ttsMap`, `note` and `skipped` are kept for Export. Loading replaces the placed pieces.
14. **Export.** Fields for `id` and `name`, filled from the loaded map. "Export" downloads `<id>.json` in the format of decision 1. Positions are rounded to 3 decimals, rotations to 2, as the script does. Unchanged placements keep their values, so an export of a loaded map without changes gives the same file.
15. **New map in the app.** Put `<id>.json` in `src/terrain/maps/` and add its import to `index.js`. A map without a card image shows the card back in the new room dialog.
16. **Feature doc.** `docs/features/maps.md` gets a section "Terrain page" and the JSON format. `docs/features/rooms.md` gets the row `#terrain` (dev only) in its Pages table. `scripts/README.md` describes the JSON output of the script.

## Steps

### Step 1: Maps as JSON files

- Convert `maps.js` to `src/terrain/maps/<id>.json` and `index.js` (decisions 1 and 2). Comments become `note` and `skipped`. The order of the maps does not change.
- A one-time conversion script is fine. Do not commit it.
- Change the imports of the 11 files.
- `migrate-terrain.mjs` writes JSON (decision 3). Update `scripts/README.md`, `docs/features/maps.md` and the paths in `ASSETS.md`.
- Test: every map has the fields of decision 1, every `piece` is in `TERRAIN_PIECES`, every `mat` has an image.
- Check: the values of `MAPS` before and after the change are the same, except comments. The coder compares them with a short Node script.
- Checks: format, lint, test, build.

### Step 2: Shared parts and piece catalog

- Move `Mat`, the backdrop and the lights from `Scene.jsx` to their own file, so the new page can use them. `Mat` takes a mat name and a rotation. The game passes the values of its map, and looks the same as before.
- New `src/terrain/catalog.js`:
  - `MATS`: one entry per mat with name and rotation (decision 7).
  - `PIECES_BY_SIZE`: groups 1 to 5 and "none". Each entry has piece key, name, size, scale and tint (decision 9).
- `src/terrain/catalog.test.js`: counts per group, the two pieces with two sizes, a scale tie, `panther-statue` at size 3.
- Checks: format, lint, test, build.

### Step 3: Page with mat and piece list

- `src/debug/TerrainPage.jsx`, `#terrain` in `Root.jsx` (dev only, lazy).
- Side panel: mat list, filter field, piece list by size (decisions 7 and 8).
- Canvas with table, mat, `Terrain`, camera controls (decision 6).
- A click on a piece row adds it (decision 10).
- `maps.md` and `rooms.md` (decision 16).
- Checks: format, lint, test, build.

### Step 4: Move, turn, remove

- Select, drag, Q and E, Delete, Clear (decisions 11 and 12). Use `pointerDrag.js` and `tablePoint.js`.
- Update the "Terrain page" section of `maps.md`.
- Checks: format, lint, test, build.

### Step 5: Load map and Export

- Load map (decision 13), Export (decision 14), card back for a map without a card (decision 15).
- The export code is a pure function in `src/terrain/exportMap.js`. Test: the export of each loaded map without changes equals its JSON file.
- Update `maps.md`.
- Checks: format, lint, test, build.

## Results

Step 1 done.

- 22 maps are now `src/terrain/maps/<id>.json`, and `maps/index.js` (imports with `with { type: 'json' }`, `MAPS`, `TTS_MAT_TOP`). `maps.js` is gone, the 11 importers use the new path.
- `MAPS` before and after are equal (keys, order, values), except the new fields. 32 commented-out placements are in `skipped` (26 tokens, 6 barrels with `note`). The truck tint exception is a `note` on its placement. Header comments went to `docs/features/maps.md`.
- `migrate-terrain.mjs` writes the map JSON and adds the import to `index.js` (`scripts/lib/maps-index.mjs`, tested). Trial runs with `--out` of 3 migrated maps gave the same JSON as the files. `matRotation` is now written as 0 to 359.99.
- Tests: `maps/maps.test.js`, `scripts/lib/maps-index.test.js`.
