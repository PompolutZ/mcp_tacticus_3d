# Advance: right-click the far end of the movement tool

## Request

A player asked for this: a right click on the far end of the movement tool moves the snapped character to that end. This move is called Advance.

- Throw / Push off: the character moves along the tool. If the tool is bent, the character follows the bend. The tool is not straightened. There is no collision check, so the players resolve overlaps.
- Throw / Push on: the move is a Throw. The tool is already straight. The character moves along the Throw line and stops at the first hit (base, terrain at start height, mat edge). This is the same stop that the Throw drag uses today.
- The end spot: the base touches the far end from outside. This matches the full Throw distance.
- The move is a short animation, not a jump.

## Decisions

- Trigger: a right click anywhere on the far half of the tool, so it is easy to hit, while the tool is snapped to a character. A right click on the far half means a right press and release without movement (`e.delta <= CLICK_MOVE`, as in `characters/TrayStrip3D.jsx`). A right drag still turns the camera. On macOS, `contextmenu` fires on mouse down, so the check runs on pointer up with button 2.
- Only a character with a body can Advance, the same as Throw. Tokens do not have a body.
- No Advance in these cases: the other player has claimed the model (`model.claim()` fails), the model is lifted (key R), or the tool is an angle tool.
- Place on: Advance works as in the Throw-off case. The Place lock stays.
- Throw on: after the move, the Throw lock stays on. The character is still on the line.
- Path, Throw off: a line with three points. It starts at the character center, goes to the hinge, then goes to the point on the far half at `tip + radius` from the hinge (`alongHalf`).
- Path, Throw on: `throwLine` from the start to `throwMove(...).moved`.
- Height: each point uses the ground height (`landingY`), as the old slide did.
- Animation: restore the slide from commit `3cd05c7` as a general `slide(path, duration)` on the character. It uses `setKinematic` / `setDynamic` from `physics.js`, eases out, and `isBusy()` includes the slide, so the claim stays during the move. `LiveSync` already sends the poses of a claimed model, so the other player sees the move. Call `model.moved()` when the move starts.

## Steps

### 1. Slide on the character

- `characters/CharacterModel.jsx`: add `slide(path, duration)` and the per-frame move. Base it on `startSlide` / `moveSlide` from `3cd05c7`. Add the slide to `isBusy()`.
- `scene/Scene.jsx`: expose `slide` on `toolModels`.
- `characters/throwPath.js`: add the path timing helper (ease-out, speed, minimum time). Base it on `throwSlide` from `3cd05c7`.
- `characters/claims.js:18`: the comment lists drag, lift, slide and turn. With this step the comment is true again.
- Tests: the timing helper (a longer path takes longer, never under the minimum, ends at the path end).

### 2. Advance

- `tabletools/toolGeometry.js`: `advancePath(shape, side, tip, radius, from)` returns the three points for Throw off. Tests: the last point is on the far half center line at `tip + radius` from the hinge; the path passes the hinge; for a straight tool the path is a straight line.
- `tabletools/useToolLimits.js`: `handleAdvance()`. It checks the rules above, picks the Throw-off path or the Throw-on line, and calls `target.slide(...)`.
- `tabletools/RulerTool.jsx`: a right click (press and release without movement) on the far half mesh calls `handleAdvance`. Stop the event so the camera does not turn on a click.
- `docs/features/range-movement-tools.md`: a new "Advance" section and a line in "Input rules".

## Request 2: Maximum Threat overlay

In the setup, the player without Priority picks the Maximum Threat from the two crisis cards. Today the only control is the two chips on the table (`ThreatPanel` in `setup/GameSetup.jsx`). Add an overlay like the "Choose 1" crisis overlay (`crisis/CrisisChoose.jsx`):

- It opens by itself on the screen of the player who chooses.
- It has one button per threat. A click sets the Maximum Threat.
- It shows that player's own roster Breakdown tab, so the player can see which characters each threat allows before they choose.

### Decisions

- Reuse the "Choose 1" overlay mechanism in `App.jsx` (`openChoose`, `chooseKey`, `useAutoOpen`, `popupOpen`), extended to the `threat` step. No second copy of it. The same rules apply: it opens once per step, only for the chooser, only when both rosters are in and no earlier step is browsed. Closing it does not open it again.
- New `setup/ThreatChoose.jsx`, in the same `Dialog` frame and comic styles as `CrisisChoose`. Shared layout goes into a shared piece, not copied.
- Buttons: one per crisis card, for example "Secure · 17". A click calls `actions.threat(value)` and closes the overlay. The other player sees "Waiting for X to choose the Maximum Threat." if they open it.
- Breakdown: the existing `rosters/BreakdownTab.jsx`, for the chooser's own roster. Its threat chips stay as a preview: they change which characters it shows, not the Maximum Threat. Its state (threat, filters) is the same as in the roster popup, so a filter set in one place shows in the other. To share it, the state moves out of `rosters/RosterPopupHost.jsx` into a hook that both use.
- The table chips stay.

### Steps

#### 3. Shared Breakdown state

