# Plan: A tool snap does not select an enemy model

Requested by the user on 2026-10-11. It follows Part 1 of `docs/plans/playtest-1-bugs.md`. Status: Part 1 done.

One coder step and one commit.

## Request

In a multiplayer room, a free tool that is dragged onto an enemy model snaps to it and selects the model. Then **Place** could move the enemy model. The snap should not select it. This is the same rule as for the tool keys in `playtest-1-bugs.md`, Part 1.

## Facts

- `RulerTool.jsx`, `onDragMove`: a free tool follows the pointer while it is dragged by its body. When the pointer moves onto a model, the tool snaps to it and the drag ends. Then the tool calls `onSnap(model)`. A snapped tool turns around its base and never snaps to another model.
- `Scene.jsx` passes `onSnap={selectModel}` to the range, movement and Toward / Away tools. `selectModel` calls `selectPiece` and does not check the side.
- **Place** moves the first selected character (`placeTarget` in `Scene.jsx`), on any side. `claim()` stops **Place** only while the other player moves that model.
- `keySelects` in `App.jsx` checks the side for the tool keys. It finds the side with `characters` and `modelCharacterId`.
- `Scene.jsx` gets the played sides as the prop `ownTraySides` (`App.jsx` passes `playedSides`). It uses them only for the dice trays.
- `docs/features/peer-to-peer.md`: "A tool can snap to any model or token, also of the opponent, because players measure range to enemy models."

## Decisions

1. One pure helper has the rule: a tool key or a tool snap selects the piece, except a model of a side that this browser does not play. `keySelects` in `App.jsx` and `selectModel` in `Scene.jsx` both use it. The helper gets a unit test.
2. The `Scene.jsx` prop `ownTraySides` gets the name `playedSides`, the same as in `App.jsx`, because it now has two uses.
3. The rule goes into `docs/features/peer-to-peer.md`, next to the line about snaps to enemy models. The line in `docs/features/key-shortcuts.md` about the keys stays.

## Part 1: Snap without selection

Work:
1. A pure helper, for example `toolSelects(piece, characters, playedSides)` in `src/selection.js`, with a unit test: own model, other side's model, crisis token, single player (both sides played).
2. `App.jsx`: `keySelects` uses the helper.
3. `Scene.jsx`: rename the prop `ownTraySides` to `playedSides` (also in `App.jsx` and in the props comment). `selectModel` uses the helper, so a snap to a model of the other side does not change the selection.
4. Docs: `docs/features/peer-to-peer.md`, the line about snaps to enemy models. Add: the snap does not select that model, so **Place** cannot move it.

**Result:** `toolSelects` in `src/selection.js` (with tests in `src/selection.test.js`). `keySelects` in `App.jsx` and `selectModel` in `Scene.jsx` use it. Scene prop `ownTraySides` is now `playedSides`. Rule added to `docs/features/peer-to-peer.md`.

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, the web tests.

User, after this part:
1. Multiplayer room, two browsers. Red spawns a free tool (a tool key over the empty table) and drags it onto a Blue model. The tool snaps to the Blue model. The Blue model is not selected on either screen.
2. Red selects an own model, then drags a free tool onto a Blue model. The own model stays selected. **Place** moves the own model.
3. Red drags a free tool onto an own model. The model is selected, as before.
4. Sandbox: a free tool dragged onto a Red model selects it, as before.
5. The tool keys work as after `playtest-1-bugs.md`, Part 1.
