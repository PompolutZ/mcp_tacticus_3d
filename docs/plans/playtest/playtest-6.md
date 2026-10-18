# Plan: Fixes from the sixth playtest

Requested by the user on 2026-10-18. Status: in progress.

Branch `playtest-6`, worktree `../mcp_assist_3d-playtest-6`, from main. One coder step and one commit for each step. Each step writes its **Result** below when it is done. Feature docs change in the same step as the code.

Checks of every step: `pnpm format`, `pnpm lint` (no more warnings than before the step), `pnpm typecheck`, `pnpm test`, `pnpm --filter web build`.

## Request

1. Remove from the Streamer view whether a model contests a Secure objective. It gives too much help to good players.
2. Hovering over a model shows the model name, as for terrain.
3. R1 tool, Place 1 on, a token or model locked to it: the locked piece can be dragged anywhere within R1 of the snapped base, but the tool stays where it is. So the table shows a placement that the tool does not measure. The tool must follow the piece.
4. Settings: an option to turn off the camera turn on a left drag. A left click also selects a model, so a small miss turns the camera. On by default.
5. Bug: Push / Throw stops midway. A truck with spilled green goo was there before (Oscorp Chemical, the truck was deleted). Image: `~/Downloads/HEROTABLE3D/bug7.png`.
6. Damage and Power counters: left click adds 1, right click takes 1, as in TTS. Bigger controls on the tray card that are easier to hit.
7. Bug: the Damage and Power counters draw on top of a model that stands on the tray card. Image: `~/Downloads/HEROTABLE3D/bug8.png`.
8. Terrain pieces with no textures: Oscorp Chemical "Pipes" Size 3 (`pipes-size-3-2`), Sand Scrap "Barrel" Size 1 (`barrel-size-1`, also on Dockyard Destruction).

## Facts

- The badge shows Secure tokens within the card's contest range after the model is let go (`ui/SpectatorBadge.jsx`, `docs/features/spectator-view.md`). The HUD columns do not show them.
- Terrain hover label: `terrain/useTerrainHoverLabel.js`, text from `terrain/label.js`, drawn with `OccludedHtml` (`scene/LabelOcclusion.jsx`). A model already has a `hovered` state (`characters/CharacterModel.jsx`).
- Place 1: `docs/features/range-movement-tools.md`, "Range 1". `tabletools/rangeOne.js`, `tabletools/placeLock.js`. A snapped range tool already turns around its base to aim at a piece under the pointer (`tabletools/aimTurn.js`).
- Left drag on the empty table turns the camera (`CAMERA_MOUSE_BUTTONS` in `camera.js`, `docs/features/key-shortcuts.md`). Right drag also turns it.
- The Throw line stops at the first fixed, non-sensor collider (`castAlongHit` in `physics.js`, `characters/throwPath.js`). So a fixed collider that stays after its terrain piece is deleted would stop it.
- Counters: `TrayCounters` and `Counter` in `characters/TrayControls.jsx`. They are DOM in a drei `<Html transform>`, so they always draw on top of the canvas.
- Both pieces with no textures are bundle pieces (GLB with its own materials, `terrain/pieces.js`). `apps/web/scripts/README.md` describes the migration.

## Decisions

1. Streamer: the badge no longer shows Secure tokens. The held objective tokens stay. Remove the contest code that only the badge uses. `contestRange` in `cards.json` stays, because it is card data.
2. Model name: hover only. The Labels setting stays for terrain only, so the table is not crowded. The label shows after the pointer stays on the model for 1 s (user, 2026-10-18), one constant. The text is the character name (a two-card character: the name of the card of that model). Same look and occlusion as the terrain label. No label during a drag.
3. Range tools follow the locked piece (user, 2026-10-18: "otherwise problem will be fixed for R1 but exist for R2, 3 etc."). On every range tool (R1 to R5, Place 1 and Place / Place 2), while a locked piece that is not the snapped piece is dragged, the tool turns around the snapped base to aim at it, the same pose as the aim turn (on R1 with Place 1, the width points at it). The piece can go anywhere the turned tool still reaches: for Place / Place 2, its base touches the outline of the turned tool; for Place 1, as today. The tool stays in its last pose after the drop.
   - When the locked piece is the snapped piece, the tool stays where it is, as today. The tool has nothing else to turn around.
   - Movement tools do not change. Their bent shape is the path of the move, so the piece follows the tool, not the other way.
