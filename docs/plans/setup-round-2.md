# Plan: Setup round 2

Requested by the user on 2026-10-11. Plan 2 of `docs/plans/playtest-1.md`. Status: done. The user tested it on 2026-10-12. Branch `setup-round-2`, from main at `87f9b6e`.

The feature is `docs/features/setup-game.md`. Each step makes one commit and writes its **Result** below.

Steps 1 to 7 can run while another plan branch is open. Steps 8 and 9 rename the sides in about 70 files, so they come last. They start only when no other plan branch is open: `table-controls` merges into main first, then this branch merges main. (Order changed by the user on 2026-10-11: the rename was steps 1 and 2.)

Checks of every step: `pnpm format`, `pnpm lint`, `pnpm test`, `pnpm --filter web build`.

## Request

The answers of the user for plan 2 are in `docs/plans/playtest-1.md`, "Plan 2: Setup round 2". In short:

- **Roll off** [9]. The app reads the roll off from the dice trays. The manual "X has Priority" stays.
- **Colors** [9]. Blue is the player with Priority, Red is the other player. The side keys `blue` / `red` become `host` / `guest`. The host sits at +z. The new room dialog has no side choice. Saved rooms are not migrated.
- **Names** [10]. Discord names in a multiplayer room, "You" / "my" for yourself. Blue and Red in the Sandbox and a single player room.
- **Texts** [1, 3]. "Choose" replaces "Use" and "Select". The deck buttons have no color.
- **Rulebook order** [4]. The panel says what to do now, in the order of the rulebook.
- **History** [5]. **Prev** / **Next** browse the choices. **Override** goes back to an earlier step.
- **Who can click** [6]. In a multiplayer room, only the player who chooses can click.
- **Edge controls** [6, 8]. ↺ **Choose this edge** ↻ moves to the side of the player who chooses.
- **Squad step** [11, 13]. No **Select squad** mode. A **+** / **✓** button on each own roster card, the popup for the rest. **Squad ready** is the main button.
- **Deploy Lock**. On when the squads go on the table. Off at the first **Power** in round 1.

## Facts

### Rules (Jarvis rules reference, read on 2026-10-11)

- p4: Priority decides the order of turns in a round. The Priority token shows who has it.
- p9, "Mission setup": the player with Priority chooses one of their decks (Secure or Extraction) and draws 2 cards. The other player chooses 1. The player without Priority draws 2 cards from their deck of the other type. The player with Priority chooses 1.
- p9: the player without Priority chooses which card's Maximum Threat the mission uses.
- p9: the player with Priority chooses a battlefield edge. Their deployment edge is the bottom of the card map, the blue zone. The other edge, the red zone, is the edge of the player without Priority.
- p11: each player builds a squad with a total threat up to the Maximum Threat. No two characters share an alter ego. Up to 5 of the 10 Team Tactic cards. Players do not reveal their squads until deployment.
- p7, p11: players choose one Leadership ability at the same time, after both squads are deployed.
- p12: the player with Priority takes the first turn. In the Cleanup Phase, the player who activated the last character passes Priority, if they have it.
- p22: One-Shot cards come after Priority and before the mission setup.
- The roll off itself and the order of deployment are not in the Jarvis rules reference. The tie rules are in `docs/features/setup-game.md`, "Roll off".

So the order is: roll off, deck, first card, second card, Maximum Threat, deployment edge, squads, deployment, affiliation and Leadership.

### Sides in the code

- The side keys `'blue'` and `'red'` are in about 70 files: web (`src/`, tests, scripts) and API (`apps/api/src/stores/store.ts`, `routes/rooms.ts`, tests). About 100 object keys `blue:`, 90 `red:`, 90 property reads `.blue` / `.red`.
- Characters have the field `teamColor` (10 files). Setup and other code use `TEAMS` and `otherTeam` from `src/setup/setup.js`.
- The API stores seats as `players.blue` and `players.red`, with indexes on both. `POST /rooms` takes `side`. Join takes the free seat.
- The Yjs document has `SCHEMA = 1` (`src/net/doc.js`). A table of another schema gets a new start table (`docs/features/rooms.md`). So a schema change makes old rooms start fresh instead of breaking.
- CSS classes such as `chip--player-blue` mean a color, not a side.
- `setup.deck.team` is the roll-off winner today. The crisis tokens turn a half turn when red has Priority (`buildMatTokens` in `App.jsx`).
- `squadSelect: { blue, red }` in `App.jsx` is the **Select squad** toggle (13 uses).
- The TTS mod's Red seat is the app's blue side, at +z (`src/scoreboard/board.js`).

