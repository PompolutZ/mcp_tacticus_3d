# Feature: Game log

Status: partly built. The log has the setup, the Power and Cleanup Phases and Priority. Character changes, token sounds and drops are not built.

## Goal

One shared list that tells what happened at the table, for both players: the dice, the setup steps, the phase buttons and Priority changes.

## Panel

The Log is a HUD panel in the right column (`src/components/LogPanel.jsx`). It replaces the Rolls panel. The toolbar chip is **Log**.

- Collapsed: one bar at the top of the right column with the newest entry. A click on the bar, or the toolbar chip, expands it.
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

The dice entries are the same as in the Rolls panel before.

## Entry data

An entry stores data, not text: `{ id, at, by, kind, ... }` (`src/log/log.js`).

- `by`: the side of the browser that wrote it. It is null in the Sandbox and a single player room.
- `side`: the side that did the thing (the chooser of a step, the side of a Power Phase).
- Other fields by kind: `type`, `card`, `threat`, `ready`, `affiliation`, `step`, `gains`, `round`, `flipped`, `before`, `after`.

The text is made when the entry shows, with the names of the viewer (`src/setup/names.js`, `src/setup/useNames.js`). So the same entry reads "You choose ..." in one browser and "Nelly chooses ..." in the other, and "Blue" or "Red" in the Sandbox and a single player room.

Each entry is written in the same transaction as the change it tells. An effect that runs in both browsers (the roll-off read, the squad reveal) writes an entry with a fixed id, so two writes make one entry (`addEntry` skips an id that is there). The fixed ids are `rolloff:<setup id>:<last throw id>`, `revealed:<setup id>:<side>`, `affiliation:<setup id>:<side>` (automatic affiliation) and `deployed:<setup id>`.

## Limit

The `log` list keeps the newest 300 entries. A write that goes over removes the oldest ones in the same transaction. `rolls` has no limit.

## Not built yet

- Entries of characters: Damage and Power (with the merge of clicks within 10 s), card flip, tokens on a character, held objective tokens, **Remove** and a deleted character.
- Entries for the drop of objective tokens.
