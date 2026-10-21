# Plan: Builder review fixes

Requested by the user on 2026-10-21. Status: in progress. Branch `builder-review-fixes`, worktree `../mcp_assist_3d-builder-review-fixes`.

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step: `pnpm format`, `pnpm lint` (no new warnings against main), `pnpm test`, `pnpm typecheck`, `pnpm --filter web build`. A step that changes `apps/api`: also the api tests.

Paths are under `apps/web/src/` unless they start with `apps/` or `docs/`. Line numbers are at `95967aa`.

## Request

A code quality review of `ccf208a..95967aa` (2026-10-19 to 2026-10-21) found 3 medium and 10 low issues. Most of them are in the Sandbox map builder. The user asked to fix all of them.

## Steps

### 1. Board record in the table document (review items 1, 2)

Problems:
- `terrain/SandboxBuilder.jsx:30-37` keeps the board name, id suffix, fixed id and imported author in component state. App mounts the panel only in Build mode (`App.jsx:998`). So a Build toggle or a reload loses them, and a re-save gets a new id. `docs/features/map-builder.md` says a re-save keeps the id.
- `canUndo` in `log/log.js:109` checks "same board" with `mapId`. Every custom board, import and empty mat has `mapId` null. So Undo can put a piece of board A onto board B.

Change:
- New game field `board` in `net/doc.js` (`GAME_FIELDS`): `{ key, name, author, id, suffix }` or null.
  - `key`: which board instance the table shows, for undo. `applyMap` and `fillMap`: the map id. `applyBoard` and `applyEmptyMat`: a new random id. `startTable`: the map id, or `'custom'` for a room board.
  - `name`, `author`: the name field and the author of a loaded map or imported board.
  - `id`: the fixed id (a loaded map, an imported file with an id), else null. `suffix`: made once per board record (`newIdSuffix`).
  - An old table has no `board`. That is a valid state (empty name, as now), so `SCHEMA` does not change. This follows the rule for `tools` in `docs/features/peer-to-peer.md`.
- `applyMap`, `applyBoard`, `applyEmptyMat`, `fillMap` and `startTable` in `rooms/table.js` write `board` in the same change. `applyBoard` takes the name, author and id of the import. The Toolbar Map select then updates the name too.
- `SandboxBuilder` reads and writes `game.board` instead of `useState`. Only `message` stays local.
- The `terrainDeleted` log entry stores `boardKey` (`pieces/terrainUndo.js`, `useTablePieces.js`). `canUndo` compares it with `game.board?.key`. An entry without `boardKey` (old table) keeps the `mapId` compare.
- Tests: rename keeps the suffix; Build off/on keeps name and id (the record survives, a pure test on the table); `canUndo` is false after `applyBoard` or `applyEmptyMat` on a table where `mapId` stays null.
- Docs: `map-builder.md` ("Name and id": the record is in the document, not the panel state). `game-log.md` (or the Undo section that exists): the board key. `peer-to-peer.md` "Yjs document": the new field.

**Result:**

### 2. Export after Load map keeps the map data (review item 3)

Problem: the board that `SandboxBuilder.jsx:51-58` exports has no `ttsMap`, `note` or `skipped`. A moved map piece also loses its placement `note`, because `storedCustom` (`terrain/builder.js:100`) and `TERRAIN_FIELDS` do not store it. `map-builder.md` line 45 says Load map keeps them. The round trip test checks `exportMap(mapToState(map))`, not the Sandbox path.

Change:
- When `mapId` is a key of `MAPS`, the export merges `ttsMap`, `note` and `skipped` from `MAPS[mapId]`.
- A placement note: a map piece keeps `index` when it becomes custom (`toCustomPiece`, `storedCustom`), and export takes the note from `MAPS[mapId].placements[index]`. The user chose this over storing `note` in the document: the map file stays the one source of the note text. `isCustomPiece` checks `piece`, so a custom piece with `index` is still custom. Check every reader of `index` (`withPlacements`, `toCustomPiece`, terrain undo) treats a custom piece with `index` as custom.
- Test: Load map, move a piece that has a note, export through the same function `SandboxBuilder` uses. The file has `ttsMap`, `skipped` and the note.

**Result:**

