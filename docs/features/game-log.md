# Feature: Game log

Status: built. The log has the setup, the Power and Cleanup Phases, Priority, the changes of characters and the drop of objective tokens.

## Goal

One shared list that tells what happened at the table, for both players: the dice, the setup steps, the phase buttons, Priority changes and the changes of characters.

## Panel

The Log is a HUD panel in the right column (`src/components/LogPanel.jsx`). It replaces the Rolls panel. The toolbar chip is **Log**.

- Collapsed: one bar at the top of the right column with the newest entry. The bar is under the toolbar (`--hud-top`). A click on the bar, or the toolbar chip, expands it.
- Expanded: the whole list, the newest entry first. Each entry has its time (hours and minutes) and a border in the color of its side. **Collapse** or Escape collapses it.
- The state is per browser, in localStorage (`mcp-assist-3d/log-open`). Collapsed is the default.

The panel merges two lists by time: `rolls` (the dice, `docs/features/dice-rolling.md`, "History") and `log` (the rest). A tie goes to the `log` entry, because the roll-off result is written after the throw.

## What is logged

| Entry | Text (for Nelly, seen by Oleh) |
|---|---|
| Roll off | "Roll off: Nelly has Priority." or "Roll off: a tie." Set by hand: "... (set by hand)." |
| Deck | "Nelly chooses the Secure deck." |
| First and second card | "Oleh chooses Hostage (Extract)." |
| Maximum Threat | "Nelly chooses Maximum Threat 18." |
| Edge | "Oleh chooses this board edge." |
| Squad ready | "Nelly is ready." / "Nelly is not ready." |
| Squads revealed | "Nelly's squad is on the table." |
| Affiliation | "Nelly chooses the affiliation Avengers." |
| Deployment done | "Deployment done." (the first Power Phase) |
| Override | "Nelly went back to the Maximum Threat." |
| Restart | "Nelly started the setup again." |
| Power Phase | "Power Phase (Nelly): Hulk 4 → 7, Angela 2 → 4". One entry for each side that gained Power |
| Cleanup Phase | "Cleanup Phase: round 3. Flipped: Hulk. Priority passes to Nelly." The text of the HUD message |
| Priority click | "Priority goes to Nelly." |
| Damage, Power | "Hulk Damage 2 → 5". Clicks merge, see "Merge of clicks" |
| Card flip | "Hulk turns to the injured side." |
| Token put on a character | "Activated put on Hulk." For a token that counts up, the count after: "Poison put on Hulk (2)." Every token of the tray, also Dazed and the special conditions |
| Token taken off | "Dazed taken off Hulk." |
| Objective token held | "Hulk holds Asset." (put on the card, or a supply token taken to it). A move on the same card is no entry |
| Objective token dropped from the card | "Hulk drops Asset from the card." (dragged to the table) |
| Objective token dropped by Dazed or Remove | "Hulk dropped Asset. Nelly places it." One entry for each token |
| Objective token placed | "Nelly placed Hulk's Asset." (a release or **Done**) |
| Remove | "Hulk is removed from the board." |
| Character deleted | "Hulk is deleted from the table." |

A token that changes nothing (a second Dazed, a token the character is immune to) has no entry.

The dice entries are the same as in the Rolls panel before.

## Entry data

An entry stores data, not text: `{ id, at, by, kind, ... }` (`src/log/log.js`).

- `by`: the side of the browser that wrote it. It is null in the Sandbox and a single player room.
- `side`: the side that did the thing (the chooser of a step, the side of a Power Phase).
- Character entries: `side` is the side of the character, so the border has the color of its owner, and `by` is the player who clicked. Fields: `characterId`, `name`.
- Token entries are told apart by `kind`. `token`: a token of the tray, with `key` (`activated` or another token key), `tokenName`, `on` (put on or taken off) and `count` (after the change). `held`: an objective token, with `tokenId`, `tokenName` and `on`. `dropped` and `placed`: an objective token of a drop, with `tokenId`, `tokenName` and `placeBy` (the side that places it). `placed` has `side` = `placeBy`. Token sounds play from the `token` and `held` entries (`sounds.md`).
- Other fields by kind: `type`, `card`, `threat`, `ready`, `affiliation`, `step`, `gains`, `round`, `flipped`, `before`, `after`, `stat`, `from`, `to`.

The text is made when the entry shows, with the names of the viewer (`src/setup/names.js`, `src/setup/useNames.js`). So the same entry reads "You choose ..." in one browser and "Nelly chooses ..." in the other, and "Blue" or "Red" in the Sandbox and a single player room.

Each entry is written in the same transaction as the change it tells. An effect that runs in both browsers (the roll-off read, the squad reveal) writes an entry with a fixed id, so two writes make one entry (`addEntry` skips an id that is there). The fixed ids are `rolloff:<setup id>:<last throw id>`, `revealed:<setup id>:<side>`, `affiliation:<setup id>:<side>` (automatic affiliation) and `deployed:<setup id>`.

## Merge of clicks

Damage and Power clicks on one character change the last entry of the log when all of these hold: it is a Damage or Power entry of the same character and stat, the same player wrote it (`by`), it is the last entry of the list, and it is at most 10 s old. The entry takes the new value and the new time, so a run of clicks with pauses under 10 s stays one entry. When the value is back at the start of the entry, the entry is removed. A click that changes nothing (Damage at 0) adds nothing. The rule is `addStatEntry` in `src/log/log.js`.

## Limit

The `log` list keeps the newest 300 entries. A write that goes over removes the oldest ones in the same transaction. `rolls` has no limit.