### Dice

- Each player has a dice tray. A throw ends when every die is on the shelf. The app stores the face of each die on the shelf (`docs/features/dice-rolling.md`).

## Decisions

1. **Side and color are two things.** A side is a seat at the table: `host` (+z) or `guest` (−z). A color is Blue or Red. The code stores sides. A color comes from one function, `colorOf(team, setup)`, so no code reads a color from a side key.
2. **Names in code.** The values are `'host'` and `'guest'`. The character field `teamColor` becomes `team`. `TEAMS` and `otherTeam` stay. CSS color classes (`chip--player-blue`) stay, and get the color from `colorOf`.
3. **The roll-off winner sets the colors.** `setup.priority` is the side that won the roll off. That side is Blue, the other is Red, for the whole game. The Priority token of the game (plan 4) is a different field, because it moves in the Cleanup Phase, and the colors must not move with it.
4. **Before the roll off**, the +z side is Blue and the −z side is Red. After step 8, the host is always at +z. **Restart setup** goes back to that.
5. **Sandbox:** the +z side is always Blue. The roll off sets Priority, not the colors.
6. **Old rooms.** `SCHEMA` becomes 2. An old room gets a new start table. The API does not migrate seats. An old room record with `players.blue` / `players.red` is not read (see step 9).
7. **The host keeps the host rights,** whatever the color: delete the room, write the table while both are connected.
8. **The panel follows the rulebook order** (see Facts). Each step says who does what now, with player names.
9. **History is shared.** Both players see the step that one player browses. **Override** needs a confirm. Either player can press it.
10. **Who can click** in a multiplayer room: the player who chooses in the current step. The other player sees the buttons disabled, with a title that says who chooses. The manual Priority buttons are an exception: both players can press them, because players can agree on a roll off made with real dice.

## Step 1: Priority and colors

Work:

1. `setup.js`: new field `setup.priority: null | team`. `setupStep` gets a first step `rollOff` while `priority` is null. `chooseDeck` no longer takes the team: the player with Priority chooses.
2. New `colorOf(team, setup)` in `setup.js`: in a room, the side with `setup.priority` is Blue. Before the roll off, and always in the Sandbox, the +z side is Blue (decisions 4, 5). Until step 8, the side keys are still `blue` (+z) and `red` (−z), so a side key no longer tells the color. Each place that shows a color (tints, CSS classes, "Blue player" texts, tool, tray and dice tray colors) calls `colorOf`.
3. The panel of the roll-off step: the rule text and two buttons with the player names, for example **Nelly has Priority** and **You have Priority**. In the Sandbox and a single player room: **Blue has Priority**, **Red has Priority**.
4. The deck step: **Choose Secures** and **Choose Extracts**, for the player with Priority, with no color (decision of plan 1 notes 1, 3).
5. The crisis tokens turn by `setup.priority`, not by the host (`buildMatTokens`).
6. Docs: `setup-game.md` (Roll off, Priority, State, Decisions 1 and 3).

Checks: as in "Checks". New tests: `setupStep` with `rollOff`, `colorOf` before and after Priority, in the Sandbox.

User, after this step: a room, the guest has Priority: the −z player's trays, tools and dice turn Blue, the +z player's turn Red. Nobody moves. The crisis tokens of the −z player's card lie at the −z edge.

### Result

Done. Commit "setup round 2 part 1: Priority and colors".

