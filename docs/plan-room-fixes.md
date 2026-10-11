# Plan: Multiplayer toolbar, gem threat and squad affiliation

Requested by the user on 2026-10-11, after the checks of the Power and Cleanup buttons. Status: plan written, the user answered the questions of decisions 2 and 4 on 2026-10-11. The user gave the OK on 2026-10-11 and checks the result after all parts.

One coder step and one commit for each part. Each part writes its **Result** below when it is done.

## Requests

1. In a multiplayer room, the toolbar has no crisis card dropdowns. The crisis cards come from the rosters of the players (the game setup). The Sandbox and a single player room keep the dropdowns.
2. In a multiplayer room, the toolbar has no mat turn buttons (↺ ↻). The player who chooses the board edge turns the mat in the game setup. After that, the mat turn stays fixed for the room.
3. The squad threat counts the Infinity Gems. Each attached gem adds 1 threat. Infinity Gem: Bonded Soul (Adam Warlock) adds 0.
4. When both squads go on the table (both players clicked **Ready**), each player chooses the affiliation of their squad for the scoring board. Today every VP marker shows the Unaffiliated token.

## Facts

- `Toolbar.jsx` has the prop `multiplayer`. It already hides the Roster group in a multiplayer room. A room (single player or multiplayer) has no map picker (`roomCode`).
- The Crisis group (`CRISIS_TYPES` dropdowns) calls `handleCrisisChange`. The game setup calls the same handler at **Select board edge** (`handleSetupEdge` in `App.jsx`). So the setup does not need the dropdowns.
- The Mat group has the map picker (no room only) and ↺ ↻ (`handleTurnMat`). The setup panel has its own ↺ **Select board edge** ↻ in the step `edge` (`GameSetup.jsx`, `BoardPanel`). No key turns the mat.
- In a multiplayer room, both players see the ↺ ↻ of the setup panel. The hint names the player with Priority ("Blue player: turn the mat until your deployment edge faces you").
- **Restart setup** starts the setup again from the roll-off. So the step `edge` comes again, with its ↺ ↻.
- `squadThreat(parsed, places)` in `src/rosters/cards.js` sums the Threat Level of the characters only. The panel "Threat 15 / 18" (`GameSetup.jsx`) and the **Ready** check (`handleSquadReady` in `App.jsx`) both use it. A roster character is `{ code, gems }` (`src/rosters/mct.js`).
- The gem rows of `src/tactics/jarvis-tactics-cards.json` have no threat. The character rows of `src/characters/jarvis-characters.json` have `bearableGemsWithName`, with a `threatLevel` for each gem. Found on 2026-10-11: every gem has 1, Bonded Soul (`01910104`) has 0, the same on every character.
- The VP marker shows `game.affiliations[side]` (`ScoreBoard.jsx`). The Control markers on Secure tokens show the same token (`CrisisToken.jsx`). The start value is `unaffiliated` for both (`rooms/table.js`). Nothing writes it: the toolbar **VP** group was removed on 2026-10-07, and the plan then was that the game setup sets it (`docs/feature-roster.md`, `docs/feature-setup-game.md` "Not built yet").
- Rule (p11): a squad uses an affiliation when more than half of its characters have that affiliation. A squad has only one affiliation. So a squad with one such affiliation has no choice, and a squad with none is Unaffiliated. Only a squad with 2 or 3 has a choice.
- Each Jarvis character row has `affiliations` (`slug`, `name`, `isLeader`). Found on 2026-10-11: 31 slugs. `src/scoreboard/affiliations.json` has a token for each of them. One key differs: Jarvis `uncanny-x-men`, token `uncanny-xmen`. The tokens `captain-america-shield` and `vibranium-heist` are not affiliations of a character.
- `src/scoreboard/affiliations.js` imports its JSON with `with { type: 'json' }`, so a Node test can import it. `src/characters/characters.js` imports JSON without it.
- Setup steps (`src/setup/setup.js`, `setupStep`): after `squads` and `reveal` comes `done`, and the setup panel goes away (`GameSetup.jsx`). `placeSquad(setup, side, squad, placed)` puts a revealed squad into the setup. Each browser reveals the sides it plays (`revealSquad` in `App.jsx`), so in a multiplayer room each browser writes only its own side.

## Decisions

1. **Crisis dropdowns.** The Crisis group shows only when `multiplayer` is false.
2. **Mat turn.** The ↺ ↻ of the toolbar show only when `multiplayer` is false. The ↺ ↻ of the setup panel stay: they are how the player with Priority chooses the board edge.
   - Both players keep seeing ↺ **Select board edge** ↻ in the setup panel, as today. The players agree who turns. (User, 2026-10-11.)
   - After **Restart setup**, the step `edge` comes again, so the mat can turn again. A restart rolls off again, so Priority and the deployment edge can change. (User, 2026-10-11.)
