# Plan: Q / E and the wheel turn and bend a snapped tool

Requested by the user on 2026-10-14. Status: Parts 1 and 2 done.

Three coder steps, one commit each. Branch `tool-turn-keys`, worktree `../mcp_assist_3d-tool-turn-keys`.

## Request

1. A snapped tool turns with Q / E and with the mouse wheel, and it stays snapped.
2. While Bend is on, Q / E and the wheel bend the tool, the same as a drag.
3. One place in the code decides what an input does in each tool state (a small state machine). The feature doc describes these rules.
4. A setting for the Q / E and wheel step: 5° to 15°, default 15°.

## Facts

- `RulerTool.jsx` (1828 lines) has the tool state in separate hooks: `snap` (free or snapped, and the half on the base), `bendOn`, `turn` (the bend of each half), `placeSide`, `placeOne`, `throwLock`, `dragKind` (`'move'`, `'turn'` or null).
- `dragPlan(side)` decides what a drag does: bend the grabbed half, turn around the base, or move (returns null).
- `turnAroundCenter(angle)` is the Q / E path. It always turns around the tool center, so a snapped tool becomes free. During a turn drag (snapped tool or bend) it does nothing.
- `Scene.jsx`: `turnPiece` sends Q / E to the dragged piece, else the one under the pointer. `ROTATE_STEP` is 15°, `ROTATE_RATE` is 90°/s for a held key. A held key and each wheel step go through `addTurn`, which smooths the turn over a few frames, and `applyTurn` calls the tool's `turnRef` function.
- `input/bindings.js`: the wheel turns a piece only while a drag is on (`'dragging'`). Without a drag the wheel zooms.
- `useDragTool`: a turn drag keeps `turning.current` with `d` (the turn since the drag started) and calls `onTurn(d, startPose)` on each frame.
- The R1, range and angle tools aim at the piece under the pointer during a turn drag (`measuredRef`). Then the pose comes from the aim, not from `d`.
- The angle tool and the T/A tool have no Bend button. A range tool has no Bend button.
- Settings: `settings/settings.js` (`defaultSettings`, `normalize`, with tests), the Settings popup, and `docs/features/table-tools.md`, "Settings menu".
- The terrain page (`docs/features/maps.md`) has its own Q / E, 15°.

## Decisions

1. A new pure module `src/components/toolInput.js` holds the rules. `toolAction(state, input)` returns one action:
   - state: `{ snapped, snappedSide, bendable, bendOn, side, drag }`. `side` is the half under the pointer or the grabbed half (`'left'`, `'right'` or null on a range tool). `drag` is `'move'`, `'turn'`, `'bend'` or null.
   - input: `'drag'` (drag start) or `'step'` (Q / E press, held key, wheel step).
   - action: `{ kind: 'move' }`, `{ kind: 'turnCenter' }`, `{ kind: 'turnBase' }`, `{ kind: 'bend', side }` or `{ kind: 'none' }`.
   No React and no Three.js, so unit tests cover it. Place, Place 1 and Throw only limit drags of models, so they stay out of it.
2. The rules (the same table goes into the feature doc):

   | Tool state | Drag a half | Q / E, wheel during a drag |
   |---|---|---|
   | Free, Bend off | move the tool | turn around the tool center |
   | Free, Bend on | bend that half | bend that half one step |
   | Snapped, Bend off | turn around the base | turn around the base one step |
   | Snapped, Bend on, far half | bend the far half | bend the far half one step |
   | Snapped, Bend on, half on the base | turn around the base | turn around the base one step |

   - Q / E with no drag do what the row says for the half under the pointer. On a range tool there is no half, so the row for "Bend off" applies.
   - A step during a drag goes to the drag's own action. A turn drag continues from the new angle. A move drag turns the tool around its center, as today.
   - Without a drag, the wheel zooms, as today.
   - A bend stops at 90° from straight (`MAX_BEND`), the same as a drag.
   - A movement tool snapped next to an angle tool keeps its ±45° limit (`limitTurn`).
   - While a turn drag aims at a piece under the pointer (range, R1, angle tool), the aim sets the pose, so a step does nothing.
3. During a turn or bend drag, a step adds to an offset in `useDragTool` (`turning.current.extra`). `onTurn` gets `d + extra`. So the grabbed spot leaves the pointer by the step, and the next pointer move goes on from the new angle.
4. The step setting is in `settings.turn.step`: whole degrees, 5 to 15, default 15. It applies to every Q / E press and wheel step on the table: characters and tools, turns and bends. The speed of a held key (90°/s) does not change. The terrain page keeps its own 15°.
5. The feature doc `range-movement-tools.md` gets a section "Input rules" with the table. The Q / E paragraph and the "Bending" section point to it.

## Part 1: The rules module, no change in behavior

Work:
1. `src/components/toolInput.js`: `toolAction(state, input)` as in decisions 1 and 2. Tests in `toolInput.test.js`: every row of the table, for both inputs, plus a range tool (no half) and a drag that is on.
2. `RulerTool.jsx`: `dragPlan` gets its choice (move, turn around base, bend which half) from `toolAction(state, 'drag')`. The pose math stays in `RulerTool.jsx`.
3. `turnAroundCenter` stays as it is in this part.
4. Docs: `range-movement-tools.md`, new section "Input rules" with the "Drag a half" column only. The Q / E column comes in Part 2.

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, the web tests.

