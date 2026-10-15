# Plan: Remove duplicates

Requested by the user on 2026-10-15. Status: in progress. Branch `remove-duplicates`, worktree `../mcp_assist_3d-remove-duplicates`, from main after `docs/plans/review-fixes.md` and `docs/plans/split-large-files.md` merge into main. The plan touches many files, so no other branch is open while it runs.

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step:

- `pnpm format`, `pnpm lint` (no more warnings than before the step), `pnpm test`, `pnpm --filter web build`.
- `pnpm fallow dupes`: no new clone group. The groups that the step removes are gone.
- `grep -rn "<old name>" apps/web/src apps/web/scripts docs/features`: a pointer to a moved or removed name points to its new place.

Line numbers are at `4698e42`. The two earlier plans move code: Scene.jsx parts go to hooks and layers, RulerTool `Tool` goes to hooks and `toolGeometry.js`, `useDragTool` and `useRestStore` go to `tabletools/`, the Table.jsx effect goes to `rooms/openTableSession.js`, GameSetup text builders go to `setup/setupText.js`. Find the code by name, not by line. Paths are under `apps/web/src` unless they start with `scripts/`, `docs/` or `infra/`.

## Request

The user: "code duplication without any reason is a design smell". Every rule, constant, helper and UI shell gets one source. The behavior does not change, except where a copy was wrong. The step says so then.

## Facts

### Tests

- Web tests use `node:test` and `node:assert/strict`: `node --test "{src,scripts}/**/*.test.js"`.
- A module that imports `.json` without `with { type: 'json' }`, or uses `import.meta.glob`, does not load in Node. That rules out `crisis/cards.js`, `tactics/cards.js`, `rosters/cards.js`, `characters/characters.js`. A pure helper that needs their data takes it as an argument. `setup/setup.js` has no imports. `scoreboard/affiliations.js`, `physics.js`, `sideColors.js` load in Node.

### Sides and colors

- `setup/setup.js:5` exports `TEAMS = ['host', 'guest']` and `otherTeam` (line 8). Local copies of the list: `Library.jsx:17`, `Lobby.jsx:17`, `NewRoomDialog.jsx:19`, `RoomPlayers.jsx:4`, `Toolbar.jsx:14` (as `[{ team }]`). Inline lists: `tactics/layout.js:58`, `:142`, `setup/rollOff.js:51`, `crisis/useCrisisTokens.js:62`, `ScoreBoard.jsx:255`, `TokenPanel.jsx:31`, `Scene.jsx:381`, `:1546`, `rooms/seat.js:19`.
- Inline copies of `otherTeam`: `SpectatorColumns.jsx:116`, `Scene.jsx:1093`, `:1238`, `:1256`, `TableButtons.jsx:14` (local `otherSide`), `tokens/dropWait.js:17`.
- `crisis/useCrisisTokens.js:62` computes `multiplayerRoom ? [ownSide] : ['host', 'guest']`. This is `playedSides` of `rooms/seat.js:19`.
- `COLOR_HEX` in `sideColors.js:10` is `#2980b9` / `#c0392b`. `index.css` writes these two again 8 times (`.log-entry--`, `.chip--player-`, `.roster-popup-title--`), plus hover shades `#2471a3` / `#a93226` (`.chip--player-*:hover`) and light text `#5dade2` / `#ec7063` (`.lobby-seat--`, `.room-player--`). `SelectionOutlines.jsx:46`, `:53` write them again as `0x2980b9` / `0xc0392b`.

### Rules in UI

- Squad ready: `GameSetup.jsx:463` (message) and `useGameSetup.js:350` (`handleSquadReady`) check "no character" and "threat above Maximum Threat" each.
- Affiliation choices: `GameSetup.jsx:332` and `useGameSetup.js:428` (`handleSetupAffiliation`) each build "squad keys, then `DEFAULT_AFFILIATION`".
- `GameSetup.jsx:540` parses both rosters again. `useGameSetup` returns `parsedRosters`, and App passes it to other components (`App.jsx:1039`, `:1050`, `:1061`).
- `App.jsx:659` (`wheelState`), `:677` (`useTableKeys` state) and `:1011` (peek card) write the same 7-part "a popup is open" check.

