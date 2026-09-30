# Plan: Dice rolling

Implementation plan for `docs/feature-dice-rolling.md` (the design). Coder agents do one phase each, in order. Each agent adds a short **Result** to its phase: files, measured facts, changes from the plan, open issues. The next agent reads the results of all earlier phases.

## Rules for every phase

- Read `CLAUDE.md`. Do not open the app in a browser. Check with `npx vite build`.
- Do not commit and do not push. Leave the changes in the working tree.
- Match the style of the code around you: plain, short comments that say why. Units are inches, 1 three.js unit = 1".
- Keep tool output small (`head`, `grep`, summaries). Do not read big files in full when a part is enough.
- Research files (temporary, not in the repo): `/private/tmp/claude-501/-Users-olehlutsenko--dev-mcp-assist-3d/6ba10be4-125e-4011-a7b3-72f90695cc6e/scratchpad/research/`
  - `D8_1885.obj`: the TTS D8 mesh with UVs. AssetRipper exported it from the TTS game files. Tips are on ±z.
  - `Octahedron_colision_1866.obj`: the TTS D8 collider.
  - `d8_template.png`: the TTS D8 template. The original is in `~/Library/Application Support/Steam/steamapps/common/Tabletop Simulator/Modding/Dice Templates/D8.png`.
  - `dice-tray.lua`: the script of the TTS "Blue Dice Tray". It spawns dice (`addDice`, line ~505), sets `RotationValues` and `bounciness`, and calls `roll()`.

## Names used in all phases

| Thing | Value |
|---|---|
| Symbol keys, in shelf order | `crit`, `wild`, `hit`, `block`, `blank`, `skull` |
| Display names | Crit, Wild, Hit, Block, Blank, Skull |
| Tray keys | `blue`, `red` (the same as `teamColor`) |
| Dice per tray | at most 42 (shelf and well together) |
| Assets | `src/assets/dice/d8.glb`, `d8.webp`, `tray.glb`, `tray.webp`, `icons/<symbol>.webp` |
| Pure modules | `src/dice/faces.js`, `throw.js`, `tray.js`, `history.js`. No imports of `src/assets/index.js` or React, because `scripts/dice-sim.mjs` imports them in Node. `three` is allowed. |

TTS sources (all in the TTS cache; `cachedFile(url)` in `scripts/lib/tts.mjs` finds them):

| Source | URL |
|---|---|
| Tray mesh (OBJ, also the TTS collider, `Convex: false`) | `https://steamusercontent-a.akamaihd.net/ugc/1484450726088422898/0BFC436A4116D8FEA5CDD343ACB7ABDABE0A9C8D/` |
| Tray texture | `https://steamusercontent-a.akamaihd.net/ugc/1702911676506178508/43FA03FCB40E9BB9CEAEBE3E0EEFDC9AA83F10C2/` |
| Die texture (2048 × 2048) | `https://steamusercontent-a.akamaihd.net/ugc/783003963486280633/F22C6421CD6DAA09A14F7AB7AF380AFF2DC90480/` |
| Icons | `https://d37ev18qvj5a3m.cloudfront.net/tts/token/ui/D{CRIT,WILD,HIT,BLOCK,BLANK,FAIL}_UI.png`. FAIL is the skull. |

The mod objects are "Blue Dice Tray" (TTS pos (36, 0.96, 11.42), rotY 0, scale 0.8, color {0.12, 0.53, 1}) and "Red Dice Tray" (pos (36, 0.96, -11.41), rotY 180, color {0.86, 0.10, 0.09}).

`RotationValues` from `dice-tray.lua` (Unity Euler degrees; face number = position in the list):

| Face | Value | x | y | z |
|---|---|---|---|---|
| 1 | Failure | 326.26 | 5.66 | 90 |
| 2 | Block | 326.26 | 5.66 | 180 |
| 3 | Hit | 33.74 | 180.17 | 180 |
| 4 | Blank | 33.74 | 180.17 | 90 |
| 5 | Critical | 33.74 | 180.17 | 270 |
| 6 | Hit | 33.74 | 180.17 | 0 |
| 7 | Wild | 326.26 | 0.17 | 0 |
| 8 | Blank | 326.26 | 0.17 | 270 |

## Phase 1: Assets and die shape

Read in the design: "The die", "Tray", "Implementation sketch". Read `scripts/README.md` (the first part, about conversion), `scripts/lib/convert.mjs`, `scripts/lib/tts.mjs`.

