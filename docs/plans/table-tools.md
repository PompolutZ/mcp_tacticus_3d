# Plan: Tools on the table, settings menu

Requested by the user on 2026-10-11. Plan 6 of `docs/plans/playtest-1.md`. Status: plan written on 2026-10-11. The user asked to run all coder steps and to check the result after the last step, so the plan was not shown for an OK first.

The feature is `docs/features/table-tools.md`. Each step makes one commit and writes its **Result** below.

## Request

Notes from the first game: "More buttons on the table" (21), "The Power button on the table, facing each player, near their roster" (22), "The Cleanup button near the scoring board" (23).

Answers of the user, from `docs/plans/playtest-1.md`, plan 6:

- TTS players expect every tool of the TTS table on the table, for example below their character trays. The table can be larger if needed. The Power button lies near each roster, facing its owner. The Cleanup button lies near the scoring board.
- The plan starts with a list of every button and tool that the mod has on the TTS table.
- **Settings menu.** Stored in the browser (localStorage). For each tool: on the table or in the HUD. It also lists the keys of the app and what each key does. Changing keys comes later.

## TTS tools and buttons

Read on 2026-10-11 from the mod file `~/Library/Tabletop Simulator/Mods/Workshop/3036795456.json` (saved 2026-10-06): the object list, the `createButton` and `createInput` calls in each object script, and the Global XML UI. Places are TTS (x, z). The mod has a Red and a Blue copy of each player object, at −z and +z. In the app, the mod's Red seat is the app's blue side (`src/scoreboard/board.js`).

### Objects of each player

| TTS object | TTS place | Tools and buttons | The app before this plan |
|---|---|---|---|
| Tool Tray | (23.5, ±12.75), between the mat and the dice tray | Holds 7 tools: Range 2, 3, 4, 5 and the Short, Medium and Long movement tools. **Refresh** puts every tool back on the tray. **Settings** shows 3 toggles: a tool dropped off the play area goes back to the tray (on by default), highlight the snap target while a tool is held (off), highlight characters within range (on). Tool skins: **←** **→**, a URL field and **Import**. Keys 1–9 and 0 (Scripting 1–10) | No tray. The tools come from the keys and the toolbar groups **Range** and **Move** |
| Range 2–5 tools | on the Tool Tray | **Snap N** / **Unsnap** (snaps to the nearest character), **Place N** / **Done**. Range 2 also has **Snap 1** / **Unsnap** and **Place 1** / **Done** | R1–R5. A key or a drag snaps a tool, Q / E frees it. **Place**, **Place 1**, **Place 2** |
| Short, Medium, Long movement tools | on the Tool Tray | **Bend** / **Lock**, **Snap** / **Unsnap**, **Place** / **Done** / **Undo** (a right click moves the full distance, **Undo** moves the character back), **Toward/Away** / **Toggle: Toward** / **Toggle: Away**, **Throw Push** / **↑** (straighten) | Bend (the hinge button), **Place**, **Throw / Push** (straightens first), a separate Toward / Away tool (key 6) with its own toggle. No **Undo**, no **Snap** button |
| Dice Tray | (36, ±11.4) | **Clear**, **−**, the total (a click clears the tray and sets up the same number of dice again), **+**, **Roll**. 6 face plates: a click rerolls one die of that face. **Refresh** reloads the script | On the table at (27, ±10.1): **Clear**, **−**, N, **+**, **Roll**, **+N Crits**. A face plate opens a menu: reroll one, change one to. N is not a button |
| Roster Maker (bag) | (−45.6, ±14.6) | Name buttons, a roster field ("Paste MCT codes or drop cards inside"), **Create Roster**, **Reset**, picture **<** **>** and **Change Picture**, type **<** **>**, a **Leader** toggle, a tray color toggle with R, G, B fields, a tool image URL field | The roster field in the toolbar (Sandbox, single player room). A multiplayer room gets its rosters when it is made |
| Roster Tray | (−41.4, ±14.6) | **Show Roster**, **Hide Roster**, **Edit Roster**, 3 affiliation buttons, **Auto Activate** (puts the squad on the table), **Select Secure**, **Select Extract**, saved squads 15–20 (left click loads, right click saves), **Save Roster**. Draft modes: **Start Draft**, **Start Collector**, **SELECT**, **USE**, **ADD**, **Change Art**, Priority toggles | Roster cards on the table during the setup, and the setup panel (deck, cards, threat, edge, squad, **Ready**) |
| Tray Spawner | (−32.5, ±15.2) | **Activate Character** (a tray for each card dropped on it), **Add/Remove Character Tray**, affiliation **←** **→** with a token and a color swatch, **Hidden Zone**, **Model Type: 3D** (3D model or standee), **Update Trays**, **Custom Token** with a URL field. Custom card: Healthy and Wounded Stamina fields, **Submit** | The Library (characters). The setup puts the squads on the table |
| Character tray, one per character | a row at z ±28.25 | **Flip Card**, Power (left click +1, right click −1), Damage (the same), **Remove Card**, **<** **>** (swap with the next tray). Special trays: grunt Damage, **Spawn Construct**, Doomsday Device, Ultron AI (14 buttons), Gamma Aura and other rolls | Damage **−** **+**, Power **−** **+**, **Flip**, **Remove**, held tokens. No swap |
| Tactic Tray | (0, ±21.15) | No buttons. 5 card places | A tactic tray with 5 slots |
| VP Tracker | (−32.5, ±10.8) | No buttons. A marker that players drop on the scoring board | VP marker |
| Card bags | x −20 … −28, z ±12 … ±16 | Character Cards, Tactic Cards, Secure and Extract Crisis Cards, Infinity Gems. No buttons | The Library |