### 3. Top view image shows only the mat and terrain (review item 4)

Problems in `terrain/boardImage.js:150`:
- `ShadowUpdates` turns off automatic shadow updates. The capture does not ask for a new shadow map after `hideOthers`, so hidden models still cast shadows into the image.
- With Faster drawing on, the selected piece has the orange shade in its material (`useOutline`). Add selects the new piece, so Add then Save gives an orange piece.

Change:
- Set `gl.shadowMap.needsUpdate = true` after `hideOthers` and before `gl.render`. The one in `finally` stays.
- Take the selection shade off during the capture. Preferred: `useOutline` exposes a way to drop and restore the shade, and the capture calls it. The coder checks how the shade is set and picks the simplest way that keeps `useOutline` the single owner of the shade.
- `docs/features/map-builder.md` (top view): no models, no shadows of models, no selection shade.

**Result:**

### 4. Bad data does not break the table (review items 5, 6, 9)

Problems:
- `rooms/openTableSession.js:224`: a Versus room record has no `board`. A fill or a failed migrate on `'custom'` calls `startTable('custom', undefined)`, which gives a table with no mat and no terrain.
- `withPlacements` (`rooms/table.js:35`) keeps a custom piece with any `piece` key. A peer can send a key that `TERRAIN_PIECES` does not have. Then `Terrain.jsx:148` reads `piece.bundle` on undefined and `SceneBoundary` shows the error screen.
- `validateBoard` (`terrain/builder.js:172`) and the zod schema (`apps/api/src/routes/board.ts:31`) keep any string as the board id. The id is the download file name, and the doc says it is kebab-case (`MAP_ID_PATTERN`).

Change:
- `openTableSession`: for `CUSTOM_MAP_ID` with no board, do not fill. Show "The board of this room can not be rebuilt." through `onExit`, the same way as the other load errors.
- `withPlacements`: leave out a custom piece whose key is not `Object.hasOwn(TERRAIN_PIECES, key)`.
- `validateBoard`: an id that fails `MAP_ID_PATTERN` becomes '' (then the id is made from the name). Zod: the same pattern on `id`. Share the pattern: the api cannot import web code, so copy it with a comment that names the other place, as for `CUSTOM_MAP_ID`.
- Tests: each of the three refusals.
- Docs: `map-builder.md` (import id rule, Versus refill), `rooms.md` if it describes the fill.

**Result:**

### 5. Advance counts a move only when the slide starts (review item 10)

Problem: `handleAdvance` in `tabletools/useToolLimits.js:248,265` claims the model and calls `moved()` before `slide()`. `startSlide` (`scene/useModelSlide.js:23`) returns without a slide when the model is dragged or remote. Then the move is counted and nothing moves.

Change: `startSlide` returns true or false. `handleAdvance` checks the same refusal before the claim (a `canSlide()` on the target), or calls `moved()` only after a true. The claim must not stay when the slide is refused. Test for the refusal if the hook has a pure part to test, else say so in the Result.

**Result:**

### 6. Cleanups (review items 7, 8, 11, 12, 13)

- `terrain/useBuilderEdits.js:26,31`: remove `startTransition` and its comment. `setTerrain` writes a `useSyncExternalStore` store, which always renders at once.
- `terrain/pieceBox.js:18`: export one Draco decoder path constant and use it in `App.jsx:98` and `pieceBox.js`. Stop the second decode of each piece if drei or r3f gives the loaded GLTF from its cache (for example `useLoader` cache with the same loader and key). If that is not reliable, keep the second load and say why in the Result.
- `api/board.js` `getBoardImage` and `rooms/serverStore.js` `getRoomImage`: one `getBlob(path)` helper in `api/client.js` (null on 404). On the server, one helper for the WebP response in `board.ts` and `rooms.ts`.
- `characters/models.js:14` imports `scripts/custom-models.json` and `scripts/lib/custom-models.mjs`. Move both into `src/` and let the scripts import them from there. Update `scripts/README.md` and `docs/features/custom-models.md` paths.
- `rooms/table.js`: keep one name for `'custom'`. If `CUSTOM_BOARD` (Map select value) and `CUSTOM_MAP_ID` (room map id) must stay apart, one comment says why.

**Result:**
