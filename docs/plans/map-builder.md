# Plan: map builder in the Sandbox

## Request

A map builder in the Sandbox: an empty mat ("No terrain"), a list of pieces, drag to move, Q/E to turn. Save as a JSON export first, then one custom board per user in Mongo. Pick a custom board in the new room dialog. Remove `#terrain` when the Sandbox covers it. The scanned pieces (Traffic Light, Taxi Cab) are in the list.

The user tests at the end. Fixes go in place, or into a fix plan.

Problems that the user found on `#terrain`:

- A mat without terrain cannot be picked.
- An added piece is half under the mat.
- A drag is not precise.

## Facts found

- `#terrain` (`src/debug/TerrainPage.jsx`) already has the parts of an editor: mat list, piece list by size (`src/terrain/catalog.js`), add, drag, Q/E turn, Delete, load map, Export (`src/terrain/exportMap.js`). They live in the page component. The Sandbox has none of them.
- The table document stores a terrain piece as `{ id, index, locked, y? }`: an index into the map JSON (`src/rooms/table.js`, `mapTerrain`, `withPlacements`). A piece that is not in a map JSON cannot be stored. The mat comes from `MAPS[mapId].mat`.
- Added piece half under the mat: `addPiece` puts the placement position at the mat top (`TTS_MAT_TOP`). The position is the origin of the mesh, and for most pieces the origin is the middle of the mesh, not its bottom.
- Drag not precise: the drag reads the pointer on the plane of the mat top (`NO_HIT_WORLD`). The pointer grabs the piece higher up, on its side or top. With the camera at an angle, a move on the mat plane is not the move under the pointer, so the piece slides away from the pointer.
- The room API checks `mapId` with `/^[a-z0-9-]{1,64}$/` (`apps/api/src/routes/rooms.ts`). A random room gets its map from a `maps` list when the guest joins.

## Decisions

1. **Board.** A board is a mat, a mat rotation and a list of full placements, in the map JSON format (`docs/features/maps.md`, "JSON format"). The export, the file import and the Mongo record use this one format and `exportMap.js`.
2. **Full placements in the document.** A stored terrain piece is either a map piece `{ id, index, locked, y? }` as today, or a custom piece `{ id, piece, position, rotation, scale, size?, tint?, locked }`. `withPlacements` reads both. A map piece that the builder moves or turns becomes a custom piece. Old tables keep working.
3. **Mat in the document.** `game.mat`: `{ name, rotation }` or null. Null means the mat of the map. One function gives the mat of a table, from `mapId` and `game.mat`. Every place that reads `MAPS[mapId].mat` uses it (Mat, preload in `tableFiles`, the 2D view).
4. **No terrain.** The Sandbox Map select gets a second group, "Empty mat", with one row per mat (`MATS` of `catalog.js`). It sets `game.mat` and clears the terrain. `mapId` stays a map id or becomes null.
5. **Build mode.** A Sandbox toolbar button "Build" opens a side panel. In Build mode:
   - All terrain pieces are unlocked. A click selects a piece, a drag moves it, Q/E turn the selected piece by 15°, Delete removes it. Leaving Build mode locks them again.
   - The panel has the parts of `#terrain`: mat list, Clear, filter, piece list by size, load map, `id` and `name`, Export, and a new Import (a `.json` file in the map format).
   - Models, tools and dice stay where they are. The game keys that collide with Q/E/Delete do not act on terrain outside Build mode, as today.
