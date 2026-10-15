# Plan: Feedback from the third playtest

Requested by the user on 2026-10-14. Status: steps 1 to 11 done (step 11, the LOS tool, was added by the user on 2026-10-14 before the test). The user decides more on the overlays (decisions 6 and 7) after a test run.

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
9. Line of Sight tool. The game has no real tool for it. A line as wide as the base, from the base center, that turns around the base. A footprint of a neutral color. It goes to the board edge, or to the first terrain with a larger Size. Terrain of the same or smaller Size does not stop it. Spawn from the tool rack, or with Shift + 1 over a model. Rules (from the user):
   - A character has LOS to another character or an object if a straight, unobstructed line can be drawn from any part of its base to the other base or the object. The line can pass through characters, but not through terrain with a larger Size than the other character or the object.
   - A character on top of terrain: add the Size of the character and the Size of the terrain.
   - A character on top of terrain ignores that terrain for LOS.
   - User answer: the Size that blocks is the Size of a target model that the player picks. LOS is checked after the models are placed; the player looks at the line and decides.

## Facts

Paths are under `apps/web/src/`.

### Plans

- Plans from a user test: `playtest-1.md` and its 6 plans (`playtest-1-bugs.md`, `setup-round-2.md`, `squad-breakdown.md`, `game-flow.md`, `table-controls.md`, `table-tools.md`), `tool-snap-select.md` (follows playtest-1-bugs Part 1), `playtest-2.md`, and this plan.
- Other docs and code comments point to these files by path, for example `docs/plans/playtest-1.md` in `squad-breakdown.md`.
- The open branch `terrain-page` does not change these files.

### Drag

- All drags use `startPointerDrag` (`drag/pointerDrag.js:42`). It returns `{ cancel }`, which ends the drag with `onCancel` and no drop.
- Model drag: `characters/CharacterModel.jsx:701-753`. The `cancel` handle is not kept. The start pose is not stored: `freePlace` is the last free point, and the turn is set by `upright(...)` every frame. `onCancel` runs only on a lost ownership tie and leaves the body where it is.
- Esc during a model drag goes to `cancel` → `handleEscape` (`tabletools/useTableTools.js:107`). That clears the selection and removes selected tools. The drag goes on. `keyAction` (`keyboard.js:40-50`) checks only `tokenDrag` and `toolDrag`. `modelDrag` is in the key state (`App.jsx:581`).
- Peers see the drag live (`scene/LiveSync.jsx`). The table document is written when the body rests (`onModelRest`, `Scene.jsx:1558`). So a cancel only has to put the body back. The live sync and the rest write do the rest.
- Tactic card (`TacticCard.jsx:167`), crisis token (`CrisisToken.jsx:277, :340`) and priority marker (`ScoreBoard.jsx:136`) drags have an `onCancel` that restores the place, and comments that say "Escape". The handle is not kept, so Esc does nothing there.
- Token drags and HUD tool chip drags already cancel on Esc.

### Phase buttons

- Setting: `settings/settings.js:8-16`, `PLACES = ['table','hud']`, every item defaults to `'table'`. Stored in localStorage `mcp-assist-3d/settings`.
- HUD place: a "Phase" group in the toolbar (`ui/Toolbar.jsx:261-287`).
- Bottom right: `.hud-warnings` (`index.css:1676`) when a warning exists.

### Deck text

- `setup/GameSetup.jsx:290-295`: "You choose a deck.", "Waiting for Nelly to choose a deck.", "Blue chooses a deck.". Browsing back: "Deck: Nelly chose Secures" (`:69-70`).
- Buttons `DeckButtons` (`:166-189`): "Choose Secures", "Choose Extracts", title "Draw 2 of Nelly's Secure cards".

### Crisis cards in the setup

