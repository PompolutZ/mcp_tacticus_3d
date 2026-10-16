# Plan: Upgrade to React 19 and R3F v9

Requested by the user on 2026-10-16. Status: not started. Branch `upgrade-react-19`, worktree `../mcp_assist_3d-upgrade-react-19`, from main. The plan changes the lockfile and many packages, so no other branch is open while it runs.

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step:

- `pnpm format`, `pnpm lint` (no more warnings than before the step), `pnpm test`, `pnpm --filter web build`.
- `pnpm fallow`: no new unused export, no new clone group.

Paths are under `apps/web/` unless they start with `docs/`.

## Request

The user: the app is 2 weeks old, so it should use the latest versions. The first commit (`e3c348c`) set React 18 and fiber v8 with `^` ranges. No doc gives a reason for these versions. Fiber v9 lets React context cross `<Canvas>`. A later plan can then move `App.jsx` state into context or a store, and `App` and `Scene` no longer pass ~85 props.

This plan only upgrades. The state move is a separate plan.

## Facts

Found by a research agent on 2026-10-16. The targets are the newest versions that the pnpm age check allows.

### Versions

| Package | Now (lock) | Target |
|---|---|---|
| react, react-dom | 18.3.1 | 19.3.0 |
| @types/react, @types/react-dom | 18.3 | 19.x |
| @react-three/fiber | 8.18.0 | 9.8.1 |
| @react-three/drei | 9.122.0 | 10.7.9 |
| @react-three/rapier | 1.5.0 (engine 0.14.0) | 2.2.0 (engine 0.19.2) |
| @react-three/postprocessing | 2.19.1 | 3.2.0 |
| postprocessing | 6.39.5 | same. Needs three ≥0.168 and <0.187 |
| three | 0.169.0 | 0.186.1 (step 5) |
| @dimforge/rapier3d-compat (direct dep) | 0.14.0 | remove, or 0.19.2 if a script needs it |

- The five React packages must move in one step, because each one's peer range needs the others.
- three 0.169 meets every peer range. Therefore three moves in its own step.
- `@react-aria/focus` 3.22.1, `embla-carousel-react` 8.6.0, `@vitejs/plugin-react` 4.7 and vite 5 already work with React 19.
- Tooling: oxlint and `node --test`. No ESLint React plugins, no vitest. Nothing to change.

### Code that the upgrade hits

- Ref callbacks that return a value: `src/tabletools/ToolDragGhost.jsx:45`, `src/tabletools/OtherTool.jsx:103`, `:112`. React 19 treats a returned function as a cleanup. Wrap the body in `{}`.
- Postprocessing v3 lowers the `EffectComposer` `multisampling` default from 8 to 4. `src/scene/SelectionOutlines.jsx:199` sets no value.
- Postprocessing v3 rewrote how Outline keeps its selection. `SelectionOutlines.jsx` sets `effect.selection` through a ref and passes `selection={[]}`. This should still work. The user checks it.
- Rapier engine 0.15.1: `FIX_INTERNAL_EDGES` no longer also turns on `ORIENTED`. Hit: the dice tray trimesh, `src/dice/DiceTrayParts.jsx:105`.
- Rapier engine 0.19 renames `rapier.es.js` to `rapier.mjs`. Hit: `scripts/dice-sim.mjs:56`. `scripts/README.md:552` and `docs/plans/dice-rolling.md` describe the old layout.
- Fiber v9 runs StrictMode inside `<Canvas>` (`src/main.jsx:17`). In dev, about 102 effects in 3D components run twice. Only dev changes.
- `src/terrain/bundleColliders.js:6` and `src/terrain/Terrain.jsx:314` depend on rapier 1.5 behavior: collider args scale with world scale, and a RigidBody transform is copied onto auto-built colliders (see the physics-sim notes: a `quaternion` prop turned terrain colliders twice).

### Not hit

propTypes, defaultProps, string refs, `ReactDOM.render`, `findDOMNode`, legacy context, `element.ref`, Canvas `gl` as a function, JSX namespace types, `extend`. drei APIs in use (`useGLTF`, `useTexture`, `Html`, `Line`, `OrbitControls`, `Environment`, `useProgress`) are in v10. Fiber 9.8.1 still marks color maps as sRGB. `canvasEvents.js` (`events`, `state.internal.lastEvent`), `addEffect`, `addAfterEffect`, `useLoader.preload`, `onPointerMissed` still exist. `forwardRef` and `Context.Provider` still work.

