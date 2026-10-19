# Plan: Render performance

Requested by the user on 2026-10-18. Status: step 3 built, not committed; the other steps wait for the user's decision. Branch `render-performance`, worktree `../mcp_assist_3d-render-performance`, from main.

Each step makes one commit and writes its **Result** below. Paths are under `apps/web/` unless they start with `docs/`.

Checks of every step: `pnpm format`, `pnpm lint`, `pnpm test`, `pnpm --filter web build`, `pnpm --filter web typecheck`.

## Request

Some users say the app lags in Chrome, but not in Brave or Edge. React work is already reduced (`memo`, zustand store, see `state-context.md`). The user asked what else can make the app faster.

## Facts

Found on 2026-10-18. Paths under `src/`.

- Chrome, Brave and Edge use the same engine (Chromium). So a lag that only Chrome has comes most likely from a Chrome setting or from the GPU that the system gives to Chrome:
  - Energy Saver (Settings → Performance) limits the frame rate to 30 fps on battery.
  - Windows can set a different GPU for each app (Settings → Display → Graphics). Chrome can run on the built-in GPU and Edge on the fast one.
  - Extensions (React DevTools, ad blockers) are often installed only in Chrome.
  - Hardware acceleration off: the app already detects it (`renderer.js`, `isSoftwareRenderer`).
- The debug panel shows `fps`, `worstMs`, `cpuMs`, `gpuMs`, draw calls, triangles, size and pixel ratio (`debug/FrameStats.jsx`). Debug mode is only in the dev server (`App.jsx`, `useDebugLook`).
- `<Canvas>` in `App.jsx` sets no `dpr` and no `frameloop`. R3F defaults: pixel ratio up to 2, and a new frame every display refresh, also when nothing changes.
- `scene/SelectionOutlines.jsx`: the `EffectComposer` has `multisampling={8}`, plus a `ToneMapping` pass and 7 `Outline` effects. An `Outline` with an empty selection skips its passes.
- `scene/SceneShared.jsx`: one shadow light with a 3072×3072 map, PCF (`shadows="percentage"`). three.js draws the shadow map again every frame (`shadowMap.autoUpdate` is true by default). Terrain and the mat do not move.
- drei `<Html>` (and `OccludedHtml`, `scene/LabelOcclusion.jsx`) moves a DOM element in every frame. It is used per piece in `tokens/TokenFace.jsx`, `terrain/Terrain.jsx`, `characters/CharacterModel.jsx`, and in the trays and tools. With many pieces, the browser must recalculate style for many elements each frame.
- About 30 `useFrame` callbacks. Physics: `TIME_STEP = 1 / 120` in `scene/Scene.jsx`, so 2 or more steps per frame at 60 fps. A slow frame makes more steps in the next frame.

## Decisions

1. **Measure first.** Step 1 decides if the lag is a Chrome setting, the GPU or the CPU. Steps 2–3 help when the GPU is slow. Steps 4–6 help when the CPU is slow. Skip steps that the measurement does not support.
2. **Small changes first.** The pixel ratio and multisampling are one-line changes with a large effect on the GPU. Drawing only on change (step 6) gives the largest saving, but it touches many files, so it comes last and may become its own plan.
3. **The look must not change visibly** at the default settings, except for a slightly softer image at a lower pixel ratio. The user checks this in the browser.
4. When a step changes lasting behavior (for example the pixel ratio rule), a new feature doc `docs/features/rendering.md` gets it in the same step.

## Steps

### Step 1. Measure on a lagging user's machine

No code. The user asks one lagging user to:

- check Energy Saver, the Windows GPU setting and extensions in Chrome, and try Chrome with extensions off (a guest window);
- if possible, run the dev server with debug mode and send `cpuMs`, `gpuMs`, `fps` and the pixel ratio from the debug panel, in Chrome and in Edge, on the same table.

If the debug panel cannot run there, step 1b adds a small stats overlay to the built app, turned on by a URL parameter (for example `?stats`). It reuses `debug/FrameStats.jsx`.

**Result:**

### Step 2. Limit the pixel ratio and multisampling (GPU)

- `App.jsx`: `<Canvas dpr={[1, 1.5]}>`. Optional: drei `<PerformanceMonitor>` lowers the pixel ratio to 1 when the fps stays low, and raises it again when the fps recovers.
- `scene/SelectionOutlines.jsx`: `multisampling` 8 → 4. Check that `setResolutionScale` still gives the same line width (it reads `dpr`).
- Check: in the debug panel, `gpuMs` before and after, on a retina screen.

**Result:**

### Step 3. Draw the shadow map only when a shadow caster changes (GPU)

The user asked to build this step before step 1 (2026-10-18). Most of the table is still most of the time: a model moves about once per round, terrain stays until it is removed. So the shadow map is the same in almost every frame. The step has a small cost and low risk, so it does not wait for the measurement.

Shadow casters today (found on 2026-10-18): character models (`characters/useFigureMaterials.jsx`), terrain (`terrain/Terrain.jsx`), dice and the dice tray (`dice/`), the scoreboard (`scoreboard/ScoreBoard.jsx`). Tokens, cards and tools cast no shadow. No `InstancedMesh`, no skinned or morph meshes, no `useFrame` with a priority.