### Shared objects

| TTS object | TTS place | Tools and buttons | The app before this plan |
|---|---|---|---|
| Automatic Crisis Deployment | (−32, 0), between the scoring board and the table edge, with 7 button blocks ("ASCComp") | **Setup Map** (the terrain of the map card on it), **Setup Crisis** / **Clear Crisis** (the tokens of the crisis cards on it), **Rotate Map**, deploy lines **Off** / **On**, **Random Map**, **Team Event Maps**, **Random Secure**, **Random Extract**, **Nudge Terrain**, **Default Conditions** / **Alt Conditions**, **Normal Crisis Mode** / **Additive Mode** | Toolbar: the map select, **Mat** **↺** **↻** and the Crisis selects (Sandbox, single player room). The setup in a multiplayer room. **Deploy** → **Lock** |
| Tracker (scoring board) | (−23.1, 0) | **Toggle Score Board Skin**, **Toggle Score Board Type**, **Create Custom Player Token** | The scoring board, no buttons |
| Round Tracker | (−20.1, −5.2) | No buttons. A marker | The round marker. **Cleanup** moves it |
| Priority Token | (−21.9, 7.6) | No buttons. A marker. The HUD shows who has it | None (plan 4 of the playtest) |
| MCP Chess Clock | (−40, −0.7) | A swap button for each player, start / pause, **Count:** up or down, **Pause All Clocks**. Timers in the HUD | None |
| Token Tray | (23.4, 0), between the two dice trays | **Spawn all tokens**: a copy of every token | The Library, tab Tokens |
| Play mat | (0, 0) | **<** **>** change the mat picture | The map sets the mat |
| Bags | x −45 and −32 | Make Your Own Map, Organized Play, One Shots, Terrain Cards, Core Set. No buttons | The map select |
| Mod Mechanics | (49.5, −6.6) | A PDF | None |
| UI Controller | (50, 32), off the play area | **Token UI: On**, **Hide UI**, **Show UI** | — |

### HUD (Global XML UI)

