# Feature: Game log

Status: built. The log has the setup, the Power and Cleanup Phases, Priority, the changes of characters and the drop of objective tokens.

## Goal

One shared list that tells what happened at the table, for both players: the dice, the setup steps, the phase buttons, Priority changes and the changes of characters.

## Panel

The Log is a speech bubble under the **Log** button of the toolbar (`src/log/LogPanel.jsx`, styles in `src/log/log.css`). Its tail points at the button. It replaces the Rolls panel.

- Closed: no bubble. When a new entry is added (a dice entry or a log entry), the bubble shows it for a few seconds, then hides. A next new entry replaces the text and starts the time again. Entries that come with the table load, or with a sync from the other player at connect, do not show it. A click on the bubble opens the Log.
- **Undo**: a terrain delete entry has an **Undo** button, in the open list and in the bubble. It shows while the piece is not on the table and the map is the same (`canUndo` in `src/log/log.js`), so after an undo or a map change it is gone. Both players see it. A click on it does not open or close the Log. One undo is one transaction (`handleTerrainUndo` in `src/pieces/useTablePieces.js`, rules in `src/pieces/terrainUndo.js`): the piece comes back with its id, place and lock; a piece that fell gets its old height back only if it is still at the fallen height; a model that fell goes back up only if its pose is still the one after the fall and this browser can claim it. What moved onto the spot since is not moved. There is no undo for other actions.
- Open (the **Log** button, or a click on the bubble): the last entries, the newest first. The list scrolls. **Collapse** or Escape closes it.
- The show time and the number of entries are constants in `src/log/bubble.js`. `freshItem` there decides what is new.
- Each entry has its time (hours and minutes) and a mark in the color of its side. Entries are split by dashed lines.
- The state is per browser, in localStorage (`mcp-assist-3d/log-open`). Closed is the default.

The panel merges two lists by time: `rolls` (the dice, `docs/features/dice-rolling.md`, "History") and `log` (the rest). A tie goes to the `log` entry, because the roll-off result is written after the throw.

## What is logged

| Entry | Text (for Nelly, seen by Oleh) |
|---|---|
| Roll off | "Roll off: Nelly has Priority." or "Roll off: a tie." Set by hand: "... (set by hand)." |
| Deck | "Nelly plays on their Secure crises." |
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
| Terrain deleted | "Nelly deleted Crate." The piece name is from `TERRAIN_PIECES`. It has an **Undo** button, see "Panel" |
| Terrain put back | "Nelly put back Crate." (the Undo) |

A token that changes nothing (a second Dazed, a token the character is immune to) has no entry.

The dice entries are the same as in the Rolls panel before. The dice show as the face icons of the tactic cards (`src/tactics/diceIcons.js` maps the symbol to the icon), square, with no box. Blank has no icon, so the log writes **Blank** in bold.

## Entry data

An entry stores data, not text: `{ id, at, by, kind, ... }` (`src/log/log.js`).

- `by`: the side of the browser that wrote it. It is null in the Sandbox and a single player room.
- `side`: the side that did the thing (the chooser of a step, the side of a Power Phase).
- Character entries: `side` is the side of the character, so the border has the color of its owner, and `by` is the player who clicked. Fields: `characterId`, `name`.
- Token entries are told apart by `kind`. `token`: a token of the tray, with `key` (`activated` or another token key), `tokenName`, `on` (put on or taken off) and `count` (after the change). `held`: an objective token, with `tokenId`, `tokenName` and `on`. `dropped` and `placed`: an objective token of a drop, with `tokenId`, `tokenName` and `placeBy` (the side that places it). `placed` has `side` = `placeBy`. Token sounds play from the `token` and `held` entries (`sounds.md`).
- `terrainDeleted`: `piece` (the stored piece, with its id), `pieceKey` (the name in `TERRAIN_PIECES`), `mapId`, `terrain` (the height before and after the fall of each piece that fell) and `models` (the delta and the pose after the fall of each model that fell). `terrainRestored`: `piece` and `pieceKey`.
- Other fields by kind: `type`, `card`, `threat`, `ready`, `affiliation`, `step`, `gains`, `round`, `flipped`, `before`, `after`, `stat`, `from`, `to`.

The text is made when the entry shows, with the names of the viewer (`src/setup/names.js`, `src/setup/useNames.js`). So the same entry reads "You choose ..." in one browser and "Nelly chooses ..." in the other, and "Blue" or "Red" in the Sandbox and a single player room.

Each entry is written in the same transaction as the change it tells. An effect that runs in both browsers (the roll-off read, the squad reveal) writes an entry with a fixed id, so two writes make one entry (`addEntry` skips an id that is there). The fixed ids are `rolloff:<setup id>:<last throw id>`, `revealed:<setup id>:<side>`, `affiliation:<setup id>:<side>` (automatic affiliation) and `deployed:<setup id>`.

## Merge of clicks

Damage and Power clicks on one character change the last entry of the log when all of these hold: it is a Damage or Power entry of the same character and stat, the same player wrote it (`by`), it is the last entry of the list, and it is at most 10 s old. The entry takes the new value and the new time, so a run of clicks with pauses under 10 s stays one entry. When the value is back at the start of the entry, the entry is removed. A click that changes nothing (Damage at 0) adds nothing. The rule is `addStatEntry` in `src/log/log.js`.

## Limit

The `log` list keeps the newest 300 entries. A write that goes over removes the oldest ones in the same transaction. `rolls` has no limit.