- `setup.priority: null | team`. `setupStep` starts with `rollOff`. `setPriority(setup, team)` sets it. `chooseDeck(setup, type, codes, random)` has no team and stores `deck: { type }`; the player with Priority chooses. **Restart setup** clears it (`newSetup`).
- Old saved setups: `priorityOf(setup)` = `setup.priority ?? setup.deck?.team ?? null`. A saved setup with a deck keeps its step and its colors follow `deck.team`. One with no deck is at the roll off.
- `colorOf(team, setup, followPriority)` in `setup.js`. `followPriority` is `Boolean(room)` in `App.jsx`: a single player room and a multiplayer room follow Priority, the Sandbox (no room) does not. Open question 1 of the plan (single player room follows the roll off) is taken as the proposal, so the user can check it.
- `src/sideColors.js`: a module store (like `look.js`, because React context does not cross the Canvas). `App.jsx` sets the color of both sides in a layout effect. `useSideColor`, `useSideName`, `useSideColors`, `COLOR_NAME`, `COLOR_HEX`.
- Places that use the color of a side now: tool meshes and the rack (`RulerTool.jsx` hooks, `TOOL_TINT` is keyed by color), `ToolDragGhost`, dice tray tint (`DiceTrayParts`, `TRAYS.color` removed), model base ring color (`CharacterModel`), crisis token Control ring (`CrisisToken`), VP marker edge (`ScoreBoard`, `COLOR_TINT` in `board.js`), remote cursor, outline of the other player's selection (`Scene` passes the color to `outlineMode`), dice history entries (`RollsPanel`), `TokenPanel` Control chips, `Library` team chips and texts, `Toolbar` roster fields, `RoomPlayers`, `RosterPopup` title, `TableButtons` Power Phase title, `GameSetup` (all texts, chips), `App.jsx` texts (already has the character, Power Phase message).
- Not changed: Lobby, new room dialog, join page, `RosterField` (no setup there, colors before the roll off). Tray plates and tactic trays have no tint.
- Roll-off panel: two buttons, **Blue has Priority** / **Red has Priority**; in a multiplayer room **Blue side has Priority** / **Red side has Priority** (names come in step 3). Both players can press them. Deck step: **Choose Secures** / **Choose Extracts**, with no color, only in the crisis area of the player with Priority.
- Crisis tokens turn by `priorityOf(setup) === 'red'` (the −z side).
- Tests: `setup.test.js` (`rollOff` step, `chooseDeck` by Priority, `colorOf` per mode, old saved setup, `crisisRows`).
- The "Use" texts of the drawn cards and **Select board edge** stay for step 3.


## Step 2: The app reads the roll off

Work:

1. A plain module `src/setup/rollOff.js`: from the shelf faces of both trays, the winner: more successes (Crit, Wild, Hit), then more Crits, then more Wilds, else a tie. Tests.
2. In the roll-off step, when a throw ends and both shelves have exactly 5 dice, the app sets `setup.priority` to the winner. On a tie, the panel says "Tie: roll again." The manual buttons stay.
3. The panel shows the result: "Name wins the roll off: 4 successes against 3."
4. Docs: `setup-game.md`, "Roll off" (the app reads it now), Decision 1.

Checks: as in "Checks".

User, after this step: each player clears their tray and rolls 5 dice. The winner gets Priority. A tie asks to roll again.


### Result

Done. Commits "setup round 2 part 2: the app reads the roll off", "setup round 2 part 2: read the roll off on any throw".

- `src/setup/rollOff.js` (`readRollOff({ blue, red })` of symbol lists, `shelfCounts`), tests in `rollOff.test.js`. Side keys are still `blue` / `red`.
- `setup.rollOff: { winner, counts } | null` stores the read result for the panel. `setRollOff(setup, result)` sets Priority to the winner (a tie keeps it). `setPriority` (manual) clears `rollOff`. **Restart setup** clears it (`newSetup`).
- Trigger: an effect in `App.jsx` on the history list (`rolls`). Every browser checks when a new `throw` entry appears, its own or from the other player. Entries present at mount, and entries older than 30 s (`ROLL_OFF_FRESH`, late sync), are not new, so shelves left from before a restart do not count without a new throw. It does nothing unless the step is `rollOff` and both shelves have exactly 5 dice in the document. (First version used an `onThrowEnd` prop of the tray; replaced, so players who roll at the same time are read.)
- Writer rule: the shelf write and the entry are one transaction, so the browser that has the last entry has both full shelves. Both browsers may write the same result; a browser skips the write when `setup.rollOff` already equals it. It reads `table.setup` and `table.dice` at that moment, not the render.
- Panel (`GameSetup.jsx`): "Blue wins the roll off: 4 successes against 3." with the tiebreak (Crits or Wilds) when successes are equal, or "Tie: roll again." Shown in the `rollOff` and `deck` steps, gone when a deck is chosen.
- Docs: `setup-game.md` (What the app does, Roll off, Decision 1).