### Dialogs

- `CrisisChoose.jsx:24`, `CrisisCompare.jsx:51`, `NewRoomDialog.jsx:115`, `RosterPopup.jsx:62`, `SettingsPopup.jsx:59` copy one shell: `Overlay`, `pressedBackdrop` ref, backdrop click, `×` button, inner element with `role="dialog"`, `aria-modal`, `aria-label`. Fallow groups `dup:38066dd5`, `dup:08a51ea4`, `dup:c86dd1d0`. `TrayPopup.jsx:72` has the same parts in another form (close button inside, `stopPropagation`).
- No dialog moves focus. Focus stays behind the dialog, and Tab leaves it.
- Escape: on the table, the rebindable `cancel` action (`input/bindings.js:208`, `keyboard.js:40`) closes popups. `key-shortcuts.md:137` says: a user who removed Escape closes the popup with its close button. In the lobby, `NewRoomDialog.jsx:68` and `RoomRosterPopup.jsx:19` have their own window listener (Escape and arrows). `KeyBindings.jsx:137` captures keys on window in the capture phase while a capture runs.
- `.hud-notice`, `.hud-warnings`, `.phase-buttons` (z-index 600) stack above `.card-popup` (400). So HUD messages show above popups today.
- The web app has no React Aria package.

### Card data

- 16 of 400 ids in `tactics/cards.json` have 7 digits. `migrate-tactics.mjs` `cardEntry` writes `card.ID` as it is. Readers pad: `rosters/cards.js:29`, `tactics/cards.js:13`, `Library.jsx:100`, `scripts/fetch-jarvis-tactics.mjs:71`. The comment at `rosters/cards.js:27`, `docs/features/roster.md:70` and `scripts/README.md:414` say "three ids". That count is wrong. All 45 crisis ids have 8 digits.
- `Library.jsx:77` searches `card.id.startsWith(q)`. A search for the 8-digit code of one of the 16 cards finds nothing today.
- "Current printing is `replacedBy: null`": `crisis/cards.js:13`, `rosters/cards.js:115`, `scripts/migrate-crisis.mjs:63`.
- Two crisis lists: `crisis/cards.js` `CARDS` (threat from `crisis/cards.json`, written by `migrate-crisis.mjs:198`) and the crisis rows of `rosters/cards.js` (threat from Jarvis `threatLevel`). Today the 45 values are equal. `migrate-crisis.mjs:326` warns when they differ.
- Tactic rows: `tactics/cards.js` (`GEM_CODES` from Jarvis) and `rosters/cards.js:97` (first Jarvis row per code, `isInfinityGem`). Jarvis tactic rows have no `replacedBy`. The "first row" rule is correct for tactics.

### Storage

- Same try/catch read and write of JSON: `rooms/store.js:19-36`, `settings/settings.js:90-106`, `log/open.js` (stores `'1'` / `'0'`).
- `auth/session.js:2` says it is the only file that touches `localStorage` and `sessionStorage`. That is false. Its calls at lines 37, 42, 76, 103, 120 have no try/catch. With storage turned off, they throw.
- `settings/useSettings.js:9-39`: six handlers, each `next = { ...settings, X }`, `setSettings`, `writeSettings`.
- `Library.jsx:89-95` copies the timer of `components/useHudMessage.js`. The hook's comment says so.

### 3D code

- `CharacterModel.jsx:305` writes its own `rigidRef` and `liveRb`. `useBodyRef.js` gives both, and clears the ref on unmount.
- `DeployRangeTool` (`RulerTool.jsx:639`) repeats `useRangeParts` (`:629`) with mesh 3.
- Screen pixel to NDC: `drag/tablePoint.js:13`, `Scene.jsx:576`, `:638`, `RulerTool.jsx:354`, `:405`.
- Nearest raycast hit: `Scene.jsx:582` (`characterAt`), `:613` (`terrainUnder`), `RulerTool.jsx:1181` (`modelUnder`).
- `setBodyType(0)` / `setBodyType(2)`: `CharacterModel.jsx:473`, `:495`, `:658`, `:724`, `:755`, `:776`, `Scene.jsx:746`, `:831`, `:838`, `RulerTool.jsx:387`. `DiceTray.jsx` uses `rapier.RigidBodyType`.
- Host deleted the room: `Table.jsx:245` and `:289` run the same three lines (`close`, `deleteDoc`, `exit`).

