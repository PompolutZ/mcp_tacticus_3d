# Plan: Feedback from the third playtest

Requested by the user on 2026-10-14. Status: plan approved by the user on 2026-10-14. The user decides more on the overlays (decisions 6 and 7) after a test run.

Branch `playtest-3`, worktree `../mcp_assist_3d-playtest-3`, from main at `5d071a9`. One coder step and one commit for each step. Each step writes its **Result** below when it is done. Feature docs change in the same step as the code.

Checks of every step: `pnpm format`, `pnpm lint`, `pnpm test`, `pnpm --filter web build`.

Rule of every step (from the user): reuse existing hooks and functions. Extend a shared one before writing a new copy in a component.

## Requests

1. Move all plans that came from a user test under `docs/plans/playtest/`.
2. During a model drag, Esc puts the model back exactly where it was before the drag.
3. The Automatic Power Phase and Cleanup Phase buttons go to the bottom right corner of the HUD, where a TTS player looks first. HUD is the default place for both.
4. The info panel says "choose a deck" when a player picks between their Secures and Extracts. Players say "I want to play my Secures". The text must say it that way.
5. Cards that a player must choose from turn 90° toward that player.
6. In the setup, a click on a crisis card opens a compare overlay instead of the roster. Tabs: Compare Secures, Compare Extracts. My cards in the top half, the opponent's cards in the bottom half. The overlay has the Choose my Secures / Choose my Extracts button. When a player must choose 1 of 2 cards, an overlay opens on their screen by itself. The roster keeps its crisis tab, opened from a character or tactic card.
7. The spectator view shows each squad in a column, one on the left, one on the right: portrait, Damage and Power bars, tokens, KO. A header with the player name, VP and the round. A size setting.
8. Rework the top toolbar. Today its buttons wrap to a second row, and the Log bar covers Settings in the Sandbox.

## Facts

Paths are under `apps/web/src/`.

### Plans

- Plans from a user test: `playtest-1.md` and its 6 plans (`playtest-1-bugs.md`, `setup-round-2.md`, `squad-breakdown.md`, `game-flow.md`, `table-controls.md`, `table-tools.md`), `tool-snap-select.md` (follows playtest-1-bugs Part 1), `playtest-2.md`, and this plan.
- Other docs and code comments point to these files by path, for example `docs/plans/playtest-1.md` in `squad-breakdown.md`.
- The open branch `terrain-page` does not change these files.

### Drag

- All drags use `startPointerDrag` (`drag/pointerDrag.js:42`). It returns `{ cancel }`, which ends the drag with `onCancel` and no drop.
- Model drag: `components/CharacterModel.jsx:701-753`. The `cancel` handle is not kept. The start pose is not stored: `freePlace` is the last free point, and the turn is set by `upright(...)` every frame. `onCancel` runs only on a lost ownership tie and leaves the body where it is.
- Esc during a model drag goes to `cancel` → `handleEscape` (`tabletools/useTableTools.js:107`). That clears the selection and removes selected tools. The drag goes on. `keyAction` (`keyboard.js:40-50`) checks only `tokenDrag` and `toolDrag`. `modelDrag` is in the key state (`App.jsx:581`).
- Peers see the drag live (`components/LiveSync.jsx`). The table document is written when the body rests (`onModelRest`, `Scene.jsx:1558`). So a cancel only has to put the body back. The live sync and the rest write do the rest.
- Tactic card (`TacticCard.jsx:167`), crisis token (`CrisisToken.jsx:277, :340`) and priority marker (`ScoreBoard.jsx:136`) drags have an `onCancel` that restores the place, and comments that say "Escape". The handle is not kept, so Esc does nothing there.
- Token drags and HUD tool chip drags already cancel on Esc.

### Phase buttons

- Setting: `settings/settings.js:8-16`, `PLACES = ['table','hud']`, every item defaults to `'table'`. Stored in localStorage `mcp-assist-3d/settings`.
- HUD place: a "Phase" group in the toolbar (`components/Toolbar.jsx:261-287`).
- Bottom right: `.hud-warnings` (`index.css:1676`) when a warning exists.