## Step 3: Names and texts in the rulebook order

Work:

1. A helper `playerName(team, room, ownTeam)`: "You" for yourself in a multiplayer room, the Discord name for the other player, "Blue" / "Red" in the Sandbox and a single player room. A possessive form for "my" / "X's".
2. Every setup text uses it and the word "Choose". Examples: "You choose the board edge", "Choose from my Secures", "Choose from Nelly's Secures", "Nelly chooses the Maximum Threat", "Waiting for Nelly to choose a deck".
3. The panel says what to do now in each step, in the order of Facts, "Rules". After the reveal it says: "Deploy one model at a time, taking turns. Nelly deploys first.", with the name of the player with Priority, or "You deploy first." The app does not enforce the deployment (open question 2). No Leadership step (open question 3).
4. Docs: `setup-game.md`, the table "What the app does".

Checks: as in "Checks".

User, after this step: read every setup step in a multiplayer room, from both browsers. Each text names the right player.


### Result

Done. Commit "setup round 2 part 3: player names and Choose texts".

- `src/setup/names.js` (plain, tests in `names.test.js`): `playerName(team, ctx)`, `possessive(team, ctx)`, `says(team, ctx, verb)` ("You choose" / "Nelly chooses"), `verbFor`, `isYou`, `capital`. `ctx = { mySide, players, peer, colors }`. Fallback name "Opponent", deleted player "Deleted player". In the Sandbox and a single player room the name is the color name (`colorOf`), never "You".
- `App.jsx` builds `seatPlayers = { players, peer }` (room players and the hello of the peer) and passes it through `Scene` to `GameSetup`, which builds the ctx.
- Texts: roll-off buttons ("Nelly has Priority", "You have Priority"), roll-off result ("You win the roll off: …"), status line ("Nelly has Priority"), deck / card / threat / edge hints in the form "You choose …" / "Waiting for Nelly to choose …", cards "Choose from Nelly's Secures." / "Choose from my Secures.", card buttons **Choose**, **Choose this edge**, squad hint, reveal wait text, deck button titles and problems with names, affiliation row labels and lock title, squad panel "Waiting for Nelly."
- After the reveal the affiliation step says "Deploy one model at a time, taking turns. Nelly deploys first." and then the affiliation prompt. When no affiliation step opens, the setup is done and the panel is gone, so the text does not show. No Leadership step.
- Not changed: who can click (step 4), the squad buttons and the **Select squad** label (step 5).


## Step 4: Who can click, edge controls

Work:

1. Multiplayer room: only the chooser of the current step can click the deck, card, threat and edge buttons (decision 10). The other player sees them disabled, with the title "Nelly chooses".
2. ↺ **Choose this edge** ↻ lie on the side of the player with Priority, facing them. The arrows are bigger. **Choose this edge** is on a second row. The info panel stays at the scoring board.
3. Docs: `setup-game.md`, "Buttons", replace "The app does not check who clicks" (What the app does, Decision 2).

Checks: as in "Checks".

User, after this step: in a multiplayer room, each step can be clicked only in the right browser. The edge controls lie in front of the player with Priority.

### Result

Done. Commit "setup round 2 part 4: who can click, edge controls".