### More found with grep and fallow

`pnpm fallow dupes` at `4698e42`: 11 groups, 256 lines. Beyond the dialogs:

- Pointer follow ghost: `TokenDragPreview.jsx:30` and `ToolDragGhost.jsx:30` (window `pointermove`, `tablePoint`, `pointRef`, visibility).
- Hover report effect `if (!hovered) return; onHover?.(true); return () => onHover?.(false)`: `CharacterModel.jsx:706`, `TacticCard.jsx:208`, `CrisisToken.jsx:375`, `Terrain.jsx:313`, `TurnHandle.jsx:10`, `TokenFace.jsx:55`, `LosTool.jsx:325`, `RulerTool.jsx:1169`. `LosTool.jsx:333` and `RulerTool.jsx:1174` also share `useEffect(() => () => onDrag?.(false), [])`.
- Footprint slot (`acquireFootprint` in an effect, release on unmount): `DragFootprint.jsx:15`, `RulerTool.jsx:557`, `:648`.
- `footprintShape` and the left-button check: `LooseToken.jsx:76`, `TokenPile.jsx:103`.
- Constants with the same meaning: `GAP = 0.02` (ground to token or marker) in `CrisisToken`, `LooseToken`, `TokenPile`, `TokenDragPreview`, `SupplyPile`, `PriorityMarker`, `ScoreBoard` (comments say "the same as LooseToken.jsx"). `LIFT = 0.04` in `ToolDragGhost`, `Ping`, `RemoteCursor`. `HOVER_RATE = 25` in `CharacterModel` and `RulerTool` ("same as models"). `DEG` in `crisis/matTokens.js:4`, `terrain/placementMove.js:4`, `characters/models.js:118`. `maxPolarAngle={85 * (Math.PI / 180)}` in `App.jsx:917` and `debug/TerrainPage.jsx:386`.
- `INCHES_PER_PX = 0.04` and `px(inches)` in `OnTable.jsx:6`, `GameSetup.jsx:48`, `TableButtons.jsx:11`, `ToolRack.jsx:21`. `TABLE_Y = 0.05` in `GameSetup.jsx:45` and `TableButtons.jsx:10`.
- `scripts/migrate-crisis.mjs:87-121` and `scripts/migrate-tactics.mjs:71-99`: the same download, missing and result loop (3 groups, one clone family).
- `infra/scripts/delete-test-data.ts:9` and `infra/scripts/errors.ts:27`: the same `.env` load and `MONGODB_URI` check.

## Decisions

1. **Keep the names `TEAMS` and `otherTeam`** in `setup/setup.js`. They exist and have more than 20 users. A rename to `SIDES` changes many lines and adds nothing.
2. **`COLOR_HEX` in `sideColors.js` is the one source of the two player colors.** `main.jsx` sets `--player-blue` and `--player-red` on `document.documentElement` from a pure `playerColorVars()` before the first render. `index.css` uses `var(--player-blue)` and `var(--player-red)`. The hover and light text shades are used only in CSS, so they become `:root` variables there (`--player-blue-hover`, `--player-blue-light`, and red). `SelectionOutlines.jsx` reads `COLOR_HEX` through `new Color(...)`.
3. **Pure rules go to files that load in Node**, with tests. A rule that needs card data takes it as an argument, and a thin wrapper next to the data calls it.
4. **One `Dialog` component, built on `Overlay`.** It owns the portal, the backdrop press-and-click rule, the `×` button, `role="dialog"`, `aria-modal`, `aria-label`, and focus. It stays a portal `div`, so the stacking stays the same.
5. **Focus uses `FocusScope` from `@react-aria/focus`** (`contain`, `restoreFocus`). On open, Dialog focuses its own dialog element (`tabIndex={-1}`), not the first button. So Enter or Space after opening does not press `×`. Reasons:
   - The native `<dialog>` with `showModal()` puts the dialog in the top layer. Then the HUD notices (z-index 600) go behind it, and the page outside becomes inert. That changes what the user sees.
   - `react-aria-components` `Modal` brings its own overlay, portal and markup. Every dialog's CSS must change.
   - An own focus trap must find tabbable elements, handle disabled and hidden ones, and restore focus when the opener is gone. `FocusScope` does this already and is one small package.
