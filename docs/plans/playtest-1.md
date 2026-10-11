# Plan: Feedback from the first playtest

Requested by the user on 2026-10-11, after the first game with another player. Status: notes and answers collected on 2026-10-11. Each area below gets its own plan doc when it starts. This doc keeps the notes and the answers, so that no answer is lost between sessions.

Order: plan 1 first, then 2 to 6. Plan 2 starts its rename of `blue` / `red` only when no other plan branch is open.

| # | Plan doc | Branch | Content |
|---|---|---|---|
| 1 | `playtest-1-bugs.md` | main | Washed-out cards and tokens, tool key selects the enemy model |
| 2 | `setup-round-2.md` | `setup-round-2` | Roll off, colors, names, texts, history, who can click, panel places, squad buttons, Deploy Lock |
| 3 | `squad-breakdown.md` | main | Breakdown tab in the roster popup |
| 4 | `game-flow.md` | | Priority marker, drop of objective tokens, log panel, sounds, ping |
| 5 | `table-controls.md` | `table-controls` | Drag, Alt, Place, Give click, model facing, labels, footprint, hover, dice tray clicks |
| 6 | `table-tools.md` | main | TTS tools on the table, settings menu |

## Notes from the game

The notes as the players wrote them, in order:

1. The player could be confused since we say "Use Blue player Secures". The buttons should not have a color, and they should say "Select Secures" / "Select Extracts".
2. Consider Alt over a card to open the popup.
3. Change "Use" to "Select" or "Choose".
4. Double check the order of choosing Priority and selecting the board edge.
5. Consider going back in time in the setup, with an override, in case somebody made a mistake.
6. Bigger mat turn buttons. Move the select button to a second row, and call it "Choose this edge".
7. Track who has Priority.
8. Move the board edge panel in front of the player who chooses.
9. Bind Blue and Red to the result of the roll off.
10. Use player names: "You choose the board edge", "Choose from my Secures", "Choose from X's Secures", "X chooses the Maximum Threat".
11. Squad choice in the roster popup.
12. A breakdown section as in Jarvis.
13. A better call to action for **Select squad** and **Ready**.
14. Bug: cards and tokens look too bright and washed out.
15. Ping with a key.
16. Turn the characters so that they face the board edge.
17. Sounds.
18. A player was annoyed that a character must be selected before a drag.
19. A number key over a dice tray should clear the tray first.
20. A better log: dice, Power changes, and so on.
21. More buttons on the table.
22. The Power button on the table, facing each player, near their roster.
23. The Cleanup button near the scoring board.
24. Delete over a dice tray should delete the dice on the shelf.
25. A neutral color for the footprint.
26. Labels on at start. When they are off, a label over terrain on hover.
27. Place on a second tool: the character should snap to the tool where Place was turned on last.
28. A click on a token pile below a character tray gives that token to this character.
29. Show the other player that you put Activated on a character, so they know to activate or pass. Maybe help them count, so they know when they can pass.
30. Bug: in multiplayer, a tool key over an enemy model (to measure) should not select the enemy model.
31. A click on a face plate of the dice tray puts one die of that face back in the well. A click on a die on the shelf opens the change menu.
32. Fix the removal of a character.

## Answers

The user answered on 2026-10-11. Numbers in brackets are the notes above.

### Plan 1: Bugs

- **Washed-out look** [14]. All cards and tokens. The user guesses a material that reflects too much. Check the material, the lights, the environment, the tone mapping and the color space.
- **Enemy model selected** [30]. In multiplayer, a tool key over an enemy model snaps the tool to it, but does not select the model.

### Plan 2: Setup round 2

