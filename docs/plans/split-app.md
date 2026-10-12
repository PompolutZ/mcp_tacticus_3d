# Plan: Split App.jsx

Requested by the user on 2026-10-12. Status: work in progress on branch `split-app`. Branch `split-app`, from main, after `docs/plans/fallow-cleanup.md` merges into main. No other branch that edits `App.jsx` is open while this plan runs.

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step:

- `pnpm format`, `pnpm lint` (no more warnings than before the step), `pnpm test`, `pnpm --filter web build`.
- `grep -rn "App.jsx" apps/web/src apps/web/scripts docs/features`: a pointer to a moved name points to its new file.
- Review the move with `git diff --color-moved=dimmed-zebra --color-moved-ws=allow-indentation-change`. Moved code shows as moved, not as changed.

Line numbers are at `895496b` (`game-flow`). They can move a little after the merge. Find the code by name.

## Request

Fallow (see `docs/plans/fallow-cleanup.md`) reports `App.jsx` as the main risk of the repo:

- 2,748 lines. It is the file with the most commits (65), and the rate goes up.
- `App` (line 299): cyclomatic 85, cognitive 179, 99 hooks (32 `useState`, 7 `useEffect`, 5 `useMemo`, 55 custom).
- `handleKeyDown` (line 790): cyclomatic 54, 105 lines.

The user asked to split it. The behavior must not change.

## Facts

### Tests

- Web tests use `node:test` and `node:assert/strict`: `node --test "src/**/*.test.js"`.
- A module that imports `.json` without `with { type: 'json' }`, or uses `import.meta.glob`, does not load in Node. That rules out `characters/characters.js`, `tokens/tokens.js`, `crisis/cards.js`, `tactics/cards.js`, `rosters/cards.js` and `assets/index.js`. A pure helper takes such lookups as arguments, as `cleanupCrisisTokens(tokens, cardOf)` does.
- These load in Node: `setup/setup.js`, `setup/names.js`, `setup/rollOff.js`, `dice/faces.js`, `tokens/dropWait.js`, `characters/{files,models,trays,cleanup}.js`, `tactics/layout.js`, `selection.js`, `camera.js`.

### Lint and build

- `App.jsx` has one lint warning: line 614, `exhaustive-deps`, `placeTool` missing. It moves with its effect in step 8.
- The production build has no debug code today (`grep -c "Khronos PBR Neutral" dist/assets/*.js` gives 0). This works because `const debug = import.meta.env.DEV && debugOn` is a constant in `App`.
- No component uses `React.memo`. `Scene` writes its bridge refs (`characterAtRef` and others) on every render.

### Map of App.jsx

| Lines | Section | Owns |
|---|---|---|
| 153–190 | Constants | camera, roll off, `DEG`, drop geometry, `EMPTY_SQUAD`, `SETUP_REMOVAL` |
| 192–284 | Pure builders | `buildMatTokens`, `supplyToken`, `newCharacter`, `canvasEvents` |
| 311–335 | Seat, tool record | `isGuest`, camera start, `ownSide`, `playedSides`; `tools`, `poses`, active tool state, spawn state |
| 336–379 | View toggles, document fields, E1 | debug look, labels, spectator; `matTurns` … `rosters`; E1 seeds `table.rosters` |
| 380–446 | Setup view (E2), selection (E3) | `setup`, `hiddenSquads`, `mySide`, `nameCtx`, `priority`, `ownSquad`, `viewSetup`; `selection`, `selectedTools` |
| 447–559 | Pointer, camera, panels, log writers, HUD, drag state | `ownPing`, hover refs, held key maps, panel state, `writeLog`, `hudMessage`, `tokenDrag`, `toolDrag` |
| 560–646 | Settings (E4, E5), waiting tokens (E6), misc | `settings`, `waitLines`, `removeWaits`, Scene bridge refs, warnings, `ready` |
| 648–1017 | Lobby, mat, map, terrain, spawn, tools, hover, keys | `handleSpawn`, `placeTool`, key handlers 787–926, ping 950–958 |
| 1019–1295 | Flip key, crisis tokens, drop and wait, log data | |
| 1297–1490, 2000–2052 | Character actions | |
| 1319–1431 | Phases, Priority click | |
| 1500–1998 | Rosters, setup, squads, roll off (E8, line 1641), reveal (E9, line 1920), `setupActions` | `parsedRosters`, `breakdownThreats`, `seenThrows` |
| 2054–2330 | Table tokens, piles, tactic cards, token drag, tool drag | |
| 2332–2399 | Derived view, look effect (E10) | `selectedToken`, `openTray`, `popupBreakdown`, `debug`, `mode` |
| 2401–2745 | JSX | Canvas and Scene (about 125 props), Toolbar (about 40), popups, HUD, warnings |