6. **Escape always closes a dialog** (the user decided on 2026-10-15). Dialog handles Escape itself, on the table and in the lobby, also when the user removed Escape from the `cancel` binding. It calls `onClose` and stops the event, so the table `cancel` action does not run a second time. `NewRoomDialog` and `RoomRosterPopup` drop the Escape part of their own listeners. Their arrow keys stay, because they do different things.
7. **`CardPopup` and `LoadingOverlay` stay on `Overlay`.** A card popup closes on any click and has a peek mode; it has no controls. The loading overlay cannot be closed.
8. **Storage helper `src/storage.js`**: `readJson`, `writeJson`, `readText`, `writeText`, `removeKey`, `storageKeys`. Each takes an optional storage area (default `localStorage`, read inside the try) and never throws. `log/open.js` keeps its stored format: `writeJson(KEY, open ? 1 : 0)`, and `readJson(KEY) === 1` reads the old `'1'`.
9. **`auth/session.js` uses the helper too.** Its calls no longer throw when storage is off. This is a fix of a wrong copy. The comment at line 2 is removed.
10. **Settings get one writer.** `useSettings` returns `updateSettings(patch)` (shallow merge, then store). `SettingsPopup` gets one `onSettingsChange(patch)` prop in place of six.
11. **Body types are named constants in `physics.js`**: `BODY_DYNAMIC = 0`, `BODY_KINEMATIC_POSITION = 2`, the values of Rapier's `RigidBodyType`. `DiceTray.jsx` keeps `rapier.RigidBodyType`, because it has `rapier` at hand; a test checks the two constants against `@react-three/rapier`'s `rapier.RigidBodyType` if Node can load it, else against the numbers with a comment.
12. **Crisis threat comes from Jarvis.** Game data comes from Jarvis, the TTS mod gives the files (project rule). `migrate-crisis.mjs` stops writing `threat` and keeps its warning. A one-off script removes `threat` from `crisis/cards.json`. The values are equal today, so nothing changes on screen.
13. **Tactic ids are stored with 8 digits.** `migrate-tactics.mjs` pads at write time. A one-off script pads the 16 ids in `tactics/cards.json`, the same as a rerun of the script would. The readers stop padding. The Library search by an 8-digit code then finds the 16 cards; this is a fix.
14. **`rosters/cards.js` reads crisis and tactic rows from `crisis/cards.js` and `tactics/cards.js`.** It does not import the crisis and tactic JSON files any more. The "current printing" rule is in `crisis/cards.js` only (and in `migrate-crisis.mjs`, which is a build tool and cannot import app code).
15. **Small copies inside one function stay.** For example `{ host: ..., guest: ... }` literals for data shapes are data, not a rule.
16. **The user tests at the end** of the plan, with the lists under "User" of every step. The user can also test after any step.

## Risks

1. **The earlier plans move code.** Find every place by name. If one of them already removed a duplicate (for example the "host deleted the room" exit in `openTableSession.js`), write that in the Result and skip it.
2. **`review-fixes` trims the Jarvis and card data.** Step 7 reads that plan's Result first. If the files or their fields moved, the step applies the same rules to the new files.
3. **Focus return on the table.** After a table dialog closes, focus goes back to the opener, for example the Settings button. A later Space or Enter can then press that button as well as run the table action. Today a click on a toolbar button also leaves focus on it, so the case exists already. Step 6 checks Space and Enter after closing each table dialog. If a key presses the opener, Dialog gets `restoreFocus={false}` on the table, and the Result says so.
4. **Key capture in Settings.** `KeyBindings.jsx` captures on window in the capture phase. Escape during a capture must still be captured, not close Settings. The window capture-phase listener runs before Dialog's handler; it must stop the event while a capture runs. Test this.
5. **CSS variables before the first render.** If `main.jsx` sets them after the first paint, the first frame shows no player color. Set them before `createRoot(...).render`.
6. **Import cycles.** `setup/setup.js` has no imports, so it is safe to import from anywhere. A new shared module (for example `pieces/heights.js`) imports nothing from components.
7. **Stale closures.** A helper must not change which render's values a handler reads. Move code, do not change it from React state to a document read or back.