- **Roll off** [9]. The app reads the roll off when both shelves have 5 dice after a roll. It applies the tie rules (more successes, then more Crits, then more Wilds, else roll again). A manual "X has Priority" override stays.
- **Colors** [9]. In the rules, Blue is the player with Priority, and Red is the other player. In the Sandbox, Blue and Red only tell the sides apart. In a multiplayer room, and maybe in a single player room, the roll off sets the colors. The host keeps the host rights, whatever the color.
  - No player moves to another half of the table. Each player keeps their half. Only the shown color changes.
  - The side keys `blue` / `red` in the code and the data are renamed to `host` / `guest`, so that a side does not depend on a color. The color of a side is set later, by the roll off. (User, 2026-10-11.) Today 51 files use the keys.
  - Saved rooms are not migrated. Old rooms with `blue` / `red` can break. (User, 2026-10-11.)
  - The host always sits at +z (the current Blue view), the guest at −z. The side choice in the new room dialog goes away. (User, 2026-10-11.)
  - The color (Priority) matters for some crisis maps. For example, TTS places the tokens of Survivors (Search for Safe Shelters) wrong, probably because it treats the host as Blue. The app turns the crisis tokens by the player with Priority, not by the host.
- **Names** [10]. Discord names in a multiplayer room, "You" / "my" for yourself. Single player and Sandbox: Blue and Red.
- **Deck buttons** [1, 3]. No color. "Choose Secures" / "Choose Extracts". "Choose" replaces "Use" and "Select" everywhere in the setup, because the rulebook says "choose". The other player sees "Waiting for X to choose a deck".
- **Rulebook order** [4]. The panel tells players what to do now, because players forget the order. Check the exact order in the rulebook (p9, p11) for each step.
- **History** [5]. **Prev** / **Next** browse the choices made so far. Both players see the step that one player browses, because they talk during the setup. **Override** at an earlier step makes it the current step and drops the later choices, for both players. Either player can press it, after a confirm. The drawn cards stay, unless the deck step itself is done again. An Override before the squads are on the table removes them, the same as **Restart setup**.
- **Who can click** [6]. In a multiplayer room, only the player who chooses can click a setup button (deck, cards, threat, edge). The other player sees the buttons disabled. This replaces the decision "the app does not check who clicks" in `docs/features/setup-game.md`.
- **Edge controls** [6, 8]. Only ↺ **Choose this edge** ↻ moves, to the side of the player who chooses. The arrows are bigger, and the button is on a second row. The other player sees them, disabled. The info panel stays at the scoring board.
- **Squad buttons** [13]. ~~**Choose squad**, with the hint "Click roster cards to add them". Then **Squad ready**, and **Change squad** to go back.~~ Replaced (user, 2026-10-11, while testing the squad breakdown): the **Select squad** toggle makes two modes. With it on, a click on a roster card does not open the popup. With it off, the Breakdown tab still chooses a squad. Also **Select squad** looks more important than **Ready**, which is wrong at that point. So:
  - No squad mode. The **Select squad** toggle goes away.
  - In the squad step, each roster card of the own roster has a small **+** / **✓** button in a corner. It adds the card to the squad or removes it.
  - A click anywhere else on the card opens the roster popup, as in the other steps.
  - **Squad ready** is the main button of the panel (the strongest style). Until the squad is valid, it is disabled and its title says why. While the player is ready, it becomes **Change squad**.
- **Roster popup** [11]. "Add to squad" / "Remove from squad" on the card, only in the squad step. The Breakdown tab still fills the squad with a click on a row.
- **Deploy Lock**. It turns on when the squads go on the table, because players deploy first. It turns off when a player first presses **Power** in round 1.

### Plan 3: Squad breakdown

- A **Breakdown** tab in the roster popup during the setup, similar to the Breakdown tab of Jarvis.
- One combination: the total threat is at most the threat value, no other character of the roster still fits, and no two characters share an alter ego.
- The threat values: only the values that are still possible in this game. At the start, the threat values of the crisis cards of both rosters. The list gets shorter as the cards are drawn and chosen. After the player without Priority chooses the Maximum Threat, only that value is left.
- The combinations use the same character portraits as the rest of the app.
- Filters, as in Jarvis: must have, must not have, affiliation, at least 2 affiliations, leader, min and max squad size. Jarvis "Pinned" and "Played" are left out, because the app has no game history.
- In the squad step, a click on a combination fills your squad choice. Team Tactic cards are still chosen by hand.
- A player can also open the breakdown of the other roster, because rosters are public. Only the squads are hidden.