- `chooserOf(setup)` in `setup.js`: deck, second card, edge → the side with Priority; first card, threat → the other side; other steps null. Tests in `setup.test.js`.
- `GameSetup.jsx`: `lockedTitle(setup, what, ctx)` is null in the Sandbox, a single player room and for the chooser. Else the deck buttons, card **Choose**, threat chips and edge controls get `aria-disabled`, no click handler and the title "Nelly chooses the Maximum Threat" (`says` of names.js). Manual Priority buttons unchanged.
- `EdgeControls` (in `GameSetup.jsx`) uses `edgeControls(side)` in `tabletools/layout.js`: in the tactic tray row, on the owner's right of the tactic plate (mirror of the Power button, gap 0.6"). Blue: x 9.25 … 16.45, z 18.55 … 22.15 (centre z = tactic tray z 20.35), 7.2" × 2.8"; red mirrors. `OWNER_FACING_ROTATION`. Arrows 2.2" × 1.4" with font 28 px, **Choose this edge** 7.2" × 1.2" on the second row. (First version lay in the rack band at z 34.4 … 37.6, outside the start view; moved.) The mat turn arrows left the panel. Node tests in `tabletools/layout.test.js` (inside the table, mirror, start view |x| ≤ 20 and |z| ≤ 34, no overlap with the rest, the Power button, dice trays, full rosters and crisis rows of both sides). The test setup of the Power button moved into a shared `crowded(side)`.
- Docs: `setup-game.md` (What the app does, Deployment edge row, Buttons).


## Step 5: Squad step without a mode

Work:

1. Remove the **Select squad** toggle and `squadSelect`.
2. Own roster cards in the squad step: a small **+** / **✓** button in a corner. It adds the card to the squad or removes it. A click anywhere else on the card opens the roster popup.
3. Roster popup, squad step, own roster: **Add to squad** / **Remove from squad** on the card. The Breakdown row click stays.
4. The squad panel: **Squad ready** is the main button (the strongest style). Disabled with a title that says why, until the squad is valid. While ready: **Change squad**.
5. Docs: `setup-game.md`, "Squads", `squad-breakdown.md` if it names **Select squad**.

Checks: as in "Checks".

User, after this step: build a squad with the corner buttons, the popup, and a Breakdown row. A click on a card always opens the popup. **Squad ready** is the button you see first.

### Result

Done after the merge of main (table-controls, 7 steps). Commits "Merge branch 'main' into setup-round-2", "setup round 2 part 5: squad step without a mode".

- Merge: one conflict in `GameSetup.jsx` (`CrisisRow` props, the header comment, the `GameSetup` props). Kept both: `locked`, `seatPlayers`, `browse` / `override` and `onCardHover` (Alt). The rest of main's code has no side colors (only side keys in `TRAY_ROTATION` and `modelSpawnYaw`). The roll-off effect in `App.jsx` reads `kind: 'throw'` entries of `dice/history.js`, which main did not change.
- `squadSelect` and the **Select squad** toggle are gone. `squadBlock(team)` in `App.jsx` (was `breakdownChooseBlock`; also blocks while `setup.view` is set) says if the squad of a side can change. `handleSquadToggle(team, tab, index)` is the old toggle code of `handleRosterClick`, which is gone: a click on a card always goes to `handleRosterOpen`.
- `RosterCard` has the `onToggle` prop: a round **+** / **✓** button (`OnTable` in the card group, top right corner, `.roster-toggle`) with `stopPropagation` on pointer down, up and click. `Scene` gets `squadEdit` and `onSquadToggle`. `hideCursor` (decision 21 of plan 9) follows `squadEdit` of the own side, so the cursor is hidden for as long as the own squad can change.
- `RosterPopup` takes `squad: { has, onToggle }` (built in `App.jsx` only when `squadBlock` is null): **Add to squad** / **Remove from squad** in the card footer of the characters and tactics tabs.
- `GameSetup.jsx`: **Squad ready** with the new `.chip--primary` style (`aria-disabled` and the reason as title), **Change squad** while ready, the new hint.
- Docs: `setup-game.md`, `squad-breakdown.md`, `peer-to-peer.md` (cursor), `README.md`.


## Step 6: Deployment step, Deploy Lock

Found in step 3: the deployment text shows only in the affiliation step. Most squads need no affiliation choice, so the setup ends at the reveal, and the text never shows. So deployment becomes a setup step of its own.

