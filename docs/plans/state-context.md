# Plan: Move App state into a zustand store

Requested by the user on 2026-10-16. Status: steps 1-9 done, waits for the user test. The user gave the OK on 2026-10-16 to run steps 4-9 back to back (coder agent per step, no stop between steps), then stop for the user test with the step 9 measurement. Branch `state-context`, worktree `../mcp_assist_3d-state-context`, from main. The plan changes many files, so no other branch is open while it runs.

Each step makes one commit and writes its **Result** below.

Checks of every step:

- `pnpm format`, `pnpm lint` (no more warnings than before the step), `pnpm test`, `pnpm --filter web build`, `pnpm --filter web typecheck`.
- `pnpm fallow`: no new unused export, no new clone group. Write the Scene and App prop counts in the Result.

Paths are under `apps/web/` unless they start with `docs/`.

## Request

The user: all libraries are on the latest versions, so state can now be handled in a simpler way. `upgrade-react-19.md` says: fiber v9 lets React context cross `<Canvas>`, so `App.jsx` state can move into context or a store, and `App` and `Scene` no longer pass ~85 props.

The user then asked why not a store library. Decision: zustand (see Decisions).

## Facts

Found by a research agent on 2026-10-16. Paths under `src/`.

- `App.jsx` (1032 lines) passes about 85 props to `Scene` and about 33 to `Toolbar`. `Scene.jsx` (1228 lines) passes 38 props to `TokenLayer` and 16 to `OwnTools`. Most of them Scene only forwards.
- No `memo` anywhere, no React Compiler. Every App or Scene render renders the whole 3D tree. Step 1 measured it.
- Doc data: `Table.jsx` opens the doc and passes `table`, `ownership`, `presence`, `live`, `connection` to `App` (`<App key={doc.guid}>`). App reads every doc slice with `useSyncExternalStore` (`net/useY.js`), so any doc change renders App and the whole tree. Snapshots keep the identity of entities that did not change.
- Three module stores exist only because context did not cross `<Canvas>`: `table/actions.js` (App sets the actions each render), `sideColors.js`, `scene/look.js`. Their comments say so.
- Scene's own state: `draggingCharId`, `rangeMark`, `overlapIds` (100 ms check, set only on change), and the stores `otherOwned`, `otherDragKey`, `otherSpawn` (ownership), `otherLook` (presence).
- Per-frame and per-pointer data is in refs today: drag points, hover (`useHovered`), held keys, turns (`usePieceTurns`). This stays so.
- Handlers from the action hooks (`useCrisisTokens`, `useCharacterActions`, `useTablePieces`, `usePhaseActions`, `useGameSetup`, `useTableTools`) are new closures each render.
- `scene/useLatest.js` exists: a ref that holds the value of the last render.
- `zustand` 5.0.15 is already installed, as a dependency of `@react-three/fiber` 9.8.1 (`^5.0.3`).
- `fallow` ignores one clone group (`dup:aa079c9e:2`, the `TokenLayer` prop list). Drop it when the prop list goes.

## Decisions

1. **One zustand store per table.** `createTableStore(...)` with zustand's vanilla `createStore`. App makes it once (App is keyed by doc, so a new doc gets a new store). One React context holds the store object, which never changes. Components read with `useTableStore(selector)`. Only components whose selected value changes render.
2. **Why zustand, not context or jotai.** Context renders every reader on a change, so values must be split by rate and children need `memo`. A store with selectors does not need that. Zustand is the same shape as the module stores the app has now, and it is already a dependency. Jotai is better for a lot of state per piece; most state here is per table.
3. **Yjs stays the source of truth for doc data.** The store holds the Yjs stores (`table`), not copies of the doc. A component reads a doc slice with the existing `useY*` hooks. No doc data is copied into zustand.
4. **The store holds local state:** net objects, seat, settings, selection, drag, tool spawn, popup openers, Scene's own state, and the actions.
5. **Actions are stable.** The store has one `actions` object, made once. Each function calls the latest implementation, which App registers after each render (a ref write, no store change, no subscriber notified; reuse `useLatest`). Therefore no component renders because a handler changed.
6. **Per-piece selectors.** A model reads `s => isSelected(s.selection, 'character', id)`, a boolean. Only the models whose flag changes render.
7. **The three module stores go.** `table/actions.js`, `sideColors.js`, `scene/look.js` move into the store. Their comments go.
8. **Per-frame data stays in refs.** No pointer position, pose or hover in the store.
9. **`zustand` becomes a direct dependency** of `apps/web`, `^5.0.15`, so the app does not depend on fiber's choice.
10. **`memo` only where measurement still shows a cascade**, in the last step.

## Store shape