- Rows: `crisisRows` (`setup/setup.js:291-327`). Roll off and deck steps: all 20 cards, a Secure row and an Extract row per side. First step: the Priority player's 2 drawn cards (`use: true`), the other player's full row of the other type. Second step: the Priority player's picked card, the other player's 2 drawn cards.
- Every card has `yaw: CRISIS_CARD_YAW = π/2` (`rosters/layout.js:101`). The top faces the table edge (−x), as the scoring board.
- Chooser: `chooserOf(setup)` (`setup.js:116-129`). Deck and second steps: the Priority player. First step: the other player. In the first and second steps, the chooser picks from cards on the opponent's side.
- Viewer: `tableSeat(room).mySide` (`rooms/seat.js`). It is null in the Sandbox and in a single player room.
- Rotations that face a side: `OWNER_FACING_ROTATION` (`scene/OnTable.jsx:15`).
- A crisis card click opens the roster on the crisis tab: `CrisisRow` → `onRosterOpen({ team, tab: 'crisis', index })` (`GameSetup.jsx:133-141, :539`).
- Roster popup: `rosters/RosterPopup.jsx`, host `RosterPopupHost.jsx`, carousel `ui/Carousel.jsx` (Embla). Character and tactic roster cards open it too (`Scene.jsx:1448`).
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

### Line of Sight

- Tools: range, move and T/A, one entry of each kind per side in Yjs `table.tools` (`net/doc.js:39`, `tabletools/storedTool.js`). Rack: `tabletools/layout.js:39-73`, `ToolRack.jsx`. Spawn by key over a piece or by a drag from the rack: `tabletools/useTableTools.js` (`placeTool`, `handleToolDrop`). Live pose during a drag: `net/livePose.js`. Other player's tools: `OtherTool` (`RulerTool.jsx`).
- Snap and turn around a base: `snapPose`, `turnAround` (`RulerTool.jsx:132-156`). Footprint on table and terrain: `ToolFootprint` (`RulerTool.jsx:449`, `footprintProjection.js`).
- Key 1 is `range1`: the R2 tool in Snap 1 mode. No default binding uses Shift. Modifiers must match exactly (`input/bindings.js:233`), so Shift + 1 is free. `overPiece` is the hover condition.
- Character Size: Jarvis `size`, and `statCard.frontSide.size` / `backSide.size` (`characters/jarvis-characters.json`). Hulkbuster 4 → 2 and Phoenix 2 → 4 between sides. Not loaded: `rosterEntry` (`characters/characters.js:20-60`) has no size. Face-up side: `character.side`.
- Base diameter: `BASE_DIAMETER` (`characters/files.js:31`), `toolModels[].radius` (`Scene.jsx:1014`).
- Terrain Size: per placement, `MAPS[id].placements[i].size` (`terrain/maps.js`), merged by `withPlacements` (`rooms/table.js`). Used only for the label (`Terrain.jsx:380`). The terrain `RigidBody` has no `userData`, so a collider does not know its Size.
- Physics: `castAlong(..., keep)` (`physics.js:62`) casts a shape along a direction with a collider filter, fixed colliders only (no models, no tools). `throwPath.js` already finds the terrain under a base (`intersectionsWithShape`, `:72-86`) and the distance to the mat edge (`matEdgeDistance`, `:43`, not exported). The mat is 36" for all maps, edges at ±18.

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

