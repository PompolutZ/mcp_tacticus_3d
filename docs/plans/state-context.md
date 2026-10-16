# Plan: Move App state into context

Requested by the user on 2026-10-16. Status: not started. Branch `state-context`, worktree `../mcp_assist_3d-state-context`, from main. The plan changes many files, so no other branch is open while it runs.

Each step makes one commit and writes its **Result** below.

Checks of every step:

- `pnpm format`, `pnpm lint` (no more warnings than before the step), `pnpm test`, `pnpm --filter web build`, `pnpm --filter web typecheck`.
- `pnpm fallow`: no new unused export, no new clone group. Scene and App prop counts go down; write them in the Result.

Paths are under `apps/web/` unless they start with `docs/`.

## Request

The user: all libraries are on the latest versions, so context or state can now make the code simpler. `upgrade-react-19.md` says: fiber v9 lets React context cross `<Canvas>`, so `App.jsx` state can move into context or a store, and `App` and `Scene` no longer pass ~85 props.

## Facts

Found by a research agent on 2026-10-16. Paths under `src/`.

- `App.jsx` (1032 lines) passes about 85 props to `Scene` (723–840) and about 33 to `Toolbar`. `Scene.jsx` (1228 lines) passes 38 props to `TokenLayer` and 16 to `OwnTools`. Most of them Scene only forwards.
- No `memo` anywhere, no React Compiler. Every App render already renders all of Scene. Context alone does not cut renders. It only removes the props.
- Doc data: `Table.jsx` opens the doc and passes `table`, `ownership`, `presence`, `live`, `connection` to `App`. App reads every doc slice with `useSyncExternalStore` (`net/useY.js`), so any doc change renders App and the whole tree. Snapshots keep the identity of entities that did not change.
- Three module stores exist only because context did not cross `<Canvas>`: `table/actions.js` (App sets the actions each render), `sideColors.js`, `scene/look.js`. Their comments say so.
- Existing contexts: `scene/SelectionOutlines.jsx:114` (stable `register`), `scene/LabelOcclusion.jsx:18` (mutable registry, no renders).
- Per-frame and per-pointer data is in refs today: drag points, hover (`useHovered`), held keys. React state changes only at press, drop, rest. This stays so.
- Handlers from the action hooks (`useCrisisTokens`, `useCharacterActions`, `useTablePieces`, `usePhaseActions`, `useGameSetup`, `useTableTools`) are new closures each render.
- `fallow` ignores one clone group (`dup:aa079c9e:2`, the `TokenLayer` prop list). Step 1 of the upgrade plan says: drop it when the prop list goes.

## Decisions

1. **React context, no new library.** Stable objects go in context. Values that change go in their own small context. Doc slices are read with the existing `useY*` hooks by the component that needs them. A store library (zustand) would add a second way to do the same thing.
2. **Stable values and changing values never share a context.** A context value that changes renders every reader.
3. **Handlers in context must be stable.** New `useStableHandlers(obj)`: returns one object whose functions never change and call the latest closure (ref updated in a layout effect). No change inside the action hooks.
4. **A component reads a doc slice itself when only it needs it.** Example: `ScoreBoard` reads `table.scoreMarkers`, `DiceTray` reads `table.dice`. App keeps the slices its own hooks need (`characters`, `setup` and others).
5. **The three module stores become context.** `table/actions.js`, `sideColors.js`, `scene/look.js`. Their comments go.
6. **`memo` on the big children only, in the last step**, after the props are gone: `TokenLayer`, `OwnTools`, `OtherTools`, `ToolRack`, `DiceTray`, `ScoreBoard`, the model list, `CharacterTray`, `Toolbar`. Then a doc change that only touches tokens does not render the dice tray.
7. **Per-frame data stays in refs.** No pointer position, pose or hover in React state.

## Contexts

| Context | Value | Changes |
|---|---|---|
| `TableContext` | `table` (stores, `transact`), `ownership`, `presence`, `live`, `pieceLives`, `sceneApi`, `controlsRef`, `wheelCameraRef` | never (per doc) |
| `SeatContext` | `ownSide`, `mySide`, `playedSides`, `hiddenSquads`, `seatPlayers`, `nameCtx`, `spectator`, side colors | rare |
| `SettingsContext` | `settings`, `bindings`, `updateSettings`, `debugOn`, `showLabels`, `showColliders` | rare |
| `ActionsContext` | all table handlers (replaces `table/actions.js`), hover handlers, popup openers, `showHudMessage` | never |
| `SelectionContext` | `selection`, `selectedTools` (setters are in `ActionsContext`) | on select |
| `DragContext` | `tokenDrag`, `toolDrag`, `toolSpawn`, `angleSpawn` (the point refs are in `TableContext`) | drag start, end |
| `SceneContext` (made by Scene) | model registry, `toggleSelect`, `dragSelect`, `rangeMarkOf`, `otherSelectedOf`, `getPieceLive`, `trayShape`, `trayPositions`, `toolModels` | rare |

