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

### 4. Physics after the upgrade

- Run the same tests and the same `dice-sim` command as step 2. Write both numbers side by side. The new engine gives other throws for the same seed, so compare the statistics, not single throws.
- If dice results move outside the chi limit, or a physics test fails, stop and report. Do not tune values without the user.

**Result:**

### 5. three 0.186.1

- Bump `three` to 0.186.1 (the newest that `postprocessing` 6.39.5 allows).
- Shadows: find where `shadows` is set on `<Canvas>`. Keep it on `PCFShadowMap`, or pick the nearest look. Write the choice here.
- Check the two shader patches against the new three shader chunks. The patch must find its text. Add a dev warning if a replace finds nothing, if there is none.
- Grep for other APIs removed between r169 and r186 (three migration guide) and fix the hits.

**Result:**

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