4. Camera: Settings → **Left drag camera on** / **off**, default on. Off: a left drag on the empty table does nothing. Right drag and middle drag work as before. Saved in `settings` as a boolean.
5. Throw bug: find the cause first, with a headless test (load Oscorp Chemical, delete the truck, Throw across its old place). Fix the cause, not the symptom. If the cause is something else, the coder stops and reports.
6. Counters: a left click on the counter (icon or value) adds 1, a right click takes 1, no context menu. The − and + buttons stay. Counters and buttons get bigger on the tray card. Size by look; the coder sets one CSS value and names it. The spectator badge is read-only and does not change.
7. Counter occlusion: a model in front of the controls hides the part behind it. drei `occlude="blending"` cannot work (Step 4 Result). The user chose option A (2026-10-18): the 3D tray draws its whole control strip in 3D (Damage and Power counters, the attached card gems, Flip, Remove), so the depth test hides it behind models. Clicks are R3F pointer events. Left click +1, right click −1 and the step 3 size stay. The DOM `TrayControls` stays for the tray popup (2D) and `TrayCounters` for the Streamer badge, which draws on top on purpose. The DOM controls were chosen first so a 2D view could use the same components; the popup still does.
8. Textures: find why the two GLBs have no texture (missing in the GLB, or lost in the material copy). Fix it in the migration or in the loader, so other pieces with the same cause are fixed too. List every other piece with the same cause.

## Step 1: Streamer without Secure

- Decision 1. `ui/SpectatorBadge.jsx` and the code it uses for the contest check. Delete code that nothing else uses.
- Tests: remove tests of deleted code only.
- Docs: `docs/features/spectator-view.md` (keep the TTS facts, change "How the app does it").

User: Streamer on. A model next to a Secure token shows no Secure token. Held objective tokens still show.

### Result

Badge no longer shows Secure tokens; held objective tokens stay. Deleted `ui/secureNear.js` and `secureNear.test.js` (`nearSecureIds`, `placementHeld`: only the badge used them). Removed from `SpectatorBadge.jsx` the props `baseRadius`, `secureTokens`, `contestRange`, `isHeld` and the per-frame contest state; from `SceneModel.jsx` the `isHeld` callback and the `secureTokens`, `contestRange` props; from `Scene.jsx` `secureTokens` and `contestRange`. `contestRange` stays in `cards.json` and `crisis/cards.js`. Docs: `spectator-view.md`. Checks: format, lint (40 warnings before and after), typecheck, test (1059 web pass), build ok.

## Step 2: Model name on hover

- Decision 2. Reuse the label look and `OccludedHtml` of the terrain label; no copy of its CSS. Put the label above the model top (`modelTop`).
- Tests: the label text for a normal and a two-card character, if it is a function.
- Docs: `docs/features/table-tools.md` or `key-shortcuts.md` (hover section).

User: hover a model: after 1 s its name shows. Leave it: gone. Drag it: no label.

### Result

New `characters/modelLabel.js` (`NAME_LABEL_DELAY` 1 s, `modelLabel(model, name)`) and its test: card 1 or spare model shows the name, a second-card model shows `Name (Form)` from `secondForm`, else the name. `SceneModel.jsx` passes `label`. `CharacterModel.jsx`: local timer state, label with `OccludedHtml` and `.terrain-label` at `modelTop`; leaving or a drag hides it at once. Docs: `key-shortcuts.md` (Hover). Checks: format, lint (40 warnings before and after), typecheck, test (1063 web pass), build ok.

## Step 3: Counters by click, bigger

- Decision 6. `Counter` in `characters/TrayControls.jsx` and its CSS.
- Docs: `docs/features/character-trays.md`.

User: left click on Damage adds 1, right click takes 1, no browser menu. Same on Power. The buttons are easier to hit.

### Result