Work:

1. `setup.js`: a new field `setup.deployed: false`. `setupStep` gets a step `deploy` after the reveal and the affiliation, while `deployed` is false. A saved setup that is done and has no `deployed` field stays done.
2. The panel in the `deploy` step: "Deploy one model at a time, taking turns. Nelly deploys first." and "Press Power Phase when both squads are deployed."
3. When the squads go on the table, `game.deployLine` (Deploy Lock) turns on.
4. The first **Power** in round 1 (any Power Phase button or the toolbar) sets `deployed` and turns Deploy Lock off. The setup is then done, and the panel goes away.
5. Players can still turn Deploy Lock on and off by hand. It does not change the step.
6. Tests for `setupStep` with `deploy`, and for the old saved setup.
7. Docs: `setup-game.md` (steps table, State), `round-phases.md` (the first Power Phase ends the deployment).

Checks: as in "Checks".

User, after this step: after the reveal (and the affiliation choice, if any), the panel shows the deployment text, and Deploy Lock is on. The first Power Phase turns it off and the panel goes away.

### Result

Done. Commit "setup round 2 part 6: deployment step, Deploy Lock".

- `setup.js`: `NEW_SETUP.deployed: false`, step `deploy` after `affiliation` while `deployed === false`, `finishDeploy(setup)`. Rule for old saves: a missing `deployed` field is not `false`, so the setup skips `deploy` and stays done. `crisisRows` and the Scene card lock treat `deploy` like `affiliation`/`done`. Tests in `setup.test.js`.
- `GameSetup.jsx`: the deploy line moved from the affiliation step to the `deploy` step, with "Press Power Phase when both squads are deployed."
- `App.jsx`: `revealSquad` turns `game.deployLine` on in its transaction when the other side is already placed. `handlePowerPhase` in one transaction: in step `deploy` it sets `deployed` and turns Deploy Lock off, then gives the Power. The Deploy Lock chip is not tied to the step.
- Docs: `setup-game.md`, `round-phases.md`. `table-tools.md` says nothing on when Deploy Lock turns on, unchanged.


## Step 7: History, Prev, Next, Override

Work:

1. `setup.js`: the steps that are done can be listed from the state (deck, first, second, threat, edge, squads). A shared field `setup.view: null | step` is the step that a player browses. Null is the current step.
2. The panel has **Prev** / **Next**. While a player browses, both see that step with its choice, and the buttons of the step are read only.
3. **Override** on a browsed step, after a confirm: that step becomes the current step, and the later choices are dropped, for both players. The drawn cards stay, unless the deck step is done again. When squads are on the table, Override removes them, the same as **Restart setup**.
4. Tests for each Override target.
5. Docs: `setup-game.md`, "Restart", State.

Checks: as in "Checks".

User, after this step: choose up to the edge, go **Prev** to the threat step in one browser: the other browser shows it too. **Override**: the threat step is current again, the edge choice is gone.

### Result

Done. Commit "setup round 2 part 7: history, Prev, Next, Override".

- `setup.js`: `setup.view`, `doneSteps`, `viewOf`, `browse`, `neighbourStep`, `overrideTo`, `overrideRemoval`. Tests per target.
- Override rules: rollOff clears Priority, the read result and all later; deck clears deck, draws, picks and later; first clears both picks; second clears the second pick; threat and edge clear that choice and later; draws stay for first and later. Squads or earlier also reset squads, Ready, placed, affiliation, deployed. Affiliation clears the affiliations and deployed; deploy clears deployed. The id stays. `view` is cleared.
- Table removal: `restartSetup` in `App.jsx` now calls `removeSetupPieces({ squads, crisis })`, and Override calls it with `overrideRemoval(setup, step)`: squads when target is squads or earlier and squads are placed; the crisis cards (as Restart: `handleCrisisChange(type, null)` when the card is still the picked one) when target is edge or earlier and the edge was chosen. The crisis rows come from the state, so they are those of the step again. Restart and an Override that removes squads turn `game.deployLine` off.
- Panel: **Prev** / **Next** / **Override** row. While browsing, the step buttons are disabled with the title "Browsing an earlier step", and the squad panels are hidden.
- `affiliation` is listed whenever the field exists, because the state does not say whether the player chose or the app set it.
- Override keeps the stored squad of a multiplayer browser (same setup id); Restart deletes it. (Changed in the fixes below.)