### Plan 4: Game flow

- **Priority marker** [7]. A marker shows who has Priority. The roll off sets it. In the Cleanup Phase, when the player who activated the last character has Priority, it passes to the other player (p12). Players can change it with a click, because cards such as All According to Plan change Priority.
- **Drop of objective tokens** [32]. Rule: a Dazed or KO'd character drops the objective tokens it holds, and the other player places them. Exceptions: S.H.I.E.L.D. Agents and The Black Widow, whose controlling player places them. Jarvis has this text ("its controlling player … instead of their opponent"), so the app reads it.
  - Trigger: a character that holds an objective token gets the Dazed token, or a player presses **Remove**.
  - The token drops next to the model. A Range 2 tool of the player who places the token snaps to the base. That player can drag the token only within Range 2, the same as Deploy Lock.
  - With **Remove**, the model stays on the board until the token is placed. Then it goes back to its card.
  - The player who places the token gets a HUD notice ("Place Hulk's Asset within Range 2") with a **Show** button that moves the camera, and a sound. Only that player can drag the token until it is placed.
  - The user tests how this feels before keeping it.
- **Log** [20]. A shared log in a panel that can collapse: dice, Power and Damage changes, tokens, Activated, the phase buttons and the setup steps.
- **Sounds** [17, 29]. Dice, ping, and a token put on a character. Both players hear the token sound, so the other player knows that a character was activated. This is enough for note 29 for now: no banner, no counts and no Pass button. Sound files with a free license.
- **Ping** [15]. TTS has no Ping key in its key list. Key **P**. An arrow that points down and bounces, at the pointer, for about 3 s, in the color of the side. Both players see and hear it.

### Plan 5: Table controls

- **Drag** [18]. A drag moves a piece without selecting it first, and the drag selects it. For all pieces. The user tries it first.
- **Alt** [2]. Hold Alt over a card to show it large. Release Alt to close it. The click popup stays.
- **Place** [27]. Turning on Place on tool B turns it off on tool A, and the character snaps to tool B.
- **Give click** [28]. A click on a Give source below a tray gives 1 of that token to that character.
- **Model facing** [16]. When a model spawns on its card, its front faces the opponent, toward the mat. The data does not say which way each model's front points, so the plan starts with a check of the spawn turns.
- **Labels** [26]. On at start. When they are off, a terrain piece under the pointer shows its label. The label shows the lock state: "Tree - Size 2 - (L)ocked" / "Tree - Size 2 - Un(L)ocked".
- **Footprint** [25]. A neutral color (light grey) instead of blue. Green (touching) and red (overlapping) stay.
- **Hover highlight**. Any 3D piece under the pointer that the player can use shows a highlight: a model, a die, an unlocked terrain piece, and so on.
- **Dice tray** [19, 31]. A number key over a tray clears it first, as in TTS. A click on a face plate puts one die of that face back in the well. A click on a die on the shelf opens the change menu.
- **Delete over a dice tray** [24]. Not decided. The user thinks about it.

### Plan 6: Tools on the table and settings

- **Tools on the table** [21, 22, 23]. TTS players expect every tool of the TTS table on the table, for example below their character trays. The table can be larger if needed. The Power button lies near each roster, facing its owner. The Cleanup button lies near the scoring board.
- The plan starts with a list of every button and tool that the mod has on the TTS table.
- **Settings menu**. Stored in the browser (localStorage). For each tool: on the table or in the HUD. It also lists the keys of the app and what each key does. Changing keys comes later.