10. **Line of Sight tool.**
   - New tool kind `los`, one per side, as the other kinds. The other player sees it (Yjs entry and live pose, as the other tools).
   - **Looker:** the line starts at the base center of a looking character, along a direction (yaw). Width: the base diameter. Color: a light neutral grey, half transparent, painted on table and terrain as the other footprints.
   - **Spawn:**
     - Shift + 1 over a character: line from that character, pointed at the mat center (as `snapPose`).
     - Drag the LOS chip from the rack onto a character: the same. A drop on empty table does nothing, because the line needs a character.
     - Shift + 1 over a second character while my line exists: that character becomes the **target**. The line turns to point from the looker's base center to the target's base center.
     - Shift + 1 over the looker again, or over the target: no change. Esc (selected), key 0 and a drop on the rack remove the line, as the other tools.
   - **Turn:** a drag on the line turns it around the looker's base center (`turnAround`). Q / E and the wheel during that drag turn it the same way.
   - **Block Size:** Size of the target (its face-up side), plus the Size of the terrain the target stands on. Without a target, the looker's own Size (plus its terrain), until a target is picked. A small label at the line's end shows it, for example "Size 3 · Hulk" or "Size 2 · own".
   - **Length:** from the looker's base center to the mat edge, or to the first terrain whose Size is larger than the block Size. The terrain the looker stands on is skipped. Terrain of the same or smaller Size does not stop it. Characters do not stop it. Height does not matter: the cast box is tall, so an overhang above the line also blocks.
   - **Models move:** the line belongs to the looker and the target by id. It stays on the looker's base center, keeps its direction, and is computed again when a model comes to rest. A removed model removes the line (looker) or clears the target.
   - The app does not decide LOS. The player reads the line and decides (`docs/features/character-trays.md`, "Players apply the rules").
   - Reuse: `castAlong`, the stand-on test and `matEdgeDistance` from `throwPath.js` (move them to a shared module), `turnAround`, `ToolFootprint`, the tool lifecycle of `useTableTools`.
   - New feature doc `docs/features/line-of-sight.md`.

## Steps

1. **Plans.** Decision 1. Files: `docs/plans/*.md` (9 files), every doc and comment that points to them, `CLAUDE.md`. Check: `grep -rn "docs/plans/<name>"` finds only new paths.
2. **Esc cancels a drag.** Decision 2. Files: `characters/CharacterModel.jsx`, `scene/Scene.jsx`, `keyboard.js`, `App.jsx`, `input/bindings.js` if needed, tests for `keyboard.js`. Docs: `docs/features/key-shortcuts.md` (Esc row), `docs/features/table-tools.md` if it describes the drag.
3. **Toolbar.** Decision 9. Files: `ui/Toolbar.jsx`, `App.jsx`, `index.css`, `settings/SettingsPopup.jsx`, `log/LogPanel.jsx`, a new `components/SetupChip.jsx` or similar. Docs: `docs/features/table-tools.md`, `docs/features/game-log.md`.
4. **Phase buttons.** Decision 3. Files: `ui/Toolbar.jsx`, a new `game/PhaseButtons.jsx`, `App.jsx`, `index.css`, `settings/settings.js`, `settings/settings.test.js`. Docs: `docs/features/round-phases.md`, `docs/features/table-tools.md`.
5. **Deck text.** Decision 4. Files: `setup/GameSetup.jsx`, the log text of the deck entry. Docs: `docs/features/setup-game.md`.
6. **Cards turn toward the chooser.** Decision 5. Files: `rosters/layout.js`, `setup/setup.js`, `setup/GameSetup.jsx`, tests of the layout. Docs: `docs/features/setup-game.md`.
7. **Compare overlay.** Decision 6. Files: a new `crisis/CrisisCompare.jsx`, `setup/GameSetup.jsx`, `App.jsx`, `index.css`. Docs: `docs/features/setup-game.md`, `docs/features/roster.md`.
8. **Choose 1 overlay.** Decision 7. Files: a new `crisis/CrisisChoose.jsx`, `App.jsx`, `setup/GameSetup.jsx`, `index.css`. Docs: `docs/features/setup-game.md`.
9. **Spectator columns.** Decision 8. Files: a new `ui/SpectatorColumns.jsx`, `App.jsx`, `index.css`, `settings/settings.js`, `settings/useSettings.js`, `settings/SettingsPopup.jsx`, `settings/settings.test.js`. Docs: `docs/features/spectator-view.md`, `docs/features/table-tools.md`.