- `Counter` (`TrayControls.jsx`): left click on the body adds 1, right click takes 1 (`contextmenu` preventDefault + stopPropagation). Only with onInc and onDec; the spectator badge is unchanged. Limits come from `damage`/`power` in `actions.js` (already clamp), no new rule.
- Size: one CSS variable `--tray-counter-size: 17px` on `.tray-controls` (`index.css`; was 14px). Icon and text follow it. The badge is outside `.tray-controls`, so it keeps the 14px fallback. Two `10/10` counters fit the 200 px tray width (about 196).
- Docs: `character-trays.md`, Controls.

## Step 4: Counters behind models

- Decision 7.
- Docs: `docs/features/character-trays.md`.

User: a model on its tray card hides the counters behind it. Clicks on the counters still work where they show. Terrain labels and the Streamer badge look as before.

### Result

Blocked, no code. drei `occlude="blending"` needs a transparent canvas: it puts the canvas above the Html, and models cover the Html only where the canvas is transparent. The canvas draws the background image and the opaque table, so the controls would disappear under the table. It also changes the z-index and pointer events of the shared canvas for every other Html. Options: A. draw the counters in the canvas (3D, depth test, R3F clicks); B. drei raycast occlusion (whole block hides, not per pixel); C. a CSS mask from a render of model silhouettes each frame; D. move the counters where models cannot stand. The user chose A (Decision 7).

Option A done:

- The 3D tray draws its strip in the canvas (`characters/TrayStrip3D.jsx`): each counter and chip is one flat plane with a canvas texture (`trayStripDraw.js`), so models hide it by depth test. Layout in `trayStrip.js` (same sizes as step 3). Clicks are R3F events; only the nearest hit counts, a moved pointer is not a click, right click on a counter takes 1 and its browser menu is off. Hover: pointer cursor (not-allowed on a disabled Remove), lighter look; Remove and gem chips show the title as a label above (`.token-face-label`, as `TokenFace`).
- Shared logic in `characters/trayControls.js` (`counterStep`, `counterZone`, `applyCounter`, `trayCounters`, `removeState`, `REMOVE_TITLE`, `CLICK_MOVE`) and `trayIcons.js`. DOM `TrayControls`/`TrayCounters` use them (popup and badge unchanged).
- Textures: counters redraw when value or hover changes; chip textures shared by all trays, counted, disposed. Other player's tray: was not read-only before, same now.
- Token drop: non-grunt plate already covers the strip. A grunt has no plate, so its unit group is the registered object and an invisible plane under its strip is added (`CharacterTray.jsx`).
- Tests: `trayControls.test.js`, `trayStrip.test.js` (fit, no overlap, click to change). Docs: `character-trays.md`. Checks: format, lint (40 before and after), typecheck, test (1078 web pass), build ok.

## Step 5: Left drag camera setting

- Decision 4. Settings store, `SettingsPopup.jsx`, and where `CAMERA_MOUSE_BUTTONS` is applied.
- Tests: the setting parse (default on, bad value → default).
- Docs: `docs/features/table-tools.md` (Settings menu, localStorage line), `docs/features/key-shortcuts.md` (mouse table).

User: setting off: a left drag on the table does nothing, a left click selects. Right drag turns. Reload: the setting stays.

### Result

Setting `leftDragCamera` (`settings/settings.js`, boolean, only `false` is off, default on). Settings → new Camera section → **Left drag camera on/off**. `cameraMouseButtons(leftDrag)` in `camera.js` derives the map from `CAMERA_MOUSE_BUTTONS` (`LEFT: null` when off; two stable objects), used in `App.jsx`. Debug pages keep the constant. Shift/Ctrl/Cmd + left drag does nothing when off (OrbitControls ignores a null button); right drag still pans with them. `cameraOwner.js` unchanged. Tests: setting parse, buttons map on/off. Docs: `table-tools.md`, `key-shortcuts.md`.

## Step 6: Range tools follow the locked piece

