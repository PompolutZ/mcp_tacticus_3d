# Feature: Range and movement tools

Status: built.

## What the tools are for

- **Range tools** measure distance: model to model, model to terrain, model to token. They also place characters: some effects place the character itself, allies or enemies. A common use: check if a model contests a token, and put the model at the farthest spot where it still contests.
- **Movement tools** move characters on Advance, Climb, Throw and Push. They bend: a character whose Size is smaller than a terrain piece, and that is not Flying or a Wall Crawler, cannot Advance over it. Example: Black Cat (Size 2) cannot Advance over the pickup truck (Size 3), so the tool bends around it.
- A movement tool bent to 90° is the **Toward / Away** tool.

## Selection

A tool measures against the character or token selected last. A new tool also snaps to it. Place, Place 1 and Throw do not read the selection.

## Tools

Range tools and movement tools work the same way, except for bending and [Throw / Push](#throw--push). Movement tools can bend and throw. Range tools stay straight. The R1 tool snaps with a corner, not an end, and it has two Place buttons, see [Range 1](#range-1).

A tool hangs 1" above the table. It measures with its outline, which is drawn straight below it on the table and on the tops of terrain. Walls and steep sides (more than about 60°) are not painted. While you drag or rotate the tool, it stays 1" above the table or above any terrain under its outline. Terrain within 0.5" of the outline already raises the tool.

Key **0** removes every tool from the table, as in the mod. Key **6** is the [Toward / Away](#toward--away) tool.

**Where a tool spawns.**
- A tool key (**1** to **5**, the movement keys, **6**) with the pointer over a character or a token selects that piece. The tool spawns snapped to it.
- A tool key with the pointer over the table or terrain, not over a piece, spawns the tool free. Its center is at the point under the pointer. If the tool is already out, it spawns again there. A selected piece does not change this. The key no longer removes the tool.
- A toolbar button (when the tools are set to the HUD in **Settings**), or a tool key with the pointer off the table, turns the tool on or off. A new tool snaps to the selected piece. With no selected piece, it spawns free at the table point in the middle of the screen.
- A click on a tool or a chip of the tool rack on the table is the same as its toolbar button.
- A drag from a tool or a chip of the rack works as the tool key at the point where you let go. An outline of the tool follows the pointer. Over the own rack or off the table, nothing happens. Escape cancels the drag.
- A tool that you drag and let go over the own rack goes back to it. It is removed from the table.
- Escape, key **0** and the toolbar button or the rack remove the tool.
- A free tool starts turned the same way as before.

The tool has two states: **snapped** and **free**.

### Snapped

A tool snaps to a model or to a crisis token the same way. "Model" below also means a token.

The tool is snapped to a model when it spawns while that model is selected. With a character and a token selected, it snaps to the one selected last. A tool key with the pointer over a model selects that model and spawns the tool snapped to it, so the model does not have to be selected first. The tool spawns with one end of its outline touching the edge of the model's base, and it points toward the center of the mat.

A free tool also snaps to a model while you drag it: when the pointer moves onto a model (the figure or the base), that model becomes selected. The tool keeps its direction and its bend. It moves so that its end nearer to the base touches the edge of the base. The drag ends there, so moving the pointer further does nothing until you release it. If the drag starts with the pointer already on a model, the tool snaps only after the pointer leaves that model and moves onto a model again.

Dragging a snapped tool rotates it around the center of that model's base. You can grab any part of the tool. The distance between the tool and the base does not change, so the tool keeps touching the base. The TTS mod does the same, but it points the tool at the pointer. The app turns the tool as far as the pointer turns around the base, so the grabbed spot stays under the pointer and the tool does not jump at the start.

Only a free tool snaps during a drag. A drag that starts on a snapped tool never snaps it to another model, also when the pointer passes over one. So models that stand close together do not take the tool from each other.

The tool stays snapped to the same model when you select another model. It also stays snapped when you drag it with Place on, because the base keeps touching the tool. When the model leaves the table (a removed character, or a token that a character takes), the tool is free.

### Free

The tool is free when it spawns while no model is selected and the pointer is not over a model. Turning a snapped tool with Q / E makes it free. The TTS mod has a Snap / Unsnap button on the tool for this, and no key.

Dragging a free tool moves it.

**Q** and **E** turn the tool under the pointer, or the tool you drag, 15° around its center, as in TTS. Hold the key to keep turning. Q turns it counter-clockwise and E clockwise, seen from above. The center of a movement tool is its hinge, and the tool keeps its bend. While a drag turns a snapped tool or bends a tool, Q and E do nothing. They turn characters the same way.

### Place

**Place** turns on and off. A selected range or movement tool has one Place button while it is snapped. The button is at the far end: the end that does not touch the snapped base.

Place moves nothing. It locks a character to the tool. While Place is on, the first character whose base touches the tool outline during a drag is locked. The snapped character already touches the tool, so its first drag locks it. Another character, an ally or an enemy, locks when a drag brings its base onto the outline. Before the lock, a drag is free. The lock stays with that character until Place turns off.

A locked character can be dragged only to where its base touches the outline, so the outline stays green. When the pointer goes farther, the base stops at the nearest point where it still touches the outline. The deploy line limits a drag in the same way. You can still move and rotate the tool while Place is on. The tool does not move while the locked character is dragged.

While Place is on, the button stays at the end where it was when Place turned on. Place is on for a free tool too, and shows only while it is on.

Only one Place, Place 1 or Throw / Push is on at a time across the own tools. Turning it on on one tool turns it off on the other tool (range or movement). Each player has one range tool and one movement tool, so a character is locked to one tool only.

Place needs no selected character. The button works on any snapped tool, also on a tool snapped to a token. A lock is local, like the tool state: it limits only drags in this browser.

### Throw / Push

**Throw / Push** turns on and off. A selected movement tool that is snapped to a character has the button at the snapped end, as in the mod. The button is hidden while Place is on, and Place is hidden while Throw is on. The button is disabled when the tool is snapped to a token.

Turning Throw on slides the snapped character along the middle line of the tool, from the snapped end toward the far end. The rules (p13–14) move a Thrown and a Pushed character the same way, so one button does both. The app does not apply collision damage. The players resolve it.

The rules need a straight tool. If the tool is bent, the button first straightens it: the far half turns to line up with the snapped half, so the snapped end still touches the base.

The character moves the full distance, until its base touches the far end from outside, the same as Place. It stops earlier at the first of these:

- **Another character's base.** The app measures bases from above, so the height of the other base does not matter. A base that the move goes away from does not stop it, also when the two touch at the start.
- **A terrain piece.** The base moves at the height where it starts. So a base on the table passes under an overhang (rules p9), and a base on a roof does not hit lower terrain. Terrain that the base overlaps at the start, for example the roof or the stairs it stands on, does not stop it (rules p14).
- **The mat edge.** A base never leaves the mat (rules p13).

The base stops touching what stopped it. It starts fast and slows down, as if friction stops it at the full distance. When it hits something, it stops at once. At the end, the character stands upright on what is under it, below the height where it moved. A character that moved off a roof drops to the table or to the terrain under it.

A **lifted** character (key **R**) does not stop the move. A character can throw or push another character through its own base, and the app does not know which character performs the Throw. So the player lifts the thrower before the Throw, and puts it back down after it. The same works for any other character that the move should pass.

While Throw is on, the button stays at the end where the Throw started. You can drag the thrown character only along the middle line of the tool, between its start and the full distance. So you can correct where it stopped. Turning Throw off does not move anything.

After a full move, the base touches the far end, so the tool stays snapped to the character at that end. After a shorter move, the base touches no end, so the tool is free.

### Toward / Away

When a character moves Toward or Away from another piece, the rules (p14–15) use a movement tool bent to 90°. Key **6**, the **T/A** chip of the rack and **Move → T/A** in the toolbar turn this tool on and off. It is a copy of the long movement tool, and it is always bent to a right angle. It has no Bend, Place or Throw button. Drag and Q / E work the same as on the other tools.

This is a separate tool. A short, medium or long movement tool can be on the table at the same time.

The tool is placed so that both arms touch the base of the moving character. The point where the arms meet (the hinge) is on the line through the center of the moving character and the center of the other piece:

- **Away**: the hinge is between the moving character and the other piece.
- **Toward**: the hinge is on the far side of the moving character, away from the other piece.

The mod puts the hinge one base diameter from the base center. That fits only a 35 mm base. The app uses the exact distance, so both arms touch a base of any size.

**Spawn.** The toolbar button spawns the tool snapped to the selected character and aimed at the selected token. If no token is selected, it aims at the center of the mat. With no character selected, the tool spawns free, already bent. It starts on Away. With the pointer over a character or a token, key 6 selects that piece and spawns the tool again snapped to it, also when the tool is already out. It aims at the piece selected last that is not that piece. With the pointer over nothing, key 6 works like the toolbar button.

**Snap.** The tool snaps to characters and tokens, the same as the other tools. The mod snaps it only to characters. While you drag the free tool, it snaps when the pointer moves onto a character or a token. It keeps the direction of the angle, and it moves so that both arms touch that base.

**Drag.** While the tool is snapped, a drag turns the whole tool around the base center, so the arms keep touching the base. Move the pointer onto another piece, a character or a token, and the tool shows the exact line through the center of that piece, with the current mode. Move the pointer off the piece and the tool goes back to the plain turn. A free tool works like any free tool.

**Toward / Away button.** While the tool is selected and snapped, the button on the hinge moves the tool to the other side of the base. This switches between Toward and Away.

**Limit.** In the mod, a movement tool that is snapped to the same character as the angle tool can only point within 45° of the middle of the angle. The app does the same for the short, medium and long tools, but not for range tools. The limit applies when the movement tool spawns, when you drag it onto the character, and when a drag turns it around the base. When the tool spawns on that character, it points along the middle of the angle. The app reads the angle tool at each move, so the limit follows the angle tool when you move it.

### Range marks

A snapped range tool measures against the model or token under the pointer while a drag turns the tool around the base. Turn the tool toward a piece and move the pointer onto it. That piece gets an outline:

- **Green**: the piece is within range.
- **Red**: the piece is out of range.

For R2 to R5, a piece is within range when its base touches the tool outline. For R1, a piece is within range when its base is within range 1 of the snapped base, edge to edge, seen from above. See [Range 1](#range-1).

The outline shows only while the pointer is on that piece during the drag. It goes away when the pointer leaves the piece, or when you release the tool. The snapped model is not measured against itself. The movement tools do not measure against pieces.

### Bending

A movement tool has a hinge in the middle. The round button on the hinge turns bending on and off.

While bending is on, dragging a half turns it around the hinge. The other half does not move. A half turns at most 90° from straight, the same as the plastic tool. On a snapped tool, only the far half bends. A drag on the half that touches the base turns the whole tool around the base, so the tool stays snapped. The TTS mod works the same way: its Bend button splits the tool, and one half turns around the hinge while the other half stays.

While bending is off, a drag moves or turns the whole tool, as described above. The tool keeps its bend.

The outline of a bent tool is one rectangle for each half, plus the round hinge between them.

### Range 1

Range 1 has no tool of its own. The short side of every range tool is 1", so the width of a range tool measures range 1. **R1** (the chip of the rack, or the toolbar button) spawns the Range 2 tool, the shortest range tool, and uses it this way. The TTS mod does the same with its "Snap 1" button.

The R1 tool snaps with a corner. The base touches one long side of the tool at its corner, so the tool lies across the line from the base. Along that line, the tool is 1" wide.

- Spawned while a model is selected: the tool is on the side of the base toward the mat center.
- Snapped during a drag: the tool keeps its direction. It moves so that its corner nearer to the base touches the base.
- Dragging the snapped tool rotates it around the base center, the same as other tools. So the corner moves along the base edge. Turn the tool until the corner points at the other model.

While the R1 tool is snapped and another model is selected, the outline is green when that model is within range 1 of the snapped model, and red when it is not. The app measures this edge to edge, seen from above. Touching the tool is not enough, because the tool is 3" long: a base can touch its far end and still be more than 1" away.

The R1 tool is the Range 2 tool, so it has two Place buttons while it is snapped:

- **Place 1** is at the snapped corner, on the half of the tool next to the other long side. It moves nothing. It is a toggle, like Place 2, and shows its on state. Place 1 and Place 2 turn each other off.
  - While it is on, the first character whose base comes within range 1 of the snapped piece, edge to edge and seen from above, is locked. The snapped piece itself is not locked. Before the lock, a drag is free. The lock stays until Place 1 turns off.
  - A locked character can be dragged anywhere within range 1: as close as the center of the snapped piece (its base can cover a token or portal), and as far as the base edge 1" from the snapped base edge. When the pointer goes farther, the base stops at the range 1 limit, on the line from the snapped center to the pointer.
  - The tool does not turn or move with the character. A drag selects the character, so the movement tool footprint shows if the place is within its reach.
- **Place 2** is at the far end. It works the same as [Place](#place) on other tools.
