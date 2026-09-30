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

## Tools

Range tools and movement tools work the same way, except for **Place** and bending. Movement tools can bend. Range tools stay straight.

A tool hangs 1" above the table. It measures with its outline, which is drawn straight below it on the table and on the tops of terrain. Walls and steep sides (more than about 60°) are not painted. While you drag or rotate the tool, it stays 1" above the table or above any terrain under its outline. Terrain within 0.5" of the outline already raises the tool.

The tool has two states: **snapped** and **free**.

### Snapped

A tool snaps to a model or to a crisis token the same way. "Model" below also means a token.

The tool is snapped to a model when it spawns while that model is selected. It spawns with one end of its outline touching the edge of the model's base, and it points toward the center of the mat.

A tool also snaps to a model while you drag it: when the pointer moves onto a model (the figure or the base), that model becomes selected. The tool keeps its direction and its bend. It moves so that its end nearer to the base touches the edge of the base. The drag ends there, so moving the pointer further does nothing until you release it. If the drag starts with the pointer already on a model, the tool snaps only after the pointer leaves that model and moves onto a model again.

Dragging a handle rotates the tool around the center of that model's base. The distance between the tool and the base does not change, so the tool keeps touching the base.

The tool stays snapped to the same model when you select another model. It also stays snapped after you press **Place**, because Place moves the model but keeps it touching the tool.

### Free

The tool is free when it spawns while no model is selected. Dragging the tool body makes a snapped tool free.

Dragging a handle rotates the tool around the opposite handle.

### Place

On a range tool, **Place** is in the middle of the tool. It moves the selected model to the end of the tool that is farther from its base.

On a movement tool, **Place** is shown only while the tool is snapped. It is at the end that is not touching the base. It moves the snapped model to that end. After that, the model touches that end, so Place moves to the other end.

Place does not move a token: a token has no base to place, only a position that its own drag sets. Place is disabled while the tool is snapped to a token.

### Bending

A movement tool has a hinge in the middle. The round button on the hinge turns bending on and off.

While bending is on, dragging a handle turns that half of the tool around the hinge. The other half does not move. A half turns at most 90° from straight, the same as the plastic tool. If the half touches the base of a snapped model, turning it takes its end off the base, so the tool becomes free.

While bending is off, the handles rotate the whole tool, as described above. The tool keeps its bend.

The outline of a bent tool is one rectangle for each half, plus the round hinge between them.

## Collider view

**Debug → Colliders** in the toolbar draws every physics collider as lines. A collider is the shape that physics uses for an object. It is not always the same as the visible mesh. Most terrain pieces use a convex hull: the mesh wrapped tight with no dents, so it fills gaps and holes. A model collides only with its base, so the figure can go into terrain.

## Crisis

**Crisis → Secure / Extract** in the toolbar chooses one Secure card and one Extract card. The app puts the two cards on the table next to the scoring board, and their tokens on the mat. Choosing another card removes the old tokens and adds the new ones.

Click a card to open its face image. Click a token to select it. A HUD panel at the bottom shows the actions that token allows: Flip, and for a Secure token, a Control marker (None / Blue / Red) and a damage marker. Drag a movable token to move it. A Zone token also gets a handle that turns it, and shows its Arc outline on the table while selected, the same way a tool shows its outline.

The range and movement tools also snap to a selected token, the same way they snap to a model (see [Tools](#tools)). Hold and drop are not built yet; see `docs/feature-crisis.md`.

## Roadmap

- [ ] Character stat cards
- [ ] Turn and activation tracking
- [ ] Scoring board
- [ ] Hold and drop for Asset, Civilian and VIP tokens