- Decision 3. Reuse the aim turn (`tabletools/aimTurn.js`) and the Place lock limits (`tabletools/placeLock.js`, `rangeOne.js`). The other player sees the tool move as with any tool turn.
- Tests: during a Place 1 drag the R1 width points at the locked piece center and the tool still touches the snapped base. During a Place drag on R2 to R5 the tool aims at the locked piece, and the piece base touches the outline. A locked snapped piece does not turn the tool. A movement tool does not turn.
- Docs: `docs/features/range-movement-tools.md` ("Place", "Range 1").

User: snap R1 to a model, Place 1 on, drag a token around the model: the tool turns with it and always lies between them. Same with R3 and Place. With a movement tool, Place works as before.

### Result

- `aimTurn.js`: new `aimDir(snap, rangeOne)` (direction from base into the tool; `RulerTool` aim turn now uses it) and `followPose(pose, dir, pivot, p)` (aim turn pose; unchanged when p is on the base center).
- `RulerTool.jsx`: `followPiece(model, p)` sets the live body (same write as a Q/E base turn, so store and LiveSync see it as any turn). Range tools only (no bend, no angle), snapped, locked piece not the snapped one. Passed to `useToolLimits` as `follow`.
- `useToolLimits.js`: Place and Place 1 `clamp` call `follow` first, then cut p with the turned pose (`placeClamp` / `clampRange`, no new geometry). Place 1 limit is still range 1 from the snapped center.
- Aims at the drag point p (the pointer-limited point), not the previous-frame center.
- Tests (`aimTurn.test.js`): R1 width points at piece and touches base; range tool aims, cut base touches outline at full reach; piece on base center no turn. Locked == snapped and movement tool are early returns in `followPiece` (component, not unit tested).
- Docs: `range-movement-tools.md` (Place, Range 1).
- Checks: format, lint (40 warnings before and after), typecheck, test, build ok.

## Step 7: Throw stops midway

- Decision 5. Find the cause with a headless test, then fix it. If a deleted piece leaves a collider, the test checks that the Throw line passes the old place.
- Docs: only if behavior changes.

User: Oscorp Chemical, delete the truck, Throw a model across its old place: it goes the full distance.

### Result

- Cause: not the truck. The Throw stopped at piece 7, `assetbundle-piece-2` ("Smoke"). Its GLB has no mesh, so nothing is drawn, but the prefab collider (fixed box, ~0.15" side, 0.04" above the mat) was copied. A headless cast (cylinder base, real Oscorp placements, Rapier) hit that collider; deleting the truck removed only the truck colliders.
- Decision (main): a piece with nothing visible has no collider.
- Fix: `collidersOfVisiblePiece` in `scripts/lib/bundle.mjs` (used by `readBundlePrefab`, so migration and `--colliders-only` both): no vertex in the GLB, no colliders, with a warning. `pieces.js` edited by hand to `colliders: []` as the script would write it (the data step needs the TTS cache and AssetRipper). No file was downloaded; none of the five had a `-colliders.glb`.
- Empty `colliders` in the app: `bundleColliderMeshes` gives no mesh entries, `urls.colliders` is null, `PrimitiveColliders` maps an empty list, so the RigidBody has no collider. No error path. Pointer handling of an invisible piece not checked.
- Pieces with an empty GLB (all 73 bundle pieces checked): `fire-effect-small` (Will He Get Away With It), `campus-light-size-1` (Busy City Disturbed, had 5 colliders), `sea-weed-size-2` and `coral-size-1` (Sunk Ship Sheltering Sinister Secrets), `assetbundle-piece-2` Smoke (Oscorp Chemical).
- Tests: `src/terrain/noMeshCollider.test.js` (reads every bundle GLB; empty ones have `colliders: []`, Smoke among them), `scripts/lib/bundle.test.js` (the rule). No separate cast test: with no collider the Smoke place has nothing to hit.
- Docs: `maps.md`, `scripts/README.md`.

## Step 8: Terrain textures

- Decision 8. Read `apps/web/scripts/README.md` first.
- Report the list of pieces with the same cause before the fix if the fix needs new assets from the TTS cache.

User: Oscorp Chemical Pipes and Sand Scrap Barrel show textures. Dockyard Destruction Barrel too.

### Result