1. `src/dice/faces.js`: the regular octahedron in the app's die space. 0.94" tip to tip. Exports `SYMBOLS` (shelf order), `SYMBOL_NAMES`, `D8_SIZE`, `D8_CORNERS` (6 corners), `FACES` (index = face number − 1; each `{ number, symbol, corners: [i, j, k] (counter-clockwise seen from outside), normal }`), and the density that gives mass 1.
2. Face directions. For each `RotationValues` row, the face that points up is `d = R⁻¹ · (0, 1, 0)` in Unity die space. Unity applies Euler angles in the order Z, X, Y, so `R = Ry · Rx · Rz` (y does not change which face is up). Convert Unity space to three.js space with z → −z (the same conversion as `Terrain.jsx`). The TTS die has tips on its local ±z axis (see the OBJ), so the app die keeps that orientation. Snap each direction to the nearest face normal of the regular octahedron. The 8 faces must be different, and opposite faces must add up to 9.
3. UVs. The texture must fit without changes. For each face of `D8_1885.obj`, find its UV triangle. The mesh has bevelled edges, so fit the affine map from the face plane to UV and evaluate it at the corners of the unbevelled shape (where the face planes meet). Find out which face of the OBJ is which face number: AssetRipper mirrors X when it exports (see `scripts/README.md`), so the OBJ is the Unity mesh with x → −x, and three.js space is the OBJ turned 180° around Y. Do not trust this alone. **Check it:** cut each face's UV triangle out of the die texture (`magick` with a polygon mask) and look at the images. Face 1 must be the skull, 2 the shield, 3 and 6 the starburst, 5 the "!" burst, 7 the spiral, 4 and 8 empty. The UV winding must match the face winding, or the symbols are mirrored (the "!" shows it).
4. `scripts/migrate-dice.mjs` (and `npm run migrate-dice`). Store the UV triangles as a constant in the script, with a comment about where they come from, so the script does not need the TTS game files. The script writes:
   - `d8.glb`: 24 vertices (flat faces), normals, UVs in the glTF convention, from `faces.js`. No texture inside. No Draco (it is small).
   - `d8.webp`: the die texture, at most 1024 × 1024 (the die is 0.94").
   - `tray.glb` and `tray.webp`: like a terrain OBJ piece (`readObj`, `compressMesh({ singleMaterial: true })`, `imageToWebp`).
   - `icons/<symbol>.webp`: the 6 icons, at most 256 × 256.
   Read the source URLs from the mod save where you can (the tray object by nickname, the die image from `dice-tray.lua` in the "Blue Dice Tray" script), like `tts.mjs` does. Add a "TTS dice migration" section to `scripts/README.md`.
5. Measure the tray in **tray space**: the GLB turned 180° around Y (the same `IMPORT_ROTATION` as `Terrain.jsx`, because TTS mirrors X when it imports an OBJ) and scaled by 0.8. Cast rays down on a grid over the mesh. Record in the Result: the bounding box; the well rectangle, floor height and wall top; the shelf rectangle and floor height; the counter strip; which side (+z or −z) the shelf is on. Compare with the sizes in the design.
6. Fix the three errors about the die in `ASSETS.md` (see the design, "Open questions").

Done when: the script runs, `vite build` passes, the face check images match, and the Result has the tray numbers.

**Result:**

Files: `src/dice/faces.js`, `scripts/migrate-dice.mjs` (+ `npm run migrate-dice`), `scripts/lib/tts.mjs` (added `modObject(nickname)`, exported), `src/assets/dice/{d8.glb,d8.webp,tray.glb,tray.webp,icons/{crit,wild,hit,block,blank,skull}.webp}`, `scripts/README.md` ("TTS dice migration" section), `ASSETS.md` (3 fixes). `npx vite build` passes.

**Mirror assumption:** the default option in the plan is correct — the OBJ is the Unity D8 mesh with x → −x, and three.js/app die space is the OBJ turned 180° around Y, i.e. `(x,y,z) → (-x,y,-z)`. Checked two ways: (1) the die texture crops at the computed UVs are not mirrored (spiral, skull, shield, "!" all read correctly, see below); (2) each face's OBJ-space normal, turned by this transform, exactly matches the "up" direction computed from that face's `RotationValues` row (all 8 faces, not just close — the two methods agree to float precision). Did not need to try the other option.

**Face table** (index = face number − 1 in `FACES`; normal in app die space, tips on ±z, `D8_CORNERS` scaled to 0.94" tip to tip):

| Face | Symbol | corners (D8_CORNERS index) | normal |
|---|---|---|---|
| 1 | skull | [1,3,4] | (0.8165, 0, −0.5774) |
| 2 | block | [1,4,5] | (0, −0.8165, −0.5774) |
| 3 | hit | [0,5,4] | (0, −0.8165, 0.5774) |
| 4 | blank | [0,4,3] | (0.8165, 0, 0.5774) |
| 5 | crit | [0,2,5] | (−0.8165, 0, 0.5774) |
| 6 | hit | [0,3,2] | (0, 0.8165, 0.5774) |
| 7 | wild | [1,2,3] | (0, 0.8165, −0.5774) |
| 8 | blank | [1,5,2] | (−0.8165, 0, −0.5774) |

`D8_CORNERS`: 0 = +z tip, 1 = −z tip, 2..5 = the 4 equatorial corners at (∓0.3323, ±0.3323, 0) (on the x/y diagonals, not the axes). Edge 0.665", face-to-face 0.543" — both match the design's "each edge 0.66", 0.54" between opposite faces". Density for mass 1: `D8_DENSITY` ≈ 7.2238.

Method: found the 8 unbevelled (flat) triangles of `D8_1885.obj` by matching triangle normals to the ideal octahedron face normals (all matched at dot = 1.00000, confirming the OBJ's flat center of each bevelled face is exactly on the true face plane). Fit the affine map (face-plane → UV) from each flat triangle, evaluated at the true (unbevelled) corners. Cropped both the actual die texture and the TTS D8 template (`d8_template.png`, numbered net) at the resulting UV triangles and read them by eye: the template gives the face number directly per triangle, the texture gives the symbol — the two agree with the design's "The die" table exactly (1 skull, 2 shield/block, 3 & 6 starburst/hit, 4 & 8 blank, 5 "!"/crit, 7 spiral/wild), and none of the symbols are mirrored.

**Correction to the design:** the design's "Opposite face" column and "opposite faces add up to 9" are wrong. Measured two independent ways (the `RotationValues` Euler math, and the exact negation of the OBJ face normals above) and both agree exactly: opposite pairs are **1↔5, 2↔6, 3↔7, 4↔8** (sums 6, 8, 10, 12 — not 9). `faces.js` has a comment pointing here; nothing in Phase 1 depends on the sum being 9, but later phases should not assume it.

**Tray** (tray space: `tray.glb` turned 180° around Y, scaled by 0.8, no placement translation), measured with a raycast grid at 0.1" over the mesh, `y` values clustered by height:

| Part | Size (x × z) | Floor / top y |
|---|---|---|
| Whole tray (bounding box) | 13.54" × 16.80", height 1.665" | — |
| Well | 12.6" × 8.4" | floor y ≈ 0.23" |
| Shelf | 12.7" × 2.8" | floor y ≈ 1.03" |
| Wall top (well + shelf + outer rim, all about the same) | — | y ≈ 1.60–1.665" |
| Counter strip | full width (~13.2"), thin raised strip | y ≈ 1.05" |

All close to the design's approximate numbers (13.5×16.8×1.67; well 12.8×8.6, floor ~0.3, wall 1.37 high; shelf 12.8×2.9, floor ~1.1) — the differences are just eyeballed-vs-measured, not a real disagreement. The shelf is on the **+z side** of tray space; the counter strip is on the −z side, beyond the well, opposite the shelf.

**Open issues for later phases:**
- Phase 2 (`tray.js`): use the tray-space numbers above, not the design's approximate ones. Shelf is +z in tray space, so each `TRAYS[key].yaw` must turn +z to face world z = 0 for that tray's side.
- The "opposite faces add up to 9" correction above — the design doc (`feature-dice-rolling.md`) still has the old claim; not edited here since Phase 1 was only told to fix the 3 `ASSETS.md` errors.
- `d8.glb`, the icons and `tray.glb`/`tray.webp` are not yet referenced by any component, so `vite build`'s output (`dist/`) does not currently include them (same as several other not-yet-wired assets already in the repo, e.g. `crystals.glb`) — expected to appear once Phase 4 imports them.

## Phase 2: Pure logic

Read in the design: "Terms", "Roll flow", "History", "Physics" (Throw, Values, Settle, Tilted dice), "Pitfalls". Read the Phase 1 Result.

1. `src/dice/throw.js`. Every function that needs random numbers takes `random` (a function that returns [0, 1)), with a default that uses `crypto.getRandomValues`. The sim passes a seeded one.
   - `randomRotation(random)`: uniform, Shoemake's method. Returns `{ x, y, z, w }`.
   - `throwVelocities(position, target, random)`: `{ linvel, angvel }`. Upward speed from a range. Sideways speed toward `target` from the flight time down to the well floor. Spin around a random axis, at most 50 rad/s. Start values: upward speed about 15–20 in/s (the top of the flight 4–7" above the floor with gravity 30). Phase 3 tunes them.
   - `topFace(rotation)`: `{ face, dot }`, the face whose normal, turned by the rotation, is closest to up.
   - `isTilted(dot)`: `dot < cos(15°)`.
   - The settle rule, as a function the app and the sim share, for example `stillTime(prev, linvel, angvel, dt)` that returns the new still time (0 when moving). Constants: `SETTLE_LINEAR`, `SETTLE_ANGULAR`, `SETTLE_TIME`, `SETTLE_TIMEOUT = 8`. Start values: 0.2 in/s, 0.5 rad/s, 0.25 s.
   - `DIE_BODY`: friction 0.4 with combine rule Min, restitution 0.8 with combine rule Average, damping 0.1 and 0.1. Check the Rapier combine rule values in `node_modules/@react-three/rapier/node_modules/@dimforge/rapier3d-compat` (the app uses this 0.14 copy, not the top-level 0.12).
2. `src/dice/tray.js`, from the Phase 1 numbers:
   - `TRAY_SCALE`, `IMPORT_ROTATION`, `TRAYS = { blue: { position, yaw, color }, red: {...} }`. Blue tray center at (27, 0, 10.1), red at (27, 0, −10.1). The tray bottom is on the table (y = 0). Each tray turns so its shelf faces z = 0.
   - The well rectangle, floor height, and the drop height 4.8" above the floor. `inWell(trayKey, worldPoint)`, `wellCenter(trayKey)`.
   - `shelfSlot(index)`: 42 places in rows on the shelf, in tray space, and the die height when it lies flat.
   - `freeDropPoint(occupied, random)`: a random point above the well, at least one die size from every point in `occupied`. Try again with a new point. If no point is free after some tries, go higher by one die size.
   - `trayToWorld` / `worldToTray` for points and rotations.
   - `trayColliderArrays(positions, indices)`: `{ vertices: Float32Array, indices: Uint32Array }` in tray space (scale and `IMPORT_ROTATION` applied). The app and the sim both build the trimesh with it, so they cannot differ.
3. `src/dice/history.js`: text of history entries, as in the design examples.
   - Counts text: sort by count (most first), then by shelf order. Leave out zeros. `2 Hit, 1 Crit, 1 Blank, 1 Skull`.
   - A throw entry has one part per source, in this order: `Roll: <counts>`, `Crits: <counts>`, `Reroll: Blank → Hit, Skull → Crit`. Then `Shelf: <counts>` only when the shelf had dice before the throw. Parts are joined with `. `.
   - `Changed: Skull → Block`, `Cleared`.
4. Check the functions with a small Node script in the scratchpad (not committed): uniform rotations (the top-face counts of 80 000 random rotations are equal within noise), `topFace` of the identity, `isTilted` on an edge (0.82), history examples.

**Result:**

Files: `src/dice/throw.js`, `src/dice/tray.js`, `src/dice/history.js`. All three import only `three` and `faces.js`; each imports cleanly with plain `node -e "import(...)"`. `npx vite build` passes.

**`throw.js`:**
- `DIE_BODY = { friction: 0.4, frictionCombineRule: 1, restitution: 0.8, restitutionCombineRule: 0, linearDamping: 0.1, angularDamping: 0.1 }`. Combine rule numbers checked in `@dimforge/rapier3d-compat` (the 0.14 copy nested under `@react-three/rapier`): `CoefficientCombineRule.Average = 0`, `.Min = 1`.
- `SETTLE_LINEAR = 0.2`, `SETTLE_ANGULAR = 0.5`, `SETTLE_TIME = 0.25`, `SETTLE_TIMEOUT = 8` — the plan's start values, unchanged.
- `TILT_LIMIT_DOT = cos(15°)` ≈ 0.9659.
- `THROW_UP_MIN = 15`, `THROW_UP_MAX = 20` (in/s), `THROW_SPIN_MAX = 50` (rad/s) — start values, for Phase 3 to tune.
- `randomRotation(random = crypto-based) → { x, y, z, w }`: Shoemake's method.
- `throwVelocities(position, target, random) → { linvel: {x,y,z}, angvel: {x,y,z} }`: upward speed from `THROW_UP_MIN..MAX`; solves the fall-time quadratic (gravity 30) from `position.y` to `target.y` and divides the x/z gap by that time for the sideways speed; spin is a random unit axis times a random speed up to `THROW_SPIN_MAX`.
- `topFace(rotation) → { face, dot }`: turns every `FACES[i].normal` by `rotation` and picks the largest dot with up.
- `isTilted(dot) → boolean`: `dot < TILT_LIMIT_DOT`.
- `stillTime(prev, linvel, angvel, dt) → number`: `prev + dt` while both speeds are under the `SETTLE_*` limits, else `0`.

**`tray.js`:**
- `TRAY_SCALE = 0.8`, `IMPORT_ROTATION = [0, Math.PI, 0]`.
- `WELL = { xMin: -6.27, xMax: 6.33, zMin: -3.42, zMax: 4.98, floorY: 0.233 }`, `SHELF = { xMin: -6.37, xMax: 6.33, zMin: 5.28, zMax: 8.08, floorY: 1.033 }` — re-measured tray space directly from `src/assets/dice/tray.glb` with the Phase 1 script, not retyped from its Result table; matches it. `DROP_HEIGHT = 4.8`.
- `TRAYS = { blue: { position: {x:27,y:0,z:10.1}, yaw: Math.PI, color: [0.12,0.53,1] }, red: { position: {x:27,y:0,z:-10.1}, yaw: 0, color: [0.86,0.10,0.09] } }`. Yaw derived from the requirement, not copied from TTS `rotY`: tray-space +z (the shelf) must end up pointing at world z = 0. Checked numerically both ways (`trayToWorld` of the shelf rectangle lands closer to z = 0 than the well, for both trays).
- `DIE_FLAT_HEIGHT` ≈ 0.5427" — computed from `faces.js` (face-to-opposite-face distance), not hardcoded, so it always matches `D8_CORNERS`.
- `SHELF_SLOT_COUNT = 42` in 14 columns × 3 rows (column/row spacing ≈0.91"/0.93", both clear of the die's 0.665" edge). `shelfSlot(index) → { x, y, z }` (tray space).
- `trayToWorld(trayKey, point)`, `worldToTray(trayKey, point)`, `trayToWorldRotation(trayKey, rotation)`, `worldToTrayRotation(trayKey, rotation)`: round-tripped in a check script.
- `wellCenter(trayKey) → { x, y, z }` (world), `inWell(trayKey, worldPoint) → boolean` (tray-space x/z rectangle only, no height check).
- `freeDropPoint(trayKey, occupied, random, triesPerHeight = 20) → { x, y, z }` (world): random point over the well at `DROP_HEIGHT` above the floor, at least one `D8_SIZE` from every point in `occupied` (world points); after `triesPerHeight` misses at one height it adds one `D8_SIZE` and keeps trying, capped at 1000 tries total.
- `trayColliderArrays(positions, indices) → { vertices: Float32Array, indices: Uint32Array }`: applies `IMPORT_ROTATION` (x, z negate) and `TRAY_SCALE` to a raw mesh position/index pair (from either the gltf-transform `Document` in Node or a loaded `BufferGeometry` in the browser), so `DiceTray.jsx` and `scripts/dice-sim.mjs` build the identical trimesh.

**`history.js`:** `countsText(counts) → string`, `throwEntryText({ roll, crits, reroll, shelfBefore, shelfAfter }) → string`, `changeText(from, to) → string`, `CLEARED_TEXT`. All 5 design examples reproduced exactly by a check script (`Roll: 2 Hit, 1 Crit, 1 Blank, 1 Skull`; `Crits: 1 Wild. Shelf: …`; `Reroll: Blank → Hit. Shelf: …`; `Changed: Skull → Block`; `Cleared`).

**Checks run (scratchpad, not committed):** 80 000 `randomRotation` + `topFace` calls with `Math.random` gave a chi-squared of 10.24 (< 14.07, 7 df) across the 8 faces — uniform within noise, same test Phase 3 will run for real. `topFace(identity)` → `{ face: 6, dot: 0.8165 }` (no face points straight up at the identity rotation, since every face normal has a nonzero x or y component — expected for this die). `isTilted(0.82)` → `true`, `isTilted(0.99)` → `false`. `stillTime` resets to 0 on a fast step and climbs to 0.5 over 5 still steps of 0.1 s.

**Changes from the plan:** none in the API shape. `freeDropPoint` takes `trayKey` (not just a bare well rectangle) so it can return world points directly, since `DiceTray.jsx` and the sim both work in world space when spawning dice; `occupied` is a list of world points rather than tray-space ones for the same reason.

**Open issues for later phases:**
- Phase 3 tunes `THROW_UP_MIN/MAX` and `THROW_SPIN_MAX` in `throw.js` and may add `numSolverIterations`.
- Phase 4 assigns ids to history entries and decides the exact `roll`/`crits`/`reroll` grouping per throw (which dice came from which source) — `history.js` only formats text from whatever counts/pairs it is given.
- `inWell` does not check height (only the x/z rectangle), matching the design's "outside the well" list (shelf, rim, table, terrain, model base) — those are all distinguished elsewhere (shelf state, or the y < -10 rule), not by height here.

## Phase 3: Headless sim and tuning

Read in the design: "Physics", "Fairness", "Measurements". Read the Phase 1 and 2 Results. Memory from the model physics work: Rapier `world.step()` must run once before scene queries return hits; the app uses `@dimforge/rapier3d-compat` 0.14 nested under `@react-three/rapier`.

1. `scripts/dice-sim.mjs` (and `npm run dice-sim`). It builds the Rapier world in Node with the app's own code: `tray.glb` through `readGlb` (`scripts/lib/convert.mjs` has Draco) and `trayColliderArrays`, the die hull from `D8_CORNERS`, `DIE_BODY`, `throwVelocities`, `randomRotation`, `topFace`, the settle rule. The same gravity (−30), time step (1/120) and solver iterations as `Scene.jsx`. A table cuboid like `Scene.jsx`. Trimesh with `TriMeshFlags.FIX_INTERNAL_EDGES`. Dice with CCD.
2. It measures and prints a short report: fairness (8000 throws of one die, chi-squared with 7 degrees of freedom < 14.07), also 10 dice at once and throws of a die that rests; how often a die rests tilted; how often it leaves the well; time until all dice rest; ms per step with 42 dice. Use a seeded `random`, and a `--seed` option.
3. Tune: upward speed, sideways speed, spin, settle limits, `numSolverIterations` (only if dice shake). Aims: less than 2% of dice leave the well, 10 dice rest in about 3 s or less, fairness passes. Put the final values in `throw.js`.
4. Write `scripts/tts-dice-measure.lua`: the TTS measurement from the design ("Measurements", "In TTS"). It cannot be tested here. Say so in its header and in `scripts/README.md`.
5. Add the results to the design ("Measurements") and to `scripts/README.md`.

**Result:**

Files: `scripts/dice-sim.mjs` (+ `npm run dice-sim`), `scripts/tts-dice-measure.lua` (not run, no TTS here), `src/dice/throw.js` (`THROW_SPIN_MAX` 50 → 10, new `DIE_SOLVER_ITERATIONS` export), `docs/feature-dice-rolling.md` ("Measurements" filled in), `scripts/README.md` ("Dice sim" section). `npx vite build` passes.

**Command:** `npm run dice-sim` (seed 1, 8000 single-die throws, 2000 multi-die throws, both defaults). `--seed <n>`, `--throws <n>`, `--multi-throws <n>`, `--quick` (300/300, for fast tuning).

**API change for Phase 4:** `throw.js` gains `export const DIE_SOLVER_ITERATIONS = 8`. Every die `RigidBody` must set `additionalSolverIterations={DIE_SOLVER_ITERATIONS}` — see "The explosion bug" below. Nothing else in `throw.js`, `tray.js` or `faces.js` changed shape, only `THROW_SPIN_MAX`'s value.

**Tuned values, in `throw.js`:**
- `THROW_SPIN_MAX`: 50 → **10** rad/s. 50 (the TTS max, the plan's start value) made dice explode on collision far too often (see "The explosion bug"). 10 still spins visibly and keeps fairness. **Update, 2026-09-30:** back to 50. The explosions do not happen again with the current code; see the design, "Measurements".
- `DIE_SOLVER_ITERATIONS = 8` (new): extra solver iterations for die bodies only, via `additionalSolverIterations` (an @react-three/rapier / Rapier per-body setting), on top of the world's own `numSolverIterations`, which is **left at the Rapier default, 4, unchanged** — so this does not touch model physics. Combined with the lower spin, cuts the explosion rate a lot further (see below).
- `THROW_UP_MIN/MAX` (15-20 in/s), the settle constants (`SETTLE_LINEAR/ANGULAR/TIME/TIMEOUT`), `DIE_BODY`: unchanged from Phase 2 — the measurements below already meet the aims with the plan's start values, once spin and solver iterations were fixed.
- `numSolverIterations` on the app's `<Physics>` in `Scene.jsx`: **no change needed.** The fix is per-die (`additionalSolverIterations`), not global.
- Trimesh flags: `TriMeshFlags.FIX_INTERNAL_EDGES`, CCD on — as the plan already had them. Turning CCD off made the explosion bug clearly *worse* (measured: 49/60 bad rounds without CCD vs 16/30 with it, same seed/settings), so CCD stays on; it was not the cause, just a partial mitigation.

**Measured numbers** (`npm run dice-sim`, seeds 1, 2, 3, defaults — 8000 single-die throws, 2000 multi-die throws):

| Measurement | Seed 1 | Seed 2 | Seed 3 | Aim |
|---|---|---|---|---|
| Single-die chi-squared (7 df) | 5.58 PASS | 10.93 PASS | 4.06 PASS | < 14.07 |
| 10-dice chi-squared (7 df) | 8.66 PASS | 3.07 PASS | 10.93 PASS | < 14.07 |
| Single-die tilted rate | 0.5% | 0.7% | 0.6% | (measured) |
| Single-die out-of-well rate | 0.1% | 0.0% | 0.1% | < 2% |
| 10-dice tilted rate | 0.6% | 0.7% | 0.5% | (measured) |
| 10-dice out-of-well rate | 0.3% | 0.4% | 0.5% | < 2% |
| 10-dice settle time, avg | 2.61s | 2.64s | 2.61s | ~3s or less |
| 10-dice settle time, max | 3.32s | 3.74s | 3.54s | ~3s or less |
| 42-dice ms/step | 0.30 | 0.32 | 0.34 | (measured; cheap) |

All three fairness tests pass on all three seeds tried (no failure to double-check against a second seed, per the rule about α = 0.05).

**The explosion bug** (the main finding of this phase): two dice that collide can occasionally get a huge, sometimes non-finite (`NaN`), velocity from one contact. Found by instrumenting a die's speed at the moment it timed out (see the scratchpad diagnostics, not committed): the die that failed to settle had `linvel` in the hundreds of in/s, or `NaN`, right after a collision with another die — not a slow, legitimate pile-up. Cause, as far as narrowed down: the die is a sharp shape (an octahedron, points tip to tip) and 50 rad/s is about 24° of turn in a single 1/120 s physics step, enough for a tip to sweep most of the way through another die's face between two steps; the solver then corrects the resulting deep overlap with one large, occasionally unstable, push. CCD (continuous collision detection) covers *linear* motion between steps, not rotation, so it does not catch this.

Tried, in order, on the 10-dice-at-once test, each checked over many seeds because the bug is rare and lucky-looking on any one seed:
- Baseline (spin 50, world `numSolverIterations` 4, plain convex hull): tilted rate 5-34% across 5 seeds at 1000-1500 valid throws — clearly too high, and confirmed by direct trace to be the `NaN`/huge-velocity pattern, not legitimate tilts.
- `ColliderDesc.roundConvexHull` with a small border radius instead of `convexHull`: helped somewhat but not reliably (still up to 18% tilted on some seeds); dropped.
- Raising the *world's* `numSolverIterations` alone (8, 12, 16): not monotonic — 16 was sometimes *worse* than 4, because different iteration counts change the exact chaotic trajectory, not just its stability. Dropped in favor of a value that held up across seeds instead of one lucky run.
- Lowering `THROW_SPIN_MAX` alone (scanned 50 → 10): the strongest lever by far. At 10 rad/s (scale 0.2 of 50), typical tilted rate over 10+ seeds was 0.3-0.9%, but still an occasional double-digit spike on a bad seed.
- `DIE_SOLVER_ITERATIONS = 8` (per-die `additionalSolverIterations`, world left at 4) *combined with* `THROW_SPIN_MAX = 10`: the only combination that held up across 12 different seeds with no spikes (0.1-0.7% every time) — this is the shipped combination. Confirmed the per-die setting gives identical results to raising the whole world to 12 iterations, without the global-default risk.

**It is not fully gone.** At 42 dice thrown together (worst case, not part of the measured aims), tilted rate was 1-7% across 5 seeds, and most of those timeouts were still confirmed `NaN` explosions, not genuine slow piles — the bug's rate grows with the number of simultaneous pairwise contacts, so it cannot be tuned away completely without changing the shape (rounding the die's tips/edges, which the design already rejected for other reasons) or the timestep (fixed by the plan, must match `Scene.jsx`).

**What Phase 4 must know:**
- Apply `DIE_SOLVER_ITERATIONS` from `throw.js` to every die's `RigidBody` (`additionalSolverIterations={DIE_SOLVER_ITERATIONS}`), not to `<Physics>`.
- **Add a safety net for non-finite dice.** A die whose body goes `NaN` never recovers on its own (nothing in the app's own state ever un-sets it) and would sit there with an invisible/garbled mesh forever, or throw React/Rapier errors when its pose is read. Each frame (or on every settle check), test `Number.isFinite` on the die's translation (and maybe rotation); if it fails, treat it exactly like "outside the well": `wakeUp()`, teleport to the well center with zero velocity, and queue it for another throw. (This sim's own first attempt at the multi-die test had exactly this bug — tilted was checked before out-of-well in an `if`/`else if`, so a die that was both tilted, from timing out, and out of the well, from being `NaN`, only ever got counted as tilted and never got recentered, and the sim hung for minutes on one seed until this was fixed. `runSingle`/`runMulti` in `dice-sim.mjs` now check `outOfWell` independently of `tilted` for exactly this reason — copy that shape in `DiceTray.jsx`.)
- The 42-dice tilted rate above (1-7%) is with the tuned values; it is not a sign that Phase 4's own code has a bug if it sees dice rethrown at that rate with a full tray.
- `inWell`'s x/z-only rectangle check (from Phase 2) turns out to be exactly what makes the `NaN` case recoverable in this sim: comparisons against `NaN` are always `false` in JS, so `inWell(trayKey, nanPoint)` returns `false` and `outOfWell` comes out `true` for free. No explicit `isNaN` check was needed in `tray.js`; Phase 4 only needs the ordering fix above, not a new function.
- Trimesh flags and CCD: no change needed from the plan's defaults (`FIX_INTERNAL_EDGES`, CCD on). Confirmed CCD is not the cause of the explosion (it happens, worse, even with CCD off).

**Changes from the plan:** `THROW_SPIN_MAX` tuned down from the TTS-max start value (50 → 10), and one new constant (`DIE_SOLVER_ITERATIONS`) added to `throw.js`, both anticipated by the plan's "Tune: ... numSolverIterations (only if dice shake)" — dice did shake (worse: exploded), so this phase tuned both spin and a per-die solver setting rather than the world's.

## Phase 4: Trays and dice in the scene

Two agents do this phase. **4a** does items 1 (without "Shelf" and without `addCrits`, `reroll`, `change`), 2, 3, 4 and 5: the tray, the dice, `add`, `remove`, `roll`, `clear`, the throw, the settle rule, reading the faces, throwing again, and a simple `onChange` (`well`, `rolling`). After a throw, 4a leaves the read dice in the well with their symbol stored. **4b** does the rest of item 1: the shelf, sorting, `addCrits`, `reroll`, `change`, the history, and the full `onChange` state. Each agent writes its own Result (4a, then 4b).

Also from Phase 3: every die body sets `additionalSolverIterations={DIE_SOLVER_ITERATIONS}`, and a die with a position or speed that is not finite (`NaN`) is thrown again from the well center, like a die that falls off the table.

Read in the design: "Tray", "Roll flow", "Physics", "Pitfalls". Read the Phase 1–3 Results. Read `Scene.jsx`, `CharacterModel.jsx` (settle and `wakeUp` patterns), `Terrain.jsx` (texture and tint), `src/physics.js`.

1. `src/components/DiceTray.jsx`, one per tray, inside `<Physics>` in `Scene.jsx`, outside the mat group and not keyed by map:
   - Tray: fixed `RigidBody` at `TRAYS[key]`, `TrimeshCollider` with `trayColliderArrays(...)` from the loaded GLB and the flag `FIX_INTERNAL_EDGES` as a third argument (check that @react-three/rapier passes it on; the debug collider view in the app shows the collider). Visible mesh with `tray.webp`, tinted with the TTS color (as `Terrain.jsx` tints), shadows.
   - Dice: one `RigidBody` per die, `ConvexHullCollider` from `D8_CORNERS`, `DIE_BODY`, `ccd`. One shared geometry and material (`d8.glb`, `d8.webp`, `flipY = false`).
   - The dice live in a ref (per die: id, body, state `well` | `thrown` | `shelf`, symbol, source, still time, throw time). React state holds only the list of ids, so a frame does not re-render React.
   - Actions: `add`, `remove`, `roll`, `clear`, `addCrits`, `reroll(symbol)`, `change(symbol, toSymbol)`. Register them with a callback prop (`actionsRef(key, actions)`), like `bodyRef` in `Scene.jsx`.
   - Roll flow as in the design: throw from where the die is (also in the air); read faces when all thrown dice rest; throw a tilted die again; throw a die outside the well, or below y = −10, again from the well center; the 8 s timeout counts as tilted. Call `wakeUp()` before moving a die.
   - Shelf: turn each die flat on its top face (one fixed turn around up for all, so the symbols line up), make it `kinematicPosition`, move it to its slot over about 0.3 s. Sort the shelf by symbol after each change.
   - Report to the parent with `onChange(key, state)`: `{ well: number, shelf: { crit: n, ... }, rolling: boolean, critsAvailable: number, history: [{ id, text }] }`. `critsAvailable` is the number of Crits on the shelf, or 0 when `+N Crits` was used since the last Clear.
2. `CharacterModel.jsx`: `dominanceGroup={1}`.
3. Shadows: the shadow camera must cover the trays (x up to 34, z ±18.5). Keep about the same shadow detail on the mat (for example ±36 with map size 4096, or a better option you find). Write the choice in the Result.
4. `numSolverIterations` on `<Physics>` if Phase 3 found it is needed.
5. Check by reading the code that the dice keep their state when the map changes or the mat turns (Suspense, keys).

If the context gets full, stop after a working part, write the Result, and list what is left.

**Result 4a:**

Files: `src/components/DiceTray.jsx` (new), `src/components/Scene.jsx` (renders one `DiceTray` per tray key, outside the mat group, not keyed by `mapId`/`matTurns`; new optional props `trayActionsRef`, `onTrayChange`, forwarded to each tray; widened the directional light's shadow camera), `src/components/CharacterModel.jsx` (`dominanceGroup={1}`). `npx vite build` passes. `d8.glb` and the icon webps are small enough that Vite inlines them as base64 in the JS bundle instead of emitting a `dist/assets` file — expected Vite behaviour for files under its default 4 KB inline limit, not a bug; `assetUrl` still returns a usable (data:) URL and `GLTFLoader`/`useTexture` load from it the same way.

**`DiceTray.jsx` structure**, built to leave clear extension points for 4b:
- Per-die state lives in a ref, `dice` (`Map<id, entry>`), never in React state, so a physics step never re-renders the component. `entry = { id, body, state, symbol, source, stillTime, throwTime, spawn }`. `state`: `'well'` (resting, done or not yet thrown) | `'thrown'` (rolling). 4a never sets `'shelf'`, but every place that loops over dice already skips `entry.state === 'shelf'` dice, so 4b can start setting it without touching those loops. `source` is always `'roll'` in 4a (set by both `add` and the settle loop); 4b's `addCrits`/`reroll` are the ones that should set it to something else. `spawn` (`{ position, quaternion }`) is the one-time initial pose consumed by the `<Die>` child's `RigidBody` props; nothing reads it again after mount.
- `idsRef` (a plain array, insertion order) is the source of truth for "which die was added last"; `ids` (React state) is just `idsRef.current.slice()`, kept in sync after every mutation, and exists only so `ids.map(...)` can mount/unmount `<Die>` components.
- Roll-flow functions, each one job: `throwDie(entry, { fromCenter })` (wake, optionally teleport to the well center and zero the velocities, then set a new random rotation and `throwVelocities` toward a random well-floor point — used by both `roll()` and the settle loop's rethrows), `add()`, `remove()`, `roll()`, `clear()`. The per-frame settle loop (inside the tray's one `useFrame`) is the fifth piece of the flow: for each `'thrown'` die it updates `stillTime`/`throwTime`, and once settled/timed-out/non-finite it classifies `outside` and `tilted` independently (see below) and either stores the die's `symbol` and returns it to `'well'`, or queues it in `throwDie` again.
- **Where 4b should add the shelf:** a `moveToShelf(entry)` function (turn flat, `kinematicPosition`, `setNextKinematicTranslation` toward the target slot) called from the same branch in the settle loop that currently just sets `entry.state = 'well'` and stores `entry.symbol` — that branch is the one place a die's result becomes final. `addCrits`/`reroll`/`change` are new functions next to `add`/`remove`/`roll`/`clear`, added to the same object in the `actionsRef` effect. History: a new `history` ref/array reported through `onChange`; `onChange`'s payload only needs extending (see below), not restructuring.
- Registration: one `useEffect` with an intentionally empty dependency array registers `{ add, remove, roll, clear }` via `actionsRef(trayKey, actions)` once at mount and unregisters (`actionsRef(trayKey, null)`) on unmount — the functions close only over refs and the stable `setIds`, so they never go stale despite the empty deps (same reasoning as `bodyRef` in `Scene.jsx`, just via a callback instead of a ref map owned locally).
- `onChange(trayKey, state)`: called from the `useFrame` loop, but only when `{ well, rolling }` actually changed since the last report (tracked in a ref), so a rolling tray does not flood the parent with identical updates every frame. `well` counts every die with `state !== 'shelf'`.

**Props API:** `DiceTray({ trayKey, actionsRef, onChange })`. `Scene({ ..., trayActionsRef, onTrayChange })` — both optional, unused by `App.jsx` yet (Phase 5 wires them). `Scene` turns `trayActionsRef` (a ref to a `Map`, owned by `App`) into the `actionsRef(trayKey, actions)` callback `DiceTray` expects, the same way `charBodies`/`bodyRef` works, just with the map living one level further out because the HUD panel that will call these actions is outside `<Canvas>`.

**Tilted/outside check, done the way the Phase 3 Result asked:** `outside = !finite || t.y < -10 || !inWell(trayKey, t)` and `tilted = !finite || timedOut || isTilted(dot)` are computed as two independent booleans (not an `if`/`else if` chain), then combined with `outside || tilted` to decide whether to rethrow, and `fromCenter: outside` to decide whether to teleport first. `finite` checks translation, rotation and linear velocity with `Number.isFinite` (the plan said translation, "and maybe rotation"; added linear velocity too, since that's literally where the Phase 3 Result found the explosion showing up first).

**Trimesh flag:** confirmed by reading the code, not just asserting it: `@react-three/rapier`'s `createColliderFromOptions` does `ColliderDesc[shape](...scaledArgs)`, and `scaleColliderArgs` for `"trimesh"` only replaces `args[0]` (the vertices) and returns the rest of the array untouched — so a third `args` element survives all the way to `ColliderDesc.trimesh(vertices, indices, flags)`, whose real signature (`rapier.d.ts`, not `@react-three/rapier`'s own `.d.ts`, which only types a 2-tuple) takes `flags?: TriMeshFlags`. `<TrimeshCollider args={[trayVertices, trayIndices, rapier.TriMeshFlags.FIX_INTERNAL_EDGES]} />` (`rapier` from `useRapier()`, matching the nested 0.14 build already used everywhere else — not a bare `@dimforge/rapier3d-compat` import, which would resolve to the top-level 0.12). Also found in passing: `RigidBody`'s TS types list only a `rotation` prop, but the component's source destructures and forwards a `quaternion` prop too (used here for a die's initial random rotation, as an `[x, y, z, w]` array) — the same "types don't list it, the code passes it on" situation as the trimesh flag, just undocumented rather than untyped.

**Shadow choice** (fixed by the orchestrator after 4a): the light at (10, 30, 10) gives a shadow camera whose x axis runs along the world diagonal, so the 4a bounds (±35 × ±19) missed parts of the trays. Now `left −26, right 38, top 25, bottom −34` (the mat and both trays measured in the shadow camera space with three.js) and `shadow-mapSize` 3072, so one shadow pixel is about as small as before.

**Suspense/remount check:** `DiceTray` is rendered in `Scene.jsx` next to the crisis cards/tokens, outside the `<group rotation={...}>` that wraps the mat and `<Terrain>`, and keyed only by `trayKey` (`'blue'`/`'red'`), never by `mapId` or `matTurns`. A map change or a mat turn remounts `Terrain` (its own key includes both) but never `DiceTray`, so its `dice` ref, `idsRef` and React `ids` state all survive untouched — dice keep their position, state and symbol across both. Read, not run in a browser, per the phase's rules.

**Left for 4b:** the shelf itself (slot placement, `kinematicPosition`, sorting), `addCrits`, `reroll`, `change`, history text/storage, and the full `onChange` shape (`shelf`, `critsAvailable`, `history`). Also left for Phase 5: `App.jsx` never passes `trayActionsRef`/`onTrayChange` yet, so nothing in this phase is reachable from the UI — expected, per the phase 4 rules ("Until Phase 5 there is no UI to call the actions").

**Open/uncertain:**
- `remove()`'s "last added die that is not on the shelf" reads `idsRef` back to front and skips `'shelf'` entries; not yet exercised against a real shelf (there is none in 4a), so 4b should double check it once dice can reach `'shelf'`.
- `add()`'s new-die overlap check (`freeDropPoint`'s `occupied` list) only includes dice whose `RigidBody` has already mounted (`entry.body` non-null); a die added in the same React commit as a previous one could, in principle, get a point that turns out to collide with one that hasn't mounted yet. Not observed, and `add()` is a rare, one-at-a-time user action, but it is a real (very small) gap.
- Not able to see the tray or dice render, per the rules ("do not open the app in a browser"); everything above is from reading the code and matching it against `scripts/dice-sim.mjs`'s equivalent logic (same functions, same constants, same collider-building code), not from a visual check.

**Result 4b:**

Files: `src/components/DiceTray.jsx` (shelf, sorting, `addCrits`/`reroll`/`change`, history, full `onChange`), `src/dice/shelf.js` (new — pure shelf helpers, see below), `src/dice/throw.js` (added `isFinitePoint`/`isFiniteQuat`, moved out of `DiceTray.jsx` so it stays smaller), `src/dice/tray.js` (added `randomWellPoint`, same reason — it was `DiceTray.jsx`'s private `randomWellTarget`, now exported next to `freeDropPoint`/`wellCenter` since it is pure). `npx vite build` passes, no new warnings. `DiceTray.jsx` is 525 lines — over the "about 450" guideline even after the `shelf.js`/`throw.js`/`tray.js` split; everything left in it touches the `dice` ref, a `RigidBody`, or `rapier`, so it is not pure and the plan says only pure helpers move out. Checked with a Node script (scratchpad, not committed): `flatRotation` puts every one of the 8 faces exactly up (dot 1 to float precision), `sortShelfEntries` sorts by `SYMBOLS` then id, `shelfMovePose` at t=0/0.5/1 gives the start/mid/end pose, and all 5 `docs/feature-dice-rolling.md` "History" examples reproduce exactly through `throwEntryText`/`changeText`/`CLEARED_TEXT` (same check Phase 2 already ran, re-run here against the values `DiceTray.jsx` actually builds).

**Die states, final:** `'well'` (resting or not yet thrown — also a die that just settled with a result, waiting for the rest of its throw to finish), `'thrown'` (in the air), `'shelf'` (kinematic, has a slot). A die's entry also carries `face` (the exact face number it landed on, 1-8; kept alongside `symbol` so the shelf pose is fixed per face, not just per symbol), `source` (`'roll' | 'crits' | 'reroll'`, meaningful only until the die reaches the shelf, then set back to `null`), `rerollFrom` (the symbol it had before a reroll, for the history line once it settles again), and, once on the shelf, `slot`/`moveFrom`/`moveTo`/`moveElapsed`/`moving` for the slide to its place.

**When a throw finishes (design step 5):** every frame, after the settle/rethrow logic, the tray counts dice in state `'thrown'`. Once there are none, every `'well'` die with a non-null `symbol` (i.e. it just settled and is waiting) is moved to the shelf in one `finalizeThrow` call: each is grouped by its `source` into `roll`/`crits` counts or `reroll` `{from, to}` pairs, flipped to `'shelf'`, the shelf is re-sorted (which starts each one's slide), and one history entry is written with `throwEntryText`. Since `roll()` throws every non-shelf die at once (design step 2/3), "every thrown die of that throw" is simply "every die in state `'thrown'` right now" — no separate batch id was needed.

**Shelf mechanics:** `startShelfMove(entry, index)` (in `DiceTray.jsx`) reads the die's actual current pose (`rb.translation()`/`rb.rotation()`, waking it first), computes the target pose (`shelfSlot(index)` → `trayToWorld`, `flatRotation(entry.face)` → `trayToWorldRotation`), and — the first time this die reaches the shelf (`entry.slot === undefined`) — calls `rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)` directly on the raw Rapier body (bypassing the React `type` prop, same as `rb.wakeUp()`/`rb.setTranslation()` elsewhere in this file). `resortShelf(forceIds?)` sorts every `'shelf'` entry with `sortShelfEntries` (`src/dice/shelf.js`: by `SYMBOLS` order, then by id) and calls `startShelfMove` for any whose slot number changed, or whose id is in `forceIds` (used by `change()`, whose die can land back on the same slot number but always needs a new rotation). The `useFrame` loop drives the actual slide: for every `'shelf'` entry with `moving`, it advances `moveElapsed`, calls `shelfMovePose(moveFrom, moveTo, t)` (linear position, slerp rotation, `src/dice/shelf.js`), and feeds the result to `setNextKinematicTranslation`/`setNextKinematicRotation`, over `SHELF_MOVE_TIME = 0.3`s. `reroll()` (shelf → well) calls `rb.setBodyType(rapier.RigidBodyType.Dynamic, true)` to reverse it.

**Flat rotation:** `flatRotation(faceNumber)` in `src/dice/shelf.js`. `Quaternion.setFromUnitVectors(faceNormal, up)` — three.js's fixed, shortest-arc choice — so the same face number always gets the exact same rotation, satisfying "one fixed turn around up for all dice so the symbols line up" without tracking the die's actual landed twist. `change()` (no real throw happened) uses `defaultFaceForSymbol(symbol)` (also `shelf.js`): the lower face number for Hit/Blank, the only symbols on two faces.

**Actions API**, registered via `actionsRef(trayKey, { add, remove, roll, clear, addCrits, reroll, change })`:
- `add()` — adds one die (source `'roll'`) at a free point above the well. No-op once the tray holds 42 dice (`MAX_DICE`, shelf + well).
- `remove()` — removes the last added die that is not on the shelf. No-op if every die is on the shelf, or the tray is empty. (Re-checked now that a real shelf exists: it already skipped `'shelf'` entries in 4a; nothing needed changing.)
- `roll()` — throws every die not on the shelf, from wherever it is (including one already in the air, or one that already settled but has not reached the shelf yet — design step 3). No-op if every die is on the shelf or the tray is empty (loop just does nothing).
- `clear()` — removes every die (well, thrown or shelf) and resets `critsUsedRef`. Always adds a "Cleared" history entry, even on an empty tray.
- `addCrits()` — adds one die (source `'crits'`) per Crit currently on the shelf. No-op if already used since the last `clear()`, or if the shelf has 0 Crits. Stops early (adds fewer than the Crit count) if it hits the 42-die cap, but still marks itself used if it added at least one.
- `reroll(symbol)` — moves one `'shelf'` die showing `symbol` back into the well at a free drop point, dynamic again, `source` set to `'reroll'`, `rerollFrom` set to `symbol`. No-op if the shelf has no die with that symbol. Re-sorts the shelf to close the gap. Does not write a history entry itself — that happens once the die is rolled and settles (grouped into the next `finalizeThrow`).
- `change(symbol, toSymbol)` — turns one `'shelf'` die showing `symbol` into `toSymbol` in place (`defaultFaceForSymbol`), re-sorts, and writes a `"Changed: X → Y"` history entry immediately. No-op if the shelf has no die with that symbol.

**`onChange(trayKey, state)`, final shape:** `{ well: number, shelf: { crit, wild, hit, block, blank, skull }, rolling: boolean, critsAvailable: number, history: [{ id, text }] }`. `well` counts every die not in `'shelf'` state (thrown or well, including ones waiting to be shelved this instant — reporting happens after that frame's `finalizeThrow`, so `well`/`shelf` are always consistent with each other in one report). `shelf` always has all 6 keys, 0 when empty. `history` is newest-first; the same array reference is reused until it changes, so the parent can diff by reference. Reported from the tray's `useFrame`, only when `well`, `rolling`, `critsAvailable`, any `shelf` count, or the `history` reference actually changed since the last report (`lastReported` ref) — unchanged from 4a's approach, just with more fields compared.

**4a's open issue, fixed:** `add()` (and now `addCrits()`, `reroll()`) get their occupied-points list from a new `wellOccupiedPoints()` that uses `entry.body.translation()` when a die's `RigidBody` has mounted, and falls back to `entry.spawn.position` when it has not — so dice added in the same commit (e.g. several Crit dice at once) no longer risk overlapping each other.

**Left / uncertain:**
- Not able to see the shelf, the flat pose or the slide, per the rules (no browser). Everything above is from reading the code and a Node check of the pure math (`flatRotation`, `sortShelfEntries`, `shelfMovePose`, `throwEntryText`), not a visual check.
- `flatRotation`'s shortest-arc choice is deterministic per face number but was not checked against the die's actual texture/UVs — two faces that share a symbol (Hit: 3 and 6; Blank: 4 and 8) may show that symbol at a different in-plane twist from each other on the shelf. The design only asks for "one fixed turn ... so the symbols line up" (i.e. repeatable per face, not necessarily upright or matched across faces); Phase 5/6 should flag it if the icons look rotated oddly once it is checked in the browser.
- `addCrits` marks itself used even on a partial add (cap hit before adding all N Crit-dice) — a judgment call, not in the design text; easy to change in Phase 5 if the rules read differently.
- `App.jsx` still does not pass `trayActionsRef`/`onTrayChange` (Phase 5), so none of this is reachable from the UI yet — expected.

## Phase 5: HUD panel

Read in the design: "Controls: HUD panel", "Roll flow", "History". Read the Phase 4 Result. Read `App.jsx`, `Toolbar.jsx`, `TokenPanel.jsx`, `src/index.css`.

1. `App.jsx`: a ref map of tray actions (`trayActions`), state `trays = { blue, red }` filled by `onChange`, passed through `Scene` to `DiceTray`.
2. `src/components/DicePanel.jsx`, outside `<Canvas>`. Blue at the bottom right, red at the top right (below the top HUD row). It has:
   - An empty box for the inset view, visible while the tray has dice. Register the element in a ref map in `App.jsx` (`insetBoxes`, key → element) for Phase 6. The box has no background.
   - `− N +`, Roll, Clear, `+N Crits` (disabled when 0).
   - The 6 icons with counts. A click on a count opens a menu: "Reroll one", and "Change one to" with the 5 other symbols.
   - The history, newest first, scrolls.
3. CSS in `src/index.css`, in the style of the toolbar. Check that the panels do not cover the toolbar, the spawner, the token panel or the debug panel.
4. No keyboard shortcuts (open question in the design).

**Result:**

Files: `src/components/DicePanel.jsx` (new, one component used for both trays), `src/App.jsx` (`trayActions` ref map, `trays` state filled by `onTrayChange`, `insetBoxes` ref map, `diceMenu` state, Escape handling, renders the two panels), `src/index.css` (panel styles, `.chip:disabled`). `npx vite build` passes, no new warnings.

**Layout:** Red sits inside `.hud-top`, in a new `.hud-top-right` column together with `CharacterSpawner` (`App.jsx`: `<div className="hud-top-right"><CharacterSpawner/><DicePanel trayKey="red" .../></div>`). It is stacked under the spawner in normal flow, not at a fixed pixel offset, so it stays clear of the toolbar no matter how many rows the toolbar wraps to — the toolbar (left) and the spawner+red-panel column (right) grow independently inside the row. Blue is `position: absolute; bottom: 12px; right: 12px` (`.dice-panel--bottom`), the same corner pattern as `.token-panel`/`.debug-panel` use for their corners, clear of both (opposite side from debug-panel's bottom-left, above/right of the centered token-panel).

**Inset box:** `<div ref={insetBoxRef} className="dice-panel-inset" style={{ visibility: hasDice ? 'visible' : 'hidden' }} />`, `hasDice = well + shelfTotal > 0` from the tray's last `onChange`. `insetBoxRef` is `el => registerInsetBox(trayKey, el)`, a callback ref built in `App.jsx`; `registerInsetBox` sets/deletes the element in `insetBoxes.current` (a `Map`, key → element), the same add-on-mount/delete-on-unmount pattern as `trayActionsRef`. Size: `width: 100%` of the 240px panel, `height: 130px`, no background, `pointer-events: none` (so a click there falls through to the canvas, not to the box). Border color is the team accent (`#2980b9` blue / `#c0392b` red) — this is the "thin frame" the rules allow; nothing else about the box is opaque. The 240×130 box is a guess at the tray's rough footprint (13.5″×16.8″, viewed at an angle) — not measured in a browser; Phase 6 reads the actual rendered rect at render time either way, so a size that turns out wrong just needs a CSS tweak, not a code change.

**No opaque wrapper:** `.dice-panel` itself has no background/border — only its children (`.group`, `.dice-panel-faces`, `.dice-panel-history`) have the usual panel background, same as `.group` elsewhere. That keeps the wrapper from covering the inset box with its own background; only the inset box's own 1px border frame sits over the canvas there.

**Actions:** `DicePanel` does not receive the resolved actions object as a prop (it may not exist yet if the tray hasn't mounted) — it receives `trayActionsRef` (the same `Map` ref App passes into `Scene`) and looks up `trayActionsRef.current.get(trayKey)?.[action]?.(...)` inside each button's `onClick`, i.e. at click time, per the phase's "Facts". `−`/`+`/Roll/Clear/`+N Crits` call `remove`/`add`/`roll`/`clear`/`addCrits` this way; a face count's menu calls `reroll(symbol)` or `change(symbol, toSymbol)`.

**Menu:** state is lifted to `App.jsx` as `diceMenu = { trayKey, symbol } | null` (not local to `DicePanel`), specifically so `handleKeyDown`'s Escape branch can close it first: `if (e.key === 'Escape') { if (diceMenu) { setDiceMenu(null); return } handleEscape(); return }`, ahead of the existing selection/tool-clearing Escape behavior. A click on a face count calls `onMenuToggle(symbol)` (toggles open/closed, and switches trays/symbols if another menu was open). Closing on a choice and on an outside click both happen inside `DicePanel` itself: each menu button calls `onMenuClose()` right after the action; a `pointerdown` listener (added only while a menu is open, same pattern as `CharacterSpawner`'s dropdown) closes it when the click lands outside the panel's own DOM node.

**Keys:** `DicePanel` adds no `onKeyDown`/`stopPropagation` of its own, and every clickable element is a plain `<button>`, so `isEditing()` (which only matches `input`/`textarea`/`select`/`[contenteditable]`) never reports a dice-panel button as "editing" — the window-level pan keys, R/S/M/L tool keys and Escape all keep working while a panel button has focus, same as the existing toolbar chips.

**Left / uncertain:**
- Not checked in a browser (per the rules): the 240×130 inset box size, the menu's position/overflow near the right edge of the screen, and whether the panel's 240px width is enough for 6 face buttons in one row before wrapping.
- `.dice-panel-inset`'s border color is the only "team accent" applied; the rest of the panel (buttons, text) uses the same neutral chip styling as the rest of the app. Easy to extend if a stronger accent is wanted later.
- The inset box is sized by CSS, not measured against the tray camera's real aspect ratio (that camera does not exist yet — Phase 6). If Phase 6's fixed aspect looks visibly off in the box, the fix is a CSS size change in `index.css`, not in `DicePanel.jsx`.

## Phase 6: Inset view

Read in the design: "Inset view". Read the Phase 5 Result. Read `SelectionOutlines.jsx`, `App.jsx`, `src/debug/FrameStats.jsx`.

1. `src/components/TrayInsets.jsx`, inside `<Canvas>`. The main view is already drawn by the `EffectComposer` in `SelectionOutlines.jsx` (it uses `useFrame` with priority 1). So `TrayInsets` uses a higher priority and only draws the insets after it. When the composer is off (debug mode `no-composer`), R3F does not draw the main view by itself while a `useFrame` with priority > 0 exists, so `TrayInsets` draws it first in that mode.
2. For each visible box: read `getBoundingClientRect()` relative to the canvas; set viewport and scissor (WebGL y counts from the bottom); camera aspect = box aspect; clear depth only; render the scene with the tray camera. Turn off `gl.shadowMap.autoUpdate` during inset renders. Set `gl.toneMapping` to ACES Filmic during inset renders (the composer turns the renderer tone mapping off), then set it back.
3. Tray camera: fixed, above the tray on the side away from the center line, looking toward the shelf at an angle, so the well and the shelf fill the box. Put the camera pose in `tray.js`.
4. Update the design status line and the pitfalls that are now answered.

**Result:**

Files: `src/components/TrayInsets.jsx` (new), `src/dice/tray.js` (new `insetCamera(trayKey)`, `INSET_FOV`), `src/App.jsx` (renders `<TrayInsets insetBoxes={insetBoxes} noComposer={mode === 'no-composer'} />` inside `<Canvas>`, next to `<SelectionOutlines>`), `docs/feature-dice-rolling.md` (status line, "Pitfalls to check"). `npx vite build` passes, no new warnings.

**Library facts checked, in `node_modules`:**
- `@react-three/postprocessing`'s `EffectComposer` (`dist/EffectComposer.js`): `useFrame((_, delta) => { if (enabled) composer.render(delta) }, enabled ? renderPriority : 0)`, `renderPriority` defaulting to 1. So with the composer on, its `useFrame` runs at priority 1; with it off (`enabled={false}`, the 'no-composer' debug mode), the priority drops to **0**, not to "off" — it still runs (and does nothing, since `enabled` is false inside the callback too), just no longer as a priority subscriber.
- `@react-three/fiber`'s root render loop (`dist/events-*.esm.js`): `subscribe` does `internal.priority += (priority > 0 ? 1 : 0)` when a `useFrame` callback is added, and the per-root frame loop does `if (!state.internal.priority && state.gl.render) state.gl.render(state.scene, state.camera)`. So R3F only draws the default camera itself when **no** subscriber anywhere has priority > 0 — a priority-0 subscriber (the composer, when disabled) does not count, but `TrayInsets`'s own priority (2, see below) does, which is exactly why `TrayInsets` has to draw the main view itself in 'no-composer' mode: once it exists, R3F never will, composer on or off. Subscribers are sorted ascending by priority and run in that order, "highest priority renders last (on top)" (the library's own comment) — so priority 2 always runs after the composer's priority 1.
- `gl.autoClear`: three's `WebGLRenderer` constructor sets it `true` by default, and nothing in this app changes that outside `EffectComposer`'s own render (which sets `gl.autoClear = autoClear` — `false`, from `SelectionOutlines`' `<EffectComposer autoClear={false}>` — only for the duration of its own `composer.render()` call, then restores the previous value). So outside the composer's render, `gl.autoClear` is `true`, and `gl.render(scene, camera)` would clear color+depth+stencil on its own — which is why `TrayInsets` clears depth only itself (`gl.clear(false, true, false)`) rather than relying on `autoClear`.
- What the composer leaves in the renderer state after it runs: its last pass has `renderToScreen: true`, which calls `renderer.setRenderTarget(null)` (checked in `postprocessing/build/index.js`). Three's `setRenderTarget(null)` (checked in `three/src/renderers/WebGLRenderer.js`) resets the active viewport/scissor/scissorTest from its own stored `_viewport`/`_scissor`/`_scissorTest` fields — i.e. whatever the public `setViewport`/`setScissor`/`setScissorTest` last set, default full-canvas/off — not from the render target's size. It leaves `gl.toneMapping` at `NoToneMapping`, always, as long as `EffectComposer` is mounted (its own `useEffect(() => { gl.toneMapping = NoToneMapping; return () => restore }, [gl])` runs once at mount regardless of `enabled`); `SelectionOutlines`' own effect only overrides this back to `ACESFilmicToneMapping` when `composer` is `false`, and its `ToneMapping` pass does the ACES step itself, in-shader, when the composer is on. Confirms the design's note ("the composer turns the renderer tone mapping off") and why `TrayInsets` has to set `gl.toneMapping = ACESFilmicToneMapping` for its own renders and restore the previous value after, exactly like `SelectionOutlines` already does for the 'no-composer' case.
- `gl.setViewport`/`gl.setScissor` (checked in `three/src/renderers/WebGLRenderer.js`): both take **CSS pixels**, not device pixels — `setViewport(x, y, w, h)` does `state.viewport(_currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).round())`, i.e. three itself multiplies by the pixel ratio. `TrayInsets` passes the box's `getBoundingClientRect()` rect straight through (CSS pixels), not pre-multiplied.
- `camera.parent === null` free-standing cameras (checked in `three/src/renderers/WebGLRenderer.js`'s `render()`): it calls `camera.updateMatrixWorld()` itself when the camera has no parent, so `TrayInsets`' per-tray `PerspectiveCamera` (built once, never added to the scene graph) needs no manual `updateMatrixWorld()` call — only `aspect`/`updateProjectionMatrix()` when the box's size is known.

**Render order, per frame (`TrayInsets`' `useFrame`, priority 2):**
1. `noComposer` (App's `mode === 'no-composer'`) only: `gl.render(scene, defaultCamera)` — the main view, full canvas, since nothing else will draw it (see the R3F fact above).
2. For each tray whose box element exists, has a nonzero rect, and is not `visibility: hidden` (see "Left/uncertain" below for why the CSS check was added): compute the box's rect in canvas-relative, bottom-up CSS pixels; set viewport + scissor + scissor test; clear depth only; set the tray's `PerspectiveCamera.aspect` from the box's own width/height; `gl.render(scene, camera)`.
3. Restore `gl.setScissorTest(false)`, viewport/scissor back to the full canvas rect, `gl.shadowMap.autoUpdate` and `gl.toneMapping` back to what they were before this frame's inset renders — needed because three's `setRenderTarget(null)` (used by every later `gl.render`, this frame or next) resets the active viewport/scissor from its own stored fields, not from the canvas size, so a leftover small viewport would otherwise stick.

Outlines: never appear in the insets, by construction — `TrayInsets` calls `gl.render(scene, camera)` directly, bypassing `SelectionOutlines`' `EffectComposer`/`Outline` passes entirely, so there is nothing to turn off.

**Tray camera pose**, `insetCamera(trayKey)` in `src/dice/tray.js`, fixed, computed once from `WELL`/`SHELF`: position at tray-space `x` = the well/shelf combined center, `y` = the well floor + 14", `z` = 8" beyond the well's outer edge (the side away from the center line — the player's side, confirmed the same tray-space direction, `-z`, for both `blue` and `red`, since `TRAYS`' yaw is exactly what makes the shelf, tray-space `+z`, face the center line for both); looking at a target halfway between the well's outer edge and the shelf's inner edge, at the average of the well/shelf floor heights; `fov` (vertical) 32°. Converted to world space with `trayToWorld`, so the same tray-space numbers work for both trays. Found with a small script (scratchpad, not committed): projected the well/shelf floor rectangles (plus 1.5" of height, for the walls and standing dice) through a test `PerspectiveCamera` at the box's own aspect (240 / 130 ≈ 1.846, `.dice-panel-inset` in `src/index.css`) over a grid of camera setbacks/heights/fovs/look targets, and kept the combination whose projected rectangle used the most of the box (about 80-90% of both the box's width and height) without going outside it. No CSS size change was needed — the box's existing 240×130 aspect already matched a well-framed shot closely.

**`TrayInsets.jsx`:** one `PerspectiveCamera` per tray, built lazily on first use and kept in a ref `Map`, never added to the scene graph (see the "free-standing camera" fact above) — its pose never changes, only `aspect`, every frame, from the box's current size. `FrameStats` (checked, not changed): already sets `info.autoReset = false` and resets/reads it itself once per frame (`addEffect`/`addAfterEffect`, not tied to any `useFrame` priority), specifically because "the composer calls render several times in a frame" — `TrayInsets`' extra `gl.render()` calls are exactly more of that, already accounted for, nothing to change there.

**Left/uncertain:**
- The phase's own text defines "visible box" as "element present and its rect has width and height", but Phase 5's `DicePanel` hides an empty tray's box with `visibility: hidden`, not `display: none` — which does not change `getBoundingClientRect()`'s size, only whether the box itself (its border) paints. Rendering into it anyway would still show up on the canvas, since the box's own invisibility does not hide the canvas underneath. Added a `getComputedStyle(el).visibility === 'hidden'` check on top of the size check to cover this; flagging it here since it goes beyond the phase's literal instruction.
- Not checked in a browser, per the rules: how well the chosen camera pose actually frames the tray, whether 32° fov reads as "natural", and whether the box aspect needs a tweak once seen. The scratchpad projection check only confirms the math, not how it looks.
- The inset renders reuse the same `scene` as the main view, so anything conditionally shown only for the main camera (there is nothing like that today) would need checking against this too if added later.
