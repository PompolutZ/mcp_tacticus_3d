# Plan: LOS from any part of the base

Requested by the user on 2026-10-14. Status: done.

Branch `los-any-base`, worktree `../mcp_assist_3d-los-any-base`, from main at `b980e3f`. One coder step, one commit. Checks: `pnpm format`, `pnpm lint`, `pnpm test`, `pnpm --filter web build`.

## Request

The LOS tool measures between two characters, and terrain is in the way. The tool must check whether a line from any part of the looker's base reaches any part of the target's base without crossing blocking terrain. If such a line exists, the looker has LOS, and the LOS line runs fully to the target.

Example from the test: Bizzie looks at Moondragon next to the Armored Truck (Size 3). The center line hits the truck corner and stops. A line from the left side of Bizzie's base passes the truck. So the line must reach Moondragon.

## Facts

Paths are under `apps/web/src/`.

- `tabletools/losLength.js`: `losLength` casts one tall box of the full base width along the yaw (`losCast`, `castAlongHit` in `physics.js`). The first terrain with Size > block Size stops the whole line. One corner of the box on a truck corner is enough.
- `tabletools/LosTool.jsx`, `useLosLine`: works out `{ distance, label }` when a model rests (0.15 s), when the yaw changes, and when a Size changes. Both players run it with their own physics.
- `characters/terrainUnder.js`: `standingColliders` (the terrain under the looker is skipped), `matEdgeDistance`.

## Decisions

1. **Only with a target.** With no target, the line does not change.
2. **Clear sight test.** A pure function `clearSight` finds a straight segment from a point of the looker base to a point of the target base that no blocking terrain crosses. Blocking: the same rule as today (Size > block Size, the looker's standing terrain skipped, height does not matter).
3. **How it tests.** Points on the edge of each base, about 0.1 inch apart (at least 16 per base), only the half of each edge that faces the other base, plus the two centers. For each pair of points, cast a tall, very thin box along the segment (as `losCast`, width about 0.01 inch). The first clear pair ends the test. Order: center to center first, then the pairs on parallel lines (left edge to left edge, and so on), then the rest. A gap narrower than the point spacing can be missed. That is accepted.
4. **When the line points at the target.** The test result applies only when the center line of the tool passes through the target base. When the player turns the line away from the target, the length is as today.
5. **Length with clear sight.** The line runs at least to the far edge of the target base (center distance + target radius). When the normal cast goes further, the line goes further, as today.
6. **No clear sight.** Length as today: it stops at the first blocking terrain.
7. **Cost.** `clearSight` runs only when a model rests or a Size changes, not on each turn frame. A turn uses the stored result and checks only decision 4. If the test takes too long (over about 5 ms with a few hundred casts), the coder reports it with the number.
8. **Show the clear line.** When `clearSight` finds a clear segment and decision 4 applies, the tool draws that segment as a thin line (drei `Line`, about 2 px, the LOS grey but not transparent) from the looker base point to the target base point, a little above the base bottom. `clearSight` returns the segment, or null. Both players see it, because both work it out.
9. **The app still does not decide LOS.** The label stays as it is. The feature doc changes: the line now shows when some part of the base can see the target.

## Steps

1. **Clear sight.** Files: `tabletools/losLength.js` (or a new `components/losSight.js`): `clearSight({ from, fromRadius, to, toRadius, cast })` returns the clear segment `{ a, b }` or null; a Rapier cast for a segment, from the same code as `losCast`. `tabletools/LosTool.jsx`, `useLosLine`: run `clearSight` with the rest key, store the result, apply decisions 4, 5 and 8 (the thin line in `LosView`). Tests with a fake cast: the center line blocked but an edge line clear gives that segment; every line blocked gives null; the test stops at the first clear pair. Docs: `docs/features/line-of-sight.md` ("Length", and "The line": the app checks sight from any part of the base to the target, and draws the clear segment).

## Results

Step 1 done. Files: `tabletools/losLength.js` (`losKeep`, `clearSight`, `losSegmentBlocked`), `tabletools/losLength.test.js`, `tabletools/LosTool.jsx` (`useLosLine` sight, `Line` in `LosView`), `docs/features/line-of-sight.md`. Cast count for 1 inch bases 3 inches apart: 1 at best, 1 + 17 + 17 * 16 = 290 when every pair is blocked (17 points per half edge). The sight test runs only in the rest path. A turn re-checks only decision 4. Sight is dropped when a model moves, until it rests again.