### Deck text

- `components/GameSetup.jsx:290-295`: "You choose a deck.", "Waiting for Nelly to choose a deck.", "Blue chooses a deck.". Browsing back: "Deck: Nelly chose Secures" (`:69-70`).
- Buttons `DeckButtons` (`:166-189`): "Choose Secures", "Choose Extracts", title "Draw 2 of Nelly's Secure cards".

### Crisis cards in the setup

- Rows: `crisisRows` (`setup/setup.js:291-327`). Roll off and deck steps: all 20 cards, a Secure row and an Extract row per side. First step: the Priority player's 2 drawn cards (`use: true`), the other player's full row of the other type. Second step: the Priority player's picked card, the other player's 2 drawn cards.
- Every card has `yaw: CRISIS_CARD_YAW = π/2` (`rosters/layout.js:101`). The top faces the table edge (−x), as the scoring board.
- Chooser: `chooserOf(setup)` (`setup.js:116-129`). Deck and second steps: the Priority player. First step: the other player. In the first and second steps, the chooser picks from cards on the opponent's side.
- Viewer: `tableSeat(room).mySide` (`rooms/seat.js`). It is null in the Sandbox and in a single player room.
- Rotations that face a side: `OWNER_FACING_ROTATION` (`components/OnTable.jsx:15`).
- A crisis card click opens the roster on the crisis tab: `CrisisRow` → `onRosterOpen({ team, tab: 'crisis', index })` (`GameSetup.jsx:133-141, :539`).
- Roster popup: `components/RosterPopup.jsx`, host `RosterPopupHost.jsx`, carousel `components/Carousel.jsx` (Embla). Character and tactic roster cards open it too (`Scene.jsx:1448`).
- No popup opens by itself today. Every popup opens from a click.

### Spectator

- Toggle: `spectator` state in `App.jsx:99`, View → Spectator in the toolbar. It shows a 3D badge above each model (`SpectatorBadge.jsx`).
- Characters: `characters` Yjs list. `team` is `host` or `guest`. `damage`, `power`, `tokens {key: count}`, `side` (`healthy`/`injured`). A grunt has `host`.
- Portrait: `characterPortrait(key)` (`characters/files.js:18`), `CharacterPortrait.jsx`. Stamina: `characterStamina(key, side)`. Token images: `characterToken(key)` (`tokens/files.js`). Held objectives: crisis tokens with `heldBy === ch.id`.
- KO: no field. A character is off the mat when `characterOnBoard(ch, poses)` is false (`characters/models.js:149`). Before the deploy, every character is off the mat too.
- Name: `playerName(team, ctx)` (`setup/names.js:19`). VP and round: from `scoreMarkers` positions, `VP_POINTS` and `ROUND_POINTS` (`scoreboard/board.js`). `game/usePhaseActions.js:113` reads the round this way.
- Settings slider pattern: the volume slider in `SettingsPopup.jsx:84-101`, clamp in `normalize()`.

### Toolbar

- `.hud-top` (`index.css:48`) holds `.toolbar`, a flex row that wraps. Groups: Lobby + room, players, Library | Log, Mat, Range/Move, Crisis selects (Sandbox), Roster inputs (Sandbox), Deploy, Phase, View, Debug, Settings (`margin-left: auto`).
- Library, Log, the notice start at a fixed `top: 56px`. That assumes one toolbar row. In the Sandbox the toolbar has 2 rows, so the Log bar covers Settings, and open panels cover row 2.
- The Log bar (`LogPanel.jsx`) is always shown at the top right and shows the newest entry.

## Decisions

