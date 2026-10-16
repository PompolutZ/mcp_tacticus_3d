# Plan: Move App state into a zustand store

Requested by the user on 2026-10-16. Status: steps 1-6 done. The user gave the OK on 2026-10-16 to run steps 4-9 back to back (coder agent per step, no stop between steps), then stop for the user test with the step 9 measurement. Branch `state-context`, worktree `../mcp_assist_3d-state-context`, from main. The plan changes many files, so no other branch is open while it runs.

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

**Result:**

### 8. Scene slice

- `rangeMark`, `draggingCharId`, `overlapIds` move into the store. The `otherOwned`, `otherDragKey`, `otherSpawn`, `otherLook` reads move to the pieces that use them, with per-piece selectors. The cause found in step 2 is fixed here.
- Scene-built helpers (`toggleSelect`, `dragSelect`, `rangeMarkOf`, `otherSelectedOf`, `getPieceLive`, `trayShape`, `trayPositions`, `toolModels`) become store actions or selectors.
- `TokenLayer`, `OwnTools`, `OtherTools`, `CharacterTray`, models read the store. Their props go.
- Remove the `fallow` ignore `dup:aa079c9e:2` from `.fallowrc.json`.

**Result:**

### 9. Measure again, memo where needed

- The user repeats the baseline run and the tool turn. Numbers go in the Result, next to step 1.
- `memo` only on components that still render because their parent rendered (the reason counter shows `parent`).
- Check that the `apiRef` assignment (Scene) does not depend on Scene rendering often. Move it to a layout effect with deps if needed.

**Result:**

## User checks

- [ ] Everything works as before: select, drag, tools, dice, tokens, cards, setup, popups, two players.
- [ ] Debug panel, tool turn: OtherTools, ScoreBoard, Terrain, DiceTray stay near 0.
- [ ] Debug panel, open and close a popup: Scene stays 0.
- [ ] Dev console: no new warnings.

## Not in this plan

- Moving the action hooks out of App, so each feature owns its data. A later plan.
- React Compiler. A later plan, if wanted.