| Slice | Values | Changes |
|---|---|---|
| net | `table` (Yjs stores, `transact`), `ownership`, `presence`, `live`, `pieceLives`, `sceneApi`, `controlsRef`, `wheelCameraRef`, drag point refs | never (per doc) |
| seat | `ownSide`, `mySide`, `playedSides`, `hiddenSquads`, `seatPlayers`, `nameCtx`, `spectator`, side colors | rare |
| settings | `settings`, `bindings`, `debugOn`, `showLabels`, `showColliders`, look | rare |
| actions | all table handlers, hover handlers, popup openers, setters | never |
| selection | `selection`, `selectedTools` | on select |
| drag | `tokenDrag`, `toolDrag`, `toolSpawn`, `angleSpawn` | drag start, end |
| scene | `rangeMark`, `draggingCharId`, `overlapIds`, model registry (refs) | during a turn or drag |

Popup flags (`openCard`, `libraryOpen` and others) stay in App. They are DOM only, and the 3D tree needs only the openers.

## Steps

### 1. Render counter and baseline

The user asked to measure render counts before the refactor (2026-10-16).

- New `src/debug/renderCount.js`: `useRenderCount(name)`. It counts commits, not render calls: a `useLayoutEffect` with no deps adds 1. Therefore the StrictMode double render in dev does not count twice. Module counters (plain object, no React state, no subscription), so counting causes no render. Node test for the counter part.
- Call it in: `App`, `Scene`, `Toolbar`, `TokenLayer`, `OwnTools`, `OtherTools`, `ToolRack`, `DiceTray`, `OtherDiceTray`, `ScoreBoard`, `Terrain`, `CharacterTray`, `CharacterModel` (one sum for all models), `CrisisToken` (sum), `TacticCard` (sum).
- `DebugPanel`: a "Renders" section. Per name: total since reset and the count of the last second. A Reset button. The panel reads the counters on its own timer (the same way it reads `FrameStats`), so the panel does not make the counted components render.
- Counting runs only when the debug flag is on. Otherwise the hook does nothing.

**Result:** Done. `src/debug/renderCount.js`: `useRenderCount(name)` (layout effect, no deps), `countRender`, `readRenderCounts`, `resetRenderCounts`, `setRenderCounting`. Node test `renderCount.test.js`. The hook is in all 15 components. `DebugPanel` has a "Renders" section (total / last second per name, Reset), read on its own 500 ms timer.

Deviation: the debug flag is React state in `App` (`debugOn`, dev only), no module flag. So `DebugPanel` calls `setRenderCounting(true)` while it is mounted (it is mounted only when debug is on) and `false` on unmount. Counts of the first commits before the panel mounts are missed. Panel rows appear after the first 500 ms tick.

Checks: lint 40 warnings (same as before), tests 1010 pass, build and typecheck ok, fallow: no unused export, no clone group. `fallow` health fails with 307 above threshold, same as before the step.

**Baseline (user, sandbox, 2026-10-16):** one run with all actions of the table below except the two-browser one, no Reset between them. Total commits:

| App | Toolbar | Scene | TokenLayer, OwnTools, OtherTools, ToolRack, ScoreBoard, Terrain | CharacterModel (sum) | CharacterTray | DiceTray |
|---|---|---|---|---|---|---|
| 20 | 20 | 27 | 27 each | 23 | 37 | 57 |

CrisisToken, TacticCard and OtherDiceTray did not show (none on the table). Read: every Scene commit reaches every child (27 each). Scene has 7 commits more than App, from its own state. CharacterTray and DiceTray have more than Scene, from their own state. Per action it is about 3-4 Scene commits.

**Tool turn (user, sandbox, 2026-10-16):** after Reset: spawn a tool against a model, turn it a little, spawn a second tool.

| App | Toolbar | Scene | TokenLayer, OwnTools, OtherTools, ToolRack, ScoreBoard, Terrain | CharacterModel (sum) | CharacterTray | DiceTray (2 trays) |
|---|---|---|---|---|---|---|
| 35 | 35 | 158 | 158 each | 154 | 168 | 322 |

Read: about 120 Scene commits come from Scene itself, not from App, and each one reaches every child. `usePieceTurns` has no React state, so it is not the cause. DiceTray is 2x because the sandbox plays both sides (2 instances). The React DevTools Profiler was hard to read here, so step 2 adds a reason counter.

### 2. Reason counter, find the cause of the turn renders

- `src/debug/renderCount.js`: `useRenderReason(name, values)`. `values` is an object of named values. In a layout effect, it compares each value with the last commit (`Object.is`) and counts the names that changed. A commit with no changed name counts as `parent`. Same on/off rule as `useRenderCount`. Node test.
- Call it in `Scene` with its props (all of them, as one object) and its own state and store values: `draggingCharId`, `rangeMark`, `overlapIds`, `otherOwned`, `otherDragKey`, `otherSpawn`, `otherLook`, and the state returned by its hooks.
- `DebugPanel`: under "Renders", the reasons for Scene, sorted by count.
- The user repeats the tool turn. The Result gets the reasons. Then the plan names the fix for that state in step 8 (or earlier, if it is small).

