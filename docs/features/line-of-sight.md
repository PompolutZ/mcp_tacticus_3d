# Feature: Line of Sight

Status: partly built. The Size data and the length rule are built. The tool (spawn, turn, label, the other player's view) is not.

## Goal

The game has no real tool for Line of Sight. This tool is a line from a looking character. The player reads it and decides.

## The line

- One tool of the kind `los` per side, like the other tools. The other player sees it.
- It starts at the base center of the looker. It points along a direction (yaw).
- It is as wide as the base. Color: light neutral grey, half transparent. It is painted on the table and on terrain, as the other footprints.
- The app does not decide Line of Sight. See [Players apply the rules](character-trays.md).

## Spawn

- Shift + 1 over a character: the line starts at that character and points at the mat center.
- A drag of the LOS chip from the rack onto a character: the same. A drop on empty table does nothing.
- Shift + 1 over a second character while the line exists: that character is the **target**. The line turns from the looker's base center to the target's base center.
- Shift + 1 over the looker or the target again: no change.
- Esc (selected), key 0 and a drop on the rack remove the line.

## Turn

A drag on the line turns it around the looker's base center. Q / E and the wheel during that drag turn it the same way.

## Block Size

- With a target: the Size of the target (its face-up side) plus the Size of the terrain that the target stands on.
- With no target: the Size of the looker (plus its terrain).
- A small label at the end of the line shows it, for example "Size 3 · Hulk" or "Size 2 · own".
- Character Size is per side (Hulkbuster 4, then 2 on the Injured side). It comes from Jarvis (`characterSize` in `src/characters/characters.js`). Built.

## Length

- The line runs from the looker's base center to the mat edge, or to the first terrain whose Size is larger than the block Size.
- The terrain that the looker stands on is skipped.
- Terrain of the same or smaller Size does not stop the line.
- Characters do not stop it.
- Height does not matter. The cast box is tall, so an overhang above the line also blocks.
- Terrain Size is per placement in the map. It sits in the `userData` of the terrain body (`size`, `id`). A piece with no Size has Size 0 and never stops the line. Built (`losLength` in `src/components/losLength.js`).

## When models move

- The line belongs to the looker and the target by id. It stays on the looker's base center and keeps its direction. It is computed again when a model comes to rest.
- A removed looker removes the line. A removed target clears the target.