- Move the per-team Breakdown state and its builders (`breakdownChoice`, `breakdownThreats`, `popupBreakdown`) out of `rosters/RosterPopupHost.jsx` into one hook. `RosterPopupHost` and the new overlay both use it. No behavior change.
- `docs/features/squad-breakdown.md`, "State": say where the state lives now.

#### 4. Threat overlay

- `setup/ThreatChoose.jsx` and its styles, based on the `CrisisChoose` frame.
- `App.jsx`: the choose key and auto-open cover the `threat` step. Mount `ThreatChoose` for that step.
- `docs/features/setup-game.md`: the overlay in the Maximum Threat part and in the Code table. `docs/features/squad-breakdown.md`: the Breakdown also shows in this overlay.

## Results

### 1. Slide on the character

- Done. The slide is in its own hook, `scene/useModelSlide.js`. `useModelLift.js` now returns functions (`clearLift`, `isLifted`, `isUp`, `restPosition`) and not its ref, so `CharacterModel.jsx` does not change a value a hook returns (lint: react immutability).
- `slidePath(points)` in `characters/throwPath.js` takes a line of points, so it can follow a bent tool.

### 2. Advance

- Done. `advancePath` in `tabletools/toolGeometry.js` gives the Throw-off path. `groundedPath` in `characters/throwPath.js` adds the ground height (`landingY` from `3cd05c7`).
- The Throw stop is one function, `throwStop` in `tabletools/useToolLimits.js`, used by the Throw drag and by Advance.
- Throw on: the slide starts where the character is, kept on the line, so a character dragged part way does not jump back. The side and the character come from the Throw lock, as for the Throw drag.

### 3. Shared Breakdown state

- Done. `rosters/useBreakdownChoice.js` keeps the Breakdown state. `App.jsx` calls it once and passes `breakdownFor(team)` to `RosterPopupHost`. `breakdownFor` is a plain function: its inputs from `useGameSetup` are new each render, so a memo would not help.

### 4. Threat overlay

- Done. `setup/ThreatChoose.jsx` uses the "Choose 1" auto-open in `App.jsx`, extended to the threat step. `crisis/ChooseFrame.jsx` is the frame both overlays share. `threatChips` in `setup/deckButton.js` gives the table chips and the overlay buttons the same label, value and lock.

### 5. Terrain delete entry and Undo

- Done. `planFall` returns `{ terrain, models: { id: { delta, pose } } }`; `useTerrainFall` also returns `raiseModels` (new `sceneApi.raiseModels`), which queues the poses for the same after-render effect as a fall. The pure rules are in `pieces/terrainUndo.js` (`deleteEntryData`, `undoPlan`, tests in `terrainUndo.test.js`). `canUndo` and the texts are in `log/log.js`.
- Entry also stores `pieceKey` (name for the text), since the stored piece has only `id, index, locked, y`. Terrain falls store `from` and `to` heights.
- Deviation: the app has no spectator seat (the `spectator` flag is the Streamer view), so the button is not hidden for anyone. `LogPanel` shows it only when `onUndo` is passed.

## Request 3: Undo a terrain delete

A terrain piece can be deleted by accident (Delete key). Add an **Undo** button to the log entry of the delete, so the player can put the piece back.

### Decisions

- Today a terrain delete has no log entry. Add one: kind `terrainDeleted`, text "Nelly deleted Crate." (the name from `TERRAIN_PIECES`). It is written in the same transaction as the delete (`handleTerrainRemove` in `pieces/useTablePieces.js`).
- The entry stores what undo needs: the removed piece (the whole object, with its id), the map id, the old `y` of each terrain piece that fell, and the fall of each model (`id`, delta, the pose after the fall).
- **Undo** shows on the entry in the open log and in the bubble. It shows while the piece is not on the table and the map is the same. So after an undo, or after a map change, the button is gone. Both players see it. A spectator does not.
- An undo is one transaction:
  - the piece is back with the same id, place and lock state;
  - a terrain piece that fell gets its old `y` back, but only if its `y` is still the one from the fall;
  - a model that fell goes back up by its delta, but only if it has not moved since the fall (pose still the same) and this browser can claim it;
  - a new entry "Nelly put back Crate."
- Anything that moved onto the spot after the delete is not moved. The players fix it (as for other overlaps).
- One undo for each delete. No undo for other actions.

### Steps

#### 5. Terrain delete entry and Undo

- `terrain/useTerrainFall.js`: `planFall` also returns the model falls (delta and the pose after the fall), so the entry can store them.
- `pieces/useTablePieces.js`: write the `terrainDeleted` entry in `handleTerrainRemove`. Add `handleTerrainUndo(entry)`, as in the rules above.
- `log/log.js`: text of `terrainDeleted` and `terrainRestored`. A pure function `canUndo(entry, terrain, mapId)`.
- `log/LogPanel.jsx`, `log/log.css`: the **Undo** button on the entry, in the list and in the bubble. A click on it does not open or close the Log.
- Tests (`log/log.test.js`, and a test for the undo writes): the button shows only while the piece is not on the table and the map is the same; undo puts the piece back with its id; a piece moved after the fall keeps its place.
- `docs/features/game-log.md`: the two entries in "What is logged", the Undo rule in "Panel". `docs/features/maps.md`, "Delete": the delete can be undone from the log.
