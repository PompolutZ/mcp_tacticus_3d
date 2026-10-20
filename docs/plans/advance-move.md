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

## Results

### 1. Slide on the character

- Done. The slide is in its own hook, `scene/useModelSlide.js`. `useModelLift.js` now returns functions (`clearLift`, `isLifted`, `isUp`, `restPosition`) and not its ref, so `CharacterModel.jsx` does not change a value a hook returns (lint: react immutability).
- `slidePath(points)` in `characters/throwPath.js` takes a line of points, so it can follow a bent tool.

### 2. Advance

- Done. `advancePath` in `tabletools/toolGeometry.js` gives the Throw-off path. `groundedPath` in `characters/throwPath.js` adds the ground height (`landingY` from `3cd05c7`).
- The Throw stop is one function, `throwStop` in `tabletools/useToolLimits.js`, used by the Throw drag and by Advance.
- Throw on: the slide starts where the character is, kept on the line, so a character dragged part way does not jump back. The side and the character come from the Throw lock, as for the Throw drag.