### three 0.169 → 0.186.1

- r182 removes `PCFSoftShadowMap`. Fiber uses it for `shadows`. `PCFShadowMap` is now soft, so shadows look different.
- r182 changes transparent `MeshStandardMaterial`.
- Shader patches on three's built-in shader code: `src/tabletools/footprintProjection.js:107-111`, `src/dice/DiceTrayParts.jsx:68-74`. They break when three renames the code they replace.

## Steps

### 1. Fallow fixes and ref callbacks

- `scripts/lib/diceStats.mjs:5`: remove `export` from `CHI_LIMIT_5`. Line 102 uses it.
- `.fallowrc.json`: ignore the clone group of `src/scene/Scene.jsx` `<TokenLayer …>` props and `src/tokens/TokenLayer.jsx` props destructure. Note: the match is the prop list, the state plan removes it.
- Wrap the 3 ref callback bodies in `{}`.
- Check: `pnpm fallow` shows no unused export and no clone group.

**Result:** Removed `export` from `CHI_LIMIT_5`. Clone group ignored in `.fallowrc.json` with `duplicates.ignoredClones: ["dup:aa079c9e:2"]` (key = fingerprint + instance count; it shows again if the prop list changes). JSON has no comments, so the note is here: the match is the prop list, the state plan removes it, then drop the entry. Wrapped the 3 ref callbacks in `{}`. Checks: format, test, web build pass. Lint warnings: same count as before. `pnpm fallow`: no unused export, no clone group; only the health findings remain (306, as before).

### 2. Physics baseline on React 18

No code change, no commit unless a script needs a fix to run.

- Run `pnpm --filter web test` and save the output of the physics tests (`physics.test.js`, `physics.live.test.js`, `characters/throwPath.test.js`, `characters/base.test.js`, `terrain/dropQuery.test.js`, `terrain/dropDown.test.js`, `dice/throw.test.js`).
- Run `pnpm --filter web dice-sim --seed 1` (headless Node, defaults 8000 + 2000 throws). Write the run time and the numbers (face counts, chi test, tilt and out-of-well rate, settle time) here. If it runs longer than 15 minutes, stop it and use `--seed 1 --throws 2000 --multi-throws 500` in steps 2 and 4.
- Do not use `dice-night-run`. It drives the real app in a browser for hours.

**Result:**

React 18, no package change, no script fix.

`pnpm --filter web test`: 1002 tests, 1002 pass, 0 fail, 0 skipped (1.9 s). The physics test files pass; they print no numbers.

`pnpm --filter web exec node scripts/dice-sim.mjs --seed 1` (defaults 8000 + 2000 throws): 33 s wall. Run twice, same output except the perf line (0.260 and 0.237 ms/step).

| | single die | 10 dice at once |
|---|---|---|
| valid / attempts | 8000 / 8181 | 2006 / 2030 |
| tilted | 2.2% | 1.2% |
| out-of-well | 0.0% | 0.5% |
| lost | 0.0% | 0.0% |
| chi-squared (7 df, limit 14.07) | 5.91 PASS | 11.24 PASS |
| face counts 1-8 | 1006 946 1010 984 1031 1034 1009 980 | 261 253 211 267 276 256 243 239 |

Settle time per round: avg 2.68 s, max 3.72 s (203 rounds). 42 dice perf: 0.237-0.260 ms/step.

### 3. Upgrade React, fiber, drei, rapier, postprocessing

- Bump the packages in the table (not three). Remove `@dimforge/rapier3d-compat` from `package.json` if nothing in `src/` or `scripts/` imports it. Else bump it to 0.19.2.
- `SelectionOutlines.jsx:199`: add `multisampling={8}`.
- `DiceTrayParts.jsx:105`: add `ORIENTED` to the trimesh flags, so the tray collider works as before.
- `scripts/dice-sim.mjs:56`: new engine file name. Update `scripts/README.md` and the engine notes in feature docs. Do not change `docs/plans/dice-rolling.md` (done plan), except for paths.
- Read the rapier 2.2 source. Confirm that collider args still scale with world scale, and how a RigidBody transform reaches auto-built colliders. Fix `bundleColliders.js` and `Terrain.jsx` if it changed. Write what you found here.
- `grep -rn "18\.3\|fiber 8\|v8\|0\.14" docs/features apps/web/scripts/README.md`: update version notes.