1. **Plans.** `git mv` the 9 plans above into `docs/plans/playtest/`, and fix every path that points to them, in docs and code comments. Add one line to `CLAUDE.md` "Docs": plans from a user test are in `docs/plans/playtest/`.
2. **Esc cancels a drag.**
   - The model drag stores the start position and turn in `onStart`. Esc during the drag calls the kept `cancel` handle. `onCancel` puts the body back at the start pose, zeroes velocities, and makes it dynamic again. A Q / E turn and an R floor switch during the drag are undone too.
   - `keyboard.js`: `if (s.modelDrag) return cancelModelDrag`, before the `cancel` fallback. So Esc no longer clears the selection during a model drag.
   - The same for the tactic card, crisis token and priority marker drags (user OK). Their `onCancel` restores the place already. They need the kept handle and a key state flag.
   - Reuse the existing code: one shared way to keep the active drag handle and cancel it (a hook or a function next to `startPointerDrag`), used by all these drags and by the token and tool drags where it fits. No copy per component.
3. **Phase buttons.**
   - In the HUD, the Power and Cleanup buttons are a group in the bottom right corner, out of the toolbar. Power first, then Cleanup. HUD warnings stack above the group.
   - `defaultSettings()`: `power` and `cleanup` default to `'hud'`. The other items stay `'table'`.
   - Saved settings get a `version`. A saved value without the new version gets `power` and `cleanup` set to `'hud'` once (user OK: no one used the app yet).
4. **Deck text.** Wording from the user. The plural is "crises".
   - Chooser: "Decide if you want to play on your Secure or Extract crises."
   - Other player: "Waiting for Nelly to decide if they want to play on their Secure or Extract crises."
   - Sandbox and single player room: "Blue decides if they want to play on their Secure or Extract crises."
   - Buttons stay "Choose Secures", "Choose Extracts", on the table and in the compare overlay.
   - Browsing back and the log: "Nelly plays on their Secure crises."
5. **Cards turn toward the chooser.** In the deck, first and second steps, the cards that the chooser picks from get the yaw that faces the chooser's table edge. Deck step: both rows of the Priority player. First and second steps: the 2 drawn cards. The other cards keep `CRISIS_CARD_YAW`. `crisisRowLayout` sets the yaw and checks the row spacing, so turned cards do not overlap. The coder checks the sign against the card plane in `RosterCards.jsx`.
6. **Compare overlay.**
   - Opens in the roll off, deck, first and second steps, from a click on a crisis card of either side, except a drawn card in the first or second step (see decision 7).
   - Two tabs: Compare Secures, Compare Extracts. The tab of the clicked card opens first.
   - Top half: a carousel of my cards of that type. Bottom half: a carousel of the opponent's cards. In the Sandbox and a single player room, the side of the clicked card is on top. The clicked card is the current card of its carousel.
   - Under the tabs: "Choose Secures" or "Choose Extracts", for the active tab. It calls the same action as the table button, with the same locks and titles. It shows only in the deck step. A click closes the overlay.
   - Esc and the close button close it, as other popups.
   - The roster no longer opens from a crisis card in the setup. It still has the crisis tab.
7. **Choose 1 overlay.**
   - In the first and second steps, an overlay shows the 2 drawn cards side by side, large, with a "Choose this card" button under each. Title: "Choose 1 of Nelly's Secures". The button calls the same action as the table "Choose" chip.
   - It opens by itself on the chooser's screen when the step starts. In the Sandbox and a single player room the viewer plays both sides, so it opens there too.
   - It opens by itself once per step. After the player closes it, a click on a drawn card opens it again. The other player can open it this way too, without the buttons.
   - It closes after the pick.
   - The compare overlay opens by itself for the Priority player when the deck step starts, once, in the same way (user OK). Both overlays close with Esc or the close button and open again from a card click, as the roster.
   - Both overlays reuse the existing popup parts: the `.card-popup` frame, the close button, `Carousel.jsx`, the Esc handling of `closePopups`, and the setup actions of `useGameSetup`.