10. **LOS data and rule.** Decision 10, without UI. Character Size per side in `rosterEntry` from Jarvis (and a lookup like `characterStamina`). Terrain Size on the terrain collider (`userData` on the `RigidBody`, read through `collider.parent()`). A pure LOS length function: start, yaw, base width, block Size, terrain skipped → distance and the blocking terrain. Shared module for the stand-on test and `matEdgeDistance` (`throwPath.js` uses it too). Tests for the size lookup and the length rule (with a fake cast). Docs: `docs/features/line-of-sight.md` (Status: partly built), `docs/features/roster.md` if it lists character fields.
11. **LOS tool.** Decision 10, the tool. Files: `tabletools/useTableTools.js`, `tabletools/layout.js`, `tabletools/ToolRack.jsx`, a new `tabletools/LosTool.jsx` (or a kind in `RulerTool.jsx` if the code fits), `scene/Scene.jsx`, `selection.js`, `net/livePose.js`, `tabletools/storedTool.js`, `input/bindings.js`, `App.jsx`, `toolTips.js`. Docs: `docs/features/line-of-sight.md` (Status: built), `docs/features/key-shortcuts.md`, `docs/features/range-movement-tools.md`, `docs/features/table-tools.md`.

## Results

### Step 1: Plans

Done. 9 plans moved with `git mv` into `docs/plans/playtest/`.       20 path refs fixed in 13 files (plans, `docs/features/table-tools.md`, 5 code comments under `apps/`). `CLAUDE.md` "Docs" has the new line. No old path is left, except the example in Facts of this plan.

### Step 2: Esc cancels a drag

Done. Files (under `apps/web/src/`): `drag/pointerDrag.js`, `drag/pointerDrag.test.js`, `drag/useTokenDrag.js`, `tabletools/useTableTools.js`, `characters/CharacterModel.jsx`, `scene/Scene.jsx`, `tabletools/RulerTool.jsx`, `keyboard.js`, `keyboard.test.js`, `App.jsx`. Docs: `docs/features/key-shortcuts.md`, `table-tools.md`.

- One path: `pointerDrag.js` keeps a module-level active drag, set at the press and cleared at the end. Exports `isDragActive()` and `cancelActiveDrag()`. App key state has `drag: isDragActive()`, `keyAction` Esc → `cancelDrag` (before popups and the generic `cancel`, so the selection stays). Every `startPointerDrag` drag is covered, with no per-component handle: tactic card, crisis token and its turn handle, priority marker, model, token, HUD tool chip, ruler tool.
- Token and tool drags migrated: `tokenDragHandleRef`, `cancelTokenDrag`, `toolDragHandleRef` and the actions `cancelTokenDrag` / `cancelToolDrag` are removed. `tokenDrag` / `toolDrag` stay in the key state only for `dragging` (blocks other keys, wheel turns).
- `onCancel(reason)`: `'cancel'` (Esc) or `'lost'` (lost tie). Model: Esc restores the start pose (position + rotation stored in `onStart`), zero velocities, dynamic; clears floor mode and drag flags; Scene drops a pending Q / E turn (`onDragEnd(cancelled)`). Lost tie keeps the old behavior (body stays for the remote mode): the other player owns the model, a put back would fight their drag. Tactic card, token, marker `onCancel` unchanged (they restore on both reasons, as before).
- Rest path: `releaseAtEnd` is false for models, so the claim is released by the Scene loop when the dynamic body sleeps. After the cancel the body is dynamic at a resting pose, so it falls asleep, `onRest` writes the start pose and the claim ends as after any drag. Not run in a browser (user rule).
- RulerTool drag (not listed): got an `onCancel` that ends the drag, so Esc leaves the tool where it is. No put back.
- Checks: format, lint (46 warnings, same as before), test (695 pass), build ok.
- Open: Esc on a press that has not passed the threshold also cancels it (no click). A model that is cancelled before `onStart` has no start pose and is not moved.

### Step 3: Toolbar

Done. Files (under `apps/web/src/`): `ui/Toolbar.jsx`, `settings/SettingsPopup.jsx`, `App.jsx`, `index.css`, new `useHudTop.js`. Docs: `docs/features/table-tools.md` (new "Toolbar" section, Debug section), `game-log.md`, `roster.md`, `rooms.md`, `spectator-view.md`.

