# Plan: Place locks, it does not move

Requested on 2026-10-13. Worktree `../mcp_assist_3d-place-lock`, branch `place-lock`.

## Request

1. The range and movement tools need a feature doc. It says what the tools are for in the game.
2. **Place** does not move a character. It locks a character to the tool: a drag keeps the base touching the tool outline.
3. Place does not need a selected character.
4. **Place 1** (R1) and **Throw / Push** also lock and do not move.

Main use: a range tool on an enemy model shows how far it attacks. A movement tool on an own model, with Place on, shows where that model can stand, inside or outside that range.

## What the tools are for

The new feature doc starts with this.

- **Range tools** measure distance: model to model, model to terrain, model to token. They also place characters: some effects place the character itself, allies or enemies. A common use: check if a model contests a token, and put the model at the farthest spot where it still contests.
- **Movement tools** move characters on Advance, Climb, Throw and Push. They bend: a character whose Size is smaller than a terrain piece, and that is not Flying or a Wall Crawler, cannot Advance over it. Example: Black Cat (Size 2) cannot Advance over the pickup truck (Size 3), so the tool bends around it.
- A movement tool bent to 90° is the **Toward / Away** tool.

## Facts

Checked on 2026-10-13:
- The tool behavior is in `README.md`, "Tools" (lines 202–343), with Place rules also in "Selection" and "Overlapping models". There is no feature doc for the tools.
- `RulerTool.jsx`: `togglePlace` moves `placeTarget` (the selected character) past the far end, then a drag of it keeps the base on the outline (`onPlaceLimit` with `{ id, clamp }`). `handlePlaceOne` moves it across the R1 tool, then locks its drag to a line (`rangeOne.js`, the tool turns with the line). `handleThrow` slides the snapped character (`throwMove`, `throwSlide` in `throwPath.js`), then locks its drag to the middle line.
- `Scene.jsx`: `placeTarget` = the first selected character. `placeLimits` holds one `{ id, clamp }` per tool. `constrainDrag` applies the limit whose `id` is the dragged model. `limitTool` keeps one Place or Throw on at a time across the own tools.
- `charSlides` / `startSlide` in `Scene.jsx` and `CharacterModel.jsx` exist only for the Throw slide.

## Decisions

1. **Which character is locked.** While Place is on, the first character whose base touches the outline during a drag is locked to that tool. The snapped character already touches it, so its first drag locks it. The lock stays with that character until Place turns off. Before the lock, a drag is free.
   - Reason: you said the snapped model is locked. A range tool on an own model also places another character (an ally or an enemy). That character is not snapped, so it locks when it first touches the outline.
2. **Lock area.** Place (and Place 2 of R1): the base touches the outline, the same clamp as now.
3. **Place 1 (R1).** The base edge stays within 1" of the snapped piece edge, seen from above. This is range 1, for contesting a token. The lock starts when a drag brings the base within range 1. The line lock and the tool turn of today go away.
4. **Throw / Push.** Turning Throw on does not slide the character. It still straightens a bent tool. The snapped character is locked at once: its drag stays on the middle line, from its start to the stop point (the first base, terrain piece or mat edge, or the full distance). The stop rules stay (`throwMove`). The slide code is removed.
5. **One lock at a time** across the own tools, as now: Place, Place 1, Place 2 and Throw. Turning one on turns the others off. Each player has one range tool and one movement tool, so a character can be locked only to one of them.
6. **No selection.** Place, Place 1 and Throw no longer read the selection. `placeTarget` goes away. The buttons are enabled on any snapped tool, also when it is snapped to a token (Throw stays disabled on a token).
7. **Buttons stay where they are**: Place at the far end, Place 1 at the snapped corner, Throw at the snapped end. A free tool shows Place only while it is on, as now.
8. **The tool does not move** while its locked character is dragged. A snapped tool stays snapped while the snapped character touches it; after a drag away from the snap point it is free, as with any drag.
9. **Multiplayer.** A lock is local, like Place now: it is not stored. It limits only drags in this browser.
10. **Docs.** The README "Tools" section moves to `docs/features/range-movement-tools.md`. The README keeps a short pointer. The red overlap mark list ("A move is …") loses Place, Place 1 and Throw.

## Part 1: Feature doc

Work:
1. New `docs/features/range-movement-tools.md`. `Status: built.` First section: "What the tools are for" (above). Then the README "Tools" section as it is, and the Place lines from "Selection".
2. `README.md`: replace "Tools" with two lines and a link to the feature doc.
3. Code comments that point to README "Tools", "Place", "Throw / Push", "Range 1" point to the feature doc.

No behavior change.

Checks: `pnpm format`, `pnpm lint`.

## Part 2: Place, Place 2 and Place 1 lock

Work:
1. `RulerTool.jsx`: `togglePlace` and `handlePlaceOne` do not move anything. Remove `placeTarget`. The limit has no fixed `id` until a drag locks a character (decision 1).
2. `Scene.jsx`: `constrainDrag` gives each own limit the dragged model. A limit with no locked character takes the model when its base touches the outline (Place) or comes within range 1 (Place 1). Remove `placeTarget`.
3. `rangeOne.js`: replace the line lock with a range 1 clamp: the drag point stays where the base edge is within 1" of the snapped base edge. Unit tests for it.
4. A pure helper for "base touches the outline, else clamp" if the clamp code is not one yet, with a unit test.
5. Feature doc: Place, Range 1, Selection lines, overlap list.

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, the web tests.

User checks:
- [ ] Range tool snapped to an own model, Place on: nothing moves. Drag the model: it stays touching the outline.
- [ ] Range tool snapped to an own model, Place on: drag another model onto the outline. It locks there. The snapped model can still be dragged freely.
- [ ] R1 snapped to a crisis token, Place 1 on: drag a model toward the token. Once within range 1, it cannot leave range 1. Drag it to the farthest spot.
- [ ] Movement tool Place on, then Place 1 on R1: movement Place turns off.
- [ ] Range tool on an enemy model, movement tool on an own model with Place on: the own model moves only along the movement tool. The range tool is not changed.
- [ ] No selection is needed for any of the above.

## Part 3: Throw locks

Work:
1. `RulerTool.jsx`, `handleThrow`: keep the straightening and `throwMove` (for the stop point). Remove the slide. Lock the snapped character to the middle line, from its start to the stop point.
2. Remove the slide code if nothing else uses it: `throwSlide`, `charSlides`, `startSlide` in `CharacterModel.jsx`, and their tests.
3. Feature doc: "Throw / Push".

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, the web tests.

User checks:
- [ ] Movement tool snapped to a model, Throw on: nothing moves. Drag the model: it stays on the middle line.
- [ ] A base or terrain on the line: the drag stops before it. A lifted model (R) does not stop it.
- [ ] Bent tool, Throw on: the tool straightens.
