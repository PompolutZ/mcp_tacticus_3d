# Plan: Automatic Power Phase

Requested by the user on 2026-10-11. Status: plan approved by the user on 2026-10-11. Phase 1 and 2 done on 2026-10-11. The user checked Phase 2 on 2026-10-11: all checks pass. The user confirmed Stun and Poison (decision 1, the TTS way) on 2026-10-11.

Order of work, one coder step and one commit each: this plan's Phase 1 and Phase 2, then `docs/plan-cleanup-phase.md` Phase 1, 2 and 3. Each phase writes its **Result** below when it is done.

The Cleanup Phase button is in `docs/plan-cleanup-phase.md`.

## Goal

A player presses one button, and each of their characters on the table gets the Power of the Power Phase:

- every character gets 1 Power
- some characters get extra Power from a superpower, for example Hulk gets 2 more
- a character with an Infinity Gem gets 1 more per gem; the Power gem gives 2 instead of 1

Today players press `+` on each tray. `docs/characters-hud.md` ("Players apply the rules") says the app does not run the Power Phase. This plan changes that rule for the Power Phase only.

## Rules

From the Jarvis rules reference:

| Rule | Text | Page |
|---|---|---|
| Power Phase | At the beginning of the Power Phase, all characters gain 1 Power. Then players resolve player effects, then non-player effects. | 11 |
| Infinity Gem | During the Power Phase, a character with an Infinity Gem gains one additional Power per Gem. | 20 |
| Poison | The character loses 1 Power during the Power Phase. | 20 |
| Stun | If an effect would cause the character to gain more than one Power, it gains only 1 Power instead. | 20 |
| Power limit | A character can have at most 10 Power. | 7–8 |
| Grunts | Grunts cannot have Power. | 21 |

## How TTS does it

Found on 2026-10-11 in the mod scripts (`autoPower` in "Red Tray Spawner", "UI Controller", Global XML):

- Each player has an **Automatic Power Phase** button. It gives Power to that player's trays only.
- Gain = 1 + the character's extra Power (`cPower`) + 1 per gem. The Power gem (`00250102`) counts 2.
- Hulkbuster gets its extra Power only while the Hulkbuster model is on the table.
- Stun: the gain is 1, whatever the extra Power and gems are.
- Poison: the gain is 1 less. At 10 Power, the character goes to 9.
- The result is capped at 10. The chat shows one line per character: "Auto Power gave Hulk 3 power. (from 4 to 7)".
- The button does not include crisis cards.

## Facts from Jarvis

`jarvis-characters.json` has the superpower text per stat card side (`frontSide` = Healthy, `backSide` = Injured). A fixed extra Power has this text: "During the Power Phase, this character gains N additional Power."

- 40 of 232 rows have a fixed extra Power. Most get 1. Doctor Strange (Sorcerer Supreme), Ebony Maw, Hulk, The Immortal Hulk, Jean Grey and Onslaught get 2.
- The text varies: "Power Phase|," "Power Phase*," "Power Phase," and "Power Phase| this" (Ulik). The French rows (Les Démolisseurs, Thor Héros de Midgard) say "Pendant la Phase de Pouvoir, ce personnage gagne 1 Power supplémentaire."
- The tag `greaterPowerPhase` is not reliable: Valkyrie and Elendil and Warriors Three have the text but not the tag. Magneto has the tag, but his Power depends on Metal Constructs. So the text is the source, not the tag.
- Some sides differ. Hulkbuster: Healthy +1, Injured 0 (the Injured side is Iron Man, the second form). Phoenix: Healthy +1; the Injured side (Phoenix Unleashed) gets +1 per Phoenix token, which is not a fixed number.
- No character with two stat cards (`secondStatCard`) has a fixed extra Power today.
- The Jarvis gem card rows (`isInfinityGem`) have no rules text. The Power gem is `00250102`. Gems of a character on the table are in its `attached` field (MCT codes).

## Decisions

1. **Gain of one character.** Grunts get nothing. Every other character:
   1. gets 1 Power (cap 10)
   2. with Poison, loses 1 Power (floor 0)
   3. gets the extra Power of the side that faces up, plus 1 per attached gem (2 for the Power gem) (cap 10)

   With Stun, step 3 gives nothing, so the whole gain is 1. This is the TTS way. The rule text says "an effect", so another reading is possible: each effect gives at most 1 (Hulk +1 instead of +2, the Power gem +1). The plan follows TTS. These steps give the same result as TTS in every case, also at 0 and 10 Power.
2. **Data from Jarvis, per side.** A new module `src/characters/power.js` reads the fixed extra Power from the superpower text of each side, the same way `immunity.js` reads immunities. A character with two stat cards uses the smallest value of the two forms (the same rule as immunities). Variable extra Power (per token, per terrain, dice rolls) is not read. Players add it by hand.
3. **Who presses.** A **Power** button in the toolbar, in a new group **Phase**. It gives Power to the characters of the sides this browser plays: its own side in a multiplayer room, both sides in the Sandbox and in a single player room (the same sides as `ownTraySides` in `App.jsx`).
4. **Only characters on the board.** A character gets Power only when one of its models stands on the mat (`|x|` and `|z|` at most `MAT_SIZE / 2`, the same check as TTS `charOnBoard`). The rest pose in the table document (`poses`) gives the place. Reason: since `docs/plan-cleanup-phase.md`, a KO'd character stays in the app, with its model on its card. A character that is not deployed yet, or in Reserve, also stands on its card. These characters get no Power.
5. **No guard against a second press.** TTS has none either. The players fix a mistake with `−` on the tray.
6. **Feedback.** A HUD message for the player who pressed: "Power Phase: Hulk 4 → 7, Angela 2 → 4, …". It stays longer than the usual 3 s, because it can list 10 characters. The other player sees the counters change. A shared log (for example in the Rolls panel) is not in this plan.