**Effect order in one commit.** E2 and the `useWindowKeys` handler update are layout effects and run first. Then the passive effects run: E1, E3, E4, E5, E6, the window listeners (mount only), E8, E9, E10. E8 must run before E9: a remote update can carry a throw and a setup change together, and E9 reads what E8 wrote.

**Calls between groups form a chain with no cycles.** The hooks are called in this order: base (seat, document, writer, HUD, selection, hover), tools, crisis tokens (uses `placeTool`), characters (uses the drop functions and `removeWaits`), table pieces, phases, roll-off reader, setup (uses character remove, crisis change, card piles, mat turn), token drag (uses give, supply take, table token remove), keys (uses all).

## Decisions

1. **Move code without changing it.** A function body moves as it is. The hook result is destructured back into the same names, so call sites and the JSX stay the same.
2. **No `useCallback`, `useMemo` or `memo` is added.** Handlers are created again on every render, as today. Drag callbacks keep the closure of the render where the press happened. The "latest ref" pattern is not used.
3. **Every builder that runs during render gets a `use*` name**, also if it has no React hook inside yet. Then the rules-of-hooks lint keeps the call order fixed.
4. **Each moved effect keeps its place in the call order and its deps array**, including the `eslint-disable` comment of E9. Only the window-listener mount effect moves later; it runs once, so this changes nothing.
5. **`debug` stays a constant in `App`**, so the build still drops the debug code. Each build checks the grep in "Lint and build".
6. **`breakdownChoice` lives in a component that is always mounted** (`RosterPopupHost`). If `RosterPopup` owned it, closing the popup would lose the choice.
7. **Pure logic gets `node:test` tests** next to its file.
8. **No move that only shifts lines.** The Canvas/Scene and Toolbar JSX stay in `App`. Wrapping them would pass the same 100+ props one level down.
9. **Name clashes.** The log writer object is not named `log` (that is the Yjs list). The pure helpers are named `squadChoiceBlock`, `waitLinesOf` and `tokenDropTarget`, so they do not shadow `squadBlock`, `waitLines` and `tokenDrag`.
10. **The user tests at the end** of the plan, with the lists under "User" of every step. The user can also test after any step.

What stays in `App` (about 600 lines, about 340 of them JSX): props, the seat call, the `useY*` reads, E1, E2, `seatPlayers`, `nameCtx`, `priority`, popup and panel state, `showLabels`, `spectator`, `debugOn`, `softwareRenderer`, `ready`, `preloadFiles`, `pieceLives`, the Scene bridge refs, `handleLobby`, `handleRosterOpen`, `handleAttachedOpen`, `handleRosterCardStep`, the `resetCamera` wrapper, the derived values, a new `overlayOpen` (replaces the same drag/popup check at 795 and 2640), the JSX.

## Risks

1. **Stale closures are part of today's behavior.** For example, a give by drag reads `characters` of the render where the drag started. Decisions 1 and 2 keep this. Do not change a handler from React state to a document read (`table.X.read()`), or back.
2. **Temporal dead zone.** Function declarations are hoisted; `const` values from hooks are not. Objects built during render (`setupActions`, the key action table, Scene props) come after the hooks that give their values.
3. **Effect order**: decision 4.
4. **Seat edge case.** A multiplayer room with `side: null` gives `hiddenSquads = true` and `mySide = null`. Never derive "hidden" from `mySide`.
5. **`forEach(handleCharacterRemove)` passes the index as the second argument.** Do not add parameters to `handleCharacterRemove`.
6. **OrbitControls props.** R3F applies a prop again when its reference changes. `startView` and `CAMERA_MOUSE_BUTTONS` stay module constants.
7. **StrictMode** calls render and state updaters twice. A pure helper called during render must not call `crypto.randomUUID`. Ids are created where they are today.
8. **`HudWarnings` renders the same `.hud-warnings` div in the same place**, so the CSS still applies.