**Result:**

Versions used, all exact targets, `^` ranges: react, react-dom 19.3.0; @types/react, @types/react-dom 19.3.0; fiber 9.8.1; drei 10.7.9; rapier 2.2.0; postprocessing 3.2.0. `pnpm install`: no peer warnings. three stays 0.169.

Rapier source (2.2.0 against 1.5.0, diff of the built `esm.js`): `scaleColliderArgs`, `createColliderPropsFromChildren`, `createColliderFromOptions`, `createRigidBodyState` and `setRigidBodyOptions` are the same code. (a) Collider args still scale with the world scale of the collider object. (b) A RigidBody still sets its translation and rotation from its `matrixWorld`, and the auto colliders still get the child pose relative to the body, so a `quaternion` prop on the RigidBody still turns the colliders twice. No change needed in `bundleColliders.js` or `Terrain.jsx`; only their comments say "1.5 and 2.2". 2.x changes: `ref` is a prop (no forwardRef), `numAdditionalFrictionIterations` removed from `<Physics>` (not used), new `useFilterContactPair`/`useFilterIntersectionPair` (not used), debug geometry is rebuilt per frame. Nothing else of ours is hit.

Engine 0.19.2 changes a cast: `world.castShape` returns null for a shape that exactly touches a collider at the start of the cast or exactly at `maxToi` (0.14 gave a hit). `castDown` (`src/physics.js`) steps in 5s; a cylinder with its bottom exactly on the table top (y 0) got no hit, so `baseGroundY` returned null and `throwPath.test.js` "a wall stops the base before it" failed (moved 17.5). Fix: `castDown` and `castAlongHit` start each step `CAST_EPS` (0.001") early and make it `2 * CAST_EPS` longer, and subtract the offset from the result. New test in `physics.test.js`: base bottom exactly at y 0 finds the table. Other calls checked: `castRay` (`tablePoint.js`, `dropQuery.js`, `LabelOcclusion.jsx`): a ray starting exactly on a surface gives toi 0 (measured), only an exact touch at `maxToi` gives null, and those casts are single long ones with room (`RAY_ROOM`, 1000, the anchor distance), so no fix. `intersectionsWithShape` (`terrainUnder.js`) is an overlap query with no time of impact, test passes. `TerrainPage.jsx:55` is a stub.

Changes: package.json bumps; `@dimforge/rapier3d-compat` direct dep removed (nothing imports it: tests and dice-sim resolve it through `@react-three/rapier`); `SelectionOutlines.jsx` `multisampling={8}`; `DiceTrayParts.jsx` trimesh flags `FIX_INTERNAL_EDGES | ORIENTED`; `dice-sim.mjs` loads `rapier.mjs` next to the package entry (the package `exports` blocks the subpath, so `require.resolve('.../rapier.mjs')` fails) and its comment says 0.19.2; `scripts/README.md`, `README.md` (React 19), `docs/features/dice-rolling.md`, `maps.md` version notes. Checks: format ok; lint 40 warnings (limit 40); web build ok; typecheck ok; `pnpm --filter web test`: 1003 of 1003 pass; `dice-sim --seed 1` runs (15 s); `pnpm fallow`: no unused export, no clone group.

Later fix: `@dimforge/rapier3d-compat` is a direct devDependency again, `^0.19.2` (the version `@react-three/rapier` 2.2.0 uses), because `dice-sim.mjs` imports it and fallow flagged it unlisted. `dice-sim.mjs` now resolves it from its own package. `pnpm why`: one runtime copy (0.19.2); 0.12.0 is only a types-only dependency of `@types/three`.

### 4. Physics after the upgrade

- Run the same tests and the same `dice-sim` command as step 2. Write both numbers side by side. The new engine gives other throws for the same seed, so compare the statistics, not single throws.
- If dice results move outside the chi limit, or a physics test fails, stop and report. Do not tune values without the user.

**Result:**

STOPPED by the plan rule: 10 dice at once moved past the limits (tilted +1.1 points, out-of-well 2.2x), and its chi-squared is 14.03 against the limit 14.07. No value was tuned. User decides.

`pnpm --filter web test`: 1003 tests, 1003 pass, 0 fail, 0 skipped (1.5 s). Step 2 had 1002; the extra one is the `castDown` test from step 3.

`pnpm --filter web exec node scripts/dice-sim.mjs --seed 1` (defaults 8000 + 2000 throws), run twice: same output except the perf line (0.112 and 0.113 ms/step). Repeatable. Engine prints "using deprecated parameters for the initialization function" (rapier 0.19 init warning, from `dice-sim.mjs`).

| | step 2 single | step 4 single | step 2 x10 | step 4 x10 |
|---|---|---|---|---|
| valid / attempts | 8000 / 8181 | 8000 / 8185 | 2006 / 2030 | 2003 / 2050 |
| tilted | 2.2% | 2.3% | 1.2% | 2.3% |
| out-of-well | 0.0% | 0.0% | 0.5% | 1.1% |
| lost | 0.0% | 0.0% | 0.0% | 0.0% |
| chi-squared (limit 14.07) | 5.91 PASS | 7.32 PASS | 11.24 PASS | 14.03 PASS |
| face counts 1-8 | 1006 946 1010 984 1031 1034 1009 980 | 1059 983 1018 1000 986 988 1017 949 | 261 253 211 267 276 256 243 239 | 229 246 232 226 267 277 283 243 |

| | step 2 | step 4 |
|---|---|---|
| settle time avg / max (rounds) | 2.68 s / 3.72 s (203) | 2.71 s / 4.23 s (205) |
| ms/step, 42 dice | 0.237-0.260 | 0.112-0.113 |

Per row:

- Single die valid/attempts, tilted, out-of-well, lost: no real change (attempts 8181 to 8185, tilted +0.1).
- Single die chi-squared: 5.91 to 7.32, still far under the limit. Fine.
- 10 dice tilted: 1.2% to 2.3% (+1.1 points, 1.9x). Over the 1 point rule.
- 10 dice out-of-well: 0.5% to 1.1% (2.2x, +0.6 points). Over the 2x rule.
- 10 dice attempts: 2030 to 2050; the extra invalid throws match the tilted and out-of-well rise.
- 10 dice chi-squared: 11.24 to 14.03. PASS but 0.04 under the limit. Faces 7 (283) and 6 (277) high, 4 (226) and 1 (229) low. With 2003 throws and a fixed seed this can be chance; it was not tested with another seed.
- Settle avg: same. Settle max: 3.72 to 4.23 s (+14%), under 2x.
- ms/step: 2.2x faster (new engine).

Not done: no other seed, no tuning. Possible cause to check (not verified): the engine step 3 left `ORIENTED` on the tray trimesh, but 0.19 contact and sleep behavior for dice against each other differs; a run with `--seed 2` and `--seed 3` would show if the x10 rise is stable.

**Seeds 2-6 (added; user accepted the result on 2026-10-16):**

Seeds 2-6 ran on both engines with default counts. Values are old (step 2 engine) → new. Seed 1 is from the tables above.

| seed | single tilted | 10 dice tilted | 10 dice out-of-well | chi single | chi x10 |
|---|---|---|---|---|---|
| 1 | 2.2 → 2.3 | 1.2 → 2.3 | 0.5 → 1.1 | 5.91 → 7.32 | 11.24 → 14.03 |
| 2 | 2.0 → 2.2 | 1.8 → 2.9 | 0.8 → 0.9 | 7.51 → 7.72 | 5.89 → 6.45 |
| 3 | 1.9 → 2.2 | 1.5 → 2.0 | 0.8 → 1.2 | 9.92 → 1.07 | 1.55 → 4.14 |
| 4 | 1.7 → 2.5 | 1.7 → 2.0 | 1.1 → 1.4 | 6.54 → 10.67 | 5.59 → 4.54 |
| 5 | 1.9 → 2.4 | 2.0 → 2.0 | 1.1 → 1.3 | 5.75 → 3.28 | 7.54 → 7.99 |
| 6 | 1.8 → 2.4 | 2.1 → 2.1 | 0.9 → 1.4 | 8.50 → 5.33 | 1.10 → 13.99 |

Single die out-of-well is 0.0% everywhere. All 12 chi tests (6 seeds x 2) pass on the new engine.

Averages over seeds 1-6, old → new: single tilted 1.9% → 2.3%; single out-of-well 0.0 → 0.0; 10 dice tilted 1.7% → 2.2%; 10 dice out-of-well 0.9% → 1.2%.

Conclusion: seed 1 was an extreme case. The averaged change is within the step limits. Dice stay fair. Slightly more tilted and out-of-well throws, which are re-thrown.

### 5. three 0.186.1

- Bump `three` to 0.186.1 (the newest that `postprocessing` 6.39.5 allows).
- Shadows: find where `shadows` is set on `<Canvas>`. Keep it on `PCFShadowMap`, or pick the nearest look. Write the choice here.
- Check the two shader patches against the new three shader chunks. The patch must find its text. Add a dev warning if a replace finds nothing, if there is none.
- Grep for other APIs removed between r169 and r186 (three migration guide) and fix the hits.

**Result:**

Version: `three` `^0.186.1` in `apps/web/package.json` (resolved 0.186.1; `postprocessing` 6.39.5 peer ok). `@types/three` 0.186.0 was already in the tree (peer of drei and postprocessing), not a direct dep. `pnpm install`: no peer warnings.

Shadows: `<Canvas shadows>` in `App.jsx` and `debug/TerrainPage.jsx` mapped to `PCFSoftShadowMap`, which r186 replaces with `PCFShadowMap` plus a console warning. Both now `shadows="percentage"` (fiber's name for `PCFShadowMap`), so there is no warning. No code sets a shadowMap type or radius. The light has `shadow-mapSize` 3072 (`SceneShared.jsx`). The edge look may be a little different from r169 soft PCF; user checks.

Shader patches: each replaced string is still in r186. `#include <common>`, `#include <project_vertex>`, `#include <tonemapping_fragment>` (footprintProjection.js, meshphysical vertex and fragment) and `#include <common>`, `#include <map_fragment>` (DiceTrayParts.jsx); `sampledDiffuseColor` is still defined in `map_fragment`. No change needed. Guard added: new `src/scene/shaderPatch.js` `patchShader(source, marker, replacement)` warns in dev when the marker is missing; both patches use it.

API hits: grep of `src/` and `scripts/` for the APIs removed or renamed r169 to r186 (Clock, encodings, useLegacyLights, WebGLMultipleRenderTargets, copyTextureToTexture3D, geometry merge, PCFSoftShadowMap, RGBFormat and others): none used. Imports are plain classes (Vector3, Quaternion, CanvasTexture, ExtrudeGeometry, OBJLoader, and so on). `docs/features/2d.md` render-target color note rechecked in r186 `WebGLPrograms.js`: still true, note now says "checked in r186". Scripts: `dice-sim.mjs` runs (`--seed 1 --quick`, both chi PASS); it prints a three deprecation warning that `require("three")` will be removed (comes from a dependency's CJS load, not our code). `photos-to-glb.mjs`, `lib/unity-prefab.mjs`, `lib/bundle.mjs` import only `CylinderGeometry` and `THREE.*` basics; not run (need assets).

Transparent `MeshStandardMaterial` (r182 changed how they draw; user checks them). Only with the Standard look; the default look is Unlit (`meshBasicMaterial`):
- `CrisisToken.jsx:413` damage face (`FaceMaterial transparent`).
- `ToolRack.jsx:46` faint tool clones (OBJ `MeshStandardMaterial`, opacity `FAINT_OPACITY`).
- `SpectatorBadge.jsx:58` badge materials forced `transparent = true` (on top, depthTest off).
No other `transparent` standard material; other transparent ones are `meshBasicMaterial` (RosterCards, ToolDragGhost, LosTool, Ping, RemoteCursor).

Checks: format ok; lint 40 warnings; test 1003 of 1003; web build ok; typecheck ok; `dice-sim --seed 1 --quick` runs; `pnpm fallow`: same as before the step (1 unlisted dependency `@dimforge/rapier3d-compat` from `dice-sim.mjs`, 306 health targets), no new unused export, no new clone group.

## User checks

After step 5 (or after step 3, if the user wants to test before three):

- [ ] Table loads, models and terrain have the right colors.
- [ ] Selection outlines show on hover and select, both colors.
- [ ] Edges are as smooth as before (antialiasing).
- [ ] Shadows look right.
- [ ] Dice roll and land on the tray as before.
- [ ] Models drop on terrain, do not fall through, do not slide off the haller hood.
- [ ] Throws and stacking of tokens work.
- [ ] Range and movement tools, footprint projection look right.
- [ ] Dev console: list StrictMode warnings for a later fix.

## User test fix

Error: the 3D view crashed in a loop, `Cannot read properties of undefined (reading 'selection')` at `SelectionOutlines.jsx` (the effect over `[entries, outlines]`), then the scene boundary remounted it again and again.

Cause: `@react-three/postprocessing` 3 `EffectComposer` makes its composer in its own effect and returns null until then, so `Outline` and `ToneMapping` are not mounted when the effects of `SelectionOutlines` first run. `effects.current[mode]` was still undefined. The same risk was in the `clampEdges`, `resolution.scale` and tone mode effects. A ref callback also gets null on unmount, and a new object when the scene or camera changes.

Fix: the effect objects are kept in state (ref callback sets state, pure helper `scene/effectRegistry.js` with a node test). The effects that configure them depend on that state and wait until every Outline exists. Passes are still created once; the selection is still set on the effect object.

Other places checked: no other `src/` file uses `@react-three/postprocessing`; no other ref to a postprocessing component. drei refs in `src/` are not read from a mount effect of a parent of a late-rendered child (not changed).

Warning sources (libraries, not our code):
- `THREE.Clock deprecated`: `@react-three/fiber` 9.8.1 `new THREE.Clock()` in its store.
- `deprecated parameters for the initialization function`: `@dimforge/rapier3d-compat` 0.19.2 wasm init, called by `@react-three/rapier` `r.init()`.

Bug: dice that go to the shelf hang tilted, some inside the shelf geometry, some in the air in front of it, in a wrong order. Worked on main.

Cause: a die body has `ccd` on. When a die rests, it becomes kinematic (`kinematicPosition`) and `startShelfMove` slides it to its slot with `setNextKinematicTranslation` and `setNextKinematicRotation`. With engine 0.19 a kinematic body that keeps CCD on does not reach the target. It is stopped on its way, at the tray wall between the well and the shelf, and keeps the tilted pose it rested in. The move code runs to its end (`moving` false), so nothing shows an error. Found with a headless replica of the tray, built from the app's own `RigidBody`, `ConvexHullCollider` and `TrimeshCollider` props and the app's `tray.js`, `shelf.js` and `throw.js` (fiber 9 root in Node, fake renderer, `Physics` step 1/120). 3 dice, thrown, rested, moved to the shelf: with `ccd` on, most runs ended with 1 to 3 dice off their slot (body and mesh equal, so not a sync problem), 0.3 to 1.5" away and tilted. With `enableCcd(false)` when the die turns kinematic: 6 of 6 runs exact. The tray trimesh flags (0, ORIENTED, FIX_INTERNAL_EDGES) did not change it. Not the cause: the `@react-three/rapier` 1.5 to 2.2 code for `RigidBody`, `setBodyType` and the mesh sync (same), StrictMode (the fiber 9 reconciler does not double the effects in the harness: one ref call per body), and the kinematic move itself (exact with CCD off). Not verified on engine 0.14: a pure engine test of the same move did not show the stop in either version, so the exact CCD rule that changed is not known; the replica only proves that CCD on a kinematic die is the trigger.

Fix: `DiceTray.jsx` `setDieKinematic` (CCD off, then kinematic) and `setDieDynamic` (dynamic, then CCD on) used at every body type switch of a die (rest, first move to the shelf, throw, return from the shelf). A die that starts on the shelf from the document gets `ccd` false. Also `SelectionOutlines.jsx`: the `resolution.scale` write moved into a helper (`setResolutionScale`), so the lint warning from the last commit is gone (40 again). Behavior text in `docs/features/dice-rolling.md` is unchanged.

Not done: `CharacterModel.jsx` also has `ccd` on its body; check if a model body is ever kinematic with CCD on. Not changed.

Checks: format ok; lint 40 warnings; test 1005 of 1005; web build ok; `dice-sim --seed 1 --quick` runs (both chi PASS). User check: roll 3 or more dice, they land flat in a row on the shelf, sorted; click a plate, the die returns to the well and rolls again.