**Result:** Done. `src/debug/renderCount.js`: `useRenderReason(name, values)` (layout effect, no deps, previous values in a ref), pure `changedReasons(prev, next)` (`mount` / changed names / `parent`), `countReasons`, `readRenderReasons(name)`. `resetRenderCounts` also clears reasons. Node tests added. `DebugPanel`: "Scene reasons" under "Renders", top 15 by count, same 500 ms timer.

Names fed from `Scene`: all props as `prop:<name>` (raw props object, so a default value does not hide a changed prop); `state:draggingCharId`, `state:rangeMark`, `state:overlapIds`; `store:otherOwned`, `store:otherDragKey`, `store:otherSpawn`, `store:otherLook`, `store:sideColors`, `store:tableActions.characters`, `store:tableActions.phases`; `hook:useModelClaims.claims`, `hook:useModelClaims.claimModel`, `hook:useTerrainHoverLabel.hoverLabelId`.

Deviation: `Scene(props)` now destructures inside (`} = props`). The other hooks (`useModelRegistry`, `usePieceTurns`, `useModelSync`, `useTerrainFall`) return only refs and functions, no state, so none is fed.

Checks: lint 40 warnings (same), tests 1012 pass, build and typecheck ok, fallow: no unused export, no clone group (`health` fails as before).

**Reasons (user):** tool turn, sandbox. Renders: App 11, Scene 161, every Scene child 161, DiceTray 322 (2 trays). Scene reasons: `hook:useTerrainHoverLabel.hoverLabelId` 148, then about 14 handler props, 12 each (from the App renders). So 148 of 161 Scene renders come from the hover label state, which only Terrain reads. Step 3 fixes it.

### 3. Hover label state into Terrain

- Cause (step 2): `useTerrainHoverLabel` is called in Scene, its `hoverLabelId` state changes on each hover change, and Scene renders every child. Only `Terrain` reads the value.
- Fix: call the hook in `Terrain`, not in `Scene`. Scene passes `terrainUnder` (from `useModelRegistry`) instead of `hoverLabelId`. The hook keeps `terrainUnder` in `useLatest`, so a new function each Scene render does not re-run its effect.
- Remove `hoverLabelId` from Scene and from its `useRenderReason` call.
- Expected: Scene about 13 in the same tool turn (App renders plus the rest). Terrain still renders on each hover change. A per-piece store selector can cut that later.

**Result:** Done. `Terrain` calls `useTerrainHoverLabel`; it takes `terrainUnder` instead of `hoverLabelId`. One Terrain instance in the app (Scene, inside `<Canvas>`, so `useThree` works); the terrain editor page mounts another without `terrainUnder`, so the hook skips its listeners there (`hasUnder` guard in the effect deps). Scene: hook call, import, `hoverLabelId` and its reason entry removed. Terrain remounts on a map or mat turn; the label state resets to null then (as the cursor re-enters). Comments in Scene, Terrain and the hook updated.

Checks: lint 40 warnings (same), tests pass (web 1012), build and typecheck ok, fallow: no unused export, no clone group (`health` fails as before).

**Re-measurement (user, sandbox, 2026-10-16):** same tool turn.

| App | Toolbar | Scene | TokenLayer, OwnTools, OtherTools, ToolRack, ScoreBoard, CharacterModel (sum) | CharacterTray | DiceTray (2 trays) | Terrain |
|---|---|---|---|---|---|---|
| 16 | 16 | 19 | 19 each | 21 | 38 | 131 |

Scene 161 → 19. Terrain alone renders on hover changes (131). Scene reasons now: only App renders, about 15 handler props at 17 each (`findCharacterAt`, `onCardHover`, `onPieceHover`, `onScoreMarkerMove` and others), because App makes new handlers each render. The actions slice (step 6) removes them.

### 4. Store skeleton and net slice

- `apps/web/package.json`: `zustand` `^5.0.15`.
- New `src/table/tableStore.js`: `createTableStore(net)`, the slices of the table above as empty or initial values, node test. New `src/table/TableStoreContext.jsx`: provider and `useTableStore(selector)` (zustand `useStore`), `useTableApi()` for the store object (for `getState` in handlers).
- `App` makes the store once (`useState(() => createTableStore(...))`) and wraps its JSX.
- Net slice: leaves read `table`, `ownership`, `presence`, `live`, `pieceLives` from the store, and a doc slice with `useY*` when App does not need it: `ScoreBoard`, `DiceTray`, `OtherDiceTray`, `TacticCard`, `TokenLayer`, `ToolRack`, `RosterCards`, `PriorityMarker`, `Terrain`, `LiveSync`, `RemoteCursor`, `Ping`.
- Remove the matching props from `App` → `Scene` → children. Check: no prop removed that a hook in App still reads.

**Result:** Done. `zustand` `^5.0.15` is a direct dependency. `src/table/tableStore.js`: `createTableStore({ table, ownership, presence, live })` with all slices of the table as initial values, node test. `src/table/TableStoreContext.jsx`: `TableStoreProvider`, `useTableStore(selector)`. `App` makes the store once (`useState`) and wraps its JSX in the provider.