### Fixes after the user check

- Squad ready did nothing. Cause: step 5 removed the `squadSelect` state but left four `setSquadSelect(...)` calls in `App.jsx`; the Ready click threw a ReferenceError before `toggleReady`. Fix: calls removed. (Not a `setup.js` logic bug, so no unit test; lint does not catch it.)
- Override back before the squads left yellow frames. Cause: the multiplayer squad draft is in localStorage keyed by `setup.id`, and Override kept the id. Fix: `overrideTo` to `squads` or earlier gives a new `id` (the id is used only for the draft match, `ownSquad` and `revealPlan`), so every browser ignores its old draft; restart already makes a new id. Tests added. Also the roster frames show only when the step is `squads` and the player is not browsing (`Scene.jsx`).
- The deploy step started with Deploy Lock off. Cause: `revealSquad` turned the lock on only if the other side was already placed when it ran. In a multiplayer room each browser reveals only its own side, and the two writes can cross before they sync, so neither sees both placed; a check inside one call is not robust. Fix: no check in `revealSquad`. The reveal effect (every browser, after each setup change) calls `deployLockDue(setup)` (both placed, deploy ahead, `lockSet` false) and then sets `deployLine` and `setup.lockSet` in one transaction. Once only, so a hand toggle stays. `overrideTo` to `squads` or earlier resets `lockSet`. Unit test added.
- Request: the squad panel should lie under each player's roster row of tactic cards, so the threat and the buttons are easy to see and click without extra camera rotations. Place: `squadPanel(side)` in `tabletools/layout.js`, flat and facing its owner (`OWNER_FACING_ROTATION`), x 0, in the free band between roster row 2 (far edge z 29.5 with 10 tactics) and the rack plate (z 34.2): 4.7" deep, panel z 29.75 to 33.95 (center 31.85), 24" wide (blue; red mirrored). One row: Threat, Tactics, button; font 12px, notes 11px. The other player's panel and a placed side ("Choosing a squad" / "Ready") use a compact one-line panel at z 32.1 to 33.7, because the character trays of a placed squad reach z 31.85. Tests: no overlap with the full roster rows, rack, Power button, edge controls; inside the start view.

## Step 8: Sides `host` / `guest` in the web app

Starts only when no other plan branch is open. Merge main first.

Work:

1. `src/setup/setup.js`: `TEAMS = ['host', 'guest']`, `otherTeam`. `colorOf` (step 1) keeps its rules with the new keys.
2. Every web file: the keys `blue` / `red` that mean a side become `host` / `guest`. The character field `teamColor` becomes `team`. Each place that shows a color already calls `colorOf` (step 1). A key that means a color stays (for example the TTS file names, `chip--player-blue`).
3. `src/net/doc.js`: `SCHEMA = 2`.
4. Multiplayer: the own side is `host` when the user is the room host, else `guest`. This replaces the seat color from the API. `NewRoomDialog.jsx` loses the side choice.
5. Tests: the same rename.
6. Docs: every feature doc that names the sides `blue` / `red` as data keys. Text that means a color stays. `docs/features/setup-game.md`: Decision 1 and the State section.

Checks: as in "Checks". A grep for `'blue'` and `'red'` in `apps/web/src` lists only colors.

Tip for the coder: do the rename with a script per pattern, then read each diff hunk. Do not read whole files.

User, after this step: everything works as before, in the Sandbox, a single player room and a multiplayer room. The host sits at +z. An old room opens with a fresh table.

### Result

Done. Commit "setup round 2 part 8: sides host and guest in the web app".

