# Feature: Setup game

Status: partly built. See [Not built yet](#not-built-yet).

## Goal

Players go from two loaded rosters to the start of round 1. In a room, the new room dialog takes both rosters, and the Red field of the toolbar can load Red later (`docs/features/rooms.md`). In the Sandbox, the toolbar loads both. The app guides them through the mission setup of the rulebook (p9, p11) with buttons on the table. It draws the crisis cards at random, knows the Maximum Threat, and puts each squad on the table.

## What the app does

Every setup step writes an entry in the Log (`docs/features/game-log.md`).

In a multiplayer room, only the player who chooses in the current step can click its buttons: the deck buttons, the card **Choose** buttons, the Maximum Threat chips and the edge controls (`chooserOf(setup)` in `src/setup/setup.js`: deck, second card and edge are the player with Priority, first card and Maximum Threat are the other player). The other player sees them disabled (`aria-disabled`, no click handler), with the title "Nelly chooses the Maximum Threat". The manual Priority buttons stay open to both players, because players can agree on a roll off made with real dice. In the Sandbox and a single player room anyone clicks, because one person plays both sides. The app still does not check the game rules (`docs/features/crisis.md`, "Players apply the rules"). The panel says what to do now, in the order of the rulebook. Texts use the word "Choose" (the deck step says "Decide if you want to play on your Secure or Extract crises.") and the names of the players (see [Names](#names)).

| Step | Rule (p9, p11) | In the app |
|---|---|---|
| Roll off | Players roll off. See [Roll off](#roll-off) | The app reads the dice trays (see [Roll off](#roll-off)). The panel next to the scoring board shows the rule and two buttons with names: **Nelly has Priority** and **You have Priority** (in the Sandbox and a single player room **Blue has Priority** and **Red has Priority**). Both players can press them. The button sets `setup.priority` and the Priority marker (`game.priority`, see `docs/features/round-phases.md`, "Priority marker") |
| Deck | The player with Priority chooses one of their crisis decks: Secure or Extract | **Choose Secures** or **Choose Extracts**, in the crisis area of the player with Priority only. The buttons have no color. The app draws 2 cards of that deck at random. The panel says "Decide if you want to play on your Secure or Extract crises."; the other player in a room sees "Waiting for Nelly to decide if they want to play on their Secure or Extract crises."; the Sandbox and a single player room "Blue decides if they want to play on their Secure or Extract crises.". Browsing back and the log say "Nelly plays on their Secure crises." / "You play on your Extract crises."; a button title says "Play on your Secure crises: draw 2 of them" |
| First card | The other player chooses 1 of the 2 cards | **Choose** next to each drawn card. The panel says "Choose from Nelly's Secures." to the player who chooses, and "Waiting for Nelly to choose from my Secures." to the other. The app then draws 2 cards of the other type from the other player's deck |
| Second card | The player with Priority chooses 1 of those 2 cards | **Choose** next to each drawn card |
| Maximum Threat | The player without Priority chooses which card's threat the mission uses | **Secure · 17** or **Extract · 18** on the panel next to the scoring board. "You choose the Maximum Threat." or "Waiting for Nelly to choose the Maximum Threat." |
| Deployment edge | The player with Priority chooses a battlefield edge | **↺ Choose this edge ↻** on the table in front of the player with Priority (see [Buttons](#buttons)). The arrows turn the mat 90°. **Choose this edge** puts the two crisis cards on the board ends and their tokens on the mat. In a multiplayer room, the toolbar has no ↺ ↻, so this step is the only mat turn. After it, the mat turn stays fixed until **Restart setup** |
| Squads | Each player chooses characters with a total threat up to the Maximum Threat, and up to 5 Team Tactic cards | The **+** button on a roster card adds it or removes it (or the popup, or the Breakdown tab). Then **Squad ready**. The panel says "Click + on a roster card, or choose a squad in the Breakdown tab." When both players are ready, the squads are revealed and go on the table. In a multiplayer room, each player's squad stays hidden until then (see [Squads](#squads)) |
| Deployment | Players deploy one model at a time, taking turns. The player with Priority deploys first (p12). The app does not enforce it | The step `deploy` comes after the reveal and the affiliation. The panel says "Deploy one model at a time, taking turns. Nelly deploys first." or "You deploy first.", and a note that names the real button: "Press Power (bottom right) to start round 1 when both squads are deployed." (Power in the HUD), or "Press Auto Power Phase to start round 1 …" (Power on the table). A **Start round 1** chip on the panel does the same as the Power button: it calls the Power Phase for the sides this browser plays When both squads are on the table, Deploy Lock turns on once (`game.deployLine`, marker `setup.lockSet`): every browser checks the setup after each change, so it works in the Sandbox, a single player room and a multiplayer room. The first Power Phase in round 1 (a table button or the toolbar) sets `setup.deployed`, turns Deploy Lock off and gives the Power. The setup is then done and the panel is gone. A player can still turn Deploy Lock on and off by hand: it does not change the step |
| Affiliation | A squad uses an affiliation when more than half of its characters have it (p11) | The app sets it with no click when the squad has 0 or 1 such affiliation. With 2 or 3, the panel shows the step. See [Affiliation](#affiliation) |

The app checks only one rule: **Squad ready** does not work when the squad threat is above the Maximum Threat. The squad threat is the Threat Levels of the characters plus the threat of each attached Infinity Gem: 1, and 0 for Bonded Soul (from Jarvis). A squad with less threat is fine. The app does not check the Team Tactic count, alter egos (p11) or affiliations. The panel shows the Team Tactic count in red above 5.

### Names

`src/setup/names.js` (no imports) names the players in every setup text: `playerName(team, ctx)`, `possessive(team, ctx)`, `says(team, ctx, verb)` ("You choose" / "Nelly chooses"; `have` → "has"), `isYou`.

- Multiplayer room: "You" and "my" for the own side. The other side is the Discord `name` of the player (`docs/features/auth.md`), from the room players or the hello of the peer. A deleted player is "Deleted player". A seat with no name is "Opponent".
- Sandbox and single player room: the current color name of the side ("Blue" / "Red", `colorOf`). In a single player room it follows Priority, so after the roll off the winner is Blue.
- A step that one player chooses says "You choose the board edge" to that player, and "Waiting for Nelly to choose the board edge." to the other. Without own side (Sandbox, single player room) it says "Blue chooses the board edge."

### Roll off

Setup always starts with a roll off. Each player rolls 5 dice with their dice tray. The player with more successes (Crits, Wilds and Hits together) wins. On a tie, the player with more Crits wins, then the player with more Wilds. Otherwise, players roll again. Blank, Block and Skull count for nothing.

The app reads it (`src/setup/rollOff.js`). In the step `rollOff`, when a new `throw` entry reaches the history (from this browser or the other one) and both shelves hold exactly 5 dice, the app sets `setup.priority` to the winner and stores the result in `setup.rollOff`. The panel says "Nelly wins the roll off: 4 successes against 3." or "You win the roll off: …" (see [Names](#names)), and adds which of Crits or Wilds decided when the successes were equal. On a tie the panel says "Tie: roll again.", and Priority stays null. A player clears the tray and rolls again. The text stays until the deck is chosen.

In a multiplayer room, every browser checks on every new `throw` entry, its own or the other player's. A shelf write and its entry are one change, so a browser that has the last entry has both full shelves. This covers players who roll at the same time. Both browsers may write: the result is the same, and a browser skips the write when `setup.rollOff` already has it. Only a new throw triggers it, so shelves left from before a restart do not count. An entry older than 30 s is not new (a history that syncs late).

The manual buttons (**Nelly has Priority**, **You have Priority**) stay. Both players can press them, because players can agree on a roll off made with real dice. A manual press replaces the read result. The step `rollOff` lasts while `setup.priority` is null.

The roll off also sets the Priority marker `game.priority` on the scoring board, in the same change as `setup.priority`. `setup.priority` is the roll-off winner and sets the colors for the whole game. `game.priority` is the marker that moves in the Cleanup Phase (`docs/features/round-phases.md`, "Priority marker"). **Restart setup** and **Override** to the roll off clear both.

### Colors

A side is a seat at the table: the key `host` is at +z and the key `guest` is at −z. The host of the room always sits at +z. A color is Blue or Red. The two are not the same thing, so no code reads a color from a side key. Every place that shows a color calls `colorOf(team, setup, followPriority)` (`src/setup/setup.js`):

- In a single player room and a multiplayer room (`followPriority` true), the side with Priority is Blue and the other side is Red, for the whole game.
- Before the roll off, and always in the Sandbox (`followPriority` false), the +z side is Blue. The roll off sets Priority there, not the colors.
- **Restart setup** clears Priority, so the colors go back to the +z side Blue.

`App.jsx` computes the color of both sides and gives it to `src/sideColors.js`, a small store that the DOM and the Canvas read (`useSideColor(side)`). It tints the tools, the rack, the dice trays, the model bases, the VP markers, the Control rings of crisis tokens, the remote cursor, the outlines of the other player's selection, the dice history, the chips and the "Blue player" / "Red player" texts. The lobby, the new room dialog and the join page have no setup, so they show the colors before the roll off.

`COLOR_HEX` in `src/sideColors.js` is the one source of the two hex colors. `main.jsx` sets them as the CSS variables `--player-blue` and `--player-red` before the first render, and `index.css` reads the variables.

### Priority

The bottom edge of the map on a crisis card is the deployment edge of the player with Priority (p9). The app knows who has Priority: `setup.priority`, the side that won the roll off. The player with Priority chooses the deck, so the deck step has no team to pick. When the −z side (the key `guest`) has Priority, the tokens of both cards turn a half turn around the mat center (`buildMatTokens` in `src/crisis/matTokens.js`, `turned`). A crisis card that a player chooses in the toolbar later turns the same way.

Survivors is the only current card with a map that changes after a half turn. So for the other cards, the tokens land at the same places.

## On the table

### Crisis cards

The crisis cards of the rosters do not lie in the roster rows any more. They lie next to the scoring board, on the owner's side, until **Choose this edge**. The rows run along z, parallel to the board. Numbers are for the host (+z). The guest is the same at −z: only z changes sign.

Deck step. Seen from above, the table edge (−x) on the left. The deck buttons lie in one line along z in the gap:

```
            x = −35 … −30.2    x = −29.6    x = −29.0 … −24.2
            Secure row          gap          Extract row
z = 27.5    [secure 5]                       [extract 5]
            [secure 4]                       [extract 4]
            [secure 3]   [Choose Secures…] [extract 3]
            [secure 2]                       [extract 2]
z = 12.55   [secure 1]                       [extract 1]
            ── board end card (z = 9.5 … 12.25), scoring board (z = −9 … 9) ──
```

After a deck choice, a side with drawn cards:

```
            x = −26.1    x = −25.5 … −20.7 (in line with the board)
z = 18.35   Choose         [drawn 2]
z = 12.55   Choose         [drawn 1]
            ── board end card, scoring board ──
```

- The cards are turned the same way as the scoring board and the cards on its ends: the image top faces the table edge (−x). So each row runs along z, parallel to the board. Both players see the cards turned the same way.
- The cards are 2.75" × 4.8", the same as a crisis card on the board end.
- **Cards turn toward the chooser.** The cards that the chooser picks from read upright from the chooser's table edge, not toward −x: the deck step turns both rows (Secure and Extract) of the player with Priority; the first and second steps turn the 2 drawn cards (the ones with **Choose**). The yaw is the same as the roster cards of that side: host (+z) 0, guest (−z) π. All other cards keep the yaw π/2. The row still runs along z, so a turned card is 4.8" long in z and 2.75" wide in x: the pitch is 4.8" + 0.3", and a row of 5 is scaled to 0.97 so that it ends 1" before the table edge (z 37). The columns keep their x (Secure −32.6, Extract −26.6, drawn −23.1). The deck buttons stay centered between the rows. The **Choose** button of a turned drawn card moves to x = −25.1, next to the narrower card. `crisisRows` gives each row `facing` (the chooser, or null), and `crisisRowLayout(team, type, codes, drawn, facing)` sets yaw, pitch and scale.
- **Deck rows:** the Secure row is the first row, at the table edge (x = −35 … −30.2). The Extract row lies toward the mat (x = −29.0 … −24.2). The gap between them is 1.2", and the deck buttons are in it.
- A row starts past the Secure card on the board end (z = 12.25 + 0.3), so its first card is the one nearest to the board. The deck area is as long as 5 cards, 14.95". A row with more cards gets smaller cards, so that it fits.
- The deck rows reach past the tactic tray (z = 22.4), next to roster row 1. So they end 0.3" before x = −23.85, where a roster row of 10 character cards ends.
- **Drawn cards:** the 2 cards drawn from a deck lie in line with the board (x = −23.1, the same as the cards on the board ends), from z = 12.55. So after the second **Choose**, the chosen card of each player lies next to the board end.
- A **Choose** button is next to each drawn card, on the table-edge side (x = −26.1).
- The steps: after **Choose Secures**, the host shows its 2 drawn Secure cards in line with the board. The guest shows its Extract row. After **Choose**, the host shows the chosen card, and the guest shows its 2 drawn Extract cards in line with the board. After the second **Choose**, each player shows their chosen card.
- A click on a card opens the **crisis compare overlay** (below), not the roster popup. The roster popup still has its Crisis tab, opened from a character or Team Tactic card.
- **Crisis compare overlay** (`CrisisCompare.jsx`), in the roll off, deck, first and second steps, from a click on a crisis card of either side. The 2 drawn cards (with **Choose**) open the Choose 1 overlay instead: `App.jsx` `handleCrisisOpen({ team, type, code, drawn })` is the one place that decides.
  - Two tabs, **Compare Secures** and **Compare Extracts**. The tab of the clicked card opens first.
  - Top half: a carousel of my Secure (or Extract) cards, the whole deck of the roster. Bottom half: the opponent's. Each half has the player name (`playerName`) in the player color. In the Sandbox and a single player room, the side of the clicked card is on top. Each carousel starts at its middle card, so all 5 cards show. The cards are the images of the roster Crisis tab.
  - Under the tabs, in the deck step only: **Choose Secures** / **Choose Extracts** for the active tab. Same action, locks and titles as the table button (`src/setup/deckButton.js`). A click closes the overlay.
  - It opens by itself when the deck step starts, once for each setup id, on the screen of the player with Priority (the Sandbox and a single player room: always), on the Secure tab. Closing it, or browsing Prev / Next, does not open it again; a card click does. The other player does not get it.
  - Esc and **×** close it. The left and right arrows move the top carousel. It is the roster popup frame, backdrop and `Carousel.jsx`. It closes when the step is past the second card.
- **Choose 1 overlay** (`CrisisChoose.jsx`), in the first and second steps: the 2 drawn cards side by side, large, with **Choose this card** under each. Title "Choose 1 of Nelly's Secures" ("Blue's" in the Sandbox, "your" for own cards). The button is the table **Choose** chip: same action (`setupActions.pick`), same lock and title (`pickButton` in `src/setup/deckButton.js`).
  - It opens by itself once for each `<setup id>:<step>`, on the screen of the chooser (`chooserOf`; the Sandbox and a single player room: always). Same helper as the compare overlay (`src/setup/useAutoOpen.js`). Browsing Prev / Next does not open it.
  - A click on a drawn card opens it again. The other player sees the cards without buttons and "Waiting for Nelly to choose a card."
  - A pick, Esc and **×** close it. It also closes when the step changes (the other player picked from another screen).
- **Choose this edge** removes the rows. The two chosen cards then lie on the board ends, the same as a card from the toolbar (Secure at +z, Extract at −z).
- A chosen card without files in the app has no image and no tokens. The HUD message says so.

### Buttons

- The buttons lie flat on the table: drei `Html` with `transform`, the same as the tray controls. 1 CSS px is 0.04" on the table, so a 13 px button text is about 0.5" high.
- The buttons read the same way as the scoring board and the crisis cards: their top faces the table edge (−x).
- **↺ Choose this edge ↻** lie on the side of the player with Priority (also in the Sandbox), flat and facing that player, like the Power Phase buttons: in the row of the Team Tactic tray, on the owner's right of the tactic plate, the mirror of the Power Phase button (host: x 9.25 … 16.45, z 18.55 … 22.15; the guest is the mirror). So they are inside the start view and next to the mat that the arrows turn. The arrows are on the first row, 2.2" × 1.4" each (about twice a normal chip). **Choose this edge** is on its own second row, 7.2" × 1.2", toward the table edge. The place is `edgeControls(side)` in `src/tabletools/layout.js`, and a Node test checks that it does not overlap the mat, trays, tactic tray, Power button, rack, dice trays, roster rows or crisis rows, and that it lies in the start view. The other player sees them disabled in a multiplayer room. The info panel stays next to the scoring board.
- **Choose Secures** and **Choose Extracts** have no color, so a color never shows a crisis type. Only the player with Priority has them.
- The panel lies between the table edge and the scoring board (x = −31.6, z = 0). It shows what to do in the current step, who has Priority, the Maximum Threat and **Restart setup**. It is at most 440 px (17.6") long, and its text wraps.
- The squad panel of each player lies flat and facing them, right below their roster rows (past the Team Tactic cards), centered in x, in the free band between the cards (z 29.5) and z 33.95, inside the start view. So the player clicks + on the roster cards and sees the threat and the buttons without turning the camera. It is 24" wide and 3.7" deep at most, text 12px. One row has "Threat 15 / 18", "Tactics 3 / 5" and **Squad ready** (the main button, the strongest style of the panel). Under it is the hint "Click + on a roster card, or choose a squad in the Breakdown tab." Under it, a red line says when the threat is too high.

### Squads

- Players choose their squad from the loaded roster. The roster cards show until then.
- There is no squad mode. Each card of the own roster (in the Sandbox and a single player room: both rosters) has a small **+** button in its top right corner, a **✓** button when the card is in the squad. A click on it adds the card to the squad or removes it. It does not open the popup and does not start a drag. A click anywhere else on the card opens the roster popup, as in the other steps (with the Alt peek and the hover outline of the table controls). The button is not shown while the player has Squad ready on, while a player browses an earlier step, in the other steps, or on the other player's roster.
- The roster popup of the own roster in this step shows **Add to squad** / **Remove from squad** on a character and a Team Tactic card, with the same rules as the corner button. The Breakdown row click stays.
- A card in the squad has a yellow frame.
- The Breakdown tab of the roster popup lists the squads that fit the Maximum Threat. A click on one of them chooses its characters (see `docs/features/squad-breakdown.md`, "Choose a squad").
- Only a card that the app can put on the table can join: a character with a model, a Team Tactic card with an image. For another card, the HUD message names it.
- **Squad ready** is the main button. It works when the squad has at least 1 character and its threat is not above the Maximum Threat; else it has `aria-disabled` and a title that says why. While it is on, the button is **Change squad** (a normal button), the panel says "Waiting for Nelly." (the name of the other player), and the squad does not change. A click on **Change squad** turns it off, and the player can change the squad again.
- When both players are ready, both squads go on the table at the same time. **Squad ready** only sets the toggle. An effect in each browser puts the squads on the table (see below).
- **Hidden squads (multiplayer rooms).** The rulebook says that players do not show their squads until deployment (p11). In a multiplayer room:
  - The squad and Team Tactic cards that a player chooses are not in the shared document. They are in `localStorage` of that browser (`rooms/store.js`, key `mcp-assist-3d/squad/<user id>/<code>`, value `{ setupId, squad }`). A reload keeps the choice.
  - **Ready** writes only `setup.ready[side]`.
  - When both players are Ready, each browser reveals the squad of its own side: in one transaction it writes `setup.squads[side]`, adds the characters and Team Tactic cards, and sets `setup.placed[side]`. Then it deletes the stored squad.
  - Until then, the panel of the other player shows only "Choosing a squad" or "Ready". It has no threat, no tactic count and no buttons, and their roster cards have no yellow frame. A click on their cards opens the roster popup.
  - If the other page is closed, the panel says "Waiting for Nelly to reveal their squad." (step `reveal`).
  - A stored squad counts only for the setup with the same `setup.id`. So a restart in the other browser drops it.
  - If both players are Ready and this browser has no stored squad (another device, cleared storage), the player is not Ready any more, and the HUD says "Your squad choice is not in this browser. Choose it again."
  - The lobby deletes stored squads of rooms that are not in the room list. Deleting a room deletes its stored squad.
  - A single player room and the Sandbox keep the squads in the document, as before: one person plays both sides.
- For each squad, the app adds a tray and a model for each character, the same as the Library, and puts the Team Tactic cards into the free slots of the tactic tray. A character or a Team Tactic card that the player already has on the table is not added again. Then the roster cards leave the table, the setup is done, and its buttons go away.

### Restart and history

- **Restart setup** on the panel starts the setup again, after a confirm.
- A new roster, or **×** of a roster, also starts the setup again, because the setup points to the cards of the rosters. The HUD message says so. When the setup has put something on the table, a confirm asks first.
- A restart removes what the setup put on the table: the characters (trays and models) and the Team Tactic cards of the squads, and the two crisis cards of the mission with their tokens.
- A restart keeps the rest: characters and cards that players added from the Library, a crisis card that a player changed in the toolbar after **Choose this edge**, the mat turn and the score. A character or a Team Tactic card that was on the table before the squads is not added again, so it is not removed either.
- A restart also turns Deploy Lock (`game.deployLine`) off.
- **Prev** / **Next** on the panel browse the steps that are done: roll off, deck, first card, second card, Maximum Threat, edge, squads, affiliation (when the state has it), deployment. **Next** from the last one goes back to the current step. While a player browses, the panel shows the step name and its choice in words ("Maximum Threat: Nelly chose Extract · 18"), and the buttons of the current step are disabled. The squad panels are hidden. `setup.view` is in the shared setup, so both players see the browsed step, and either player can press **Prev**, **Next** and **Override**.
- **Override** on a browsed step, after a confirm, makes that step the current step for both players and drops the later choices:
  - roll off: Priority and the read result, and everything after. Deck: the deck, the draws, the picks, and everything after.
  - first card: both picks and everything after. Second card: the second pick and everything after. The drawn cards stay.
  - Maximum Threat: the threat and later. Edge: the edge and later.
  - squads or earlier: also the squads, Ready, `placed`, the affiliations and `deployed`. The setup gets a new `id`, so the squad that each browser stored in a multiplayer room is dropped too (it counts only for the old id). The yellow frames show only in the squad step, not while browsing. Affiliation: the affiliations and `deployed`. Deployment: `deployed`.
  - What leaves the table is the same code as for a restart: with squads on the table, the characters and Team Tactic cards of the squads leave and Deploy Lock turns off. At the edge or earlier, with the edge chosen, the two crisis cards with their tokens leave the board ends. The crisis rows are then those of the step again. Other pieces stay. The confirm names what is removed.

## Affiliation

Rule p11: a squad uses an affiliation when more than half of its characters have it. Exactly half is not enough. A squad has only one affiliation.

- When a squad goes on the table, the app counts the affiliations of its characters (from Jarvis, `squadAffiliations` in `src/scoreboard/affiliations.js`). A Rogue Agent (Jarvis tag `rogueAgent`: Taskmaster, Winter Soldier) counts as a character of each affiliation that it does not have. Two Rogue Agents count only once. With none, the squad is Unaffiliated. With one, that is the affiliation. In both cases the app sets it with no click.
- With 2 or 3, the step `affiliation` opens after both squads are on the table. The panel says "Choose the affiliation of your squad." and has a row of chips for each player: those affiliations and Unaffiliated. A click chooses it.
- A row that the app set can also change while the step is open.
- In a multiplayer room, each player clicks only their own row. The other row is disabled. After the reveal, both squads are in the document, so both rows show their choices.
- A choice writes `setup.affiliation` and `game.affiliations` together. The VP marker and the Control markers show the token.
- Power waits for the affiliation, for each side on its own (`needsAffiliation` in `src/setup/setup.js`). While a placed side has none, its Power controls are disabled with the title "Choose the affiliation of your squad first." (the Sandbox names the color: "Blue's squad"): the HUD Power button, the table Auto Power Phase button of that side and the Start round 1 chip. A control that acts for both sides is disabled while any of them has none. A side that has its affiliation keeps its Power.
- The step `deploy` follows when both sides have an affiliation. When both squads have no choice, the step does not open.
- **Restart setup** clears `setup.affiliation`. The VP markers keep their token until the next squads choose.
- A saved setup with no `affiliation` field skips this step.
- Jarvis `uncanny-x-men` is the token `uncanny-xmen`.
- The toolbar has no VP marker picker. The app finds the token of each VP marker from the characters of the squad: an affiliation that more than half of them have (p11). It does not use leaders (p7).
- Most rosters have one possible affiliation. Many have 2, and a few have 3.

## State

`App.jsx` has the object `setup` (`src/setup/setup.js`):

```js
setup: {
  id: string | null,   // random, new with each setup. A stored squad counts only for its setup id
  priority: null | team,   // team: 'host' | 'guest'. The roll-off winner (Priority). The colors follow it (see Colors)
  deck: null | { type },   // the deck type that the player with Priority uses
  draws: { secure: [code], extract: [code] },   // the 2 cards drawn from each deck
  picks: { secure: code | null, extract: code | null },   // the cards of the mission
  threat: null | number,   // the Maximum Threat
  edge: false,   // the deployment edge is chosen
  squads: { host: { characters: [place], tactics: [place] }, guest: … },
  ready: { host: false, guest: false },   // the Ready toggles. Both true: the squads are revealed and put on the table
  placed: { host: null | { characters: [id], tactics: [id] }, guest: … },   // what each squad put on the table
  affiliation: { host: null | key, guest: null | key },   // the token key of each squad, null until set
  deployed: false,   // the first Power Phase after the reveal sets it
  lockSet: false,    // Deploy Lock was turned on once, when both squads were placed; a hand toggle stays
  view: null | step,   // the done step that a player browses (Prev / Next), null: the current step
}
```

- The current step comes from these fields (`setupStep`), so the state cannot disagree with itself. The first step is `rollOff`, while `priority` is null.
- A setup saved before `priority` has `deck: { team, type }` and no `priority`. `priorityOf` reads `deck.team` as Priority for it. A saved setup with a `deck` keeps its step, and its colors follow that team. A saved setup with no `deck` is at the roll off.
- A squad stores places in the roster lists, not codes, because a roster can list a code twice.
- The random draws are in the state. So in a later peer-to-peer game, both players see the same cards (see `docs/features/peer-to-peer.md`).
- All fields are plain JSON. A room saves `setup` with its table (`rooms/table.js`). A setup saved with the old `placed` shape `{ characters, tactics }` is read by `placedSides` as the cards of Blue. When both players are Ready, such a setup stays done.
- `placed` has the ids of the new characters and Team Tactic cards of each side. The reveal makes them before it changes the state, because React can call a state updater twice, and the ids must be the same in `placed` and on the table. Each browser writes only the sides it plays. A setup saved with the old shape `{ characters, tactics }` reads as the cards of Blue (`placedSides`).
- `setupStep` has a step `reveal`: both players are Ready, but a side is not placed yet. The step `affiliation` comes after it, while a side has no affiliation. The step `deploy` follows while `deployed` is false. A saved setup with no `deployed` field counts as deployed, so a setup that was done stays done.
- In a multiplayer room, `setup.squads` stays empty until the reveal.
- There is no `squadSelect`. The squad buttons come from the step, `setup.ready`, `setup.view` and the side (`squadBlock` in `useGameSetup.js`).

## Code

| File | Content |
|---|---|
| `src/setup/setup.js` | `NEW_SETUP`, `newSetup`, `setupStep`, the step changes (`chooseDeck`, `pickCard`, `chooseThreat`, `chooseEdge`, `toggleSquadCard`, `setSquadCharacters`, `toggleReady`, `placeSquad`, `chooseAffiliation`, `finishDeploy`), `placedSides`, `needsAffiliation`, `revealPlan`, `crisisRows`. No imports, so a Node script can check it |
| `src/components/GameSetup.jsx` | The crisis rows and all setup buttons |
| `src/components/CrisisCompare.jsx` | The crisis compare overlay |
| `src/components/CrisisChoose.jsx` | The Choose 1 overlay |
| `src/setup/useAutoOpen.js` | Opens an overlay by itself once for each key |
| `src/setup/setupText.js` | `STEP_NAME`, `stepChoice`, `chooses`, `decides`, `rollOffText`: the step names, the choice of a done step, the hints and the roll off text. `stepChoice` gets the card lookup as an argument, so a Node test can run it |
| `src/setup/deckButton.js` | `lockedTitle`, `deckProblem`, `deckButton`, `pickButton`: the lock and title of the deck and card buttons, for the table and the overlay |
| `src/rosters/layout.js` | `crisisRowLayout`, `crisisCenterZ`, `CRISIS_GAP_X`. Row 2 of the roster has only the Team Tactic cards now |
| `src/rosters/cards.js` | `threat` and `key` of each card, `squadThreat`, `squadAffiliationKeys` |
| `src/scoreboard/affiliations.js` | `affiliationKey`, `squadAffiliations`, `autoAffiliation` |
| `src/components/RosterCards.jsx` | The squad frame. `RosterCard` is exported for the crisis rows |
| `src/rooms/store.js` | `readSquad`, `saveSquad`, `deleteSquad`, `listSquadCodes`: the stored squad of a multiplayer room |
| `src/setup/useGameSetup.js` | The setup handlers, the reveal effect |
| `src/crisis/matTokens.js` | `buildMatTokens(card, turned)`, `supplyToken` |
| `src/characters/newCharacter.js` | `newCharacter` |

## Not built yet

- Leadership (p7): the app does not check it.
- Leadership choice.
- Hidden squads in a single player room and the Sandbox. One person plays both sides there, so both squads are in the document.
- A button to skip the setup, for players who set up the table by hand.

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

- Jarvis lists the affiliations of each character (`affiliations[]` in `scripts/jarvis/characters.json`): `slug`, `name`, `isLeader`, `isLeaderWithTeamTactics`, `timelines`.
- 21 characters can get a Leadership ability through a Team Tactic card (`isLeaderWithTeamTactics`), for example Adam Warlock and Doctor Strange. 11 Team Tactic cards have the Jarvis tag `leadership`. So a leader can come from a Team Tactic card.
- 2 characters have the Jarvis tag `rogueAgent`: Taskmaster and Winter Soldier. Jarvis explains it as "Counts as an affiliated character during squad building".
- Jarvis has 33 affiliations. The app has 36 affiliation tokens (`src/scoreboard/affiliations.json`). The keys are the same except `uncanny-x-men` (Jarvis) and `uncanny-xmen` (app). The app also has `unaffiliated`, `captain-america-shield` and `vibranium-heist`.

## Decisions

1. The app reads the roll off from the shelves of the two dice trays when a throw ends and both hold 5 dice. The panel next to the scoring board shows the rule, the result and the **Priority** buttons, which set `setup.priority` by hand. A tie leaves Priority null.
2. The app does not check who clicks a button. The text names the player who chooses.
3. The roll-off winner has Priority (`setup.priority`) and is Blue, the other player is Red. When the −z side has Priority, the crisis tokens turn a half turn, so that the bottom of the card map is at that side.
4. The crisis cards of a roster lie next to the scoring board, not in roster row 2. The rows run parallel to the board, and the cards are turned the same way as the board.
5. The setup buttons lie flat on the table and read the same way as the board. The deck buttons have no color.
6. The only rule check is the squad threat. **Ready** also needs at least 1 character.
7. A squad card must be one that the app can put on the table: a character with a model, a Team Tactic card with an image.
8. A new roster, **×** of a roster or **Restart setup** starts the setup again. It removes the squads and the crisis cards that the setup put on the table, after a confirm.
9. The drawn and chosen crisis cards lie in line with the scoring board, next to its end.
10. Each player has a **Ready** toggle. Both squads go on the table when the second player clicks it. While a player is Ready, their squad does not change.