## Step 1: Sides and player colors

Work:

1. Replace the five local `TEAMS` with the import from `setup/setup.js`. `Toolbar.jsx` maps `TEAMS` to its `{ team }` shape where it uses it, or uses the strings directly.
2. Replace the inline `['host', 'guest']` lists in "Facts" with `TEAMS`. `crisis/useCrisisTokens.js` takes `playedSides` (from `tableSeat`) in place of `multiplayerRoom` and `ownSide`, if it uses them for nothing else.
3. Replace the six inline opponent expressions with `otherTeam`. Remove `otherSide` in `TableButtons.jsx`. `tokens/dropWait.js` imports `otherTeam`.
4. `sideColors.js`: `playerColorVars()` → `{ '--player-blue': COLOR_HEX.blue, '--player-red': COLOR_HEX.red }`. Test `sideColors.test.js`. `main.jsx` sets them on `document.documentElement` before the first render.
5. `index.css`: the 8 uses of the two base colors become `var(--player-blue)` / `var(--player-red)`. `:root` gets the four shades with a comment that the base colors come from `sideColors.js`.
6. `SelectionOutlines.jsx`: the two hex numbers come from `COLOR_HEX`.
7. Docs: `setup-game.md`, "Colors": one line that `COLOR_HEX` is the source and CSS reads the variables.

Checks: as in "Checks", plus `grep -rnE "'host', 'guest'|2980b9|c0392b" apps/web/src` gives only `setup/setup.js`, `sideColors.js` and tests.

User: Lobby seats and room players show the blue and red team names in the same colors. The Log entries have the colored left border. The Blue and Red chips in the Library and Toolbar, and their hover. The roster popup title. Selection outlines of a Blue and a Red model. Spectator columns, crisis tokens on both sides, and the table buttons of each player.

### Result

## Step 2: Storage, settings, timed message, room exit

Work:

1. New `src/storage.js` (decision 8). Test `storage.test.js` with a fake storage area: a read of a missing key, bad JSON, a throwing `getItem` and `setItem`, the key list.
2. `rooms/store.js`, `settings/settings.js`, `log/open.js` use it. `readSettings` keeps its result: `normalize(readJson(KEY))`. If `normalize` can throw on bad data, keep a try around it, so a broken record still gives the defaults.
3. `auth/session.js` uses `readText` / `writeText` / `removeKey` (token) and `readJson` / `writeJson` / `removeKey` with `sessionStorage` (login state). Remove the false comment at line 2 (decision 9).
4. `settings/useSettings.js`: `updateSettings(patch)` (decision 10). `App.jsx` and `SettingsPopup.jsx` pass patches: `{ tools: { ...settings.tools, [item]: place } }`, `{ sound: { volume } }`, `{ spectator: { size } }`, `{ turn: { step } }`, `{ labels }`, `{ bindings }`.
5. `Library.jsx` uses `useHudMessage` for its message. Fix the comment in `useHudMessage.js` that names the Library copy.
6. "Host deleted the room": one local function `roomGone()` in the Table session code (now `rooms/openTableSession.js`), called from `onGone` and the `'gone'` state. Skip if the earlier plan did it (Risk 1).

Checks: as in "Checks", plus `grep -rn "localStorage\|sessionStorage" apps/web/src` gives only `storage.js` and tests.

User: change each setting (tool places, volume, spectator size, turn step, labels, a key binding) and reload: the setting stays. The Log panel open state stays after a reload. Saved rooms still show in the lobby. Login and logout (dev login). In the Library, a click on a character without a model shows the message for 3 seconds.

### Result

## Step 3: Pointer math and the drag ghost

Work:

1. New `src/drag/screenRay.js`:
   - `ndcFromClient(canvas, clientX, clientY)` → `{ x, y }`.
   - `nearestHit(raycaster, entries)`: `entries` is an iterable of `[value, object]`. It returns the value of the nearest hit, or `null`. An entry with no object is skipped.
   - Test `screenRay.test.js` with a fake canvas (`getBoundingClientRect`) and a fake raycaster (`intersectObject`).
2. Use `ndcFromClient` in `drag/tablePoint.js` and at the four other places in "Facts".
3. Use `nearestHit` in `characterAt`, `terrainUnder` (Scene code) and `modelUnder` (RulerTool code). `modelUnder` passes `list.map((m) => [m, m.getObject()])`.
4. New hook `drag/usePointerTablePoint.js`: `usePointerTablePoint(pointRef, start, onPoint, deps)`. It owns the window `pointermove` listener, the `tablePoint(..., { offTable: 'null' })` call, `pointRef`, the cleanup. `onPoint(point)` places the group. `TokenDragPreview.jsx` and `ToolDragGhost.jsx` use it. Keep the `start`-only-on-mount rule and its lint comment.

Checks: as in "Checks". Fallow group `dup:4e07dbec` is gone.

User: drop a crisis token on a character (model and tray). Hover a locked terrain piece with labels off: its label shows. Drag a range tool body onto a model: it snaps. Drag a token from a supply pile and a tool from the rack: the ghost follows the pointer, hides off the table, and the tool ghost dims where it cannot drop.

### Result

## Step 4: 3D constants and small hooks

Work:

1. `physics.js`: `BODY_DYNAMIC`, `BODY_KINEMATIC_POSITION` (decision 11), used at the 10 `setBodyType` calls. Test in `physics.test.js`.
2. `CharacterModel.jsx` uses `useBodyRef()` for `rigidRef`, `liveRb` and `world`. Check that the unmount clear of the ref does not break a drag cancel in its own unmount cleanup; if the cleanup order matters, write it in the Result.
3. `DeployRangeTool` uses `useRangeParts(3, team)`.
4. New `src/pieces/heights.js`: `SURFACE_GAP = 0.02`, `MARKER_LIFT = 0.04`, `HOVER_RATE = 25`, each with the comment of its first copy. The files in "Facts" import them. A file whose comment gives the constant another meaning keeps its own, and the Result says which.
5. `DEG`: one export in `camera.js` (or the file the earlier plans made for angles), used by the three files. `camera.js` gets `MAX_POLAR_ANGLE = 85 * DEG`, used by `App.jsx` and `debug/TerrainPage.jsx`.
6. `OnTable.jsx` exports `INCHES_PER_PX`, `px(inches)` and `TABLE_Y`. `GameSetup.jsx` (or `setup/setupText.js`), `TableButtons.jsx` and `ToolRack.jsx` import them.
7. `components/useHoverCursor.js` gets `useHoverReport(hovered, onHover)`. The 8 components use it. `LosTool.jsx` and the RulerTool tool code share `useDragEndOnUnmount(onDrag)` in the same file, or the Result says why it stays.
8. `components/footprintProjection.js` gets `useFootprintSlot()` → the slot ref, acquired on mount and released on unmount. `DragFootprint.jsx` and the two RulerTool places use it. `CrisisToken.jsx:225` acquires on a condition, so it stays.
9. `LooseToken.jsx` and `TokenPile.jsx`: one `tokenFootprint(follow, poseRef)` in `drag/tokenDrop.js`, with a test.

Checks: as in "Checks". Fallow groups `dup:64950102`, `dup:49103c37` and the DragFootprint group are gone.

User: drag a model: it hovers and settles, Esc puts it back. Drag a range tool and a LOS tool; a removed tool does not stay hovered. Deploy line toggle on: the R3 tool follows a dragged model. Tokens, piles, markers and the priority marker lie on the table with no flicker. Hover each piece kind: the cursor and the hover label work. The setup panels and table buttons have the same size and place.

### Result

## Step 5: Setup rules and the popup check

Work:

1. `setup/setup.js`: `squadProblem({ threat, count, maxThreat })` → `'over'`, `'empty'` or `null`, in the order of `GameSetup.jsx` (over first). Test.
2. `scoreboard/affiliations.js`: `affiliationChoices(squadKeys)` → `[...squadKeys, DEFAULT_AFFILIATION]`. Test. `rosters/cards.js`: `squadAffiliationChoices(parsed, places)` → `affiliationChoices(parsed ? squadAffiliationKeys(parsed, places) : [])`.
3. `useGameSetup.js` `handleSquadReady` and `handleSetupAffiliation`, and the GameSetup squad panel and affiliation rows, use them. The message text stays in the UI (or `setup/setupText.js`).
4. `GameSetup` takes `parsed` (App's `parsedRosters`) in place of `rosters`, and stops parsing.
5. `App.jsx`: `const popupOpen = Boolean(openCard || ... || setupOpen)` once, used by `wheelState`, the `useTableKeys` state and the peek check (`!(tokenDrag || toolDrag || popupOpen)`).

Checks: as in "Checks".

User: game setup to the squad step. Ready with no character: refused, with the message. Ready above the Maximum Threat: refused, with the message. Affiliation step: each squad shows its choices and Unaffiliated. With a popup open, the wheel and the table keys do nothing, and the peek card does not show.

### Result

## Step 6: One Dialog

Work:

1. `pnpm --filter web add @react-aria/focus` (decision 5).
2. New `components/Dialog.jsx`: `Dialog({ label, className, backdropClassName, onClose, as = 'div', ...rest, children })`. It renders `Overlay` with the backdrop press-and-click rule, the `×` button, and `FocusScope contain restoreFocus` around the element with `role="dialog"`, `aria-modal="true"`, `aria-label={label}`, `tabIndex={-1}`. It focuses that element on mount. Escape on it calls `onClose` and stops the event (decision 6). `as="form"` with `onSubmit` in `rest` serves `NewRoomDialog`.
3. `CrisisChoose`, `CrisisCompare`, `NewRoomDialog`, `RosterPopup`, `SettingsPopup`, `TrayPopup` use it. Their class names and DOM order stay, so the CSS still applies. `TrayPopup` keeps its close button in its top row: Dialog gets a `closeButton={false}` prop for it, and its backdrop click uses Dialog's rule. That rule is a fix: today a drag that ends on the backdrop closes the tray.
4. `RoomRosterPopup` and `NewRoomDialog` remove Escape from their listeners (decision 6).
5. `Overlay.jsx` comment: Dialog is the shell for dialogs; Overlay stays for `CardPopup` and `LoadingOverlay`.
6. Docs: `key-shortcuts.md`: a dialog takes the focus when it opens, Tab stays inside it, focus goes back on close; Escape always closes a dialog, also when Escape is removed from `cancel`. Change `key-shortcuts.md:137`.

Checks: as in "Checks". Fallow groups `dup:38066dd5`, `dup:08a51ea4`, `dup:c86dd1d0` are gone.

User: open each dialog: Settings, a roster popup (table and lobby), the crisis compare and choose popups, a tray popup, New room. For each:

- Tab moves only between its controls. Shift+Tab too.
- The `×` button and a click on the backdrop close it. A drag that starts inside and ends on the backdrop does not.
- On close, focus is back on the button that opened it. Then Space and Enter do not press that button again (Risk 3).
- On the table, Escape closes it, also after Escape is removed from the cancel binding. In Settings, a key capture of Escape still captures.
- In the lobby, Escape closes New room and the roster popup. The arrows still step maps and cards.
- A HUD notice still shows above a dialog.

### Result

## Step 7: Card data with one source

Work:

1. Read the Result of `review-fixes` (Risk 2).
2. Tactic ids (decision 13): `scripts/migrate-tactics.mjs` `cardEntry` writes `String(card.ID).padStart(8, '0')`. A one-off `node -e` pads the 16 ids in `tactics/cards.json`; check that the diff touches only those 16 lines. Remove the padding in `rosters/cards.js`, `tactics/cards.js`, `Library.jsx`, `scripts/fetch-jarvis-tactics.mjs`. Fix `roster.md:70` and `scripts/README.md:414` (16 ids, padded by the migrate script).
3. `crisis/cards.js` exports `CRISIS_ROWS`: each current Jarvis printing `{ code, key, name, type, threat, slug }`. `key` is the `cards.json` key or `null`; `threat` is Jarvis `threatLevel`. `CARDS` is built from the rows that have a key, with `tokens` and `supply` from `cards.json`.
4. Decision 12: `migrate-crisis.mjs` stops writing `threat`; its warning stays. A one-off script removes `threat` from `crisis/cards.json`. Check `Toolbar.jsx:128` and every `getCard(...).threat` still get the value (from `CRISIS_ROWS`).
5. `tactics/cards.js` exports `TACTIC_ROWS`: the first Jarvis row per code `{ code, key, name, slug, gem }`. `TACTICS` takes `gem` from it.
6. `rosters/cards.js` builds its tactic and crisis entries from `TACTIC_ROWS` and `CRISIS_ROWS`, and drops its imports of the four tactic and crisis JSON files and `idToKey` (decision 14).
7. A Node test cannot load these files (Facts). Add a check to `scripts/` or a test that reads the JSON with `with { type: 'json' }`: every tactic id has 8 digits; each crisis `cards.json` id has one current Jarvis printing.

Checks: as in "Checks", plus: the roster popup counts of a test roster are the same before and after (log `rosterTabs` counts of one MCT code in the Result). `grep -rn "padStart(8" apps/web/src apps/web/scripts` gives only `net/fingerprint.js`, `components/storedTool.js` and the migrate script.

User: open a roster with Team Tactic cards, an Infinity Gem and crisis cards: same cards, names, threats and images as before. In the Library, search one of the 16 cards by its 8-digit code (for example `01430206`): it shows. Spawn a Team Tactic card and open a gem from the Library. Game setup crisis step: the threat and the Maximum Threat are the same as before. The Toolbar crisis list shows the threat.

### Result

## Step 8: Script and infra helpers, last fallow run

Work:

1. `scripts/lib/`: one function for the card loop of `migrate-crisis.mjs` and `migrate-tactics.mjs` (plan, download missing, missing in cache, convert, result). Each script passes its `planCard` and convert step. Test with fake plans in `scripts/lib/`. The printed lines stay the same.
2. `infra/scripts/`: one `mongoUri()` (or `mongoClient()`) for the `.env` load and the URI check, used by `delete-test-data.ts` and `errors.ts`.
3. Run `pnpm fallow dupes`. Write in the Result: lines, groups left and why each stays.
4. Grep once more for copies this plan missed: `grep -rnE "'host' \?|'guest' \?|#[0-9a-f]{6}|padStart|localStorage|role=\"dialog\"" apps/web/src`. A new finding goes in the Result as a proposal; it is not fixed in this plan.

Checks: as in "Checks". `node scripts/migrate-tactics.mjs --list` and `node scripts/migrate-crisis.mjs --list` run (with the TTS cache, on the user's machine; without it, the coder runs the tests only and writes so). `pnpm typecheck` passes (it runs `tsc` in `infra`).

User: none in the browser. Optional: `pnpm migrate-crisis --list` shows the same lines as before.

### Result

## Step 9: Library adds to the own side in multiplayer

From the user test on 2026-10-15. In a multiplayer room the Library shows the "For" choice (Blue / Red, `Library.jsx`, `team` state). A player who does not look can add characters and tactic cards for the opponent. In a multiplayer room a player only adds pieces for their own side.

Work:

1. `Library.jsx`: in a multiplayer room (the seat from `rooms/seat.js`, `tableSeat(room)`: `multiplayer`, `ownSide`), hide the "For" group and use `ownSide` as the team. A spectator or a seat with `side: null` (see split-app risk 4) adds nothing: the add buttons are disabled with a short reason in the title.
2. Single player and the Sandbox keep the Blue / Red choice: one person plays both sides.
3. Use the shared `TEAMS` from step 1. Pure choice in a plain module with a test, e.g. `libraryTeam({ multiplayer, ownSide }, chosen)`.
4. Docs: `docs/features/library.md`.

User: in a multiplayer room, as host and as guest, the Library has no For choice and adds to the own side; in a single player room and the Sandbox, For is there and works as before.