- One row, `flex-wrap: nowrap`. Left (`.toolbar-left`): Lobby, room code, Copy link, players, Setup chip. Middle (`.toolbar-middle`): Mat, Range, Move, Deploy, Phase; scrolls sideways, no scrollbar. Right (`.toolbar-right`, `flex: none`): Library, Log, Spectator, Settings.
- Setup chip (Sandbox, not multiplayer): `setupOpen` state in `App`, panel `.toolbar-setup-panel` holds the Crisis selects and Roster fields. Counts as a popup in the key state, so Esc closes it through `closePopups`. Outside click: a `pointerdown` listener, as `DieMenu` in `DiceKeys.jsx`. No new component file (the chip is in `Toolbar.jsx`).
- Debug (Mode dev only, Labels in every build, as before) is a section of `SettingsPopup`.
- `--hud-top`: `useHudTop(rootRef)` measures `.hud-top` with a ResizeObserver and sets the variable on the HUD root (top + height + 8). `:root` default 56px. `.library`, `.log` (and `.log-bar`) and `.hud-notice` use it.
- Checks: format, lint (46 warnings, same), test, build ok. Not run in a browser (user rule).

### Step 4: Phase buttons

Done. Files (under `apps/web/src/`): new `game/PhaseButtons.jsx`, `ui/Toolbar.jsx`, `ui/HudWarnings.jsx`, `App.jsx`, `index.css`, `settings/settings.js`, `settings/settings.test.js`. Docs: `docs/features/round-phases.md`, `table-tools.md`.

- `PhaseButtons` renders the Power and Cleanup buttons that the settings put in the HUD, a fixed group bottom right (`.phase-buttons`, buttons 60 px tall, 17 px text). Same handlers, `aria-disabled`, titles as before; Power calls `handlePowerPhase(playedSides)`, so it gives Power to the sides this browser plays. The toolbar Phase group and its 4 props are removed, not copied.
- `HudWarnings` has a `lifted` prop (a phase button is in the HUD): `.hud-warnings--lifted` sits at bottom 84 px, above the group.
- Settings: `version: 2`. Defaults `power` and `cleanup` are `'hud'`. A read of saved settings with another version sets both to `'hud'` once; the next write stores the version and the saved value is respected.
- Checks: format, lint (46 warnings, same), test (696 pass), build ok. Not run in a browser (user rule).


### Step 5: Deck text

Done. Files (under `apps/web/src/`): `setup/names.js` (new `their`), `setup/GameSetup.jsx` (new `decides`, `stepChoice`, button title), `log/log.js`, `log/log.test.js`. Docs: `docs/features/setup-game.md`, `game-log.md`.

- Hint: "Decide if you want to play on your Secure or Extract crises." / "Waiting for Nelly to decide if they want to ..." / "Blue decides if they want to ...". Browse back and log: `says(side, 'play')` + "on your/their X crises." Button title "Play on your Secure crises: draw 2 of them".
- `chooses` unchanged (other steps use it); `decides` is a sibling. `chose` still used by other steps.
- Checks: format, lint, test, build.

### Step 6: Cards turn toward the chooser

Done. Files (under `apps/web/src/`): `rosters/layout.js`, `setup/setup.js`, `setup/GameSetup.jsx`, new `rosters/layout.test.js`, `tabletools/layout.test.js`. Docs: `docs/features/setup-game.md`.

- Sign: card top is local -z, yaw y turns it to (-sin y, -cos y). Chooser host (+z, camera from +z, up = -z): yaw 0. Guest (-z): yaw π. Same as `cardYaw` of the roster cards. Other cards keep π/2.
- `crisisRows` adds `facing`: deck step, the Priority player's two rows; first/second step, the `use` row; else null. `crisisRowLayout(team, type, codes, drawn, facing)`.
- Spacing: turned card is 2.66-2.75" in x, 4.81" in z. Row still along z, pitch height + 0.3, scaled so it ends at z 37 (5 cards: 0.968, z 14.9 ... 34.7). Columns keep x (Secure -32.6, Extract -26.6, drawn -23.1). Gap center for deck buttons unchanged. 2 drawn cards: z 14.96, 20.1, end 22.37. `USE_BUTTON_X_TURNED` = -25.1 (was -26.1).
- Tests: yaw per chooser and step, no overlap in a row and between deck rows, end before the table edge; `crowded()` now also holds the turned rows (no overlap with the rest of the table).
- Checks: format, lint (no new warnings), test (701 pass), build ok. Not run in a browser (user rule).