Approach: one check in one place, not a mark in each place that moves something. A mark in each place is easy to forget (own drag, settling after a drop, the other player's drag, dice rolls, a model or map that loads later, a removed piece), now and in future features.

- New `scene/ShadowUpdates.jsx` (component inside `<Canvas>`) and a plain module with the compare rule.
- On mount: `gl.shadowMap.autoUpdate = false`, `needsUpdate = true`. On unmount: `autoUpdate = true` again.
- Each frame, before the render: collect the meshes with `castShadow` that are visible (the object and all its parents visible). Compare each one with the last frame: the same object, the same `geometry`, the same world matrix. Set `gl.shadowMap.needsUpdate = true` when any of these changed, or a caster was added or removed.
- The world matrix must be up to date in the frame that is drawn, so the shadow does not lag one frame behind a moving piece. three.js updates world matrices inside `render()`. So the check updates the caster matrices before the compare (for example `updateWorldMatrix(true, false)` on each caster), or runs at a point where they are already updated. The coder picks the way and writes why in the Result.
- The composer renders with priority 1 (`@react-three/postprocessing`). The check must run before it, in the same frame. A `useFrame` with a positive priority turns off R3F's own render, so check how this interacts with `SelectionOutlines` and the `no-composer` debug mode.
- Check that `needsUpdate` survives the `Outline` mask passes in the composer: three.js resets it after the first render that draws shadows.
- Copy the matrix numbers, do not keep a reference to `matrixWorld` (three.js changes the same object in place).
- Tests for the compare rule: no change → no update; a moved caster, an added caster, a removed caster, a hidden caster, a new geometry → update.
- `docs/features/rendering.md` (new, `Status: partly built`): the shadow map is drawn again only when a shadow caster changes, and why.
- Fallback if the check is too costly on the CPU: map size 3072 → 2048 instead. Write it in the Result.
- User check in the browser: shadows look the same as before. A shadow follows a dragged model, the other player's dragged model, rolling dice, a model that settles after a drop. A removed piece leaves no shadow. A new map has correct shadows. In debug mode, `gpuMs` is lower on an idle table.

**Result:** Built.

- `scene/ShadowUpdates.jsx` in `<Canvas>` (`App.jsx`), rule in `scene/shadowChange.js` (plain JS, no three.js import). Mount: `autoUpdate = false`, `needsUpdate = true`; unmount: `autoUpdate = true`. The tracker keeps, per caster, geometry, material and 16 copied matrix numbers; added, removed and hidden casters are found by a frame stamp. No allocation per frame after the casters are known (the list is reused).
- Matrices: `scene.updateMatrixWorld()` once before the compare. Simpler and cheaper than `updateWorldMatrix(true, false)` per caster, which walks the parent chain of each caster. Cost: three.js repeats the walk in `render()`, because `updateMatrix` marks every object as changed.
- Order: the callback has priority 0.5, so it runs after all priority 0 callbacks (rapier, drag, follow) and before the composer (priority 1). Any positive priority turns off the R3F render (`internal.priority`), so with `no-composer` the callback calls `gl.render` itself (`renderScene` prop). With the composer on, it does not.
- Outline passes: `needsUpdate` is not used up by them. The RenderPass draws first. The Outline passes set `shadowMap.enabled = false` while they draw (`postprocessing` OverrideMaterialManager), and `WebGLShadowMap.render` returns at once then, before it resets `needsUpdate`.
- Not watched: the shadow light and camera (static). Layers are not checked (a caster off the camera layers gives only an extra redraw).
- Tests: 6 in `scene/shadowChange.test.js`.
- Fallback (map 3072 → 2048) not needed so far; CPU cost not measured, the user checks in debug mode.

### Step 4. Fewer `<Html>` labels per frame (CPU)

- Count the `<Html>` elements on a full table (5 characters per side, tokens, terrain).
- Hide labels that are off screen or far from the camera, so drei does not update them. Or draw short labels in WebGL with drei `<Text>`.
- Check: `cpuMs` on a full table; labels still show and hide behind terrain.

**Result:**

### Step 5. Physics step cost (CPU)

- Measure the Rapier step time while dice roll and when all bodies sleep.
- If it is large: limit the number of physics steps in one frame, so a slow frame does not make the next frame slower. Check the dice results against `dice-sim` (`docs/features/dice-rolling.md`), because the step size changes how dice land.

**Result:**

### Step 6. Draw only when something changes (CPU, GPU, battery)

- `<Canvas frameloop="demand">`. Each source of change calls `invalidate()`: camera controls, physics bodies that are awake, drag, `useFrame` animations (ping, cursor, priority marker), remote changes from Yjs and presence, `<Html>` labels.
- This touches most of the 30 `useFrame` callbacks. If it is larger than one step, it becomes its own plan with one step per area.
- Check: `fps` is near 0 when nothing moves; every animation and remote change still shows without delay.

**Result:**