## Step 1: Pure builders

Work:

1. New `src/crisis/matTokens.js`: `buildMatTokens`, `supplyToken`, `DEG` and the drop constant at line 177 (lines 177, 192–246).
2. New `src/characters/newCharacter.js`: `newCharacter` (248–270). Test `newCharacter.test.js`.
3. Pointers: `setup-game.md:211`, `peer-to-peer.md:297`, `livePose.js:100`, `CrisisToken.jsx:121`, `scripts/yjs-size.mjs:14`.

User: change a crisis card in the toolbar; Edge with Red Priority turns the tokens; take a token from a supply pile; spawn a character from the Library; reveal a squad.

### Result

`buildMatTokens`, `supplyToken` and `DEG` moved to `src/crisis/matTokens.js`. `DEG` is the only constant they need; `DROP_GAP`, `TOKEN_RADIUS` and `TOKEN_ROW_SPACING` stay in `App.jsx`, the drop code uses them. `SUPPLY_YAW` is imported from `net/livePose.js`. `newCharacter` moved to `src/characters/newCharacter.js`, with 4 tests. It loads in Node. Bodies are unchanged. Pointers fixed in `setup-game.md`, `peer-to-peer.md`, `livePose.js`, `CrisisToken.jsx` (it named `buildCardTokens`, an old name) and `yjs-size.mjs`.

Checks: `pnpm format`, `pnpm lint` (45 warnings before and after), `pnpm test` (528 web tests pass), `pnpm --filter web build`, debug grep 0.

## Step 2: Seat, camera, canvas events

Work:

1. New `src/rooms/seat.js`: `tableSeat(room)` → `{ multiplayer, isGuest, ownSide, playedSides, hiddenSquads, mySide }` (311–318, 398–399, 597). Test, with a multiplayer room with `side: null`.
2. `src/camera.js`: the camera constants (165–176, and the comment at 153–159 that belongs to them), `startView(isGuest)`, `resetView(controls, wheelCamera, view)` (917–926). Tests with a fake `controls` object.
3. New `src/components/canvasEvents.js`: `canvasEvents` (272–284).
4. `App` keeps its local names.
5. Pointers: `key-shortcuts.md:36`, `:97`, `character-trays.md:110`.

User: the start view as Blue, and as the Red seat of a multiplayer room; Space during a wheel zoom; left/right drag turns, middle drag pans; a click on an Html button does not select the top-left roster card.

### Result

`tableSeat(room)` is in the new `src/rooms/seat.js`. It gives `multiplayer`, `isGuest`, `ownSide`, `playedSides`, `hiddenSquads` and `mySide`, with the same expressions as before. `hiddenSquads` and `mySide` now come from the seat call at the top of `App`, not from their old place further down. Nothing between used them. 5 tests, among them a multiplayer room with `side: null` (hidden squads, no side).

`src/camera.js` got the camera constants with their comments, `startView(isGuest)`, `CAMERA_MOUSE_BUTTONS` and `resetView(controls, wheelCamera, view)`. `startView` returns one of two module objects `{ position, target }`, so the references stay stable (Risk 6). `App` destructures it into `cameraPosition` and `cameraTarget`, and `resetCamera` calls `resetView`. 6 tests with a fake `controls`.

`canvasEvents` moved unchanged to `src/components/canvasEvents.js`. It imports `@react-three/fiber`, so it has no test. `App.jsx` no longer imports `MOUSE` or `pointerEvents`.

Pointers fixed: `key-shortcuts.md` (two), `character-trays.md:110`.

Checks: `pnpm format`, `pnpm lint` (45 warnings before and after), `pnpm test` (539 web tests pass, 11 new), `pnpm --filter web build`, debug grep 0.

Deviations: `resetCamera` stays as a one-line wrapper in `App`, and it calls `startView(isGuest)` again (same object). `resetView` keeps the order of the old code: no controls means no wheel stop.

## Step 3: Settings, Log panel state, HUD message, warnings, debug look

Work:

1. `src/settings/useSettings.js` (560–573): `{ settings, handleSettingChange, handleVolumeChange }`. Called where E4 is now.
2. `src/log/useLogOpen.js` (474–479): `[logOpen, setLogOpen]`.
3. `src/components/useHudMessage.js` (497–500, 1492–1498): `{ hudMessage, showHudMessage }`.
4. `src/components/HudWarnings.jsx` (635–642, 2686–2732): owns `storageWarning`, `closedServerWarning`, `versionClosed`. Props: `storageFailed`, `serverWarning`, `versionMismatch`, `softwareRenderer`, `onSoftwareRendererClose`. Risk 8.
5. `src/debug/useDebugLook.js` (337–341, 2396–2399): `(debug)` → `{ mode, panel props }`. Decision 5.
6. Pointer: `index.css:609`.

Checks: as in "Checks", plus the debug grep after the build gives 0.

User: tool places and volume stay after a reload; the Log chip state stays after a reload; a HUD message shows (L on terrain); close each warning (software rendering: Chrome with hardware acceleration off); in dev, the Debug panel: modes, tone mapping, surface.

### Result

`useSettings` is in `src/settings/useSettings.js`: the settings state, the two change handlers and the volume effect (E4), called where E4 was. `settingsOpen` stays in `App`. `useLogOpen` is in `src/log/useLogOpen.js` and returns `[logOpen, setLogOpen]`. `useHudMessage` is in `src/components/useHudMessage.js`; `showHudMessage` moved with it (it was a function declaration further down, now a destructured const that comes earlier, so it is never used before it exists).

`HudWarnings` is in `src/components/HudWarnings.jsx`. It owns `storageWarning`, `closedServerWarning` and `versionClosed`, with the reset of `versionClosed` during render. It renders the same `.hud-warnings` div, in the same place, with the same markup. `softwareRenderer` and `versionMismatch` stay in `App` (Scene sets the first). `useDebugLook(debug)` is in `src/debug/useDebugLook.js`. It owns `renderMode`, `toneMapping`, `surface` and the look effect (E10), and returns `{ mode, panel }`. `debug` and `debugOn` stay in `App`, and `{debug && <DebugPanel {...debugPanel} />}` stays in the JSX.

Pointers fixed in `index.css` (two comments) and `components/look.js`.

Effect order in `App` is the same as before: E-top (259), layout effect, 320, settings (E4, now inside `useSettings`), 479, window keys, E8, E9, look (E10, now inside `useDebugLook`).

Checks: `pnpm format`, `pnpm lint` (45 warnings before and after), `pnpm test` (539 web tests pass), `pnpm --filter web build`, debug grep 0 in all files.

Deviations: the three debug `useState` calls moved from the top of `App` to the E10 place, because the hook is called there. They are state only, so no effect order changes. `DebugPanel` is still imported in `App`, behind `debug`.

## Step 4: Log writer, selection

Work:

1. New `src/log/writer.js`: `logWriter(table, mySide)` → `{ writeLog, writeStatLog, characterLogData, tokenEntryData, writeHeldLog }` (483–496, 1277–1295). Decision 9.
2. New `src/useSelection.js`: `selection`, `selectedTools`, E3 (436–446). Takes `presence`.

User: Log entries for Damage and Power (quick clicks merge into one), flip, tokens, held tokens, phases; in two browsers, the selection outline and the selected tools show.

### Result

`logWriter(table, mySide)` is in the new `src/log/writer.js`. It is a plain function with no hooks. It returns `writeLog`, `writeStatLog`, `characterLogData`, `tokenEntryData` and `writeHeldLog`. `App` destructures them into the same names, where `writeLog` was. Bodies are unchanged. `useSelection(presence)` is in the new `src/useSelection.js`: `selection`, `selectedTools`, their setters and the presence effect (E3), called where they were. `App` keeps the `selection` comment and no longer imports `presenceSelection`, `presenceTools` or `addStatEntry`.

Effect order in `App` is the same as before: E1, layout effect (E2), E3 (now inside `useSelection`), `useLogSounds`, `useRemoteDropSounds`, the wait effect (E6), the window keys, E8, E9, look (E10 inside `useDebugLook`).

Checks: `pnpm format`, `pnpm lint` (45 warnings before and after), `pnpm test`, `pnpm --filter web build`, debug grep 0. No pointers needed.

Deviations: no `writer.test.js`. `writer.js` imports `characters/characters.js` and `tokens/tokens.js`, which do not load in Node.

## Step 5: Hover, card peek, ping

Work:

1. New `src/useHovered.js`: the 8 hover refs and their handlers, as they are (351, 450, 509–532, 682–685, 774–778, 1148–1157, 2056–2059, 2089–2092, 2139–2142, the inline handler at 2525–2528). It also returns `current()`, a snapshot of all hovers.
2. New `src/components/useCardPeek.js` (524–530, 781–785): `{ peekCard, handleCardHover, altDown(blocked), altUp() }`. The key handlers call `altDown` and `altUp`.
3. New `src/components/usePing.js` (447–448, 950–958): takes `presence`, `toolPointRef`.

User: Delete over each of the 6 kinds (table token, held token, pile, tactic card, terrain, tray card); F over a token, a held token, a model, a tray card, a tactic card, and over nothing (the last selected); Alt peek on each card kind; Cmd+Tab while holding Alt closes the peek; P; number keys over the own and the other dice tray.

### Result

`useHovered` is in `src/useHovered.js`. It owns the 8 hover refs and their 8 handlers (`handlePieceHover`, `handleTerrainHover`, `handleHeldHover`, `handleTrayCardHover`, `handleLooseHover`, `handlePileHover`, `handleTacticHover`, `handleDiceTrayHover`), with the bodies unchanged. The inline dice tray handler in the JSX became `handleDiceTrayHover`, same body. It also returns `current()`, a snapshot `{ piece, terrain, loose, pile, tactic, held, trayCard, diceTray }` read from the refs at the call. `current()` is not used yet (step 6). `App` destructures everything back into the same names, where `hoveredRef` was.

`useCardPeek` is in `src/components/useCardPeek.js`: `hoveredCardRef`, `altHeldRef`, `peekCard`, `handleCardHover`, `altDown(blocked)`, `altUp()`. In `handleKeyDown`, `e.preventDefault()` stays in `App`, then `altDown(blocked)` with the same condition, then `return`. `handleKeyUp` and `handleBlur` call `altUp()` (the Cmd+Tab and window blur path goes through `handleBlur`, same two lines as before). `usePing(presence, toolPointRef)` is in `src/components/usePing.js`: `ownPing` and `handlePingKey`.

Effect order in `App` is the same as before: E1, layout effect (E2), E3 (inside `useSelection`), `useLogSounds`, `useRemoteDropSounds`, the wait effect (E6), the window keys, E8, E9, look (E10 inside `useDebugLook`). The three new hooks have refs and state only, no effect.

Pointers fixed: `keyboard.js`, `docs/features/ping.md`, and the Alt comments in `CardPopup.jsx`, `CharacterTray.jsx`, `CrisisCard.jsx`, `GameSetup.jsx`, `RosterCards.jsx`, `TacticCard.jsx`.

Checks: `pnpm format`, `pnpm lint` (45 warnings before and after), `pnpm test`, `pnpm --filter web build`, debug grep 0 in all files.

Deviations: `usePing` is called after `toolPointRef` (it needs it, Risk 2), not at the old place of `ownPing`. This moves only a `useState`. `hoveredCardRef` and `altHeldRef` stay inside `useCardPeek` and are not returned. `current()` has the 8 hovers of `useHovered`, not the card hover.

## Step 6: Keys

Needs step 5.

Work:

1. `src/keyboard.js`: `keyAction(e, state)`, a pure function. It returns `{ action, preventDefault?, … }` or null. The first match wins, in today's order:
   - Alt → `peek`, with preventDefault (also during drags and popups).
   - A drag: only Escape, which cancels it. A token drag wins over a tool drag.
   - A popup: Escape closes the popups. Arrow keys step roster cards only when the roster popup is open; with a card or tray popup open, they do nothing and do not pan.
   - Escape: dice menu, then Library, then Log, then the table Escape. Escape skips the next guard.
   - Cmd, Ctrl, Alt held, or a text field: nothing.
   - Table keys: Delete (also on repeat), pan, turn, Space reset (preventDefault, also on repeat; acts only on the first press), rotate (held part on repeat, the piece turn only on the first press), then on the first press only: F, R, L, P, dice keys over the own tray (before 6 and 0), range keys, move keys, the angle key, the clear key.