### Step 7: Compare overlay

Done. Files (under `apps/web/src/`): new `crisis/CrisisCompare.jsx`, new `setup/deckButton.js`, `setup/GameSetup.jsx`, `scene/Scene.jsx`, `App.jsx`, `index.css`. Docs: `docs/features/setup-game.md`, `roster.md`.

- `deckButton.js` holds `lockedTitle`, `deckProblem`, `deckButton(setup, team, type, parsed, ctx)` (lock, disabled, title) and `TYPE`. The table `DeckButtons` and the overlay use it.
- `CrisisRow` calls `onOpen(code)`; `GameSetup` calls `onCrisisOpen({ team, type, code, drawn: row.use })` (prop through `Scene`). `App.handleCrisisOpen` sets `openCrisis` `{ team, type, code }`. Hook for step 8: route `drawn` there (first/second step) to the Choose 1 overlay. Today `drawn` cards open the compare overlay too.
- `openCrisis` is in the popup key state and in `closePopups` (Esc). Shown only in rollOff/deck/first/second (`crisisShown`). Arrows: `rosterOpen` is true for it, `handleRosterCardStep` calls `crisisStepRef` that the overlay sets, and that steps the top carousel.
- Auto-open: effect in `App`, real setup at step `deck`, no `view`, both rosters, Priority player (or no `mySide`); `autoOpenedRef` holds `"<setup id>:deck"`. Tab Secure, first card. A page reload in the deck step opens it again (the ref is not saved).
- Overlay: `.roster-popup` frame and backdrop, `Carousel` (key per side and tab), card `--card-h` min(24vh, 230px). Empty deck shows "No Secure cards".
- Checks: format, lint (46 warnings, same), test (701 pass), build ok. Not run in a browser (user rule).

### Step 8: Choose 1 overlay

Done. Files (under `apps/web/src/`): new `crisis/CrisisChoose.jsx`, new `setup/useAutoOpen.js`, `setup/deckButton.js`, `crisis/CrisisCompare.jsx` (exports `CrisisFace`), `setup/GameSetup.jsx`, `App.jsx`, `index.css`. Docs: `docs/features/setup-game.md`.

- `pickButton(setup, name, ctx)` in `deckButton.js` gives lock and title; the table Choose chip and the overlay button both use it.
- `useAutoOpen(key, onOpen)`: one hook, one ref each, for both overlays. Key `"<setup id>:deck"` (compare) or `"<setup id>:<step>"` (Choose 1); null when this screen is not the chooser's, a step is browsed or a roster is missing.
- `openChoose` in App holds the step key it was opened for; it shows only while the setup is at that key, so a step change closes it. Not in `crisisShown`, so arrows do not route to it. It is in the popup key state and `closePopups`.
- `handleCrisisOpen` with `drawn` opens Choose 1 (and closes the compare overlay); other cards close Choose 1.
- Non-chooser: cards with no button and "Waiting for X to choose a card."
- Checks: format, lint (no new warnings), test (701 pass), build ok. Not run in a browser (user rule).

### Step 9: Spectator columns

Done. Files (under `apps/web/src/`): new `ui/SpectatorColumns.jsx`, new `game/heldTokens.js`, `scoreboard/board.js` (+ test), `game/usePhaseActions.js`, `characters/TrayPopup.jsx`, `scene/Scene.jsx`, `settings/SettingsPopup.jsx`, `settings/settings.js` (+ test), `settings/useSettings.js`, `App.jsx`, `index.css`. Docs: `docs/features/spectator-view.md`, `table-tools.md`.

