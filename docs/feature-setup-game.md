# Feature: Setup game

Status: done on 2026-10-07. Not checked in a browser. The VP marker affiliation is not built yet (see [Not built yet](#not-built-yet)).

## Goal

Players go from two loaded rosters to the start of round 1. In a room, the new room dialog takes both rosters, and the Red field of the toolbar can load Red later (`docs/feature-rooms.md`). In the Sandbox, the toolbar loads both. The app guides them through the mission setup of the rulebook (p9, p11) with buttons on the table. It draws the crisis cards at random, knows the Maximum Threat, and puts each squad on the table.

## What the app does

The app does not know who wins a roll off or who clicks a button. So it does not check who may click. Each button names the player who makes the choice, and players click for the right player. This follows `docs/feature-crisis.md`, "Players apply the rules".

| Step | Rule (p9, p11) | In the app |
|---|---|---|
| Roll off | Players roll off. See [Roll off](#roll-off) | Not tracked. Players roll with the dice trays and read the result. The panel next to the scoring board shows the rule |
| Deck | The winner gets Priority. They choose one of their crisis decks: Secure or Extract | **Use Blue player Secures** or **Use Blue player Extracts** (the same for Red). The app draws 2 cards of that deck at random |
| First card | The other player chooses 1 of the 2 cards | **Use** next to each drawn card. The app then draws 2 cards of the other type from the other player's deck |
| Second card | The player with Priority chooses 1 of those 2 cards | **Use** next to each drawn card |
| Maximum Threat | The player without Priority chooses which card's threat the mission uses | **Secure · 17** or **Extract · 18** on the panel next to the scoring board |
| Deployment edge | The player with Priority chooses a battlefield edge | **↺ Select board edge ↻** on the panel. The arrows turn the mat 90°. **Select board edge** puts the two crisis cards on the board ends and their tokens on the mat |
| Squads | Each player chooses characters with a total threat up to the Maximum Threat, and up to 5 Team Tactic cards | **Select squad**, then a click on a roster card adds it or removes it. Then **Ready**. When both players are Ready, both squads go on the table |

The app checks only one rule: **Ready** does not work when the squad threat is above the Maximum Threat. A squad with less threat is fine. The app does not check the Team Tactic count, alter egos (p11) or affiliations. The panel shows the Team Tactic count in red above 5.

### Roll off

From the user, 2026-10-07: each player rolls. The player with more successes (Crits, Wilds and Hits together) wins. On a tie, the player with more Crits wins, then the player with more Wilds. Otherwise, players roll again.

The app does not read the dice for this. A later change can do it, because the dice trays already know the faces (see `docs/feature-dice-rolling.md`).

### Priority

The bottom edge of the map on a crisis card is the deployment edge of the player with Priority (p9). Before this feature, the app always put that edge at the blue side (`docs/feature-crisis.md`, "Setup flow"). Now the app knows who has Priority: the player whose deck the mission uses first. When the red player has Priority, the tokens of both cards turn a half turn around the mat center (`buildMatTokens` in `App.jsx`, `turned`). A crisis card that a player chooses in the toolbar later turns the same way.

On 2026-09-29, Survivors was the only current card with a map that changes after a half turn. So for the other cards, the tokens land at the same places.

## On the table

### Crisis cards

The crisis cards of the rosters do not lie in the roster rows any more. They lie next to the scoring board, on the owner's side, until **Select board edge**. Changed on 2026-10-07: the rows now run along z, parallel to the board. Numbers are for blue (+z). Red is the same at −z: only z changes sign.

Deck step. Seen from above, the table edge (−x) on the left. The deck buttons lie in one line along z in the gap:

```
            x = −35 … −30.2    x = −29.6    x = −29.0 … −24.2
            Secure row          gap          Extract row
z = 27.5    [secure 5]                       [extract 5]
            [secure 4]                       [extract 4]
            [secure 3]   [Use Blue player …] [extract 3]
            [secure 2]                       [extract 2]
z = 12.55   [secure 1]                       [extract 1]
            ── board end card (z = 9.5 … 12.25), scoring board (z = −9 … 9) ──
```

After a deck choice, a side with drawn cards:

```
            x = −26.1    x = −25.5 … −20.7 (in line with the board)
z = 18.35   Use          [drawn 2]
z = 12.55   Use          [drawn 1]
            ── board end card, scoring board ──
```

- The cards are turned the same way as the scoring board and the cards on its ends: the image top faces the table edge (−x). So each row runs along z, parallel to the board. Both players see the cards turned the same way.
- The cards are 2.75" × 4.8", the same as a crisis card on the board end.
- **Deck rows:** the Secure row is the first row, at the table edge (x = −35 … −30.2). The Extract row lies toward the mat (x = −29.0 … −24.2). The gap between them is 1.2", and the deck buttons are in it.
- A row starts past the Secure card on the board end (z = 12.25 + 0.3), so its first card is the one nearest to the board. The deck area is as long as 5 cards, 14.95". A row with more cards gets smaller cards, so that it fits.
- The deck rows reach past the tactic tray (z = 22.4), next to roster row 1. So they end 0.3" before x = −23.85, where a roster row of 10 character cards ends.
- **Drawn cards:** the 2 cards drawn from a deck lie in line with the board (x = −23.1, the same as the cards on the board ends), from z = 12.55. So after the second **Use**, the chosen card of each player lies next to the board end. Added on 2026-10-07. Before, the drawn cards stayed in the row of their deck.
- A **Use** button is next to each drawn card, on the table-edge side (x = −26.1).
- The steps: after **Use Blue player Secures**, blue shows its 2 drawn Secure cards in line with the board. Red shows its Extract row. After **Use**, blue shows the chosen card, and red shows its 2 drawn Extract cards in line with the board. After the second **Use**, each player shows their chosen card.
- A click on a card opens the crisis tab of the roster popup.
- **Select board edge** removes the rows. The two chosen cards then lie on the board ends, the same as a card from the toolbar (Secure at +z, Extract at −z).
- A chosen card without files in the app has no image and no tokens. The HUD message says so.

### Buttons

- The buttons lie flat on the table: drei `Html` with `transform`, the same as the tray controls. 1 CSS px is 0.04" on the table, so a 13 px button text is about 0.5" high. Changed on 2026-10-07: before, the buttons kept their size on the screen.
- The buttons read the same way as the scoring board and the crisis cards: their top faces the table edge (−x).
- **Use Blue player Secures** is blue and **Use Blue player Extracts** is red, on both players' sides. So the color shows the crisis type, not the player.
- The panel lies between the table edge and the scoring board (x = −31.6, z = 0). It shows what to do in the current step, who has Priority, the Maximum Threat and **Restart setup**. It is at most 440 px (17.6") long, and its text wraps.
- The squad panel of each player lies in their crisis area, which is empty in this step: "Threat 15 / 18" and "Tactics 3 / 5", then **Select squad** and **Ready**. Under it, a red line says when the threat is too high.

### Squads

- **Select squad** turns the choice on and off for that player. While it is on, it has a white outline, and a click on a character or Team Tactic card of that roster adds the card to the squad or removes it. While it is off, a click opens the roster popup as before.
- A card in the squad has a yellow frame.
- Only a card that the app can put on the table can join: a character with a model, a Team Tactic card with an image. For another card, the HUD message names it.
- **Ready** is a toggle. It works when the squad has at least 1 character and its threat is not above the Maximum Threat. While it is on, it has a white outline, the panel says "Waiting for the Red player.", and **Select squad** is off and does not work. So the squad does not change. A second click on **Ready** turns it off, and the player can change the squad again.
- When the second player clicks **Ready**, both squads go on the table at the same time. Changed on 2026-10-08: before, each player clicked **Activate squad**, and their squad went on the table at once.
- For each squad, the app adds a tray and a model for each character, the same as the Library, and puts the Team Tactic cards into the free slots of the tactic tray. A character or a Team Tactic card that the player already has on the table is not added again. Then the roster cards leave the table, the setup is done, and its buttons go away.

### Restart

- **Restart setup** on the panel starts the setup again, after a confirm.
- A new roster, or **×** of a roster, also starts the setup again, because the setup points to the cards of the rosters. The HUD message says so. When the setup has put something on the table, a confirm asks first.
- A restart removes what the setup put on the table: the characters (trays and models) and the Team Tactic cards of the squads, and the two crisis cards of the mission with their tokens. Changed on 2026-10-07: before, all of it stayed on the table.
- A restart keeps the rest: characters and cards that players added from the Library, a crisis card that a player changed in the toolbar after **Select board edge**, the mat turn and the score. A character or a Team Tactic card that was on the table before the squads is not added again, so it is not removed either.

## State

`App.jsx` has a new object, `setup` (`src/setup/setup.js`):

```js
setup: {
  deck: null | { team, type },   // the roll-off winner (Priority) and the deck type they use
  draws: { secure: [code], extract: [code] },   // the 2 cards drawn from each deck
  picks: { secure: code | null, extract: code | null },   // the cards of the mission
  threat: null | number,   // the Maximum Threat
  edge: false,   // the deployment edge is chosen
  squads: { blue: { characters: [place], tactics: [place] }, red: … },
  ready: { blue: false, red: false },   // the Ready toggles. Both true: the squads are on the table
  placed: { characters: [id], tactics: [id] },   // what the squads put on the table, both players
}
```

- The current step comes from these fields (`setupStep`), so the state cannot disagree with itself.
- A squad stores places in the roster lists, not codes, because a roster can list a code twice.
- The random draws are in the state. So in a later peer-to-peer game, both players see the same cards (see `docs/feature-peer-to-peer.md`).
- All fields are plain JSON. A room saves `setup` with its table (`rooms/table.js`). A room saved before this feature starts with a new setup. A saved setup without a newer field, for example `placed`, gets the start value of that field (`restoreSetup`). A setup saved before the Ready toggles has `active: { blue, red }`, the player activated their squad. `restoreSetup` uses it as `ready`. So a game with both squads on the table stays done.
- `placed` has the ids of the new characters and Team Tactic cards. The second **Ready** makes them before it changes the state, because React can call a state updater twice, and the ids must be the same in `placed` and on the table.
- `squadSelect: { blue, red }` in `App.jsx` says which player is choosing squad cards. It is not saved.

## Code

| File | Content |
|---|---|
| `src/setup/setup.js` | `NEW_SETUP`, `setupStep`, the step changes (`chooseDeck`, `pickCard`, `chooseThreat`, `chooseEdge`, `toggleSquadCard`, `toggleReady`, `activateSquads`), `restoreSetup`, `crisisRows`. No imports, so a Node script can check it |
| `src/components/GameSetup.jsx` | The crisis rows and all setup buttons |
| `src/rosters/layout.js` | `crisisRowLayout`, `crisisCenterZ`, `CRISIS_GAP_X`. Row 2 of the roster has only the Team Tactic cards now |
| `src/rosters/cards.js` | `threat` and `key` of each card, `squadThreat` |
| `src/components/RosterCards.jsx` | The squad frame. `RosterCard` is exported for the crisis rows |
| `src/App.jsx` | The setup handlers, `buildMatTokens(card, turned)`, `newCharacter` |

## Not built yet

- The VP marker affiliation from the squad. See the notes below.
- Leadership choice, Infinity Gem cards next to the character, hidden squads. The rulebook says that players do not show their squads until deployment (p11). In the app, both players see the choice.
- The Priority token on the scoring board.
- A button to skip the setup, for players who set up the table by hand.

## Notes from the user

From 2026-10-07:

- Players choose their squad from the loaded roster. The roster cards show until then.
- The toolbar has no VP marker picker. Load roster removes it, and the VP markers show the Unaffiliated token until this feature. The app then finds the token of each VP marker from the squad: from the leaders in it and the characters with the same affiliation.
- Most rosters have one possible affiliation. Many have 2, and a few have 3.

Later on 2026-10-07, the user described the setup flow that is built now (see [What the app does](#what-the-app-does)):

- Setup always starts with a roll off. The app does not track it, but this doc lists it, so that it says what the app supports.
- The crisis cards of each player lie on their side of the scoring board: Secure cards in row 1, Extract cards in row 2, with the deck buttons between the rows.
- The draws are random. Each drawn card has a **Use** button.
- **Activate squad** must not work with more threat than the Maximum Threat. Less threat is fine.

On 2026-10-08:

- Each player clicks a **Ready** toggle in place of **Activate squad**. When both players are Ready, both squads go on the table at the same time.

## Rules

From the Jarvis rules reference (rulebook 1.3.0 and 1.4.0):

- A squad uses an affiliation when more than half of its characters have that affiliation. A squad has only one affiliation. (p11)
- A roster does not include an affiliation. Players decide when they build the squad. (p11)
- A Leadership ability is active only when the squad uses the affiliation that the ability requires. (p7)
- When several characters have a Leadership ability that the squad can use, the player chooses one. Players declare their choices at the same time, after both squads are deployed. (p7, p11)
- Players can choose Team Tactic cards that require the affiliation of their squad. (p11)
- Mission setup: the player with Priority chooses one of their decks (Secure or Extract), draws 2 cards from it, and the other player chooses 1. Then the player without Priority draws 2 cards from their deck of the other type, and the player with Priority chooses 1. (p9)
- The player without Priority chooses which card's Maximum Threat the mission uses. (p9)
- The player with Priority chooses a battlefield edge as their deployment edge. It is the bottom of the map on the crisis card, the blue zone. (p9)
- A squad has a combined Threat Value equal to or lower than the Maximum Threat. Characters in a squad cannot share an alter ego. (p11)
- Players select up to 5 of the 10 Team Tactic cards of their roster. (p11)
- Players do not reveal their squads until deployment. (p11)

## Facts found

On 2026-10-07:

- Jarvis lists the affiliations of each character (`affiliations[]` in `src/characters/jarvis-characters.json`): `slug`, `name`, `isLeader`, `isLeaderWithTeamTactics`, `timelines`.
- 21 characters can get a Leadership ability through a Team Tactic card (`isLeaderWithTeamTactics`), for example Adam Warlock and Doctor Strange. 11 Team Tactic cards have the Jarvis tag `leadership`. So a leader can come from a Team Tactic card.
- 2 characters have the Jarvis tag `rogueAgent`: Taskmaster and Winter Soldier. Jarvis explains it as "Counts as an affiliated character during squad building".
- Jarvis has 31 affiliations. The app has 34 affiliation tokens (`src/scoreboard/affiliations.json`). The keys are the same except `uncanny-x-men` (Jarvis) and `uncanny-xmen` (app). The app also has `unaffiliated`, `captain-america-shield` and `vibranium-heist`.

## Decisions

Made on 2026-10-07:

1. The app does not track the roll off. The panel next to the scoring board shows the rule.
2. The app does not check who clicks a button. The text names the player who chooses.
3. The roll-off winner has Priority. When red has Priority, the crisis tokens turn a half turn, so that the bottom of the card map is at the red side.
4. The crisis cards of a roster lie next to the scoring board, not in roster row 2. The rows run parallel to the board, and the cards are turned the same way as the board.
5. The setup buttons lie flat on the table and read the same way as the board. The deck buttons have the color of the crisis type: Secure blue, Extract red.
6. The only rule check is the squad threat. **Ready** also needs at least 1 character.
7. A squad card must be one that the app can put on the table: a character with a model, a Team Tactic card with an image.
8. A new roster, **×** of a roster or **Restart setup** starts the setup again. It removes the squads and the crisis cards that the setup put on the table, after a confirm.
9. The drawn and chosen crisis cards lie in line with the scoring board, next to its end.

Made on 2026-10-08:

10. Each player has a **Ready** toggle. Both squads go on the table when the second player clicks it. While a player is Ready, their squad does not change.