2. New `src/hover.js`: `deleteTarget(h)` (order: table token, held token, pile, tactic card, terrain, tray card) and `flipTarget(h, selection)` (the exact `??` / `&&` chain at 1024–1029).
3. New `src/useTableKeys.js`: owns `heldPan`, `heldTurn`, `heldRotate` (452–455). Key down: `keyAction(e, state())`, then preventDefault if asked, then the action from a table of handlers. Key up and window blur stay as they are. `state` is a function called at the key press, because `overDiceTray` reads a ref. **`useTableKeys` is the last hook call before `return`.**
4. Tests: `keyboard.test.js` covers the list above, plus: the code tables `PAN`, `TURN`, `ROTATE`, `RESET` and `PRESS` do not overlap. `hover.test.js` covers both target orders.
5. Pointers: `keyboard.js:3`, `:32`, `:37`, `:39`, `:44`; `key-shortcuts.md:18`; `ping.md:25`.

User: every key of `docs/features/key-shortcuts.md`, also in a text field, with Cmd or Ctrl held, and on key repeat (holding F flips once); Cmd+Tab while holding W stops the pan.

### Result

`keyAction(e, state)` is in `src/keyboard.js`. It is pure. It returns `{ action, preventDefault?, ... }` or null, with the first match in the order of the old `handleKeyDown`. `PRESS_KEYS` (F, R, L, P → action name) is new there, so the first-press keys have a code table. `useWindowKeys`, the key constants and `isEditing` stay in `keyboard.js`.

`src/hover.js` has `deleteTarget(h)` and `flipTarget(h, selection)`. `deleteTarget` is the same `if` chain, so a falsy id is skipped. `flipTarget` is the same `??` / `&&` chain, so a falsy id other than null or undefined stops it. `handleFlipKey` stays in `App`, its body calls `flipTarget(hoveredNow(), selection)` instead of the inline chain. `hoveredNow` is `current()` of `useHovered`. The seven hover refs that only the key handler read are no longer destructured in `App`.

`src/useTableKeys.js` owns `heldPan`, `heldTurn` and `heldRotate`, the new `handleKeyDown` (run `keyAction`, `preventDefault` if asked, call the handler), and `handleKeyUp` and `handleBlur` unchanged. It calls `useWindowKeys` itself. It handles pan, turn and rotate; `App` gives a table for the other actions, `state()` and `altUp`. The table, `state` and `deleteHandlers` are built in `App` after `useDebugLook`, and `useTableKeys` is the last hook call before `return`. Handler bodies stay in `App` as before. The table is built on every render, no `useCallback`.

Effect order in `App`: E1, layout effect (E2), E3 (inside `useSelection`), `useLogSounds`, `useRemoteDropSounds`, the wait effect (E6), E8, E9, look (E10 inside `useDebugLook`), then the window handler update (layout) and the window listeners (mount only) in `useTableKeys`. Only the last one moved (Decision 4). The layout handler update also moved to the end; it runs before every passive effect in any case.

Tests: `keyboard.test.js` (22) covers Alt peek during drags and popups, drag-only Escape with the token drag over the tool drag, popup rules with arrow keys only for the roster popup, the Escape chain, the modifier and text field guard, Escape skipping it, Delete on repeat, pan and turn on repeat, Space (first press and repeat), Q / E, F R L P on repeat, tool keys, dice keys over the own tray before 6 and 0, and that the code tables PAN, TURN, ROTATE, RESET and PRESS do not overlap. `hover.test.js` (7) covers both target orders and falsy ids. Both load in Node.

Pointers fixed: `keyboard.js` (the header and the Delete comment), `key-shortcuts.md:18`, `roster.md:156`, and three `handleKeyDown` comments in `App.jsx`. `ping.md:25` and the other `keyboard.js` comments (`handleFlipKey`, `handleLockKey`, `handlePingKey`) were already right.

Checks: `pnpm format`, `pnpm lint` (45 warnings before and after), `pnpm test` (568 web tests pass, 29 new), `pnpm --filter web build`, debug grep 0.

Differences of the plan list to the code (the code won, no code change):

- The popup rule holds for any popup: card, tray, roster and settings. The plan names card and tray.
- The Alt peek passes `blocked` for the same four cases (drag, popup) and calls `preventDefault` first, as the code did.

Deviations: the table keys `pan`, `turn` and `rotate` are handled in `useTableKeys` and not in the `App` table, because the held maps live there. The Space reset action is returned also on repeat (with `first: false`), so `preventDefault` runs on repeat as before. `overlayOpen` (planned for the end) is not part of this step.