- `scoreFromMarkers(markers)` gives `{ host, guest, round }`; the Cleanup Phase and the columns both use it. `nextRoundSpot` stays (tests), no longer used by the app.
- `heldTokensByCharacter(tokens)` is shared by `Scene` (badges) and the columns. `OnToken` is exported from `TrayPopup`; with no `onClick` it is a static span.
- Columns: `.spectator-col`, size by `--spectator-size`. Right column sits 44 px under `--hud-top` (below the Log bar) unless the Log is open. Both end 84 px above the bottom on the right (phase buttons); max-height + inner scroll.
- Hidden squad: `hiddenSquads && team !== mySide && !placedSides(setup)[team]`.
- Settings: `spectator: { size }`, slider step 5.
- The portrait is always `characterPortrait`; no state says a character is transformed (a second form is a second model), so `transformPortrait` is not used.
- Checks: format, lint, test, build ok. Not run in a browser (user rule).

### Step 10: LOS data and rule

Done. Files (under `apps/web/src/`): new `characters/size.js`, `tabletools/losLength.js`, `characters/terrainUnder.js` (+ tests), `characters/characters.js`, `terrain/Terrain.jsx`, `characters/throwPath.js`, `physics.js`. Docs: new `docs/features/line-of-sight.md`. `roster.md` lists no character fields, so no change.

- `characterSize(slug, side)` (like `characterStamina`) from `rosterEntry.sizes` (`cardSizes`, `sideSize` in `size.js`). A grunt has its front size on both sides.
- Terrain `RigidBody` has `userData: { id, size }`. `terrainSize(collider)` reads it through `collider.parent()`; null for the table.
- `losLength({ start, yaw, width, blockSize, skipped, cast })` gives `{ distance, blocker }`, `blocker` is `{ collider, size }` or null. `losCast(world, rapier)` is the real cast (tall thin box, `castAlongHit` in `physics.js`). `castAlong` uses `castAlongHit`.
- `terrainUnder.js`: `standingColliders(world, rapier, start, ground, radius, halfH)` (handles of the colliders under a base) and `matEdgeDistance`. `throwPath.js` uses both.
- Checks: format, lint (no new warnings), test, build ok. Not run in a browser (user rule).

### Step 11: LOS tool

Done. Files (under `apps/web/src/`): new `tabletools/LosTool.jsx` (`LosTool`, `OtherLos`), `tabletools/losBlock.js` (+ test); changed `tabletools/RulerTool.jsx`, `Scene.jsx`, `ToolRack.jsx`, `storedTool.js`, `terrainUnder.js`, `throwPath.js`, `footprintProjection.js`, `LiveSync.jsx`, `tabletools/useTableTools.js`, `layout.js`, `dropShape.js`, `selection.js`, `useSelection.js`, `input/bindings.js`, `App.jsx` (+ tests). Docs: `line-of-sight.md` (Status: built), `key-shortcuts.md`, `range-movement-tools.md`, `table-tools.md`.

- Entry of kind `los`: `{ which: true, spawn, looker, target, pose }` (`losEntry`, `losFields`, `sameLos`). Shift + 1 is the action `los` (`overPiece`). It spawns the line, or sets the target (`placeLos`). The rack drag uses the same function. LOS chip in column 1 under L (the column is not deeper than R5, so the rack size is the same).
- The line is a kinematic body with no collider at the looker base center. It reuses `useDragTool` (always a turn, `turnAround`), `ToolFootprint` (new props `oneSided`, `opacity`), and a shared `useRestStore` (taken out of `Tool`). `useDragTool` plans can set `refresh`, so Q / E and the wheel show during a turn drag at once.
- `useLosLine` works out the length: `standingColliders` under the looker (skipped) and the target, `losBlock` (block Size and label), `losLength`. The footprint slots are 14 (two more tools).
- The other player follows the looker model and the live yaw (`tool:los`), and works out the same length with its own physics.
- Removed looker: `onToolRemove` removes the line. Removed target: `target: null`.
- Differs from decision 10: the length is worked out when a model has not moved for 0.15 s (not on a rest event of the body). A turn is worked out at once. A click on the LOS chip removes the line, or starts it at the selected character. A "drop on the rack" is a turn drag that ends with the pointer over the own rack (the line never moves).
- Checks: format, lint (no new warnings), test, build ok. Not run in a browser (user rule).