Net slice: `ownership`, `presence`, `live`, `pieceLives` and `table` come from the store in `Scene` and these leaves: `ScoreBoard` (markers), `CrisisToken`, `TacticCard`, `LiveSync`, `RemoteCursor`, `DiceTray`, `OtherDiceTray`. Doc slices read with `useY*`: `TokenLayer` `tokenPiles`; `Scene` `matTurns`, `tacticCards`. `startPose` and `onModelRest` are `table.poses` in Scene. App keeps `setMatTurns`, `setTokenPiles`, `setTacticCards` as plain store setters, so App no longer subscribes to those three. Props gone from App → Scene: `ownership`, `presence`, `live`, `pieceLives`, `matTurns`, `tacticCards`, `tokenPiles`, `startPose`, `diceStore`, `rollsStore`, `transact`, `onModelRest`. Gone from `TokenLayer`: `ownership`, `pieceLives`, `tokenPiles`.

Deviations:
- The store makes `pieceLives`, `sceneApi`, `controlsRef`, `wheelCameraRef` itself, and App reads them back with `store.getState()`. Passing App's refs into the store gave a new lint warning (refs during render).
- `useTableApi` is not exported yet (fallow: unused export). Step 6 or later exports it when a handler needs it.
- Not removed, because App still needs the value: `scoreMarkers`, `affiliations` (SpectatorColumns), `priority` (needs `nameCtx`, step 5), `rosters`, `setup`, `looseTokens` (Scene uses it), `tokens`, `poses`, `terrain`, `tools`. `ownPing` stays (App's `usePing`).
- `.fallowrc.json`: the ignored clone id is now `dup:18a62811:2` (the `TokenLayer` prop list changed, so the hash did). Step 8 drops it.
- No feature doc described this state flow, so none changed. The store comment points to the plan.

Checks: lint 40 warnings (same), tests pass (web 1015), build and typecheck ok, fallow: no unused export, no new clone group (`health` fails as before, 308).

Prop counts: App → Scene 85 → 73. Scene → TokenLayer 38 → 35. Scene → OwnTools 16 (unchanged).

### 5. Seat and settings slices

- App writes the seat and settings values into the store when they change (one effect per slice, with deps).
- `sideColors.js` and `scene/look.js` module stores go. Their readers use `useTableStore`.
- Remove the matching props from Scene, Toolbar, SpectatorColumns.

**Result:** Done. App writes two slices in layout effects with deps: seat (`ownSide`, `mySide`, `playedSides`, `hiddenSquads`, `seatPlayers`, `nameCtx`, `spectator`, `sideColors`) and settings (`settings`, `bindings`, `debugOn`, `showLabels`, `showColliders`, `look`). Layout, not passive, so a reader shows the new value in the same commit (colors and names change with the roll off). The store also starts with the seat, `settings` and `bindings` (`createTableStore(net, initial)`), so no child renders with a default first. App calls `useSettings` and `tableSeat` above the store for that.

`sideColors.js` keeps the constants (`COLOR_HEX`, `COLOR_NAME`, `hexNumber`, `playerColorVars`), the store part is gone. New `table/useSideColors.jsx`: `useSideColors`, `useSideColor`, `useSideName` on `useTableStore`. `scene/look.js` is gone: `DEFAULT_LOOK` is in `tableStore.js`; `FaceMaterial` and `SelectionOutlines` use `useTableStore(s => s.look...)`. `useDebugLook` returns `look` (no `setLook` effect). Non-React readers: none.

Leaves read the store: `Terrain` (`showLabels`), `DiceTray` (`rethrowTilted`), `GameSetup` (`mySide`, `nameCtx`), `TokenLayer` (`playedSides`), `TableButtons`, `ToolRack`, `OwnTools` (`ownSide`), `Toolbar` (`spectator`, `settings.tools`), `SpectatorColumns` (`nameCtx`, `mySide`, `hiddenSquads`, `settings.spectator.size`). `Scene` reads `ownSide`, `playedSides`, `spectator`, `showColliders`, `turnStep` itself and feeds them to `useRenderReason` (`table:*`). Scene props gone: `ownSide`, `showColliders`, `showLabels`, `turnStep`, `rethrowTilted`, `spectator`, `playedSides`, `mySide`, `seatPlayers`. Toolbar props gone: `spectator`, `settings`.

Deviations:
- `useNames` takes `colors` as a third argument. App calls it above the provider, so it cannot read the store.
- `TerrainPage` (dev, no App) gets its own provider with a default store, since `SelectionOutlines` and `Terrain` now read it.
- Not removed, because App or another App child still passes them: `LogPanel` (`mySide`, `seatPlayers`), `CrisisCompare`, `CrisisChoose`, `RosterPopupHost`, `SettingsPopup`, `PhaseButtons`, `Library` (`seat`). Out of the step's list. `ToolDragGhost` `side` and `Ping` `side` stay props from Scene.
- Renamed `characters/useFigureMaterials.js` to `.jsx`: lint forbids a plain module importing the `.jsx` hook file. `table/useSideColors.jsx` is `.jsx` for the same reason.
- `.fallowrc.json`: ignored clone id now `dup:8a38126b:2` (`TokenLayer` prop list changed). Step 8 drops it.
- `table/actions.js` comment still says context does not cross Canvas: step 6 removes the file.
- Feature doc `setup-game.md` ("Colors") updated.

Checks: lint 40 warnings (same), tests pass (web 1015), build and typecheck ok, fallow: no unused export, no new clone group (`health` fails as before, 308).

Prop counts: App → Scene 73 → 64. App → Toolbar 34 → 32. Scene → TokenLayer 35 → 34. Scene → OwnTools 16 → 15.

### 6. Actions slice

- `actions` in the store: one object, made once (decision 5). App registers the implementations after each render.
- It replaces `table/actions.js` and `useTableActions()`: `Scene`, `TableButtons`, `Library`, `GameSetup` move to the store.
- Into it: the handlers of the action hooks, the hover handlers of `useHovered`, the popup openers, `showHudMessage`.
- Remove the matching props from Scene, Toolbar, TokenLayer, OwnTools, CharacterTray, RosterCards, GameSetup.
- Risk: an action called during render sees the previous render's implementation. Actions run on events. The coder checks that none is called during render.

**Result:** Done. `tableStore.js`: `createActions()` makes one `actions` object and `registerActions(impls)`, once per store. Each function calls `impl.current[name]`, so it is stable. `ACTION_NAMES` (flat: hover, token, pile, tool, table, popup and toolbar actions, `showHudMessage`) and `ACTION_GROUPS` (`setup`, `characters`, `phases`, as before). `App` builds `actionImpls` each render and calls `registerActions` in a layout effect without deps (a ref write, no `set`, no subscriber). Node test for forward, replace and no notify. `table/actions.js` and `useTableActions` are gone, with their comments.

Readers: `Scene`, `TokenLayer`, `OwnTools`, `CharacterTray`, `RosterCards`, `GameSetup`, `Toolbar`, `ToolRack`, `TableButtons`, `Library` use `useTableStore((s) => s.actions)`. `CharacterTray` builds its own closures with `character.id`. Scene still passes `actions.x` into leaves that keep a generic prop (`Terrain`, `DiceTray`, `PriorityMarker`, `CrisisCard`, `TacticCard`, `ScoreBoard`).

Deviations:
- Scene `useRenderReason` needs no new keys: it feeds the raw props, so the removed props are gone from it. The two `store:tableActions.*` entries are removed (the object never changes).
- `onToolReturn` was `undefined` when the rack is off or hidden. New boolean prop `toolReturn` (Scene) and `canReturn` (OwnTools), computed in App as before. `onToolRemove` and `onToolReturn` are one action.
- `RosterCards` takes `editable` (bool) instead of `onToggle`.
- `GameSetup` lost `onStartRound` (it calls `phases.power(playedSides)` itself).
- `showHudMessage` is in the store but no reader uses it yet (only App's hooks).
- Kept as props (not in the step list): `onSelectionChange`, `onSelectedToolsChange` (step 7), refs (`dragPointRef`, `toolDragPointRef`, `heldRotate`), `tokenDrag`, `toolDrag`, `diceMenu`, `removeWaits`; popup panels of App (`TokenPanel`, `LogPanel`, `TrayPopup`, `PhaseButtons`, `RosterPopupHost`, `SettingsPopup`).
- `useTableApi` still not exported (no reader needs `getState`).
- The no-deps effect first got a lint warning (a `set*` call in the effect body); the object is built outside the effect, so no new warning.
- Docs: `setup-game.md`, `character-trays.md` pointers.

Render-call check: every `actions.*` call is in an event handler, a hover or drag callback, or an effect (`useHoverReport`, `useHoverPeek`, `RulerTool` store and return). None runs during render. `actions.x` is passed as a value in render, never called.

Checks: format, lint 40 warnings (same), tests pass (web 1016), build and typecheck ok, fallow: no issue, no clone group (`health` fails as before, 308).

Prop counts: App → Scene 64 → 35. App → Toolbar 32 → 16. Scene → TokenLayer 34 → 23. Scene → OwnTools 15 → 13.

### 7. Selection and drag slices

- `useSelection` state moves into the store. The mirror to presence becomes a store subscription made in `createTableStore`.
- `tokenDrag`, `toolDrag`, `toolSpawn`, `angleSpawn` move into the store. `useTokenDrag` and `useTableTools` write there.
- Readers use per-piece selectors (decision 6): models, tokens, tools, `ToolDragGhost`, CardPopup peek, key state.
- Remove the matching props.

**Result:** Done. `tableStore.js`: `createActions(set)` adds stable setters `setSelection`, `setSelectedTools`, `setTokenDrag`, `setToolDrag`, `setToolSpawn`, `setAngleSpawn` (a value or an updater, no change on an equal result) and `toggleSelect(kind, id)`, `dragSelect(kind, id)`. The store also holds `dragPointRef` and `toolDragPointRef` (made once). The presence mirror is a store subscription in `createTableStore` (one push at creation, then on a `selection` or `selectedTools` change). `useSelection.js` is gone. `selection.js`: new `isSelected`. Node tests for the setters and the presence mirror.

Writers: `useTokenDrag` and `useTableTools` take `store`, write with the setters, and read the selection with `getState()` in their handlers. App passes `actions.setSelection` to the other hooks as before. App reads `tokenDrag`, `toolDrag` and `selection` with `getState()` (wheel state, key state, F key).

Readers (per-piece selectors, primitives or booleans): `CharacterFigure` (`isSelected(s.selection, 'character', modelId)`), `CrisisToken`, `LooseToken`, `CharacterTray` (its character's model), `Terrain` (`selectedId` of the terrain piece), `TokenPanel` (selected token id; takes `tokens` and handlers with the token id), `CardPopup` peek (hides on `tokenDrag || toolDrag`), `ToolDragGhost` (reads `toolDrag`, `toolDragPointRef`, `ownSide`; no props), `TokenLayer` (`tokenDrag`, `dragPointRef`), `OwnTools` (`toolSpawn`, `angleSpawn`, `selectedTools`, and the last tool piece, an object that changes only when that piece changes). Scene no longer reads the selection or the drags, so a selection change renders no Scene. App also no longer renders on a selection or drag change.

Props gone: App → Scene `angleSpawn`, `toolSpawn`, `selection`, `onSelectionChange`, `selectedTools`, `onSelectedToolsChange`, `tokenDrag`, `dragPointRef`, `toolDrag`, `toolDragPointRef`. Scene → TokenLayer `selectedTokenId`, `selectedLooseId`, `toggleSelect`, `dragSelect`, `tokenDrag`, `dragPointRef`. Scene → OwnTools `toolSpawn`, `angleSpawn`, `selectedTools`, `onSelectedToolsChange`, `toolTarget`. Scene → `CharacterTray` and the models: `selected` (models get `modelId`). `onSelectionChange` and `onSelectedToolsChange` are removed, not kept. Scene `useRenderReason` needs no change (raw props).

Deviations:
- `useTableApi` is still not exported: no component handler needs `getState` (App is above the provider and has `store`). Fallow flags an unused export.
- `.fallowrc.json`: the ignored clone is dropped now (the `TokenLayer` prop list is no longer a clone). Step 8 has nothing left to drop.
- `Terrain` keeps its `selectedId` prop for `TerrainPage` (no selection store there); without it, Terrain reads the store.
- `TokenPanel` signature changed (it was `token` + closures).
- `CardPopup` peek keeps the `popupOpen` check in App; the drag check moved into it.
- The presence mirror pushes once per selection change, also one that only changes a terrain piece (presence skips an equal field).
- Doc: `character-trays.md` (token drag state is in the store).

Checks: format, lint 40 warnings (same), tests pass (web 1018), build and typecheck ok, fallow: no unused export, no clone group (`health` fails as before, 308).

Prop counts: App → Scene 35 → 25. App → Toolbar 16 (unchanged). Scene → TokenLayer 23 → 17. Scene → OwnTools 13 → 8.

### 8. Scene slice

- `rangeMark`, `draggingCharId`, `overlapIds` move into the store. The `otherOwned`, `otherDragKey`, `otherSpawn`, `otherLook` reads move to the pieces that use them, with per-piece selectors. The cause found in step 2 is fixed here.
- Scene-built helpers (`toggleSelect`, `dragSelect`, `rangeMarkOf`, `otherSelectedOf`, `getPieceLive`, `trayShape`, `trayPositions`, `toolModels`) become store actions or selectors.
- `TokenLayer`, `OwnTools`, `OtherTools`, `CharacterTray`, models read the store. Their props go.
- Remove the `fallow` ignore `dup:aa079c9e:2` from `.fallowrc.json`.

**Result:** Done. `tableStore.js`: stable setters `setRangeMark`, `setDraggingCharId`, `setOverlapIds` (skip an equal value; `overlapIds` changes only when the content does). The mark mirror to presence is a store subscription (one `set` per `rangeMark` change); Scene's effect is gone. The store also holds `received` (the LiveSync ref) and stable `getPieceLive`, `getPieceLiveTime`. Tests added.

New `table/useOtherPlayer.jsx` (no ownership/presence hook existed): `useRemote(key)`, `useOtherOwned`, `useOtherDragKey`, `useOtherDragging(key)`, `useOtherSpawn`, `useOtherPresence(selector)`, `useRangeMark(kind, id)`, `useOtherSelected(kind, id)`. They return primitives where they can. New `characters/useTrayLayout.js`: `trayPositions`, `gruntLists`, `trayShape`, used by Scene and TokenLayer.

Moved out of Scene:
- `useLiveFollow` (renamed `.jsx`) reads `remote` and `getPieceLive` itself. `CrisisToken`, `LooseToken`, `TokenPile`, `TacticCard`, `ScoreBoard` markers lost `remote`, `getLivePose`, `otherOwned`.
- `CrisisToken`, `LooseToken`, `CharacterFigure` read `rangeMark` and `otherSelected` themselves. `CharacterFigure` also reads `overlap`, `remote`, `otherDragging`, `getLivePose`, `getLiveTime`. `OtherSpawnPreview` reads `getPieceLive`.
- `TokenLayer`: `OtherSpawn` is its own component. `OtherTools` reads the side, `received` and presence (selected tools as one string, last selected key).
- Scene local components: `DeployRanges` (own and other drag), `OtherPing`, `ClaimSync` (the other player's claims; calls `onOtherClaims` of `useModelSync`, placed after the models, so their effects run first as before).
- `rangeMarkOf`, `otherSelectedOf`, `getPieceLive`, `trayShape`, `trayPositions` are gone from Scene (hooks or store). `toggleSelect`, `dragSelect` were already actions (step 7).

Deviations:
- `toolModels`, `toolModel`, `onSnap`, `onPlaceLimit`, `turnProps` stay in Scene: they are built from the model registry refs that only Scene has. `OwnTools` and `OtherTools` get them as props.
- `CharacterTray` keeps `position`, `grunts`, `slot`, `affiliation`, `onBoard`: Scene lays them out. It has no other-player state.
- `useModelSync` lost the `otherOwned` argument and returns `onOtherClaims`. The claims effect now runs in `ClaimSync`, after the poses effect of Scene (before, in the same commit, it ran in order). Only matters if a pose and a claim change in one commit.
- `.fallowrc.json` had nothing left to drop (step 7).
- No feature doc described this state, so none changed.

Checks: format, lint 40 warnings (same), tests pass (web 1020), build and typecheck ok, fallow: no issue, no clone group (`health` fails as before, 308).

Prop counts: App → Scene 25 (unchanged since step 7; the removed state was Scene's own). App → Toolbar 16 (unchanged). Scene → TokenLayer 17 → 9. Scene → OwnTools 8 → 7. Scene → OtherTools 5 → 2.

Still makes Scene render: an App render (its props, many are new objects each App render), `matTurns`, `tacticCards` (doc), `ownSide`, `playedSides`, `spectator`, `showColliders`, `turnStep` (store). A claim, a drag, an overlap change, a range mark, a ping, a spawn of the other player render only their pieces.

**Fixes after user test:** `LogPanel` called `useNames` with 2 args (step 5 added `colors`), crash. It now reads `nameCtx` from the store; App no longer passes `mySide`, `seatPlayers`. Store starts with a default `nameCtx` (was null), so a first render never reads null. Audit of steps 4-8 signature changes: all other callers match.

### 9. Measure again, memo where needed

- The user repeats the baseline run and the tool turn. Numbers go in the Result, next to step 1.
- `memo` only on components that still render because their parent rendered (the reason counter shows `parent`).
- Check that the `apiRef` assignment (Scene) does not depend on Scene rendering often. Move it to a layout effect with deps if needed.

**Result:** Parts 1 and 2 done.

**Measurement after step 8 (user, sandbox, 2026-10-16):** tool turn (spawn a tool against a model, turn it, spawn a second tool). Total commits:

| App | Toolbar | Scene | TokenLayer, OtherTools, ScoreBoard, ToolRack | OwnTools | CharacterModel (sum) | CharacterTray | DiceTray (2 trays) | Terrain |
|---|---|---|---|---|---|---|---|---|
| 39 | 39 | 40 | 40 | 53 | 38 | 43 | 83 | 96 |

Step 3 for comparison: App 16, Scene 19. Scene reasons: `prop:removeWaits`, `prop:squadEdit`, `prop:tableButtons`, `prop:toolRack` 40 each (new object each App render), `prop:tools` 11, `prop:characters` 9, `prop:poses` 4, `prop:scoreMarkers` 2, `table:showColliders` 1.

Fixes:
- `removeWaits` (and `waitLines`): `useMemo` in `useCrisisTokens` on `tokens`, `characters`, `playedSides`, `nameCtx`.
- `squadEdit`: two booleans, `useMemo` in App.
- `tableButtons`, `toolRack`: `useMemo` in App on their primitives. `powerBlockTitle` (`usePhaseActions`) is `useCallback` on `setup`, `nameCtx`, so `tableButtons` stays the same.
- Other Scene props checked: `heldRotate` (a ref), `diceMenu`, `parsedRosters`, `viewSetup`, `crisis`, `tokens`, `characters`, `poses`, `tools`, `scoreMarkers`, `affiliations`, `rosters` are state, doc snapshots or `useMemo` already. `priorityTitle` is a string. Nothing else is new each render.
- App renders: `useRenderReason('App', ...)` in App (props, doc reads, state, hook state). `DebugPanel` shows "App reasons" and "Scene reasons" with one shared section.

App cause: not found by code reading. App has no store subscription (`getState` only; the layout effects only `setState`). App reads the doc with `useY*`, so each doc change renders it. The 39 are most likely doc changes (`tools` 11, `characters` 9, `poses` 4, `scoreMarkers` 2 as Scene sees them, with others behind them), and a longer test than step 3. The App reasons counter tells. `table:showColliders` 1 is the debug switch.

Unmount warning ("Attempted to synchronously unmount a root while React was already rendering"): `tacticFaceTexture.js` `mountFace` cleanup. Not new by code: `git diff main...HEAD` for `tactics/` is `TacticCard.jsx` only (reads from the store, no change in when a face is drawn); faces are drawn once per key (cached) and the unmount code is the same as on main. It is on main too. The cause (an unmount inside a commit of another root) is not clear from code, so the fix is a guard: the cleanup runs in a `setTimeout(0)` task, never inside a render or commit.

"THREE.Clock deprecated" and "deprecated parameters for the initialization function": not in `src/`, both come from libraries (three via fiber, rapier). This branch changed no dependency except `zustand`. Pre-existing.

**Measurement after part 1 (user, tool turn after Reset, 2026-10-16):** total commits.

| App | Toolbar | Scene | TokenLayer, OtherTools, ScoreBoard, ToolRack | OwnTools | CharacterModel (sum) | CharacterTray (sum) | DiceTray (2 trays) | Terrain |
|---|---|---|---|---|---|---|---|---|
| 18 | 18 | 19 | 19 | 27 | 42 | 54 | 38 | 55 |

Scene reasons: `prop:poses` 8, `parent` 4, `prop:characters` 3, `prop:removeWaits` 3, `prop:tableButtons` 3, `prop:tools` 3, `table:showColliders` small.

**Part 2 (done):** `memo` on `Scene`, `Toolbar`, `TableButtons`, `TokenLayer`, `OtherTools`, `OwnTools`, `ScoreBoard`, `ToolRack`, `DiceTray`, `OtherDiceTray`, `CharacterTray`, `CharacterModel`, `StandeeModel`, `Terrain`, and the new `scene/SceneModel.jsx`.

Props made stable:
- Scene (`scene/Scene.jsx`): `useCallback` for `applyPlaceLimits`, `toolModel`, `setPlaceLimit`, `selectModel`, `turnProps`, `markMoved`, `registerAddDice`, `onTerrainSelect`, `onTerrainObject`; `useMemo` for `rackHidden`. Constants `NO_LIST`, `NO_SIDE_TOOLS` replace default `[]` and `{}`. `toolModels` deps now list `markMoved`.
- `usePieceTurns.trackPiece` and `useModelRegistry.terrainUnder` are `useCallback`.
- `useTrayLayout`: one shape object for each character (`slot` array stays), `trayShape` is `useCallback`.
- `CharacterTray`: prop `objectRef` replaced by `objects` (the Map ref); it makes its own `useCallback` ref.
- Models: new `SceneModel` (memo) builds the model props in `useMemo` and reads `ownership` and `actions` from the store. Scene gives it a stable `ctx` ({ refs, now }). `now` is a `useLatest` of the helpers that only handlers read (`modelBases`, `restPose`, `onModelRest`, `applyPlaceLimits`, `deployLine`, `deployDepth`). `spawn` is a new object each render and is read only on mount, so a custom `memo` compare skips it. The spectator badge is made inside it from `spectator`, `held`, `secureTokens`.
- `OwnDiceTray` (local in Scene) makes the `DiceTray` handlers with `useCallback`.
- `tableButtons.powerBlockTitle` (function) became `tableButtons.powerBlock` `{ host, guest }` (strings, App computes them); `BoardStrip` and Scene's `startRoundBlock` read it. The prop stays equal when `setup` or `nameCtx` change but the texts do not.
- `removeWaits`: new `useShallowStable` (`src/useShallowStable.js`) keeps the old object when the content is equal.

Not memo or not changed:
- `Terrain` hover label renders (55) stay: they come from its own hover state; a per-piece selector is not a small change.
- No leaf was skipped. `TerrainPage` still passes its own props to `Terrain`.

`apiRef`: the closures read only props and store values that Scene itself reads, so they change only when Scene renders. It was a passive effect after every render; now `useLayoutEffect` after every render (no deps: the closures are new functions each render, a deps list would be wrong). With Scene memo it runs rarely.

Checks: format, lint 40 warnings (same), tests pass (web 1020), build and typecheck ok, fallow: no unused export, no clone group (`health` fails as before, 308).

## User checks

- [ ] Everything works as before: select, drag, tools, dice, tokens, cards, setup, popups, two players.
- [ ] Debug panel, tool turn: OtherTools, ScoreBoard, Terrain, DiceTray stay near 0.
- [ ] Debug panel, open and close a popup: Scene stays 0.
- [ ] Dev console: no new warnings.

## Not in this plan

- Moving the action hooks out of App, so each feature owns its data. A later plan.
- React Compiler. A later plan, if wanted.