3. **Gem threat from Jarvis.** `src/rosters/cards.js` reads the threat of each gem from `bearableGemsWithName` of the Jarvis character rows, and stores it as the `threat` of the gem card. `squadThreat` adds the threat of the gems of each character in the squad. The panel and the **Ready** check then count the gems with no other change.
4. **Squad affiliation as the last setup step.** (User, 2026-10-11: a last setup step, and the app sets a single choice by itself.)
   - The choices of a squad: each affiliation that more than half of its characters have (p11), as a token key, plus Unaffiliated.
   - When a squad goes on the table (`revealSquad`), the app sets its affiliation if it has no choice: the one affiliation, or Unaffiliated when there is none. With 2 or 3, it sets nothing.
   - A new step `affiliation` comes after `reveal`, while a side has no affiliation. The board panel shows "Choose the affiliation of your squad." and one row for each player: the chips of its choices, the chosen one marked. A click on a chip sets the affiliation of that side: the setup and the VP marker. In a multiplayer room, only the own row works. A row that the app set can also change while the step is open.
   - When both sides have an affiliation, the setup is done. When both squads had no choice, the step does not open. Then the result follows from the rule, so there is nothing to change.
   - An old setup saved before this change has no affiliation field. It stays `done`.
   - **Restart setup** clears the setup affiliation. The VP markers keep their token until the next squads choose.
   - Leadership (p7) is not in this plan.

## Part 1: Multiplayer toolbar

Work:
1. `Toolbar.jsx`: the Crisis group and the ↺ ↻ only when `multiplayer` is false. The Mat group label stays only when it has a control: in a multiplayer room it would be empty, so the whole group goes.
2. Docs: `docs/feature-rooms.md` ("The mat turn buttons stay"), `docs/feature-setup-game.md` (step "Deployment edge"), `docs/feature-crisis.md` (the toolbar Crisis group).

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

User, after this part:
1. Sandbox and a single player room: the toolbar has the Crisis dropdowns and ↺ ↻.
2. Multiplayer room, two browsers: the toolbar has no Crisis group and no Mat group.
3. Multiplayer room, game setup, step "edge": the player with Priority turns the mat and presses **Select board edge**. The crisis cards go to the board and their tokens to the mat.

## Part 2: Gem threat

Work:
1. `src/rosters/cards.js`: a map gem code → threat from `bearableGemsWithName` of `jarvis-characters.json`. The gem card gets this `threat` (a gem with no entry: 1, the rule for gems). `squadThreat` adds the threat of `parsed.characters[place].gems`.
2. Docs: `docs/feature-setup-game.md` (the squad threat counts the gems), `docs/feature-roster.md` if it says the threat of a gem.

Checks: `pnpm --filter web test`, `pnpm --filter web build`, `pnpm format`, `pnpm lint`. `cards.js` imports JSON, so a Node test cannot import it. The coder checks the numbers with a one-off Node script that reads the JSON.

User, after this part:
1. Roster with Doctor Strange + Soul gem: in the squad panel, his threat counts 1 more than his Threat Level.
2. Roster with Adam Warlock + Bonded Soul: his threat is only his Threat Level (7).
3. A squad at the Maximum Threat without the gem goes above it with the gem: the red line shows, and **Ready** does not work.

## Part 3: Squad affiliation

Work:
1. `src/characters/characters.js`: each row gets `affiliations`, the Jarvis slugs of the character.
2. `src/scoreboard/affiliations.js`: `affiliationKey(slug)`: the token key of a Jarvis slug (`uncanny-x-men` → `uncanny-xmen`), or null. `squadAffiliations(lists)`: `lists` has the slugs of each character in the squad. Returns the token keys that more than half of the characters have, sorted by name. A test in `src/scoreboard/affiliations.test.js`: one choice, two choices, none, exactly half (no), the Uncanny X-Men key, and every Jarvis slug has a token.
3. `src/setup/setup.js`: `NEW_SETUP.affiliation = { blue: null, red: null }`. `placeSquad` takes the affiliation that the app sets (or null). `chooseAffiliation(setup, side, key)`. `setupStep`: `affiliation` after `reveal`, while a side has none; `done` for a setup with no `affiliation` field. Tests in `src/setup/setup.test.js`.
4. `App.jsx`: `revealSquad` finds the choices of the squad from its roster places (`squad.characters`, the codes in the parsed roster, `characterByCode(code).affiliations`) and sets the affiliation when there is no choice, in the setup and in `game.affiliations`, in the same transaction. `handleSetupAffiliation(side, key)` writes both. In a multiplayer room it returns for the other side.
5. `GameSetup.jsx`, `BoardPanel`: the step `affiliation`, with the hint and one row of chips for each player (chip with the player color, the chosen one marked like other active chips). The names come from `affiliations.json`.
6. Docs: `docs/feature-setup-game.md` (a row in the steps table, a section "Affiliation", "Not built yet"), `docs/feature-roster.md` (the VP marker note), `docs/feature-crisis.md` (Scoring board: the VP marker token comes from the setup).

Checks: `pnpm --filter web test`, `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

User, after this part:
1. Sandbox, both rosters, full setup. A squad with one possible affiliation: its VP marker shows that token after **Ready**, with no click.
2. A squad of characters with no common affiliation: Unaffiliated, with no click.
3. A squad with 2 possible affiliations: the panel shows the step, with both and Unaffiliated. A click sets the VP marker. The setup ends when both sides have one.
4. Control markers on a Secure token show the chosen token.
5. Multiplayer room, two browsers: each player can click only their own row. Both browsers show the same VP markers.
6. **Restart setup**, then a new setup: the step works again.

## Result

Part 1: done. `Toolbar.jsx` hides the Crisis group and the whole Mat group when `multiplayer` is true. Sandbox and single player rooms are unchanged. Docs updated.

Part 2: done. `cards.js` reads the gem threat from `bearableGemsWithName` (1, Bonded Soul 0) and `squadThreat` adds it for each attached gem. Docs updated.