## Step 7: Table tools

Work:

1. New `src/tabletools/useTableTools.js`: the tools record, `angleSpawn`, `toolSpawn`, `toolDrag` and its refs, `placeTool`, `placeAngleTool`, the tool handlers (319, 322–335, 552–559, 717–771, 928–948, 960–1017, 2220–2274). Takes `{ table, ownSide, playedSides, characters, selection, setSelection, selectedTools, setSelectedTools, hoveredRef, toolPointRef, controlsRef }`. Called after the hover and selection hooks.
2. Pointers: `ToolRack.jsx:12`, `:221`; `Scene.jsx:251`.

User: the toolbar range, move and angle buttons; tool keys over a model (in multiplayer, the other side's model snaps but is not selected) and over a table point; 0; Escape; rack drag, drop on the HUD or the rack, chip click, return to the rack, Escape during the drag.

### Result

New `src/tabletools/useTableTools.js` holds the tools record, `angleSpawn`, `toolSpawn`, the tool drag state and refs, `toolbarSpawnAt`, `setOwnTool`, `spawnTool`, the toolbar handlers, `handleEscape`, `clearTools`, `keySelects`, the key handlers, `placeAngleTool`, `placeTool`, `startToolDrag`, `endToolDrag`, `handleToolDrop` and `handleToolReturn`. Bodies are unchanged. `App` destructures the result into the same names. The call stands right after `usePing`, after the selection and hover hooks and before E6, so E6 still uses `placeTool` and keeps its lint warning.

Args: the planned ones, all used. The hook also returns `toolDragHandleRef` (the key table cancels the drag with it) and `handleEscape`. Pointers fixed in `ToolRack.jsx` (2) and `Scene.jsx`.

Effect order is the same: the hook has no effect. Only the store subscription of `useYRecord(table.tools)` now runs later among the passive subscriptions, which have no order dependence.

Checks: `pnpm format`, `pnpm lint` (45 warnings before and after), `pnpm test` (568 web tests pass), `pnpm --filter web build`, debug grep 0.

## Step 8: Crisis tokens, drop and wait

Needs step 7.

Work:

1. New `src/crisis/useCrisisTokens.js`: E6 (576–615) at its current place in the call order, the crisis token handlers and the drop functions (1036–1145, 1159–1275). Returns `waitLines`, `removeWaits`, the handlers, `dropWait`, `placeTokens`. The `placeTool` lint warning moves with E6.
2. `src/tokens/dropWait.js`: `TOKEN_RADIUS`, `DROP_GAP`, `TOKEN_ROW_SPACING`, `dropRowOffset(i, n)`, `droppedToken(token, { pos, baseRadius, rowOffset, wait })`, `waitLinesOf(tokens, characters, { playedSides, nameCtx, nameOf, tokenNameOf })`. Tests.

User: TokenPanel flip, control, damage; hold and drop on a card; a Dazed token drops held tokens, with the notice, the sound and the Range 2 tool; Show pans; Done places; Remove with held tokens waits.

### Result

## Step 9: Character actions

Needs step 8.

Work:

1. New `src/characters/useCharacterActions.js` (703–715, 1297–1317, 1433–1490, 2000–2052): spawn, Damage, Power, flip, give, token remove, off board, Remove. Uses `handleDropCharacterTokens`, `dropWait`, `removeWaits`. Risk 5.

User: Damage and Power limits, flip, Remove, Delete of a tray card, give by drag and by a Give click, the immunity message, Activated changes the Cleanup Priority, the duplicate spawn message.

### Result

## Step 10: Table pieces

Work:

1. New `src/useTablePieces.js` (655–680, 687–692, 1818–1840, 2061–2064, 2094–2097, 2099–2137): map, mat turn, lock, terrain, table tokens, piles, tactic cards, card piles.
2. `src/tactics/layout.js`: `cardPiles(cards, piles, tokensOf)`. Test.

User: map change, mat turn, L, Delete of terrain, table tokens, piles and tactic cards; a tactic card snaps into a slot; F on a tactic card; tactic card piles come and go with their card.

### Result

## Step 11: Phases

Work:

1. New `src/game/usePhaseActions.js` (1319–1431): Power phase, Cleanup phase, Priority click, `cleanupDisabled`, `cleanupTitle`.
2. New `src/game/phases.js`: `cleanupStatus(characters, poses, nameOf)`, `powerPhaseText`, `cleanupText`. Test.

User: Power (toolbar and table buttons) and its texts; the Cleanup button state and title, the round, the flips, the Priority note; a click on the Priority marker.

### Result

## Step 12: Roll-off reader

Work:

1. New `src/setup/useRollOffReader.js`: the roll-off constants (160–163), `seenThrows`, E8 (1636–1673), at E8's place in the call order. Takes `{ table, rolls, mySide }`.
2. `src/setup/rollOff.js`: `hasFreshThrow(rolls, seen, now)`, `shelfSymbols(dice)` (null unless both shelves hold 5 dice). Tests.
3. `src/setup/setup.js`: `EMPTY_SQUAD`, `squadChoiceBlock(setup, team, { hidden, mySide })`, `viewerSetup(setup, { hidden, mySide, ownSquad })`, `ownSquadOf(stored, setup, mySide)`. Tests. `App` keeps thin wrappers `squadBlock(team)`, `viewSetup`, `ownSquad`.

User: roll off with 5 and 5 dice: the result, the Priority marker, one Log entry also with two browsers, a tie; old throws do not count when the table opens.

### Result

## Step 13: Game setup

Needs steps 10 and 12.

Work:

1. New `src/setup/useGameSetup.js` (188–190, 408–431, 1500–1538, 1545–1634, 1675–1961): `storedSquad`, E9 with its `eslint-disable` comment, `setupActions`. Returns `viewSetup`, `ownSquad`, `parsedRosters`, `setupActions`, roster load and remove, squad toggle, Breakdown choose, `squadBlock`. **Called after `useRollOffReader`.**
2. Pointers: `setup-game.md:169`, `:198`, `:211`; `squad-breakdown.md:142`; `setup.js:412`; `GameSetup.jsx:428`, `:507`.

User: the whole setup in the Sandbox and in two browsers: load and remove a roster (with the confirm), deck, picks, threat, edge, +/✓, Ready rules, reveal, Deploy Lock, affiliation, Prev/Next, Override, Restart; hidden squads; "Your squad choice is not in this browser".

### Result

## Step 14: Token drag

Needs steps 8, 9 and 10.

Work:

1. New `src/drag/useTokenDrag.js` (536–551, 2066–2087, 2144–2218, 2276–2330): `tokenDrag`, its 3 refs, the drag starts and the release. Uses give, supply take, table token remove, `ownership`, `pieceLives`, `controlsRef`. Called after the hooks of steps 8–10.
2. New `src/drag/tokenDrop.js`: `tokenDropTarget(drag, { characterId, point })` → `movePile`, `newPile`, `supplyHeld`, `supplyTable`, `give`, `moveLoose`, `newLoose` or null. Test.
3. Pointers: `Scene.jsx:240`, `:254`; `CharacterTray.jsx:52`; `Library.jsx:52`; `SupplyPile.jsx:23`; `library.md:84`.

User: a drag from a Give source, the Library (single and pile), a pile, Shift + pile, a table token and a supply pile, onto a model, a tray, the table, the HUD and off the table; Escape cancels; a click on Give gives 1; in two browsers the claim is refused.

### Result

## Step 15: Roster popup host

Needs step 13.

Work:

1. New `src/components/RosterPopupHost.jsx` (391–394, 1540–1544, 2336–2388, 2651–2665): `breakdownChoice`, the `breakdownThreats` memo, the popup. Decision 6.
2. Pointers: `squad-breakdown.md:131`, `roster.md:156`, `:160`.

User: the Breakdown threat and filters stay after the popup closes and opens again, and reset with a new roster code; the tab falls back after the squad is placed; Add to squad; arrow keys; Escape.

### Result

## Step 16: Final run

Work:

1. A comment at the top of `App`: the hook call order and why (E8 before E9, keys last).
2. Remove leftover imports.
3. Run `pnpm fallow`. Write in the Result: the lines of `App.jsx`, the numbers of `App` and of the new hooks (cyclomatic, cognitive, hooks), the count of functions above the thresholds.

User: the full test, all the "User" lists above.

### Result

## Open questions

None.
