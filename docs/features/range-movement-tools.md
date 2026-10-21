# Feature: Range and movement tools

Status: built.

## Sizes

A range or move in game terms is a tool size (R1 to R5, Short / Medium / Long), never inches. "Within R2" is within the whole long side of the R2 tool. R1 has no tool: it is the short side (width) of a range tool. The one conversion from size to inches is `rangeLength` and `moveLength` in `src/tabletools/toolTips.js`.

## What the tools are for

- **Range tools** measure distance: model to model, model to terrain, model to token. They also place characters: some effects place the character itself, allies or enemies. A common use: check if a model contests a token, and put the model at the farthest spot where it still contests.
- **Movement tools** move characters on Advance, Climb, Throw and Push. They bend: a character whose Size is smaller than a terrain piece, and that is not Flying or a Wall Crawler, cannot Advance over it. Example: Black Cat (Size 2) cannot Advance over the pickup truck (Size 3), so the tool bends around it.
- A movement tool bent to 90° is the **Toward / Away** tool.

## Selection

A tool measures against the character or token selected last. A new tool also snaps to it. Place, Place 1 and Throw do not read the selection.

## Tools

Range tools and movement tools work the same way, except for bending and [Throw / Push](#throw--push). Movement tools can bend and throw. Range tools stay straight. The R1 tool snaps with a corner, not an end, and it has two Place buttons, see [Range 1](#range-1).

A tool hangs 1" above the table. It measures with its outline, which is drawn straight below it on the table and on the tops of terrain. Walls and steep sides (more than about 60°) are not painted. While you drag or rotate the tool, it stays 1" above the table or above any terrain under its outline. Terrain within 0.5" of the outline already raises the tool.

Key **0** removes every tool from the table, as in the mod. Key **6** is the [Toward / Away](#toward--away) tool. **Shift + 1** over a character is the Line of Sight tool, which is not a ruler: see [Line of Sight](line-of-sight.md).

**Where a tool spawns.**
- A tool key (**1** to **5**, the movement keys, **6**) with the pointer over a character or a token (also one on the table) selects that piece. The tool spawns snapped to it.
- A tool key with the pointer over the table or terrain, not over a piece, spawns the tool free. Its center is at the point under the pointer. If the tool is already out, it spawns again there. A selected piece does not change this. The key no longer removes the tool.
- A toolbar button (when the tools are set to the HUD in **Settings**), or a tool key with the pointer off the table, turns the tool on or off. A new tool snaps to the selected piece. With no selected piece, it spawns free at the table point in the middle of the screen.
- A click on a tool or a chip of the tool rack on the table is the same as its toolbar button.
- A drag from a tool or a chip of the rack works as the tool key at the point where you let go. An outline of the tool follows the pointer. Over the own rack or off the table, nothing happens. Escape cancels the drag.
- A tool that you drag and let go over the own rack goes back to it. It is removed from the table.
- Escape, key **0** and the toolbar button or the rack remove the tool.
- A free tool starts turned the same way as before.

The tool has two states: **snapped** and **free**.

### Snapped

A tool snaps to a model, to a crisis token or to a token that lies on the table (Black Bifrost, Mystic Portal and the like) the same way. "Model" below also means a token. A token on the table has its own size (`tokens/tokens.js`), so the base edge, the range and the in/out outline use its real radius, not the 0.5" of a crisis token. It shows the selection outline too. Place and Place 1 lock it the same way as a character. Throw / Push is disabled for it.

The tool is snapped to a model when it spawns while that model is selected. With a character and a token selected, it snaps to the one selected last. A tool key with the pointer over a model selects that model and spawns the tool snapped to it, so the model does not have to be selected first. The tool spawns with one end of its outline touching the edge of the model's base, and it points toward the center of the mat. A movement tool snaps with its indented end, the end of the right half (the half with the hinge mesh). A range tool snaps with its flat end.

A free tool also snaps to a model while you drag it: when the pointer moves onto a model (the figure or the base), that model becomes selected. The tool keeps its direction and its bend. It moves so that its end nearer to the base touches the edge of the base. A movement tool always snaps with its indented end: if the other end is nearer, the tool flips first. The halves swap places, so the outline stays where it was and a bend keeps its shape. The drag ends there, so moving the pointer further does nothing until you release it. If the drag starts with the pointer already on a model, the tool snaps only after the pointer leaves that model and moves onto a model again.

Dragging a snapped tool rotates it around the center of that model's base. You can grab any part of the tool. The distance between the tool and the base does not change, so the tool keeps touching the base. The TTS mod does the same, but it points the tool at the pointer. The app turns the tool as far as the pointer turns around the base, so the grabbed spot stays under the pointer and the tool does not jump at the start.

A snapped range tool is an exception while the pointer is on another model or token: it then points at the center of that piece, along the line from the center of the snapped base. It keeps touching the base. On R1, the tool width points at the piece. When the pointer leaves the piece, the plain turn goes on from where the tool is, with no jump.

Only a free tool snaps during a drag. A drag that starts on a snapped tool never snaps it to another model, also when the pointer passes over one. So models that stand close together do not take the tool from each other.

The tool stays snapped to the same model when you select another model. It also stays snapped when you drag it with Place on, because the base keeps touching the tool. When the model leaves the table (a removed character, or a token that a character takes), the tool is free.

### Free

The tool is free when it spawns while no model is selected and the pointer is not over a model. Turning a free tool around its center with Q / E keeps it free. A snapped tool stays snapped when it turns with Q / E (see "Input rules"). The TTS mod has a Snap / Unsnap button on the tool for this, and no key.

Dragging a free tool moves it.

A drag that starts on a button of the tool (Place, Throw / Push, Toward / Away, Bend) moves the tool the same as a drag of the half under it. A click on the button presses it. A drag does not press it. A disabled button does not start a drag.

**Q** and **E** act on the tool under the pointer, or the tool you drag, one turn step per press (15° by default, as in TTS; see Settings). Hold the key to keep going. Q turns counter-clockwise and E clockwise, seen from above. What a step does depends on the tool state: see "Input rules". A free tool turns around its center. The center of a movement tool is its hinge, and the tool keeps its bend. Q and E turn characters the same way.

### Place

**Place** turns on and off. A selected range or movement tool has one Place button while it is snapped. The button is at the far end: the end that does not touch the snapped base.

Place moves nothing. It locks a character or token to the tool. While Place is on, the first character or token whose base touches the tool outline during a drag is locked. The snapped model already touches the tool, so its first drag locks it. Another character, an ally or an enemy, or a token, locks when a drag brings its base onto the outline. Before the lock, a drag is free. The lock stays with that model until Place turns off.

A locked character or token can be dragged only to where its base touches the outline, so the outline stays green. When the pointer goes farther, the base stops at the nearest point where it still touches the outline. The deploy line limits a drag in the same way. You can still move and rotate the tool while Place is on.

On a range tool (R1 to R5) that is snapped, the tool follows the locked piece. While the locked character or token is dragged, the tool turns around the snapped base to point at it, the same pose as the aim turn (see [Snapped](#snapped)), and keeps touching the base. The limit is then the outline of the turned tool: the locked base touches it, so the piece can go as far as the tool reaches from the snapped base, edge to edge. The reason (playtest 6): a tool that stayed fixed let a locked piece stand where the tool did not measure. The tool keeps its last pose after the drop, and the other player sees it turn as for any tool turn. When the locked piece is the snapped piece, the tool stays where it is. Movement tools and Toward / Away do not follow: their bent shape is the path of the move, so the piece follows the tool.

While Place is on, the button stays at the end where it was when Place turned on. Place is on for a free tool too, and shows only while it is on.

Only one Place, Place 1 or Throw / Push is on at a time across the own tools. Turning it on on one tool turns it off on the other tool (range or movement). Each player has one range tool and one movement tool, so a model is locked to one tool only.

Place needs no selected character. The button works on any snapped tool, also on a tool snapped to a token. A locked token keeps its waiting limit (Range 2 of its base) too. A lock is local, like the tool state: it limits only drags in this browser.

### Throw / Push

**Throw / Push** turns on and off. A selected movement tool that is snapped to a character has the button at the snapped end, as in the mod. The button is hidden while Place is on, and Place is hidden while Throw is on. The button is disabled when the tool is snapped to a token.

Turning Throw on moves nothing. It locks the snapped character: a drag of it stays on the middle line of the tool, from its start toward the far end. The rules (p13–14) move a Thrown and a Pushed character the same way, so one button does both. The app does not apply collision damage. The players resolve it.

The rules need a straight tool. If the tool is bent, the button first straightens it: the far half turns to line up with the snapped half, so the snapped end still touches the base.

The line ends at the full distance, where the base touches the far end from outside, the same as Place. It ends earlier at the first of these:

- **Another character's base.** The app measures bases from above, so the height of the other base does not matter. A base that the move goes away from does not stop it, also when the two touch at the start.
- **A terrain piece.** The line is checked at the height where the base starts. So a base on the table passes under an overhang (rules p9), and a base on a roof does not hit lower terrain. A terrain piece that the base overlaps at the start, for example the roof or the stairs it stands on, does not stop it (rules p14). This is the whole piece, also its other parts, for example a duct on the roof it stands on.
- **The mat edge.** A base never leaves the mat (rules p13).

The stop point follows the tool: it is found again at each drag move, so moving or turning the tool while Throw is on moves it too. The drag can go anywhere on the line before it, and the character drops where it is released.

A **lifted** character (key **R**) does not stop the line. A character can throw or push another character through its own base, and the app does not know which character performs the Throw. So the player lifts the thrower before the Throw, and puts it back down after it. The same works for any other character that the move should pass.

While Throw is on, the button stays at the end where the Throw started. Turning Throw off ends the lock.

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

The tool points at the piece while the pointer is on it, so the outline is green exactly when the tool reaches the base.

The outline shows only while the pointer is on that piece during the drag. It goes away when the pointer leaves the piece, or when you release the tool. The snapped model is not measured against itself. The movement tools do not measure against pieces.

### Bending

A movement tool has a hinge in the middle. The round button on the hinge turns bending on and off.

While bending is on, dragging a half turns it around the hinge. The other half does not move. A half turns at most 90° from straight, the same as the plastic tool. On a snapped tool, only the far half bends. A drag on the half that touches the base turns the whole tool around the base, so the tool stays snapped. The TTS mod works the same way: its Bend button splits the tool, and one half turns around the hinge while the other half stays.

Q / E and the wheel bend too: over a half, or during a bend drag, they bend that half one step (see "Input rules").

While bending is off, a drag moves or turns the whole tool, as described above. The tool keeps its bend.

The outline of a bent tool is one rectangle for each half, plus the round hinge between them.

### Advance

**Advance** moves the snapped character to the far end of the movement tool, with one right click. It is for a player who does not want to drag the character along the tool.

The click goes on the far half, anywhere on it, so it is easy to hit. The far half is the half that does not touch the snapped base. A right press and release without movement counts as a click. A right drag still turns the camera. The decision is made on the release, because on macOS the context menu starts on the press.

The character slides to the far end, so the move can be seen. It ends with the base touching the far end from outside, the same spot as the full Throw distance. The other player sees the slide, as for any move of a character.

- **Throw off** (also with Place on). The character follows the tool: from its place to the hinge, then along the far half. A bent tool gives a bent path, and the tool is not straightened. Nothing stops the move, so the players settle overlaps themselves, as for any move of a character.
- **Throw on.** The move is a Throw. The character goes along the Throw line and stops at the same first hit as a Throw drag. Throw stays on after the move, as the character is still on the line.

The height follows the ground along the path, so a character that leaves a roof drops.

Advance does nothing for a token (it has no body), for a lifted character, for a character that is dragged, for the angle tool, or when the other player moves the character. Then the click is ignored: the character is not claimed and the move is not counted.

### Input rules

What a drag does depends on the state of the tool and on the half you grab. `src/tabletools/toolInput.js` holds the rules.

| Tool state | Drag a half | Q / E, wheel |
|---|---|---|
| Free, Bend off | moves the tool | turn the tool around its center |
| Free, Bend on | bends that half | bend that half one step |
| Snapped, Bend off | turns the tool around the base | turn the tool around the base one step |
| Snapped, Bend on, far half | bends the far half | bend the far half one step |
| Snapped, Bend on, half on the base | turns the tool around the base | turn the tool around the base one step |

Q / E act on the half under the pointer. During a drag they act as the drag does: a turn or bend drag goes on from the new angle, and a move drag turns the tool around its center. The wheel turns only during a drag. Without a drag it zooms. A turn around the base keeps the tool snapped, and a tool next to an angle tool keeps its ±45° limit. A bend stops at 90° from straight. When a range, R1 or angle tool aims at a piece under the pointer during a drag, the aim sets the pose, so a step shows nothing. A range tool has no halves and no Bend, so the rows with Bend off apply. Place, Place 1 and Throw / Push only limit a drag of a model, so they are not in the table. A right click without movement on the far half of a snapped movement tool is Advance (see "Advance"). Other right clicks and right drags do not change; a right drag turns the camera.

### Range 1

Range 1 has no tool of its own. The short side of every range tool is 1", so the width of a range tool measures range 1. **R1** (the chip of the rack, or the toolbar button) spawns the Range 2 tool, the shortest range tool, and uses it this way. The TTS mod does the same with its "Snap 1" button.

The R1 tool snaps with a corner. The base touches one long side of the tool at its corner, so the tool lies across the line from the base. Along that line, the tool is 1" wide.

- Spawned while a model is selected: the tool is on the side of the base toward the mat center.
- Snapped during a drag: the tool keeps its direction. It moves so that its corner nearer to the base touches the base.
- Dragging the snapped tool rotates it around the base center, the same as other tools. So the corner moves along the base edge. Turn the tool until the corner points at the other model.

While the R1 tool is snapped and another model is selected, the outline is green when that model is within range 1 of the snapped model, and red when it is not. The app measures this edge to edge, seen from above. Touching the tool is not enough, because the tool is 3" long: a base can touch its far end and still be more than 1" away.

The R1 tool is the Range 2 tool, so it has two Place buttons while it is snapped:

- **Place 1** is at the snapped corner, on the half of the tool next to the other long side. It moves nothing. It is a toggle, like Place 2, and shows its on state. Place 1 and Place 2 turn each other off.
  - While it is on, the first character or token whose base comes within range 1 of the snapped piece, edge to edge and seen from above, is locked. A drag of the snapped piece locks it too, if nothing is locked yet. Its base keeps touching the short side (1") of the tool at the snapped end, and can overlap that side, as with Place. It cannot move away from that side or along the long sides, and the tool does not turn. Before the lock, a drag is free. The lock stays until Place 1 turns off.
  - A locked character can be dragged anywhere within range 1: as close as the center of the snapped piece (its base can cover a token or portal), and as far as the base edge 1" from the snapped base edge. When the pointer goes farther, the base stops at the range 1 limit, on the line from the snapped center to the pointer.
  - The tool turns around the snapped base with the character, so the tool width points at it and the tool keeps touching the snapped base (same follow as [Place](#place), same reason). The range 1 limit above does not change. The tool keeps its last pose after the drop. A drag selects the character, so the movement tool footprint shows if the place is within its reach.
- **Place 2** is at the far end. It works the same as [Place](#place) on other tools.
