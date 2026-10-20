# Feature: Line of Sight

Status: built.

## Goal

The game has no real tool for Line of Sight. This tool is a line from a looking character. The player reads it and decides.

## The line

- One tool of the kind `los` per side, like the other tools. The other player sees it.
- It starts at the base center of the looker. It points along a direction (yaw).
- It is as wide as the base. Color: light neutral grey, half transparent. It is painted on the table and on terrain, as the other footprints.
- With a target, the app checks sight from any part of the looker's base to any part of the target's base: a straight segment that no blocking terrain crosses (same rule as Length). When one exists and the line passes through the target base, the tool draws that segment as a thin grey line (2 px) a little above the base bottom. Both players see it.
- The app does not decide Line of Sight. See [Players apply the rules](character-trays.md).

## Spawn

- Shift + 1 over a character: the line starts at that character and points at the mat center.
- A drag of the LOS chip from the rack onto a character: the same. A drop on empty table does nothing. A click on the chip removes the line, or, with no line, starts it at the selected character.
- Shift + 1 over a second character while the line exists: that character is the **target**. The line turns from the looker's base center to the target's base center.
- Shift + 1 over the looker or the target again: no change.
- Esc (selected) and key 0 remove the line. A turn drag that ends with the pointer over the own rack removes it too.
- Only a character counts. Over a token (also one on the table) or the table, Shift + 1 does nothing.

## Turn

A drag on the line turns it around the looker's base center (`turnAround`). Q / E and the wheel during that drag turn it the same way, at once. The line never moves by a drag. Q / E over the line, with no drag, turn it too.

## Block Size

- With a target: the Size of the target (its face-up side) plus the Size of the terrain that the target stands on.
- With no target: the Size of the looker (plus its terrain).
- A small label at the end of the line shows it, for example "Size 3 · Hulk" or "Size 2 · own".
- Character Size is per side (Hulkbuster 4, then 2 on the Injured side). It comes from Jarvis (`characterSize` in `src/characters/characters.js`). Built.

## Length

- The line runs from the looker's base center to the mat edge, or to the first terrain whose Size is larger than the block Size.
- The terrain that the looker stands on is skipped. This is the whole piece, also its other parts (for example a duct on the roof).
- Terrain of the same or smaller Size does not stop the line.
- Characters do not stop it.
- With a clear sight segment (see The line) and the line through the target base, the line runs at least to the far edge of the target base (center distance + target radius), or further when the normal cast goes further. With no clear segment, or with the line turned away from the target, the length is as above.
- Sight test: points on the base edges (about 0.1 inch apart, at least 16 per half edge, only the half that faces the other base) and the two centers. Each pair is a thin tall box cast along the segment. Order: center to center, parallel lines, the rest. A gap narrower than the spacing can be missed. It runs when a model rests or a Size changes, not on each turn frame.
- Height does not matter. The cast box is tall, so an overhang above the line also blocks.
- Terrain Size is per placement in the map. It sits in the `userData` of the terrain body (`size`, `id`). A piece with no Size has Size 0 and never stops the line. Built (`losLength` in `src/tabletools/losLength.js`).

## When models move

- The line belongs to the looker and the target by id. It stays on the looker's base center and keeps its direction. It is computed again when a model comes to rest (it does not move for 0.15 s), when the line turns, and when a Size changes.
- A removed looker removes the line. A removed target clears the target.

## The other player

- The entry in `table.tools` is `{ which, spawn, looker, target, pose }`. `looker` and `target` are model ids. `pose` is the looker base center and the yaw, written when the line rests.
- While the line turns, the yaw goes over the live channel (`tool:los`). The other browser follows the looker's model and the yaw, and works out the length and the label with its own physics. Both players see the same label.
- The tool is `LosTool` and `OtherLos` in `src/tabletools/LosTool.jsx`. The line is painted by `ToolFootprint` (`ToolFootprint.jsx`) with one half and a fixed half-transparent fill.