6. **Shared code.** The page logic of `TerrainPage.jsx` moves to shared modules, so `#terrain` and the Sandbox use the same code until `#terrain` goes: the panel (`src/terrain/BuilderPanel.jsx`), the edit actions (add, move, turn, remove, clear, load, export, import) as pure functions in `src/terrain/builder.js`, and the drag in one hook. The drag uses `startPointerDrag` and `tablePoint`, as now.
7. **Add on the mat.** A new piece stands with the bottom of its mesh on the mat top. The height comes from the bounding box of the loaded mesh, with the placement scale and turn. One function computes it, and the add and the import of a file without heights use it. The piece goes to the mat center.
8. **Precise drag.** The drag plane is the horizontal plane through the point where the pointer grabbed the piece. Therefore the grabbed point stays under the pointer. The piece height does not change, and the piece does not climb on other pieces.
9. **Mongo save.** Collection `customBoards`, one record per user: `{ _id: userId, board, updatedAt }`. Routes `GET /me/board` (404 when none) and `PUT /me/board`. The route checks the shape (mat name, rotation, at most 300 placements, numbers, piece keys as `/^[a-z0-9-]{1,80}$/`) and builds the record field by field, as the other routes. `DELETE /me` deletes the board too. Memory and Mongo store, with tests. In the panel: "Save to account" and "Load from account", only when logged in.
10. **Board in a new room.** When the user has a saved board, the new room dialog shows a card "My board" (no image: the card back). A room on it has `mapId: 'custom'`. The table starts with `game.mat` and the full placements of the board (`startTable`). A random room never gets the custom board. The guest gets the board with the document.
11. **Remove `#terrain`.** The last step deletes `TerrainPage.jsx`, its route in `Root.jsx` and its CSS. The "Terrain page" part of `maps.md` moves to the builder feature. `scripts/README.md` and other docs that name `#terrain` point to the Sandbox builder.
12. **Feature doc.** `docs/features/map-builder.md` holds the lasting behavior. `maps.md` links to it.

## Steps

Each step: `pnpm format`, `pnpm lint` (no new warnings compared with main), `pnpm test`, `pnpm --filter web build`. API steps also `pnpm --filter api test` and `pnpm typecheck`. One commit per step.

### Step 1: scanned terrain pieces

Step 1 of `docs/plans/scanned-terrain.md`, as written there. Run the two scans in the foreground.

### Step 2: shared builder code, add on the mat, precise drag

- `src/terrain/builder.js` (pure, with tests) and `src/terrain/BuilderPanel.jsx`, from `TerrainPage.jsx` (decision 6). `TerrainPage.jsx` uses them and keeps its behavior.
- The drag hook (decision 8) and the rest height (decision 7).
- Tests: a new piece rests on the mat (its bottom at the mat top, for a mesh with its origin in the middle). A move keeps the height. Turn and remove as today.
- Docs: `docs/features/map-builder.md` (status: partly built), `maps.md` "Terrain page": the add height and the drag.

### Step 3: board in the document

- Decisions 2 and 3: the two kinds of stored pieces, `game.mat`, the one mat function and its callers.
- Tests: a table with map pieces, custom pieces and both. A missing `game.mat` gives the mat of the map. The document round trip of a custom piece.
- Docs: `rooms.md` and `peer-to-peer.md` where they describe the stored terrain.

### Step 4: Sandbox No terrain and Build mode

- Decision 4 in `Toolbar.jsx`. Decision 5: the Build button, the panel (`BuilderPanel.jsx`), the unlock in Build mode, drag, Q/E, Delete, through the shared code of step 2. Writes go to the document (`setTerrain`, `game.mat`).
- Import: a `.json` file in the map format. A bad file shows a message and changes nothing.
- Tests: the import check (good file, bad file, unknown piece key). Build mode keys only act in Build mode.
- Docs: `map-builder.md`, `rooms.md` (Sandbox).

### Step 5: save the board in Mongo

- Decision 9: API routes, stores, tests. Web: `src/api/` fetch helpers, the two panel buttons.
- Docs: `auth.md` or `backend.md` (collection and routes), `map-builder.md`.

### Step 6: My board in the new room dialog

- Decision 10. Single player and multiplayer rooms with a chosen map. Not in random rooms.
- Tests: `startTable` with a board. The dialog shows the card only with a saved board.
- Docs: `rooms.md`, `setup-game.md` if it lists the map choice, `map-builder.md`.

### Step 7: remove `#terrain`

- Decision 11. `map-builder.md` status: built.

## User checks

- Sandbox, Map select, "Empty mat": a mat with no pieces.
- Build: add a Traffic Light and a Taxi Cab. Both stand on the mat, not in it.
- Drag a piece: the point under the pointer stays under it.
- Q/E turn, Delete removes, Clear removes all.
- Export, then Import the same file: the same board.
- Logged in: Save to account, reload, Load from account.
- New room dialog: "My board" card, the room opens with the board. In a multiplayer room the guest sees the same board.
- `#terrain` is gone.