- Renamed by script per pattern (string literals, `key:` keys, `.key` reads, `{ blue, red` shorthand in comments, `teamColor` to `team`, `blueColor` to `hostColor`), then each hunk reviewed. Lines about colors were kept: `COLOR_NAME`, `COLOR_HEX`, `COLOR_TINT`, `TOOL_TINT`, `DEFAULT_SIDE_COLORS` (values `'blue'` / `'red'`), `colorOf` results, `otherRed` / `otherBlue`, CSS classes.
- `SCHEMA = 2` (`net/doc.js`); only `Table.jsx` reads it. Local single player record `VERSION = 3`; older records are not listed or opened.
- Seat mapping: `src/rooms/seats.js` (`withSides`, `hostSeat`, `API_HOST_SEAT`), called in `serverStore.js`. Delete in step 9. `createRoom` sends `side: 'blue'`.
- `NewRoomDialog.jsx`: no side choice; the host roster field only. Lobby, `JoinRoom`, `RosterField` take chip classes from `DEFAULT_SIDE_COLORS`.
- No localStorage key holds a side (settings, session, squad keys).
- Docs: feature docs with data keys updated.


## Step 9: Seats `host` / `guest` in the API

Work:

1. `apps/api/src/stores/store.ts`: `type Side = 'host' | 'guest'`. `players: { host, guest }`. Indexes on `players.host` and `players.guest`. The creator takes `host`, join takes `guest`.
2. `apps/api/src/routes/rooms.ts`: `POST /rooms` has no `side`. The answers use `players.host` / `players.guest`.
3. An old record with `players.blue` / `players.red`: the list and the read leave it out (or answer 404). Write what you chose in the Result.
4. Web: the lobby tiles, `RoomPlayers.jsx`, `JoinRoom.jsx`, `rooms/serverStore.js` read the new shape. Step 8's rule for the own side stays.
5. Tests in `apps/api/test` and the web tests of the API client.
6. Docs: `docs/features/auth.md` (Seat, the record, the indexes), `docs/features/rooms.md`.

Checks: as in "Checks", plus `pnpm --filter api test`.

User, after this step: create a multiplayer room, join it from a second browser. Both seats show the right names.

### Result

Done. Commit "setup round 2 part 9: seats host and guest in the API".

- API: `Side = 'host' | 'guest'`; `players: { host, guest }`, `rosters` keyed the same. `NewRoom` has no `side`: the creator takes `host`, join takes `guest`. `POST /rooms` has no `side` in the zod schema. Indexes `players.host` and `players.guest` replace the color ones. `GET /rooms` `$or` on both seats. `seats.ts`, `table.ts`, `signal.ts` read the new keys.
- Old record (`players.blue` / `players.red`): not read. The Mongo store adds `players.host: { $exists: true }` to `get`, `join` and the list query, so `get` returns null (every route answers 404, the seat cache gets null, the list leaves it out, join cannot fill a seat). `create` first deletes old records of the same host, since they block the unique `host` index. The TTL removes the rest. No crash path: the host-gone cleanup only runs on a record that `get` returned. The memory store only holds new records.
- Indexes: created in code (`createIndex` on first use, `stores/mongo.ts`), so an existing Atlas collection gets the two new indexes at the next Lambda call. The two old indexes (`players.blue_1`, `players.red_1`) stay unused; drop by hand in Atlas.
- Web: deleted `rooms/seats.js` and `seats.test.js`. `serverStore.js` returns the API room as is, and `createRoom` sends no `side`.
- Tests: `apps/api/test` changed to the new keys; new mongo test for an old record.
- Docs: `docs/features/auth.md` (Seat, record, indexes, old records, routes, lobby text). `rooms.md` names no seats as keys.


## Open questions

1. ~~**Single player room colors.**~~ Answered by the user on 2026-10-11: the roll off decides Priority, and Priority decides the colors, also in a single player room. Only the Sandbox keeps fixed colors. Step 1 does this.
2. ~~**Deployment order.**~~ Answered by the user on 2026-10-11: players deploy one model at a time, taking turns. The player with Priority deploys first. The app does not enforce it. The panel says it after the reveal (step 3).
3. ~~**Leadership choice** (p7, p11).~~ Answered by the user on 2026-10-11: players agree on it out loud. The app has no control and no setup step for it, and does not store it.