Popup flags (`openCard`, `libraryOpen` and others) stay in App. They are DOM only, and Scene needs only the openers.

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

**Baseline (user, in the browser):** for each action, the counts after Reset.

| Action | App | Scene | TokenLayer | DiceTray | models (sum) | other |
|---|---|---|---|---|---|---|
| select a model | | | | | | |
| drag a model and drop it | | | | | | |
| drag a token and drop it | | | | | | |
| roll 3 dice | | | | | | |
| open and close a popup | | | | | | |
| other player moves a model | | | | | | |
| idle 10 s | | | | | | |

### 2. TableContext and doc slices read by the leaves

- New `src/table/TableContext.js`: context, `TableProvider`, `useTable()`. `App` wraps its JSX in it.
- `ScoreBoard`, `DiceTray`, `OtherDiceTray`, `TacticCard`, `TokenLayer`, `ToolRack`, `RosterCards`, `PriorityMarker`, `Terrain`, `LiveSync`, `RemoteCursor`, `Ping`: read `table`, `ownership`, `presence`, `live`, `pieceLives` from context, and read a doc slice with `useY*` when App does not need it.
- Remove the matching props from `App` → `Scene` → children.
- Check: no prop removed that a hook in App still reads.

**Result:**

### 3. SeatContext and SettingsContext

- New `src/table/SeatContext.js`, `src/settings/SettingsContext.js`.
- `sideColors.js` module store becomes part of `SeatContext`. `scene/look.js` becomes part of `SettingsContext`. Remove the old stores and their comments.
- Remove the matching props from Scene, Toolbar, SpectatorColumns.

**Result:**

### 4. ActionsContext with stable handlers

- New `src/useStableHandlers.js` with a node test (the function identity stays, the call reaches the latest closure).
- New `src/table/ActionsContext.js`. It replaces `table/actions.js` and `useTableActions()`; `Scene`, `TableButtons`, `Library`, `GameSetup` move to the context.
- Into the context: the handlers of the action hooks, the hover handlers of `useHovered`, the popup openers, the selection setters, `showHudMessage`.
- Remove the matching props from Scene, Toolbar, TokenLayer, OwnTools, CharacterTray, RosterCards, GameSetup.

**Result:**

### 5. SelectionContext and DragContext

- New `src/SelectionContext.js` (in `useSelection.js` if it fits), `src/drag/DragContext.js`.
- Readers: models, TokenLayer, OwnTools, ToolDragGhost, CardPopup peek, key state.
- Remove the matching props.

**Result:**

### 6. SceneContext

- Scene provides the registry, `toggleSelect`, `dragSelect`, `rangeMarkOf`, `otherSelectedOf`, `getPieceLive`, `trayShape`, `trayPositions`, `toolModels`. The value is memoized; the functions are stable (`useStableHandlers`).
- `TokenLayer`, `OwnTools`, `OtherTools`, `CharacterTray`, models read it. Their props go.
- Remove the `fallow` ignore `dup:aa079c9e:2` from `.fallowrc.json`.

**Result:**

### 7. memo boundaries

- `memo` on the components in decision 6.
- Check that the `apiRef` assignment (Scene:526) and the actions set do not depend on App rendering each time. Move `apiRef` to a layout effect with deps if needed.
- The user measures again with the counter from step 1. Numbers go in the Result, next to the baseline.

**Result:**

## User checks

- [ ] Everything works as before: select, drag, tools, dice, tokens, cards, setup, popups, two players.
- [ ] Debug panel: the baseline table again after step 7. Drag a token: DiceTray stays 0. Open and close a popup: Scene stays 0.
- [ ] Dev console: no new warnings.

## Open questions

1. React Compiler (`babel-plugin-react-compiler`) could replace the hand `memo` in step 6 and the `useMemo`/`useCallback` calls. It is a build change and touches every component. Proposal: not in this plan. A later plan, if you want it.
