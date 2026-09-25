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

## Known bugs

**First drag after OrbitControls does not work.** After using the camera (orbit/pan/zoom), the first attempt to drag a character model does not follow the cursor. The model jumps to the final cursor position on mouse release. Subsequent drags work correctly. Root cause is a pointer capture conflict between OrbitControls and the drag handler — OrbitControls calls `setPointerCapture` on the canvas on its `pointerdown`, and the effect persists into the first drag gesture in a way that blocks `pointermove` from reaching the drag handler reliably.

## Roadmap

- [ ] Place character tokens on the mat with correct scale
- [ ] Movement rulers (Short / Medium / Long) as interactive 3D objects
- [ ] Range rulers
- [ ] Crisis card display
- [ ] Character stat cards
- [ ] Turn and activation tracking