Result: `src/components/toolInput.js` has `toolAction(state, input)` for `'drag'` and `'step'`. `toolInput.test.js` covers every table row for both inputs, a range tool, and a drag in progress. `RulerTool.jsx` `dragPlan` takes move / bend / turn around base from `toolAction(state, 'drag')`; the pose math is unchanged, and `turnAroundCenter` is untouched. `range-movement-tools.md` has "Input rules" with the "Drag a half" column.

User, after this part: drag works as before on each tool. Free move, snapped turn around the base, bend of each half, and a snapped tool with Bend on.

## Part 2: Q / E and the wheel follow the rules

Work:
1. `RulerTool.jsx`: the function that `turnRef` registers (today `turnAroundCenter`) gets `toolAction(state, 'step')`:
   - `turnCenter`: today's code.
   - `turnBase`: `turnAround(pose, base center, angle)`, with `limitTurn` at an angle tool. The snap stays.
   - `bend`: the same clamp as the bend drag (`MAX_BEND` from the other half), then `setTurn`.
   - `none`: nothing.
   The half under the pointer comes from the raycast of the tool parts (`part.side`). The coder finds the cheapest way: for example, keep the last hovered half in a ref from the part pointer events.
2. `useDragTool`: a turn or bend drag keeps an offset (`extra`). A step during that drag adds to it. `onTurn` gets `d + extra` (decision 3).
3. `Scene.jsx`: no change expected. The wheel already sends `rotate` to the dragged piece.
4. Docs:
   - `range-movement-tools.md`: the "Q / E, wheel" column in "Input rules". Replace the Q / E paragraph (line "While a drag turns a snapped tool or bends a tool, Q and E do nothing") with a short text and a link to the table. "Bending": Q / E and the wheel bend too.
   - `key-shortcuts.md`: the Q / E row and the paragraph under the table ("A turn moves both ends of a tool, so a snapped tool is free after it" and "Q / E do nothing" are no longer true). The wheel row.

Checks: as in Part 1, and new tests in `toolInput.test.js` if Part 1 did not cover `'step'`.

Result: `turnAroundCenter` is now `stepTool` in `RulerTool.jsx`. It reads `toolAction(state, 'step')`: turn around the center (as before), turn around the base (`turnAround`, `limitTurn` at an angle tool, snap stays), bend (`MAX_BEND` clamp, `setTurn` with the previous state). The half under the pointer is in `hoverSide`, set from the part pointer events. A bend drag now reports `'bend'` as `dragKind` (the bend plan has `kind: 'bend'`; `bendSide` keeps the grabbed half). `useDragTool` has `extra` in `turning.current` and `onPointerDown.stepTurn(angle)`; `onTurn` gets `d + extra`. `Scene.jsx` needed no change. Docs: `range-movement-tools.md` (Input rules column, Q / E text, Bending) and `key-shortcuts.md`. `toolInput.test.js` already covered `'step'`.

User, after this part:
1. Snapped movement tool, pointer over it, Q and E: it turns around the base, it stays snapped and keeps touching the base.
2. The same while dragging it, with Q / E and the wheel. The drag goes on from the new angle.
3. Snapped range tool and R1 tool: the same as 1 and 2.
4. A movement tool next to an angle tool: Q / E stop at ±45°.
5. Bend on, free tool: Q / E over a half bend that half. The other half does not move. The bend stops at 90°.
6. Bend on, snapped tool: Q / E over the far half bend it. Over the half on the base, the tool turns around the base.
7. Bend on, during a bend drag: Q / E and the wheel bend the grabbed half.
8. Free tool, Bend off: Q / E turn it around its center, as before.
9. Hold Q on a snapped tool: it keeps turning around the base.
10. The wheel without a drag zooms, also over a tool.

## Part 3: The step setting

Work:
1. `settings/settings.js`: `turn: { step: 15 }` in `defaultSettings`. `normalize`: a whole number from 5 to 15, else 15. Constants `DEFAULT_TURN_STEP`, `MIN_TURN_STEP`, `MAX_TURN_STEP`. Tests in `settings.test.js`.
2. Settings popup: a slider "Turn step" (5° to 15°, step 1°) that shows the value. Put it next to the key table, where Q / E are.
3. `Scene.jsx`: `ROTATE_STEP` becomes the setting, passed from `App.jsx` as a prop. The held-key speed stays.
4. Docs:
   - `table-tools.md`, "Settings menu": the new row and `turn: { step }` in the localStorage line.
   - `key-shortcuts.md`: "15° per press" becomes "one turn step (15° by default, see Settings)". Also the wheel row.
   - `range-movement-tools.md`: "15°" becomes "one turn step".

Checks: as in Part 1.

User, after this part:
1. Settings shows "Turn step" at 15°. Set it to 5°: Q / E and the wheel turn a character and a tool 5° per step, and bend 5° per step.
2. Reload the page: the setting stays.
3. Hold Q: the speed is the same as before.
