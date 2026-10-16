# Plan: Fixes from the fifth playtest

Requested by the user on 2026-10-16. Status: not started.

Branch `playtest-5`, worktree `../mcp_assist_3d-playtest-5`, from main. One coder step and one commit for each step. Each step writes its **Result** below when it is done. Feature docs change in the same step as the code.

Checks of every step: `pnpm format`, `pnpm lint` (no more warnings than before the step, 40 at the start), `pnpm typecheck`, `pnpm test`, `pnpm --filter web build`.

## Request

1. When a player's affiliation is set, each of their characters gets a pile of affiliation tokens in its Give sources.
2. The spectator view shows the affiliation: `Player name [Affiliation] VP Round`, as an icon.
3. The HUD **Power** button looks like the table button: green, with the Power token icon. The HUD **Power** and **Cleanup** buttons have the same width.
4. The camera can be moved with the mouse and with the keys, but using both at the same time moves it erratically.

## Facts

- Affiliation tokens are not tokens yet. The 36 images are in `src/assets/affiliations/` (`migrate-scoreboard.mjs`). Names come from `affiliationName` in `scoreboard/affiliations.js`. Today they show only as the control mark on a crisis token (`controlAffiliation` in `TokenLayer.jsx`).
- The Give sources of a tray are Activated, Dazed and the character's `tokens` list (`docs/features/character-trays.md`). A source never runs out. In TTS, the tray puts the affiliation token after Dazed.
- The squad affiliation of each side is in the table document (setup affiliation step).
- The spectator header shows the name, VP and "Round N" (`docs/features/spectator-view.md`, `ui/SpectatorColumns.jsx`, `ui/SpectatorBadge.jsx`).
- The table Power button: green #42B534, dark text, the Power token image left of the label (`docs/features/table-tools.md`, "Automatic Power Phase button"). The HUD buttons are in `game/PhaseButtons.jsx`, CSS `.phase-button` with `min-width: 112px`, so the width follows the label.
- Camera input: `scene/KeyboardCamera.jsx` (W A S D, arrows), `OrbitControls` (mouse drag), `scene/WheelCamera.jsx` (wheel, smoothed). Each moves the camera on its own.

## Decisions

1. Affiliation tokens become tokens: a new group `affiliation` with 36 tokens, so the Library also shows them (group "Affiliation"). Keys are `affiliation-<slug>`, so they cannot clash with other token keys. Size: the same as other character tokens.
2. The affiliation source goes after Dazed, as in TTS. It shows only while the side has an affiliation. When the affiliation changes, the source changes with it. With no affiliation, the row is as today.
3. Spectator header: `Name <affiliation icon> VP Round`. The icon is the affiliation token image, its name as the title. With no affiliation, no icon. (User, 2026-10-16: an icon, not text.)
4. HUD Power: same green, the dark text, the Power token image and the label **Auto Power Phase** as the table button. The Cleanup button's label becomes **Auto Cleanup Phase**. Power and Cleanup get one fixed width, the width of the wider one. (User, 2026-10-16: both labels change.)
5. Camera: the first input wins. A mouse camera drag (turn or pan) blocks the camera keys until the mouse button is released. A held camera key blocks a mouse camera drag until all camera keys are released. A wheel zoom or pan is left as it is, because it is a single step and is already smoothed. The camera keys during a piece drag work as today.

## Step 1: Affiliation tokens

- Add the 36 affiliation tokens to the token catalog (`tokens/tokens.js` and its data), group `affiliation`, keys `affiliation-<slug>`, images from `src/assets/affiliations/`. Add `affiliation: 'Affiliation'` to `TOKEN_GROUPS` (`tokens/groups.js`).
- `migrate-characters.mjs` must not treat them as character tokens (as with the `dice` group).
- Tests: every affiliation in `scoreboard/affiliations.js` has a token. The Library groups include Affiliation.
- Docs: `docs/features/library.md`, `docs/features/character-trays.md` (token list).

User: the Library shows the Affiliation group. Drag one onto the table and onto a character.

### Result

Done. `src/tokens/affiliationTokens.js` builds the 36 tokens from `affiliations.json` (not written to `tokens.json`, which `migrate-tokens.mjs` rewrites); `tokens.js` merges them. `characterToken` maps `affiliation-<slug>` to `affiliations/<slug>.webp`. `TOKEN_GROUPS` has Affiliation. `migrate-characters.mjs` skips affiliation names in `cToken`. New test `affiliationTokens.test.js`. Docs: library, character-trays.