## Not in this plan

- Variable extra Power, see [Later: variable Power](#later-variable-power).
- Crisis card effects (Serum Canister, Cosmic Vault, …) and Team Tactic cards.
- Power above 10 (TTS has a special case for The Incredible Hulk).

## Later: variable Power

A separate feature, to discuss later. TTS does not handle these characters either. Found on 2026-10-11 in the superpower text of `jarvis-characters.json` (every row, both sides):

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

## Phase 1: Extra Power data

Work:
1. `src/characters/power.js`:
   - `parsePowerBonus(text)`: the N of "During the Power Phase, this character gains N additional Power", English and French. 0 when the text has "for each" after it, or does not match.
   - `formPowerBonus(jch)`: `[{ healthy, injured }]` per form. A side with several matching superpowers sums them.
   - `sharedPowerBonus(jch)`: `{ healthy, injured }`, the smallest value of the forms.
   - `POWER_GEM = '00250102'`.
   - `powerAfterPhase({ power, bonus, gems, stun, poison, grunt })`: the new Power, decision 1. `gems`: list of attached MCT codes.
2. `src/characters/characters.js`: each row gets `powerBonus` (`sharedPowerBonus`) and `grunt` (`isGrunt`). Add `characterPowerBonus(slug, side)` and `characterIsGrunt(slug)`, the same shape as `characterImmune`.
3. `src/characters/power.test.js`:
   - Abomination +1 on both sides; Doctor Strange, Sorcerer Supreme +2; Hulk +2.
   - Hulkbuster: Healthy +1, Injured 0. Phoenix: Healthy +1, Injured 0. Mephisto 0.
   - Text variants: Valkyrie and Elendil +1 (no tag), Ulik +1, Black Bolt +1, Les Démolisseurs +1 (French).
   - Every row with the tag `greaterPowerPhase` has extra Power on a side, except Magneto. The test names the exceptions, so a new Jarvis row with an unknown text fails the test.
   - No row with two stat cards has extra Power (so the smallest-of-forms rule changes nothing today).
   - `powerAfterPhase`: base 1; +2 extra; Power gem; two gems; cap at 10; Stun with +2 and a gem gives 1; Poison at 0, at 5, at 10; Stun and Poison together; grunt stays 0.

Checks: `pnpm --filter web test`, `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

## Phase 2: Power button

Work:
1. `src/characters/models.js`: `characterOnBoard(ch, poses)`: true when a model of `ch` (`characterModels`) has a pose on the mat (decision 4). A test in `models.test.js`: a pose on the mat, on the tray, none, and a second model on the mat.
2. `App.jsx`: `handlePowerPhase()`. For each character of the played sides on the board (decisions 3 and 4), in one `setCharacters`: `powerAfterPhase` with the bonus of `ch.side`, `ch.attached`, the `stun` and `poison` counts of `ch.tokens`, and `characterIsGrunt`. Then the HUD message (decision 6). With no character of the played sides on the board, the message says so.
3. `showHudMessage(text, ms = 3000)`: a duration argument, for the longer message.
4. `Toolbar.jsx`: group **Phase** with a **Power** chip. Title: "Power Phase: each of your characters gains Power".
5. Docs: `docs/characters-hud.md` ("Players apply the rules", "How TTS does it" last bullet, "Attached cards" last bullet), and a short section "Power Phase" that points to this plan.

Checks: `pnpm --filter web test`, `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

User, after this phase (move the models onto the mat first):
1. Sandbox: put Hulk, Abomination and a character with no extra Power on the mat. Press **Power**. Hulk gets 3, Abomination 2, the third character 1. The HUD message lists all three.
2. A fourth character whose model stays on its tray card gets nothing.
3. Roster with Doctor Strange + Soul gem, and a character with the Power gem: Doctor Strange gets 2, the Power gem character gets 3 (plus its own extra Power).
4. Flip Hulkbuster to Injured, press **Power**: it gets 1.
5. Give a character Stun: it gets 1, also with extra Power or a gem. Give a character Poison at 0 Power: it stays 0. At 10 Power with Poison and no extra Power: it goes to 9.
6. A character at 9 Power with +2: it goes to 10.
7. Multiplayer room, two browsers: Blue presses **Power**. Only Blue characters change. Red sees the new values. Then Red presses: only Red characters change.

## Result

**Phase 1 (2026-10-11).** `src/characters/power.js` reads the fixed extra Power from the superpower text of each side (English and French, all comma and star variants), with `sharedPowerBonus`, `POWER_GEM` and `powerAfterPhase`. `characters.js` rows have `powerBonus` and `grunt`, with `characterPowerBonus` and `characterIsGrunt`. `power.test.js` has 8 tests. The data matches the plan: 40 rows with extra Power, none with two stat cards, Magneto the only tag without a bonus.

**Phase 2 (2026-10-11).** `characterOnBoard(ch, poses)` in `models.js` (with `models.test.js`). `App.jsx` has `handlePowerPhase`, `showHudMessage(text, ms)` and one `playedSides` const, used also for `ownTraySides`. The toolbar has the group Phase with the **Power** chip, after Deploy, also in a multiplayer room. The HUD message stays 8 s. Grunts are skipped and not listed. No difference from the plan.

**User checks (2026-10-11).** All 7 checks of Phase 2 pass.