- Top left and top right: the dice result of each player (Hits, Crits, Wilds, Blocks, Blanks, Fails). A click changes the dice color.
- Top: player names, VP, the Priority icon (a click switches it), the Team Tactic cards (a click shows one), the Secure and Extract names, the round.
- The timers of the chess clock (Blue, Red, game).
- A panel for each character: portrait, tokens, Damage and Power bars, objective, status, gems.
- Bottom right, for each player: **Automatic Power Phase** (that player's trays only), **Automatic Cleanup Phase** (both players), **Mod Settings**. For other seats: **Toggle Telecasting**.
- The **Mod Settings** panel: token UI on / off, **Restore Defaults**, hide / show / customize the character info UI, streamer view on / off, header / dice / characters / timers on / off, **Top Down On** / **Off**, Jarvis voice on / off, lock the streamer view.

The app before this plan: the **Rolls** panel, **View** → **Spectator** (badges above the models), **Phase** → **Power** and **Cleanup** in the toolbar.

### What this plan puts on the table

| TTS | App, after this plan | Step |
|---|---|---|
| Tool Tray with its 7 tools, keys 1–9, 0 | A tool rack for each player, below their character trays: R1–R5, S, M, L, T/A | 2, 3 |
| **Automatic Power Phase** (HUD) | A **Power Phase** button for each player, at the right end of their rack | 1 |
| **Automatic Cleanup Phase** (HUD) | **Cleanup Phase** in the board strip, next to the scoring board | 1 |
| Deploy lines **Off** / **On** (Automatic Crisis Deployment) | **Deploy Lock** in the board strip | 1 |
| **Rotate Map** (Automatic Crisis Deployment) | **↺** **↻** in the board strip, not in a multiplayer room | 1 |
| **Mod Settings** (HUD) | **Settings** in the toolbar: table or HUD, keys, mouse | 4 |

Already on the table: the dice trays, the tactic trays, the character trays, the scoring board, the VP and round markers.

Not in this plan. See [Open questions](#open-questions):

- Chess clock, Token Tray, tray swap **<** **>**, **Undo** of a move, saved squads, a click on the dice total.
- Tool Tray **Refresh**, **Settings** and skins. The app tools cannot get lost, the range marks are always on, and skins only change the look.
- **Snap** / **Unsnap** buttons on a tool. A key or a drag snaps a tool, Q / E frees it.
- Roster Maker, Roster Tray, Tray Spawner, card bags: the roster field, the setup and the Library do this.
- **Random Map**, **Random Secure**, **Random Extract**, **Team Event Maps**, **Nudge Terrain**, condition art, additive mode, scoring board skins, custom player token, mat pictures.
- The HUD panels. They are not tools on the table.

## Facts in the app

- `src/table.js`: the table is 72" × 68". `TABLE_WALLS` and the table mesh and collider in `Scene.jsx` follow `TABLE_DEPTH`. `scripts/dice-sim.mjs` builds the same table.
- Start view: `CAMERA_TARGET` [0, 0, 10.4] and `CAMERA_POSITION` [0, 32.5, 42.9] in `App.jsx`, red: z with the other sign, fov 50. Its bottom edge is just past the blue Give sources (z 30.65 at x = 0).
- Blue side, from the mat edge (z = 18): the tactic tray plate z 18.3 … 22.4 (|x| ≤ 8.65), tactic piles past its left end (`tacticPilePlace`), the character tray row from z 22.7. The plate of a tray with two cards ends at 31.85, and its Give sources at 33.75. A spare model stands past the Give sources, up to about z 33 (`src/characters/trays.js`). The tray row is centered on x = 0 and can be as wide as the table.
- Dice trays: x 20.25 … 33.75, z 1.7 … 18.5 (blue).
- Scoring board: x −27.125 … −19.125, z −9 … 9. Crisis cards on its ends: x −25.5 … −20.7, z ±9.5 … ±12.25. VP markers start at (−32.7, ±10.8).
- Setup (only while the setup shows): the panel at x −31.56, z 0, up to 17.6" long. The crisis deck rows at x −35 … −24.2, z ±12.55 … ±27.5. The drawn crisis cards at x −25.5 … −20.7 from z ±12.55. The roster rows at z 22.7 … 29.5. `GameSetup.jsx` has `OnTable`: a drei `Html transform` that lies flat and reads like the board (top to −x), 1 CSS px = 0.04".
- Tools: `table.tools.<side>.<kind>`, kind `range` | `move` | `angle`, one of each kind per side (`src/components/storedTool.js`). `ownSide` in `App.jsx` is the side of the browser. The Sandbox and a single player room are Blue: they have Blue's tools only. `playedSides` is the own side in a multiplayer room, both sides otherwise.
- Toolbar buttons: `handleRangeClick`, `handleMoveClick`, `handleAngleClick` toggle a tool. A new tool snaps to the selected piece, else it spawns free at the table point in the middle of the screen (`toolbarSpawnAt`). Keys: `handleToolKey`, `handleAngleKey`: over a piece (`hoveredRef`) it is selected and the tool snaps to it, over the table (`toolPointRef.current.atPointer()`) the tool spawns free there.
- Tool meshes: `useRangeParts(mesh, team)` and `useMovementParts(type, team)` in `RulerTool.jsx` (OBJ meshes, the toolbox texture, the player tint). The movement tools are 3.15", 5.05" and 7.07" long, 0.56" wide. The range tools 2–5 are 3", 6", 8" and 10" long, 1" wide (`RANGE_TIP`, `MOVE_TIP` are half lengths).
- A free spawn of the own side turns to `freeSpawnYaw(side)` (`storedTool.js`).
- Drags: `startPointerDrag` (`src/drag/pointerDrag.js`), `tablePoint` (`src/drag/tablePoint.js`). The Library token drag (`tokenDrag`, `startTokenDrag`, `TokenDragPreview`) shows a piece under the pointer and drops it on release. Escape cancels it in `handleKeyDown`.
- `handlePowerPhase` gives Power to the characters of `playedSides` on the board. `handleCleanupPhase` with `cleanupDisabled` and `cleanupTitle`. `deployLine` is `game.deployLine`. `handleTurnMat(direction)`. All in `App.jsx`.
- Hover label of a token: `token-face-label` in `TokenFace.jsx`.
- Popups: `Overlay.jsx` (`CardPopup.jsx`, `NewRoomDialog.jsx`). `handleKeyDown` lets only Escape through while a popup is open.
- localStorage: keys start with `mcp-assist-3d/`. `rooms/store.js` wraps each read and write in try/catch.

### Start view, measured

A calculation on 2026-10-11 with the camera above, in a 16:10 window. The visible half width at the blue end is 23.6" at z = 30.65 and 21.8" at z = 34. The far table edge (z = −34) is at 87% of the view height, so the top 13% shows only the space past the table. Moving target and position 6.4" toward blue keeps the red trays in view and puts z ≈ 37 at the bottom edge.

## Decisions

1. **Layout.** The table gets 8" deeper: 72" × 76". The 4" at each end hold the rack band. Numbers for blue; red is the same with z → −z, turned 180°.
   - **Tool rack:** x −15.2 … 15.2, z 34.2 … 36.8, centered on x = 0. It lies past the deepest tray parts (z 33.75), so it never meets the trays, also with 12 trays.
   - **Power Phase button:** in the rack band, at the owner's right end of row 2 of the rack.
   - **Board strip:** in the corner between the mat and the end of the scoring board: x −20.6 … −18.3, z 12.6 … 18.0. Nothing else lies there, also during the setup.
   - The places are constants in `src/tabletools/layout.js`, with tests for the gaps.
2. **Start view.** It moves 6.4" toward the own side, so the own rack and the Power button are in view. The view still shows the whole mat and the red trays.
3. **Settings never change the layout.** A setting only shows or hides a piece. So the two browsers of a room have the same table.
4. **Rack content.** Real-size tool meshes in the player tint, no physics body. Row 1 (mat side), from the owner's left: an **R1** chip, R2, R3, R4, R5. Row 2: S, M, L, a **T/A** chip. R1 has no tool of its own (it is the R2 tool), and T/A is a copy of the long tool. So they are chips.
5. **Out state.** A tool that is on the table shows as a faint copy on the rack, the same as an empty place on the TTS tray. R1 on the table: R2 is faint and the R1 chip is on. T/A: the chip is on.
6. **Rack click** = the toolbar button of that tool (on / off). **Rack drag** = the tool key at the release point: over a character or a crisis token it snaps to it, over the table or terrain it spawns free there, over the rack or off the table nothing happens. While the drag lasts, a flat outline of the tool follows the pointer. Escape cancels it.
7. **Return to the rack.** A drag of an own tool that ends with the tool center over the own rack removes the tool. TTS has this as the tray setting "Cleanup" (on by default).
8. **Which racks.** A multiplayer room shows both racks. Only the own rack can be used. The other rack shows the other player's tools on the table, as faint copies. The Sandbox and a single player room show only the blue rack, because that browser has only Blue's tools.
9. **Power Phase on the table gives Power to its own side only**, as the TTS button does. In the Sandbox, a player presses both buttons. The toolbar **Power** keeps its rule: all sides the browser plays. In a multiplayer room, the other player's button is disabled.
10. **Board strip**, one for each player, both the same. Row 1: **Cleanup Phase**. Row 2: **Deploy Lock**, **↺**, **↻**. It reads like the scoring board and the setup panel (top to −x). The buttons change shared state, so any player can press them, as the toolbar buttons. **↺** **↻** only where the toolbar has them: not in a multiplayer room.
11. **Settings menu.** **Settings** at the right end of the toolbar opens a popup. For 5 items, Table or HUD: Range and movement tools, Power Phase, Cleanup Phase, Deploy Lock, Mat turn. Default: Table. Table hides the toolbar buttons of the item, HUD hides the table piece. The keys work in both cases. Stored in localStorage `mcp-assist-3d/settings`, per browser. The popup also lists the keys and the mouse controls of the app, from a data module.
12. **Other plans.** Plan 1 Part 1 changes `handleToolKey` and `handleAngleKey`. The rack drop calls the same code with the hovered piece and the drop point, so it gets the plan 1 rule when the branches merge. Plan 2 renames the side keys `blue` / `red`. New code reads sides from the existing constants and does not repeat the strings, so the rename touches few lines.

Sketch, blue side, seen from above (x to the right, the blue player at the bottom):

```
                         x = -20.6 … -18.3        x = -15.2 … 15.2
z = 12.6 … 18.0          [board strip]
z = 18                   ─────────────── mat edge ───────────────
z = 18.3 … 22.4                                   tactic tray
z = 22.7 … 33.75                                  character trays, Give sources
z = 34.2 … 36.8                                   [R1][R2][R3 ][R4  ][R5   ]
                                                  [S][M ][L  ][T/A]   [Power Phase]
z = 38                   ─────────────── table edge ─────────────
```

## Step 1: Table depth, start view, Power Phase buttons, board strip

Work:

1. `src/table.js`: `TABLE_DEPTH` 76. Update the comment (the rack band, `docs/features/table-tools.md`).
2. `src/tabletools/layout.js` (new, plain module): the places of decision 1 for each side: the rack plate, the slot of each rack tool and chip (for step 2), the Power Phase button, the board strip. A function that tells whether a table point `{ x, z }` is on the rack of a side (for step 3). The turn of each piece (it faces its owner; the board strip reads like the board).
3. `src/tabletools/layout.test.js`: every piece lies inside the table. The rack and the Power button start past z 33.75 (compute it from `trays.js`: plate of a two-card tray plus two rows of Give sources). No piece overlaps the dice trays, the scoring board, the crisis cards on its ends, the tactic tray, the VP marker start places, or the drawn crisis cards and deck rows of the setup. Red is the mirror of blue.
4. `App.jsx`: move the start view 6.4" toward the own side (`CAMERA_TARGET`, `CAMERA_POSITION` and the red ones). Check the numbers with the camera math in [Start view, measured](#start-view-measured): in a 16:10 window the whole blue rack band is in view, and the red trays are too.
5. `components/OnTable.jsx` (new): move `OnTable` out of `GameSetup.jsx`, with the rotation as a prop. Two rotations: reads like the board (the one of `GameSetup.jsx`), and faces the owner of a side (the same as the tray controls). `GameSetup.jsx` imports it. No other change in `GameSetup.jsx`.
6. `App.jsx`: `handlePowerPhase(sides)`. The toolbar passes `playedSides`. A table button passes its own side. With one side, the message names it: "Power Phase (Blue): Hulk 4 → 7, …".
7. `components/TableButtons.jsx` (new), rendered in `Scene.jsx`:
   - `PowerPhaseButton` for each side: lies flat, faces its owner, chip in the player color, label "Power Phase", title as the toolbar chip. In a multiplayer room the other side's button has `aria-disabled` and the title "Only the Red player presses this." (with the right name).
   - `BoardStrip` for each side: **Cleanup Phase** (the `aria-disabled` and title of the toolbar chip), **Deploy Lock** (on state with the active style, title as the toolbar chip), **↺** **↻** (titles as the toolbar, not in a multiplayer room).
   - The toolbar keeps all its buttons in this step. Step 4 hides them by the settings.
8. Run `pnpm --filter web dice-sim --quick` before and after the table change, with the same seed. The walls are far from the dice trays, so the reports should be the same. Write both in the Result.
9. Docs: `docs/features/table-tools.md` (status, what is built), `docs/features/round-phases.md` (the Power Phase button of each side gives Power to that side, decision 9; where the buttons lie), `docs/features/key-shortcuts.md` ("Start view": the new numbers), `docs/features/character-trays.md` (the table size 72" × 76" and the start view sentence), `README.md` ("Scene units": the table size).

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. Sandbox, two rosters, squads on the table. Space: the start view shows the whole mat, the red trays, and the blue rack band with the **Power Phase** button.
2. Blue **Power Phase** gives Power only to blue characters on the board. Red **Power Phase** only to red ones. The toolbar **Power** still gives both.
3. The board strip lies in the corner between the mat and each end of the scoring board. **Cleanup Phase** has the same disabled state and title as the toolbar chip, and works from both strips.
4. **Deploy Lock** in a strip and **Lock** in the toolbar show the same state.
5. **↺** **↻** turn the mat.
6. Multiplayer room, two browsers. The other player's **Power Phase** is disabled. The strips have no **↺** **↻**. **Cleanup Phase** works from either browser.
7. Dice still land in the trays and stay on the table.

### Result

Done.

- `table.js`: `TABLE_DEPTH` 76, comment updated.
- `src/tabletools/layout.js` (new): rack plate (x ±15.2, z 34.2 … 36.8), `rackSlots(side)` (R1 chip, R2–R5 in row 1 from the owner's left, S, M, L, T/A chip in row 2), `powerButton(side)` (6" × 1.2", owner's right end of row 2), `boardStrip(side)`, `onRack(side, point)`, `rackYaw(side)`. Row 1 fills the plate width: the gap between its slots is 0.2". `layout.test.js`: 8 checks (inside the table, past z 33.775, 12 trays, no overlap with the dice trays, scoring board, crisis cards, tactic trays, VP markers and the setup areas, mirror, `onRack`).
- `src/tabletools/toolTips.js` (new): `RANGE_TIP` and `MOVE_TIP` moved out of `RulerTool.jsx`, so Node tests can read them. `RulerTool.jsx` and `Scene.jsx` import them.
- Start view: target [0, 0, 16.8], position [0, 32.5, 49.3], red the same with z → −z. Camera math (fov 50, aspect 16:10): the bottom edge meets the table at z = 37.47 (half width 23.4"), the top edge at z = −39.99. Before: 31.07 and −46.39. So the blue rack band (z ≤ 36.8, x ±15.2) and the red trays (z −22.7 … −33.75) are in view, and the whole red end of the table up to −38.
- `components/OnTable.jsx` (new): `OnTable` with a `rotation` prop (default `BOARD_READ_ROTATION`), and `OWNER_FACING_ROTATION` (blue `[-π/2, 0, 0]`, red `[-π/2, 0, π]`). `GameSetup.jsx` imports it.
- `App.jsx`: `handlePowerPhase(sides)`. The toolbar passes `playedSides`. With one side the message is "Power Phase (Blue): ...". A `tableButtons` prop carries the handlers and states to `Scene.jsx`.
- `components/TableButtons.jsx` (new), rendered in `Scene.jsx`: `PowerPhaseButton` and `BoardStrip` for each side. CSS: `.table-button`, `.table-strip-row` in `index.css`.
- Docs: `table-tools.md` (status), `round-phases.md`, `key-shortcuts.md`, `character-trays.md`, `README.md` ("Scene units" also said 72 × 48, now 72 × 76).
- Dice sim, `--quick`, seed 1. Before the change: single die 300 valid / 304, tilted 1.3%, out-of-well 0.3%, chi-squared 9.81 PASS; 10 dice 305 valid / 310, tilted 1.6%, out-of-well 2.9%, chi-squared 4.11 PASS, settle avg 3.22 s, max 3.88 s; 0.278 ms/step. After: the single die is identical; 10 dice 304 valid / 310, tilted 1.9%, out-of-well 2.9%, chi-squared 4.79 PASS, settle avg 3.20 s, max 3.88 s; 0.273 ms/step. The run is deterministic (repeated twice). The multi-die difference is one throw: the table collider is deeper, so its numbers differ slightly and the sim, which is chaotic, took a different path. No fairness or out-of-well change.
- Differs from the plan: none in behavior. The table title of the Power Phase button is the toolbar title ("Power Phase: each of your characters gains Power"). A spare model with a 1" base after one row of Give sources also ends before the rack (tested). A spare model past two rows of Give sources can reach about z 35 (center 35.05 for a 1" base), into the rack band; this is rare (the plan assumed 33).

## Step 2: Tool rack, click

Work:

1. `RulerTool.jsx`: export what the rack needs to draw a tool mesh (`useRangeParts`, `useMovementParts`, the tool lengths). No change in behavior.
2. `components/ToolRack.jsx` (new), rendered in `Scene.jsx`:
   - The plate, with the material of the tray plate (`CharacterTray.jsx`).
   - The tool meshes at their slots, lying along x, in the player tint. A tool that is on the table is a faint copy (decision 5).
   - **R1** and **T/A** chips lie flat and face the owner (`OnTable`). The chip is on while its tool is on the table.
   - Hover over a tool: a label with its name and key, in the style of `token-face-label`: "Range 3 · key 3", "Short move · key 7", "Range 1 · key 1", "Toward / Away · key 6".
   - Click: the toolbar handler of that tool (`handleRangeClick`, `handleMoveClick`, `handleAngleClick`). The click does not reach the table (no deselect).
   - Racks of decision 8. The other player's rack has no pointer handlers.
3. Docs: `docs/features/table-tools.md`, `README.md` ("Tools", "Where a tool spawns": a click on the rack is the same as the toolbar button).

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. Sandbox: only the blue rack is on the table. Its tools look like the tools on the table, at real size.
2. Click R3 on the rack: the tool spawns as with the toolbar button (snapped to the selected character, else free in the middle of the screen). R3 on the rack is faint. Click it again: the tool goes away.
3. **R1** chip: the R2 tool spawns in its range 1 use. R2 on the rack is faint, the chip is on.
4. **T/A** chip, S, M, L work the same way.
5. Hover over a rack tool: the label shows its name and key.
6. Multiplayer room: both racks. The other rack shows faint copies of the tools that the other player has on the table, and does not react to clicks.

### Result

Done.

- `RulerTool.jsx`: `useRangeParts` and `useMovementParts` exported. No change in behavior.
- `components/ToolRack.jsx` (new), rendered in `Scene.jsx` with a `toolRack` prop from `App.jsx` (`multiplayer`, `onRangeClick`, `onMoveClick`, `onAngleClick`, the toolbar handlers). Plate: color and roughness of the tray plate. Tools lie along x at `rackSlots`, in the side tint, movement tools straight. A tool on the table is a clone with its own transparent material (opacity 0.25), so the cached meshes of the real tools stay as they are. R1 on the table: R2 faint and the R1 chip on. Toward / Away on the table: the T/A chip on. R1 and T/A chips: `OnTable` with `OWNER_FACING_ROTATION`, `chip--active` when on, `title` as the hover text. Hover over a tool: `token-face-label` with "Range 3 · key 3" and so on, and the pointer cursor. Click: `stopPropagation`, ignored after a camera drag (`CLICK_MOVE`, as in `CharacterTray.jsx`).
- Racks: a multiplayer room shows both, the other one with no pointer handlers (its chips have `pointer-events: none`, see `.rack-chip--locked` in `index.css`). Else only the own side.
- Cleanup: `SIDES` removed from `layout.js`. `TableButtons.jsx`, `ToolRack.jsx` and `layout.test.js` use `TEAMS` from `setup/setup.js` (a plain module, no cycle).
- Docs: `table-tools.md` (status), `README.md` ("Where a tool spawns").
- Checks: build, format, lint (no new warnings), test 341 pass.
- Differs from the plan: none. Not checked in a browser (project rule).

## Step 3: Tool rack, drag and return

Work:

1. `App.jsx`: a rack drag, built like the token drag. A press on an own rack tool or chip starts `startPointerDrag`. A release without a drag stays a click (step 2).
2. `components/ToolDragGhost.jsx` (new): a flat outline of the tool's footprint at the table point under the pointer (`tablePoint`, hidden off the table), turned to `freeSpawnYaw` of the own side. The Toward / Away outline is the L shape.
3. The drop. Move the body of `handleToolKey` and `handleAngleKey` into functions that take the piece (or null) and the table point. The keys call them with `hoveredRef.current` and `toolPointRef.current.atPointer()`. The drop calls them with the piece under the pointer and the drop point. Over the own rack or off the table: nothing.
4. Escape cancels the rack drag (`handleKeyDown`, like the token drag).
5. Return (decision 7). In `RulerTool.jsx`, when a move drag of an own tool ends with the tool center on the own rack (`layout.js`), the tool calls a new `onReturn`. `App.jsx` removes that tool. Only while the rack is on the table (in step 4 this follows the setting).
6. Docs: `docs/features/table-tools.md`, `README.md` ("Tools").

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. Drag R4 from the rack onto a character: the tool snaps to it, and the character is selected. The same onto a crisis token.
2. Drag R4 onto the empty mat or onto terrain: the tool lies free there.
3. Release over the rack or off the table: nothing happens. Escape during the drag: nothing happens.
4. While dragging, an outline of the tool follows the pointer.
5. Drag a tool on the table back onto the rack: the tool goes away, and the rack shows it again.
6. Multiplayer room: the other browser sees the tool come and go.

### Result

Not done.

## Step 4: Settings menu

Work:

1. `src/settings/settings.js` (new): defaults, read and write of `mcp-assist-3d/settings` (try/catch, as `rooms/store.js`). Shape `{ tools: { rack, power, cleanup, deployLock, matTurn } }`, each `'table'` or `'hud'`. A missing or unknown value is the default. `settings.test.js`.
2. `src/settings/controls.js` (new): `KEY_ROWS` and `MOUSE_ROWS`, `{ keys, action }` in plain words, from `docs/features/key-shortcuts.md`: WASD, arrows, Space, 1–5, 6, 7–9, 0 (also on the own dice tray), Q / E, F, R, L, Delete / Backspace, Escape, ← → in the roster popup. Mouse: left click, left drag on a selected piece, left or right drag on the table, middle drag and the other pan inputs, wheel and pinch.
3. `components/SettingsPopup.jsx` (new), on `Overlay`: the section "On the table or in the HUD" with a Table / HUD choice for each item (Mat turn says "Sandbox and single player rooms"), the section "Keys" and the section "Mouse". A change applies at once. ✕ and Escape close it, and the keys of the table do nothing while it is open.
4. `Toolbar.jsx`: a **Settings** chip at the right end. Hide the groups by the settings: Range and Move (rack), Power, Cleanup (no Phase group when both are hidden), Deploy, and **↺** **↻** (the map select stays).
5. `Scene.jsx`: show the rack, the Power Phase buttons and the rows of the board strip by the settings. A strip with no row is not drawn. Return to the rack (step 3) only while the rack is shown.
6. Docs: `docs/features/table-tools.md` (status built), `docs/features/key-shortcuts.md` (the popup lists the keys from `src/settings/controls.js`; a change of a key changes that list in the same step), `docs/features/round-phases.md` (the buttons are on the table or in the toolbar), `README.md` (the places that name toolbar buttons that can move: "Table sides", "Tools", "Range 1", "Toward / Away").

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. A browser with no stored settings (a private window): the toolbar has no Range, Move, Phase, Deploy, **↺** **↻**. All of them are on the table.
2. **Settings**: switch each item to HUD. Its table piece goes, its toolbar buttons come back. Switch back to Table.
3. Reload: the settings stay. Another browser has its own settings.
4. The keys and mouse lists match what the keys do.
5. Escape and ✕ close the popup. Keys like 3 or F do nothing while it is open.
6. Multiplayer room: the settings of one browser do not change the table of the other.

### Result

Not done.

## Open questions

For the user, after the last step:

1. **Rack place.** Below the trays, and the start view moved 6.4" toward the player. Is the place right, and is the new start view fine?
2. **Chess clock.** TTS has one on the table. The app has none. Wanted?
3. **Token Tray.** TTS has a tray with every token between the dice trays. The app has the Library, tab Tokens. A tray on the table too?
4. **Tray swap.** TTS trays have **<** **>** to change their order. Wanted?
5. **Undo of a move.** The TTS movement tool has **Undo** after **Place**. Wanted?
6. **Dice total.** In TTS a click on the total clears the tray and sets up the same number of dice again. It could join plan 5 (dice tray clicks).
7. **Saved squads.** The TTS Roster Tray saves a squad per threat value (15–20). Related to plan 3 (Breakdown).