## Step 2: Affiliation source in the Give row

- The Give sources of each character get the side's affiliation token after Dazed, while the side has an affiliation. The source follows the current affiliation. Find the code that builds the Give row and lays it out (`characters/trays.js`, `CharacterTray.jsx`).
- Second forms, grunts and two-card trays keep their layout rules. The source rows grow by one token, so check where the rows end (`docs/features/character-trays.md`, "Space").
- Tests: the Give list with and without an affiliation.
- Docs: `docs/features/character-trays.md`.

User: set the affiliation in the setup. Each character of that side shows the affiliation source after Dazed. Drag one onto a crisis token or a character. Change the affiliation: the source changes. In two browsers, both show it.

### Result

Done. `withAffiliationSource` (`tokens/affiliationTokens.js`) puts `affiliation-<key>` after Dazed; `characterGiveSources(slug, affiliation)` uses it. `Scene.jsx` passes `affiliations[team]` to `CharacterTray` and to the spare model / construct row count. Unaffiliated adds no source (changed in step 3: it gets one). Max 11 sources, still 2 rows, so no layout change. Test `characters/giveSources.test.js`. Docs: character-trays.

## Step 3: Spectator affiliation

- The spectator header shows the affiliation icon after the player name, from the side's affiliation (decision 3). Reuse the image lookup of step 1. Both the HUD columns and the 3D badge, if both show the header.
- Docs: `docs/features/spectator-view.md`.

User: open the spectator view before and after the affiliation is set.

### Result

Done. HUD columns only (the 3D badge has no header). `SpectatorColumns.jsx` gets `affiliations` from `App.jsx` and shows `AffiliationMark` (token image via `characterToken(affiliationTokenKey)`, name as title) after the name; CSS `.spectator-affiliation`. Extra: `withAffiliationSource` now adds a source for `unaffiliated` too (own token image); only no affiliation set adds none. Test updated. Docs: spectator-view, character-trays. Checks: format, lint (40), typecheck, test (990), build OK.

## Step 4: HUD phase buttons

- `PhaseButtons.jsx` and `.phase-button`: Power gets the table button look (green #42B534, dark text, lighter green on hover, the Power token image left of **Auto Power Phase**). Cleanup says **Auto Cleanup Phase**. Reuse the image import and the colors from the table button. No copies of the values.
- Power and Cleanup have the same width.
- The disabled look stays.
- Docs: `docs/features/round-phases.md` or `table-tools.md`, where the HUD buttons are described.

User: set both buttons to the HUD in Settings. Power is green with the icon and says Auto Power Phase; Cleanup says Auto Cleanup Phase. Both buttons have the same width. Disabled states look as before.

### Result

Done. `PhaseButtons.jsx`: Power says **Auto Power Phase** with the Power token image (`POWER_ICON`, now exported from `ui/TableButtons.jsx`), class `phase-button--power`; Cleanup says **Auto Cleanup Phase**. CSS: `.phase-button--power` shares the green, dark text and hover rules with `.table-button--power` (selector lists, no copied values). `.phase-buttons` is a grid with equal columns, so both buttons have the width of the wider label (`min-width` removed). Disabled look unchanged. The table Cleanup button has no icon or color (plain chip, "Cleanup Phase"), so the HUD Cleanup keeps its current look with the new label. Docs: round-phases, table-tools. Checks: format, lint (40), typecheck, test, build OK.

## Step 5: One camera input at a time

- Implement decision 5. Find where `OrbitControls` starts and ends a drag (its `start` / `end` events) and where `KeyboardCamera` reads held keys. One shared flag decides which input owns the camera. No per-component copies.
- While the mouse owns the camera, the camera keys do nothing. While a camera key owns it, `OrbitControls` is off (`enabled = false`), and it turns back on when the keys are released.
- The camera keys during a piece or tool drag work as today.
- Tests: the owner logic as a plain module (who wins, release order).
- Docs: `docs/features/key-shortcuts.md`.

User: hold W and drag with the mouse: only W moves the camera. Drag with the mouse and press an arrow: only the mouse moves it. Release, then the other input works. Keys during a model drag still pan.

### Result
