# Feature: Round phases

Status: built.

Not built yet:

- Variable extra Power (see [Later: variable Power](#later-variable-power)).
- VP scoring and character effects of the Cleanup Phase (see [Out of scope](#out-of-scope)).

## Goal

Two phase buttons. Each one does the steps of a phase that need no choice. Each is on the table or in the HUD, by the setting of the browser (`docs/features/table-tools.md`, "Settings menu"). The default is the HUD. In the HUD, the two buttons are a group fixed in the bottom right corner of the screen, **Power** first, then **Cleanup**, larger than the toolbar chips. HUD warnings stack above the group. On the table:

- An **Automatic Power Phase** button for each player, in row 1 of its board strip, label "Auto Power Phase" (`docs/features/table-tools.md`). It gives Power to the characters of its own side only, as the TTS button does. The first Power Phase in round 1, while the setup is in the step `deploy`, ends the deployment: it turns Deploy Lock off and ends the setup (`docs/features/setup-game.md`). In the Sandbox, a player presses both buttons. In a multiplayer room, the other player's button is disabled, with the title "Only the Red player presses this." (or Blue). The HUD message names the side: "Power Phase (Blue): ...".
- **Cleanup Phase**, one button at z 0 between the scoring board and the mat, for both players. It is the same action, disabled state and title as the HUD **Cleanup**.

The toolbar **Power** (when Power is set to the HUD) gives Power to all sides that the browser plays: both in the Sandbox and in a single player room, the own side in a multiplayer room.

**Power.** A player presses one button, and each of their characters on the table gets the Power of the Power Phase:

- every character gets 1 Power
- some characters get extra Power from a superpower, for example Hulk gets 2 more
- a character with an Infinity Gem gets 1 more per gem; the Power gem gives 2 instead of 1

**Cleanup.** A player presses one button, and the app does the Cleanup Phase steps that need no choice:

- Dazed characters remove all damage, special conditions and the Dazed token, and flip to the Injured side
- all characters remove the Activated token and the tokens that last until the end of the round
- Exhausted Sources flip back, and the supply tokens leave the game
- the round marker moves to the next round
- Priority passes to the other player when the player who activated the last character has it (see [Priority marker](#priority-marker))

Without the buttons, players do each step by hand on the trays, the tokens and the scoring board.

The Cleanup button works only when every character on the board has an Activated or a Dazed token. A KO'd character must leave the board first, so the tray **Remove** button puts the model back on its card instead of deleting the character.

The feature changes the rule "Players apply the rules" of `docs/features/character-trays.md` for these two phases only.

## Power Phase

### Rules

From the Jarvis rules reference:

| Rule | Text | Page |
|---|---|---|
| Power Phase | At the beginning of the Power Phase, all characters gain 1 Power. Then players resolve player effects, then non-player effects. | 11 |
| Infinity Gem | During the Power Phase, a character with an Infinity Gem gains one additional Power per Gem. | 20 |
| Poison | The character loses 1 Power during the Power Phase. | 20 |
| Stun | If an effect would cause the character to gain more than one Power, it gains only 1 Power instead. | 20 |
| Power limit | A character can have at most 10 Power. | 7–8 |
| Grunts | Grunts cannot have Power. | 21 |

### How TTS does it

Found in the mod scripts (`autoPower` in "Red Tray Spawner", "UI Controller", Global XML):

- Each player has an **Automatic Power Phase** button. It gives Power to that player's trays only.
- Gain = 1 + the character's extra Power (`cPower`) + 1 per gem. The Power gem (`00250102`) counts 2.
- Hulkbuster gets its extra Power only while the Hulkbuster model is on the table.
- Stun: the gain is 1, whatever the extra Power and gems are.
- Poison: the gain is 1 less. At 10 Power, the character goes to 9.
- The result is capped at 10. The chat shows one line per character: "Auto Power gave Hulk 3 power. (from 4 to 7)".
- The button does not include crisis cards.

### Facts from Jarvis

`scripts/jarvis/characters.json` has the superpower text per stat card side (`frontSide` = Healthy, `backSide` = Injured). A fixed extra Power has this text: "During the Power Phase, this character gains N additional Power."

- 40 of 232 rows have a fixed extra Power. Most get 1. Doctor Strange (Sorcerer Supreme), Ebony Maw, Hulk, The Immortal Hulk, Jean Grey and Onslaught get 2.
- The text varies: "Power Phase|," "Power Phase*," "Power Phase," and "Power Phase| this" (Ulik). The French rows (Les Démolisseurs, Thor Héros de Midgard) say "Pendant la Phase de Pouvoir, ce personnage gagne 1 Power supplémentaire."
- The tag `greaterPowerPhase` is not reliable: Valkyrie and Elendil and Warriors Three have the text but not the tag. Magneto has the tag, but his Power depends on Metal Constructs. So the text is the source, not the tag.
- Some sides differ. Hulkbuster: Healthy +1, Injured 0 (the Injured side is Iron Man, the second form). Phoenix: Healthy +1; the Injured side (Phoenix Unleashed) gets +1 per Phoenix token, which is not a fixed number.
- No character with two stat cards (`secondStatCard`) has a fixed extra Power today.
- The Jarvis gem card rows (`isInfinityGem`) have no rules text. The Power gem is `00250102`. Gems of a character on the table are in its `attached` field (MCT codes).

## Cleanup Phase

### Rules

From the Jarvis rules reference (rulebook p12, "Cleanup Phase"):

1. Players score Victory Points for controlling, securing or holding objectives.
2. Players resolve player effects, then non-player effects.
3. Dazed characters remove all damage, special conditions and the Dazed token from their stat cards, and flip to the Injured side.
4. If the player that activated the last character has the Priority token, they pass it to the opponent.
5. Players remove all Activated tokens, move the Round token to the next round, and start the next round with a Power Phase.

The 4 current Source cards (Evidence, Jailbreak, Sentinel Schematics, Surprise Assault) say: "During the Cleanup Phase, remove all <supply tokens> from the game and flip each Exhausted <Source>." Players score VP for held supply tokens before that (step 1).

### How TTS does it

Found in the mod scripts (`autoCleanup` in "Red Tray Spawner", "UI Controller", Global; `autoCleanupCrisis` in "Automatic Crisis Deployment"; `advanceRoundToken` in "Tracker"):

- Each player has an **Automatic Cleanup Phase** button. One press cleans the trays of **both** players.
- Every tray: the Activated token goes, and every token with `cleanup = true` in the mod's token database goes.
- A tray with the Dazed token: the Dazed token and every special condition go, and the card flips (Damage goes to 0).
- The mat: every flipped crisis token with `flipFront` (the Sources) turns back to its front. Every token with `cleanup = true` on the mat is deleted, except affiliation tokens.
- The round token moves to the next round spot. It stays on round 6.
- The Priority token moves to the player with fewer characters left to activate. The app follows the rule (p12) instead: see [Priority marker](#priority-marker).
- TTS does not score VP and does not run character effects of the Cleanup Phase.

### Facts in the app

- A character's tokens are `ch.tokens` (key → count). Dazed is `dazed`, Activated is `activated`. The 10 special conditions are `SPECIAL_CONDITIONS` in `src/characters/immunity.js`.
- `src/tokens/tokens.json` has `cleanup: true` from the mod. 41 tokens have it: Activated, 5 character tokens (Degeneration, Expert Tracker, StarHerb, Winging It, X-Gene) and 35 Team Tactic tokens (for example Mystic Ward, Rocket Boots, Target). No special condition and no affiliation token has it.
- Loose tokens on the table are `looseTokens` (`{ id, key, x, z }`). Piles are separate and never run out.
- Crisis tokens are `tokens` in `App.jsx`. A Source has `flipOnly` in `src/crisis/cards.json`, front `extract-unexhausted-source`, back `extract-exhausted-source`. A supply token has the `supply` key of its card as `frontKey` (`extract-source-asset` or `extract-source-civilian`). A character holds a token when `heldBy` is its id.
- The round marker is `scoreMarkers.round`. `ROUND_POINTS` in `src/scoreboard/board.js` has the 6 round spots, and `snapPoint` finds the spot under a marker.
- `flip` (`src/characters/actions.js`) toggles the side and sets Damage to 0.
- Code: `src/game/actions.js` has `createPhaseActions(table, lookups)`, the document writes of the Power Phase, the Cleanup Phase and the Priority click. It is a plain module; each action reads the document and writes in one transaction. `src/game/usePhaseActions.js` keeps the blocker text, the Cleanup chip state and the HUD messages.
- A model on its tray stands on the card at `trayModelPosition` (card 1 or 2), and a spare model at `traySpareModelPosition` (`src/characters/trays.js`, `modelSpawnPosition` in `Scene.jsx`).
- The rest pose of each model is in the table document (`poses`). Scene moves a model that nobody claims when its stored pose changes (`applyPose` in `src/components/useModelSync.js`), in both browsers.
- The Delete key deletes the piece under the pointer: a token on the table, a held crisis token, a pile, a Team Tactic card, an unlocked terrain piece, and a character when the pointer is over its tray card (`docs/features/key-shortcuts.md`).

## Decisions

Decisions 1 to 6 are for the Power button. Decisions 7 to 16 are for the Cleanup button and for **Remove**.

1. **Gain of one character.** Grunts get nothing. Every other character:
   1. gets 1 Power (cap 10)
   2. with Poison, loses 1 Power (floor 0)
   3. gets the extra Power of the side that faces up, plus 1 per attached gem (2 for the Power gem) (cap 10)

   With Stun, step 3 gives nothing, so the whole gain is 1. This is the TTS way. The rule text says "an effect", so another reading is possible: each effect gives at most 1 (Hulk +1 instead of +2, the Power gem +1). The app follows TTS. These steps give the same result as TTS in every case, also at 0 and 10 Power.
2. **Data from Jarvis, per side.** The module `src/characters/power.js` reads the fixed extra Power from the superpower text of each side, the same way `immunity.js` reads immunities. A character with two stat cards uses the smallest value of the two forms (the same rule as immunities). Variable extra Power (per token, per terrain, dice rolls) is not read. Players add it by hand.
3. **Who presses.** A **Power** button in the HUD, bottom right (`components/PhaseButtons.jsx`). It gives Power to the characters of the sides this browser plays: its own side in a multiplayer room, both sides in the Sandbox and in a single player room (the same sides as `playedSides` from `tableSeat`, used in `App.jsx`).
4. **Only characters on the board.** A character gets Power only when one of its models stands on the mat (`|x|` and `|z|` at most `MAT_SIZE / 2`, the same check as TTS `charOnBoard`; `characterOnBoard` in `src/characters/models.js`). The rest pose in the table document (`poses`) gives the place. Reason: a KO'd character stays in the app, with its model on its card (decision 16). A character that is not deployed yet, or in Reserve, also stands on its card. These characters get no Power.
5. **No guard against a second press.** TTS has none either. The players fix a mistake with `−` on the tray.
6. **Feedback.** A HUD message for the player who pressed: "Power Phase: Hulk 4 → 7, Angela 2 → 4, …". It stays longer than the usual 3 s, because it can list 10 characters. The other player sees the counters change. The Power Phase also writes an entry for each side in the Log (`docs/features/game-log.md`).
7. **One button for the whole table.** A **Cleanup** button in the HUD group, next to **Power**. It cleans both sides, because the round marker and the crisis tokens are shared. This is the TTS way. Any player can press it.
8. **Disabled until every character on the board is done.** The chip is disabled while a character on the board (`characterOnBoard`, both sides) has neither an Activated nor a Dazed token, and while no character is on the board. Reason: such a character is suspicious. For example, it was KO'd, but its damage was not set and its model was not removed from the board. Players fix that by hand first.
   - The chip title gives the reason: "Each character on the board needs an Activated or Dazed token: Hulk, Angela." When the chip is enabled: "Cleanup Phase for both players. Score VP first."
   - The chip uses `aria-disabled` and a disabled style, not the `disabled` attribute, because some browsers show no title on a disabled button. A click on it does nothing.
   - The condition also blocks a second press: after a Cleanup, no character has Activated or Dazed.
   - No confirm dialog. The condition replaces it.
9. **Dazed characters.** Damage 0, side Injured, and the `dazed` token and every special condition go. The app sets the side to Injured. It does not toggle it, so a Dazed token on an Injured card does not flip it back to Healthy. Other tokens stay, except the ones in decision 10. Held objective tokens stay: a character drops them when it is Dazed (p10), and players do that by hand. A Dazed grunt has no Injured side (the Jarvis `backSide` is null): it keeps its side and Damage and loses only Dazed and the special conditions. The rules text the app has does not say more, so this is the simplest choice.
10. **All characters**, also the ones not on the board: `activated` and every token with `cleanup: true` go.
11. **Loose tokens.** Every loose token with `cleanup: true` goes, the same as TTS. Piles stay.
12. **Crisis tokens.** Every Source shows its front (Unexhausted). Every supply token goes, on the table and held. The 4 current Source cards say so. The app does not read the card text, so a new Source card with another rule needs a code change.
13. **Round marker.** It moves to the next spot of `ROUND_POINTS`. It stays on round 6. When the marker is on no spot (a player moved it off the track), it does not move, and the message says so.
14. **One change.** All of it is one `table.transact`, so the other browser gets it at once.
15. **Feedback.** A HUD message: "Cleanup Phase: round 3. Flipped: Hulk, Angela. Priority passes to Nelly." Without Dazed characters: "Cleanup Phase: round 3." When the marker is off the track: "Cleanup Phase: the round marker is not on the round track, so it did not move." "Flipped" lists every Dazed character, also one that was already Injured. The last sentence is "Priority passes to Nelly." or "Nelly keeps Priority." ("to you" and "You keep" for the own side in a multiplayer room, "Blue" or "Red" in the Sandbox and a single player room), and it is missing before the roll off. The message stays 8 s, as the Power Phase message. The Cleanup also writes an entry in the Log with the same text (`docs/features/game-log.md`), and a click on the Priority marker writes "Priority goes to Nelly.".
16. **Remove from the board, and Delete.**
    - The tray **Remove** button removes the character from the board (a KO'd character, p16). Its held tokens drop next to the model. With held tokens, the models stay until the other player places the tokens, then each model (`docs/features/character-trays.md`, "Wait for the place"). Without held tokens, each model of the character goes back to its place on the tray (card 1, card 2 or the spare place), with its spawn turn. The new pose goes into `poses`, so the other browser moves it too. The character, its tray and its tokens, Damage and Power stay. No confirm: a player can drag the model back.
    - **Remove** is also disabled while a dropped token of the character waits for its place. Title: "Waiting for Nelly to place Hulk's Asset".
    - **Remove** is disabled when no model of the character is on the board. Title: "Remove from the board: the model goes back on its card. Delete key over the card deletes the character."
    - The Delete key with the pointer over a tray card (card 1 or 2) deletes the character: a confirm "Remove X from the table? Its tray is removed too." then the character, its models, its tray and its poses go. The row of trays closes the gap.
    - The tray popup has the same **Remove** button.
    - A model that the other player drags at that moment is skipped (Scene does not move a claimed model).
    - A model that goes back stands at y = 0 with the identity quaternion on its body. The spawn turn sits on the inner figure, so identity gives the spawn turn. A lifted model cancels its lift first, because the end of a lift would fight the pose.

## Priority marker

Cleanup step 4 (p12): if the player who activated the last character has Priority, they pass it to the opponent. The app has a marker for it, a flat token 1.25" wide, with the face of the TTS Priority Token (a yellow star on blue) and the edge in the color of the side that has Priority.

- **Fields.** `game.priority` is the marker: `null | 'host' | 'guest'`. It is a different field from `setup.priority` (the roll-off winner), because the colors follow `setup.priority` for the whole game and must not move with the marker. `game.lastActivated` is the side of the character that got the Activated token last. A document from before the marker has no `game.priority`, and `gamePriority` (`src/game/priority.js`) reads the roll-off winner then.
- **Who sets it.** The roll off and the manual Priority buttons set `setup.priority` and `game.priority` in one transaction. On a tie the marker stays as it is. **Restart setup** and **Override** to the roll off clear `game.priority` and `game.lastActivated`. After that only the Cleanup Phase and a click change `game.priority`.
- **Last activator.** Giving the Activated token to a character writes the side of the character, not of the browser, in the same transaction. Taking an Activated token away changes nothing. A player fixes a wrong value with a click on the marker.
- **Cleanup.** `priorityAfterCleanup`: when `lastActivated` equals `priority`, Priority goes to the other side. Then `lastActivated` is cleared. The HUD message of the Cleanup says what happened (decision 15).
- **Place.** One spot for each side, on the table beside the end of the scoring board nearer that side, between the board and the mat edge (`priorityMarkerSpot` in `src/scoreboard/board.js`). Before the roll off there is no marker. When Priority changes, the marker slides to the other spot in about 0.4 s, in both browsers.
- **Click.** Any player can click it, also in a multiplayer room, because cards such as All According to Plan change Priority. A click gives Priority to the other side. No confirm. The title is "Nelly has Priority. Click to give it to you." Hover shows the white outline, as other pieces.
- **TTS difference.** TTS puts the token at (-17, ±19) by the mat corner, moves it with buttons, and in the Cleanup Phase gives it to the player with fewer characters left to activate. The app follows the rule of p12 instead, and the place is beside the scoring board.

## Out of scope

- VP scoring. Players move the VP markers first.
- Character effects in the Cleanup Phase, for example Dormammu (an ally with 5 or more Power suffers 1 damage) and Killmonger (Herb tokens give damage and Power, see [Later: variable Power](#later-variable-power)).
- Non-player effects of other crisis cards.
- TTS special cases, for example Bob, Agent of Hydra.
- A KO'd mark on the tray. A KO'd character is a character whose model is on its card.
- Crisis card effects of the Power Phase (Serum Canister, Cosmic Vault, …) and Team Tactic cards.
- Power above 10 (TTS has a special case for The Incredible Hulk).

## Later: variable Power

A separate feature, to discuss later. TTS does not handle these characters either. The list comes from the superpower text of `scripts/jarvis/characters.json` (every row, both sides):

| Character | Side | Superpower | Power it gives |
|---|---|---|---|
| Magneto | both | Master of Magnetism | +1 per allied Metal Construct in play (Power Phase) |
| Mephisto, Lord of Temptation | both | Demonic Contract | +1 per Devil's Deal token it has (Power Phase) |
| Phoenix (Phoenix Unleashed) | Injured | Untamed Cosmic Entity | +1 per Phoenix token it has (Power Phase) |
| Green Goblin | Injured | Unstable Psyche | roll 5 dice, +1 per critical, wild and hit (Power Phase) |
| Sentinel Prime MK4 | Injured | Overloading Power Core | roll 5 dice, +1 per critical and hit, 1 damage if any failure (Power Phase) |
| Red Skull, Master of Hydra | both | World Domination (Leadership, Hydra) | +1 to each allied character that holds or contests an objective token (Power Phase) |
| Dormammu | both | Flames of the Faltine (Leadership, Dark Dimension) | +1 to Dormammu and each other character you control (Power Phase). A squad with Dormammu must use this Leadership |
| Killmonger, Usurper | both | Strength of the New Generation (Leadership, Wakanda) | Cleanup Phase: each non-Dazed character with a Herb token removes it, suffers 1 damage and gains 1 Power |

Notes for that discussion:
- Mephisto and Phoenix count tokens that the app already tracks on the character.
- Dormammu is a fixed +1 for the whole squad, because the squad must use his Leadership. The app would only need to know that Dormammu is in the squad.
- Magneto, Red Skull and the dice rolls need the table state or dice, so players may keep them by hand.
- The Jarvis Team Tactic card rows have no rules text, so this list has no Team Tactic cards.
