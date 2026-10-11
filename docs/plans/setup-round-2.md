# Plan: Setup round 2

Requested by the user on 2026-10-11. Plan 2 of `docs/plans/playtest-1.md`. Status: step 1 done. Branch `setup-round-2`, from main at `87f9b6e`.

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


## Step 3: Names and texts in the rulebook order

Work:

1. A helper `playerName(team, room, ownTeam)`: "You" for yourself in a multiplayer room, the Discord name for the other player, "Blue" / "Red" in the Sandbox and a single player room. A possessive form for "my" / "X's".
2. Every setup text uses it and the word "Choose". Examples: "You choose the board edge", "Choose from my Secures", "Choose from Nelly's Secures", "Nelly chooses the Maximum Threat", "Waiting for Nelly to choose a deck".
3. The panel says what to do now in each step, in the order of Facts, "Rules".
4. Docs: `setup-game.md`, the table "What the app does".

Checks: as in "Checks".

User, after this step: read every setup step in a multiplayer room, from both browsers. Each text names the right player.


## Step 4: Who can click, edge controls

Work:

1. Multiplayer room: only the chooser of the current step can click the deck, card, threat and edge buttons (decision 10). The other player sees them disabled, with the title "Nelly chooses".
2. ↺ **Choose this edge** ↻ lie on the side of the player with Priority, facing them. The arrows are bigger. **Choose this edge** is on a second row. The info panel stays at the scoring board.
3. Docs: `setup-game.md`, "Buttons", replace "The app does not check who clicks" (What the app does, Decision 2).

Checks: as in "Checks".

User, after this step: in a multiplayer room, each step can be clicked only in the right browser. The edge controls lie in front of the player with Priority.


## Step 5: Squad step without a mode

Work:

1. Remove the **Select squad** toggle and `squadSelect`.
2. Own roster cards in the squad step: a small **+** / **✓** button in a corner. It adds the card to the squad or removes it. A click anywhere else on the card opens the roster popup.
3. Roster popup, squad step, own roster: **Add to squad** / **Remove from squad** on the card. The Breakdown row click stays.
4. The squad panel: **Squad ready** is the main button (the strongest style). Disabled with a title that says why, until the squad is valid. While ready: **Change squad**.
5. Docs: `setup-game.md`, "Squads", `squad-breakdown.md` if it names **Select squad**.

Checks: as in "Checks".

User, after this step: build a squad with the corner buttons, the popup, and a Breakdown row. A click on a card always opens the popup. **Squad ready** is the button you see first.


## Step 6: Deploy Lock

Work:

1. When the squads go on the table, `game.deployLine` turns on.
2. The first **Power** (any Power Phase button or the toolbar) in round 1 turns it off.
3. Docs: `setup-game.md`, `round-phases.md`.

Checks: as in "Checks".

User, after this step: after the reveal, Deploy Lock is on. The first Power Phase turns it off.


## Step 7: History, Prev, Next, Override

Work:

1. `setup.js`: the steps that are done can be listed from the state (deck, first, second, threat, edge, squads). A shared field `setup.view: null | step` is the step that a player browses. Null is the current step.
2. The panel has **Prev** / **Next**. While a player browses, both see that step with its choice, and the buttons of the step are read only.
3. **Override** on a browsed step, after a confirm: that step becomes the current step, and the later choices are dropped, for both players. The drawn cards stay, unless the deck step is done again. When squads are on the table, Override removes them, the same as **Restart setup**.
4. Tests for each Override target.
5. Docs: `setup-game.md`, "Restart", State.

Checks: as in "Checks".

User, after this step: choose up to the edge, go **Prev** to the threat step in one browser: the other browser shows it too. **Override**: the threat step is current again, the edge choice is gone.

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


## Open questions

1. **Single player room colors.** Does the roll off set the colors there too, as in a multiplayer room, or are they fixed as in the Sandbox? Proposal: as in a multiplayer room, because the room plays a real game.
2. **Deployment order.** The Jarvis rules reference has no rule for who deploys first. Today both squads go on the table at the same time, and players move the models. Is that enough, or does the rulebook say that players deploy one by one?
3. **Leadership choice** (p7, p11) is not in this plan. Keep it for later?
