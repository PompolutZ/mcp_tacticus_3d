# MCP Assist 3D

A browser-based 3D game table for **Marvel Crisis Protocol**, built with React and Three.js.

## What this project does

It renders a game table floating in space. The camera sits directly above the table by default and looks straight down, giving a top-down view of the play area. The table holds a game mat — currently the Wakanda Kingdom mat — as a texture on a flat plane. From this starting point the project will grow to support placing characters, tokens, rulers, and crisis cards on the table.

## Tech stack

| Tool | Role |
|---|---|
| [Vite](https://vitejs.dev/) | Build and dev server |
| [React 18](https://react.dev/) | UI and component tree |
| [Three.js](https://threejs.org/) | 3D rendering |
| [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) | React renderer for Three.js |
| [@react-three/drei](https://github.com/pmndrs/drei) | Three.js helpers (orbit controls, stars, texture loader) |

## Project structure

```
src/
  App.jsx          — Canvas setup and camera position
  components/
    Scene.jsx      — 3D scene: space, table, mat, lights
  assets/          — models and textures. Load them with assetUrl('path') from assets/index.js
    wakanda-mat.webp — Wakanda Kingdom game mat (2592×2592 px, from TTS mod cache)
public/
  _headers         — Netlify cache headers
  draco/           — Draco decoder for compressed GLB files
scripts/
  migrate-terrain.mjs — copies a map (mat and terrain) from the TTS mod to src/assets. See scripts/README.md
```

Put new models and textures in `src/assets/`, not in `public/`. Vite adds a content hash to their file names, so browsers can cache them forever (see `public/_headers`). Files in `public/` keep their names, so browsers must check them again on every load.

## Running locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. You can orbit, zoom, and pan with the mouse.

## Scene units

1 Three.js unit = 1 inch.

| Object | Dimensions |
|---|---|
| Game mat | 36 × 36 units (36" × 36", matching the physical MCP mat) |
| Table surface | 72 × 48 units: 72 along x, 48 along z (between the players). The same 3:2 shape as the TTS table |
| Camera default height | 20 units above the mat |

## Assets

Assets come from the Tabletop Simulator mod **3036795456** (community MCP mod). See `ASSETS.md` for the full inventory: character images, 3D models, terrain pieces, and crisis cards cached locally by TTS.

## Table sides

One half of the table is blue and the other half is red. Blue is the side of the player who won the priority roll-off. Red is the other player's side. Blue is at the bottom of the default view.

In game setup, the player with priority chooses the edge of the mat to deploy from. **Mat → ↺ / ↻** in the toolbar turns the mat and all its terrain 90° around the mat center. Turn it until the chosen edge faces the blue side. Models and tools do not turn with the mat.

## Selection

Click a piece to select it. Click it again to deselect it. One character, one crisis token, the range tool and the movement tool can be selected at the same time. Selecting another character deselects the old character. The same is true for a token. A click on the empty table deselects the character and the token. Escape deselects everything and removes the selected tools from the table.

A tool measures against the piece selected last. A new tool also snaps to it. Place moves the selected character, also when a token was selected after it.

## Tools

Range tools and movement tools work the same way, except for bending and [Throw / Push](#throw--push). Movement tools can bend and throw. Range tools stay straight. The R1 tool snaps with a corner, not an end, and it has two Place buttons, see [Range 1](#range-1).

A tool hangs 1" above the table. It measures with its outline, which is drawn straight below it on the table and on the tops of terrain. Walls and steep sides (more than about 60°) are not painted. While you drag or rotate the tool, it stays 1" above the table or above any terrain under its outline. Terrain within 0.5" of the outline already raises the tool.

Key **0** removes every tool from the table, as in the mod.

The tool has two states: **snapped** and **free**.

### Snapped

A tool snaps to a model or to a crisis token the same way. "Model" below also means a token.

The tool is snapped to a model when it spawns while that model is selected. With a character and a token selected, it snaps to the one selected last. It spawns with one end of its outline touching the edge of the model's base, and it points toward the center of the mat.

A tool also snaps to a model while you drag it: when the pointer moves onto a model (the figure or the base), that model becomes selected. The tool keeps its direction and its bend. It moves so that its end nearer to the base touches the edge of the base. The drag ends there, so moving the pointer further does nothing until you release it. If the drag starts with the pointer already on a model, the tool snaps only after the pointer leaves that model and moves onto a model again.

Dragging a handle rotates the tool around the center of that model's base. The distance between the tool and the base does not change, so the tool keeps touching the base.

The tool stays snapped to the same model when you select another model. It also stays snapped when **Place** moves that model, or when you drag it with Place on, because the base keeps touching the tool.

### Free

The tool is free when it spawns while no model is selected. Dragging the tool body, or turning it with Q / E, makes a snapped tool free.

Dragging a handle rotates the tool around the opposite handle.

**Q** and **E** turn the tool under the pointer, or the tool you drag, 15° around its center, as in TTS. Hold the key to keep turning. Q turns it counter-clockwise and E clockwise, seen from above. The center of a movement tool is its hinge, and the tool keeps its bend. During a handle drag, Q and E do nothing. They turn characters the same way.

### Place

**Place** turns on and off. A selected range or movement tool has one Place button while it is snapped. The button is at the far end: the end that does not touch the snapped base.

Turning Place on moves the selected character past the far end. Its base then touches that end from outside. If the selected character is the snapped model, the tool stays snapped to it at that end. While Place is on, the button stays at the end where it put the character. Turning Place off does not move anything.

A free tool has no far end, so it shows Place only while Place is on. Then you can still turn it off.

While Place is on, you can drag the selected character only to where its base touches the tool outline, so the outline stays green. When the pointer goes farther, the base stops at the nearest point where it still touches the outline. The deploy line limits a drag in the same way. You can still move and rotate the tool while Place is on.

Place does not work for a token: a token has no base to place, only a position that its own drag sets. So Place cannot be turned on while no character is selected. With a character and a token selected, Place moves the character.

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

### Range marks

A snapped range tool measures against the model or token under the pointer while you drag a handle. Drag the handle toward a piece and move the pointer onto it. That piece gets an outline:

- **Green**: the piece is within range.
- **Red**: the piece is out of range.

For R2 to R5, a piece is within range when its base touches the tool outline. For R1, a piece is within range when its base is within range 1 of the snapped base, edge to edge, seen from above. See [Range 1](#range-1).

The outline shows only while the pointer is on that piece during the drag. It goes away when the pointer leaves the piece, or when you release the handle. The snapped model is not measured against itself. The movement tools do not measure against pieces.

### Bending

A movement tool has a hinge in the middle. The round button on the hinge turns bending on and off.

While bending is on, dragging a handle turns that half of the tool around the hinge. The other half does not move. A half turns at most 90° from straight, the same as the plastic tool. If the half touches the base of a snapped model, turning it takes its end off the base, so the tool becomes free.

While bending is off, the handles rotate the whole tool, as described above. The tool keeps its bend.

The outline of a bent tool is one rectangle for each half, plus the round hinge between them.

### Range 1

Range 1 has no tool of its own. The short side of every range tool is 1", so the width of a range tool measures range 1. **R1** in the toolbar spawns the Range 2 tool, the shortest range tool, and uses it this way. The TTS mod does the same with its "Snap 1" button.

The R1 tool snaps with a corner. The base touches one long side of the tool at its corner, so the tool lies across the line from the base. Along that line, the tool is 1" wide.

- Spawned while a model is selected: the tool is on the side of the base toward the mat center.
- Snapped during a drag: the tool keeps its direction. It moves so that its corner nearer to the base touches the base.
- Dragging a handle rotates the tool around the base center, the same as other tools. So the corner moves along the base edge. Turn the tool until the corner points at the other model.

While the R1 tool is snapped and another model is selected, the outline is green when that model is within range 1 of the snapped model, and red when it is not. The app measures this edge to edge, seen from above. Touching the tool is not enough, because the tool is 3" long: a base can touch its far end and still be more than 1" away.

The R1 tool is the Range 2 tool, so it has two Place buttons while it is snapped:

- **Place 1** is at the snapped corner, on the half of the tool next to the other long side. It moves the selected character across the tool, so its base touches the other long side at the same corner. Its base edge is then 1" from the snapped base edge. If the selected character is the snapped model, it now touches the other long side, so the tool stays snapped to it. Place 1 does not stay on.
- **Place 2** is at the far end. It works the same as [Place](#place) on other tools. If it moves the snapped model, the base is no longer at a corner, so the tool becomes free.

## Debug mode

**Debug → Mode** in the toolbar turns debug mode on. It is only in the dev server (`npm run dev`). `vite build` leaves it out.

### Collider view

Debug mode draws every physics collider as lines. A collider is the shape that physics uses for an object. It is not always the same as the visible mesh. Most terrain pieces use a convex hull: the mesh wrapped tight with no dents, so it fills gaps and holes. A model collides only with its base, so the figure can go into terrain.

### Frame numbers

A panel at the bottom left shows numbers for the last 0.5 s. Hover a label to see what it means.

- **FPS**: frames per second. The display refresh rate is the upper limit.
- **Worst**: the longest time between two frames. A stutter shows here even when FPS looks fine.
- **CPU**: JavaScript time of a frame: physics, `useFrame` callbacks and sending the draw calls. Pointer events are not included.
- **GPU**: GPU time of a frame. It needs the `EXT_disjoint_timer_query_webgl2` WebGL extension. Chrome has it, Safari does not, so Safari shows n/a.
- **Draw calls** and **Triangles**: counts of the last frame, of all renders together (shadow map, scene, outline passes). Each outline color that is in use (selected, hovered, and the green or red [range mark](#range-marks)) draws the whole scene one more time, so the triangle count goes up by about one scene for each color.
- **Canvas**: size of the drawing buffer in device pixels, and the device pixel ratio.

### Render switch

The panel also turns parts of the rendering off, to measure what they cost:

- **Full**: as in the normal app.
- **No outline**: the EffectComposer runs, but draws no outline.
- **No composer**: R3F draws the scene straight to the screen. There are no outlines and no antialiasing, because the canvas is created without antialiasing.

## Crisis

**Crisis → Secure / Extract** in the toolbar chooses one Secure card and one Extract card. The app puts the two cards on the table next to the scoring board, and their tokens on the mat. Choosing another card removes the old tokens and adds the new ones.

Click a card to open its face image. Click a token to select it. A HUD panel at the bottom shows the actions that token allows: Flip, and for a Secure token, a Control marker (None / Blue / Red) and a damage marker. The Control marker shows the player's affiliation token, the same one as their VP marker, and a ring in the player color. Drag a movable token to move it. A Zone token also gets a handle that turns it, and shows its Arc outline on the table while selected, the same way a tool shows its outline.

Press **F** with the pointer over a token to flip it. F also flips a character card, with the pointer over the card or the model. With nothing under the pointer, F flips the piece selected last: a token, or the card of a character.

A model that stands on a token can hide it. Press **R** with the pointer over the model to lift it 6". Press R over it again to put it back, or press R with the pointer over no model to put every lifted model back. The model goes back to the same place, and physics does not move it.

The range and movement tools also snap to a selected token, the same way they snap to a model (see [Tools](#tools)). Hold and drop are not built yet; see `docs/feature-crisis.md`.

## Roadmap

- [ ] Character stat cards
- [ ] Turn and activation tracking
- [ ] Scoring board
- [ ] Hold and drop for Asset, Civilian and VIP tokens