8. **Spectator columns.**
   - View → Spectator shows the 3D badges, as now, and two HUD columns. My squad on the left, the opponent's on the right. In the Sandbox and a single player room: Blue (host) on the left.
   - Header: player name, VP, round ("Round 2").
   - One row per character and grunt, in squad order. Constructs have no row.
     - portrait
     - Damage bar: `damage / stamina`, orange on the Healthy side, red on the Injured side (TTS colors)
     - Power bar: `power / 10`, green. No Power bar for a grunt.
     - tokens on the character with counts, and held objective tokens
   - Off the mat: the row is grey. After the deploy step (`setup.deployed`) the label is "KO". Before it, no label.
   - Squads that are still hidden (`hiddenSquads`) show only the header.
   - The columns are read-only.
   - Settings: "Spectator columns size" slider, 60% to 150%, default 100%. 100% is a row about 56 px tall. A tall squad scrolls inside its column.
   - The columns start under the toolbar. An open Library or Log panel pushes the column on its side inward.
9. **Toolbar.**
   - One row that does not wrap. Left: ← Lobby, room code or "Sandbox", Copy link, players. Middle: table controls from the HUD setting (Mat, Range / Move, Deploy). Right, always in this order: Library, Log, Spectator, Settings.
   - Sandbox setup inputs (Crisis selects, Roster inputs) move into one "Setup" chip. A click opens a panel under the chip. Debug (Mode, Labels) moves into the Settings popup, dev only.
   - The toolbar height is set as a CSS variable `--hud-top`. The Library, the Log, the notice and the spectator columns start at that variable, not at 56 px.
   - The Log bar stays: a collapsed bar with the newest entry, at the top right under the toolbar.

## Steps

1. **Plans.** Decision 1. Files: `docs/plans/*.md` (9 files), every doc and comment that points to them, `CLAUDE.md`. Check: `grep -rn "docs/plans/<name>"` finds only new paths.
2. **Esc cancels a drag.** Decision 2. Files: `components/CharacterModel.jsx`, `components/Scene.jsx`, `keyboard.js`, `App.jsx`, `input/bindings.js` if needed, tests for `keyboard.js`. Docs: `docs/features/key-shortcuts.md` (Esc row), `docs/features/table-tools.md` if it describes the drag.
3. **Toolbar.** Decision 9. Files: `components/Toolbar.jsx`, `App.jsx`, `index.css`, `components/SettingsPopup.jsx`, `components/LogPanel.jsx`, a new `components/SetupChip.jsx` or similar. Docs: `docs/features/table-tools.md`, `docs/features/game-log.md`.
4. **Phase buttons.** Decision 3. Files: `components/Toolbar.jsx`, a new `components/PhaseButtons.jsx`, `App.jsx`, `index.css`, `settings/settings.js`, `settings/settings.test.js`. Docs: `docs/features/round-phases.md`, `docs/features/table-tools.md`.
5. **Deck text.** Decision 4. Files: `components/GameSetup.jsx`, the log text of the deck entry. Docs: `docs/features/setup-game.md`.
6. **Cards turn toward the chooser.** Decision 5. Files: `rosters/layout.js`, `setup/setup.js`, `components/GameSetup.jsx`, tests of the layout. Docs: `docs/features/setup-game.md`.
7. **Compare overlay.** Decision 6. Files: a new `components/CrisisCompare.jsx`, `components/GameSetup.jsx`, `App.jsx`, `index.css`. Docs: `docs/features/setup-game.md`, `docs/features/roster.md`.
8. **Choose 1 overlay.** Decision 7. Files: a new `components/CrisisChoose.jsx`, `App.jsx`, `components/GameSetup.jsx`, `index.css`. Docs: `docs/features/setup-game.md`.
9. **Spectator columns.** Decision 8. Files: a new `components/SpectatorColumns.jsx`, `App.jsx`, `index.css`, `settings/settings.js`, `settings/useSettings.js`, `components/SettingsPopup.jsx`, `settings/settings.test.js`. Docs: `docs/features/spectator-view.md`, `docs/features/table-tools.md`.

## Results

### Step 1: Plans

Done. 9 plans moved with `git mv` into `docs/plans/playtest/`.       20 path refs fixed in 13 files (plans, `docs/features/table-tools.md`, 5 code comments under `apps/`). `CLAUDE.md` "Docs" has the new line. No old path is left, except the example in Facts of this plan.
