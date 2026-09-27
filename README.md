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
public/
  wakanda-mat.png  — Wakanda Kingdom game mat (2592×2592 px, from TTS mod cache)
```

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
| Table surface | 48 × 48 units |
| Camera default height | 20 units above the mat |

## Assets

Assets come from the Tabletop Simulator mod **3036795456** (community MCP mod). See `ASSETS.md` for the full inventory: character images, 3D models, terrain pieces, and crisis cards cached locally by TTS.

## Tools

Range tools and movement tools work the same way. Movement tools do not bend yet, so they stay straight.

A tool hangs 1" above the table. It measures with its outline, which is drawn flat on the table below it. While you drag or rotate the tool, it stays 1" above the table or above any terrain under its outline. Terrain within 0.5" of the outline already raises the tool.

The tool has two states: **snapped** and **free**.

### Snapped

The tool is snapped to a model when it spawns while that model is selected. It spawns with one end of its outline touching the edge of the model's base, and it points toward the center of the mat.

Dragging a handle rotates the tool around the center of that model's base. The distance between the tool and the base does not change, so the tool keeps touching the base.

The tool stays snapped to the same model when you select another model. It also stays snapped after you press **Place**, because Place moves the model but keeps it touching the tool.

### Free

The tool is free when it spawns while no model is selected. Dragging the tool body makes a snapped tool free.

Dragging a handle rotates the tool around the opposite handle.

## Roadmap

- [ ] Place character tokens on the mat with correct scale
- [ ] Movement rulers (Short / Medium / Long) as interactive 3D objects
- [ ] Range rulers
- [ ] Crisis card display
- [ ] Character stat cards
- [ ] Turn and activation tracking
