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

`apps/api/` is the API (Hono, TypeScript). The tree below is under `apps/web/`.

```
src/
  Root.jsx         — the page of the URL hash: lobby, room or Sandbox
  App.jsx          — one table: Canvas setup, camera position, the table state
  rooms/           — rooms in localStorage, the saved table, the files to load first
  components/
    Scene.jsx      — 3D scene: space, table, mat, lights
  assets/          — models and textures. Load them with assetUrl('path') from assets/index.js
    wakanda-mat.webp — Wakanda Kingdom game mat (2592×2592 px, from TTS mod cache)
public/
  _headers         — Netlify cache headers
  draco/           — Draco decoder for compressed GLB files
scripts/
  migrate-terrain.mjs — copies a map (mat and terrain) from the TTS mod to src/assets. See apps/web/scripts/README.md
```

Put new models and textures in `src/assets/`, not in `public/`. Vite adds a content hash to their file names, so browsers can cache them forever (see `public/_headers`). Files in `public/` keep their names, so browsers must check them again on every load.

## Running locally

Node 24 and pnpm 12 (`.node-version` and `packageManager` set them; pnpm downloads the pinned version).

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts the web app and the API. The API listens on port 8787. Vite forwards `/api/*` to it, without the `/api` prefix. `http://localhost:5173/api/health` shows the API status.

`pnpm test` and `pnpm typecheck` check the API.

Open `http://localhost:5173`. The app opens on the lobby. Open the Sandbox or a room to get the table. You can orbit, zoom, and pan with the mouse.

## Lobby, rooms and Sandbox

The app opens on the **lobby**. It lists the rooms of this browser, the last changed room first. Each tile shows the map card, the map name, the room code and the time of the last change. Click a tile to enter the room. **Blue** and **Red** show that roster of the room in the roster popup. **Delete** removes a room after a confirm.

**+ New room** opens a dialog. **Random map** is on by default: the app picks the map when it creates the room. Turn it off to choose the map in a carousel of map cards. Paste the MCT codes of the rosters into **Blue roster** and **Red roster**. Red is optional: the toolbar can load it later. The game setup needs both rosters. A warning box names the characters without a 3D model and the Team Tactic cards without an image, because the app cannot show them. **Create room** works when the Blue code has a known card, and it enters the new room.

In a **room**, you are the Blue player. The map and the Blue roster are fixed, so the toolbar has no map picker and only the Red roster field. That field replaces or removes the Red roster of the room. The room saves itself in the browser storage (`localStorage`): the map, the rosters, the characters with their positions, damage and tokens, the crisis cards and tokens, the tactic cards and the score. Dice and tools are not saved. The loading screen stays until the map and the models of both rosters are in.

The **Sandbox** is the free table: map picker and both roster fields. Nothing in it is saved.

**← Lobby** at the start of the toolbar goes back to the lobby. The Sandbox asks first, because its table is lost. The URL shows the page: `#room=K7Q2-M9XD` for a room, `#sandbox` for the Sandbox, so the browser back button works. See `docs/feature-rooms.md`.

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

Click a piece to select it. Click it again to deselect it. One character, one crisis token, one unlocked terrain piece (see [Terrain lock](#terrain-lock)), the range tool, the movement tool and the Toward / Away tool can be selected at the same time. Selecting another character deselects the old character. The same is true for a token and a terrain piece. A click on the empty table deselects the character, the token and the terrain piece. Escape deselects everything and removes the selected tools from the table.

A tool measures against the character or token selected last. A new tool also snaps to it. Place moves the selected character, also when a token was selected after it.

## Terrain lock

Every terrain piece is locked when its map is loaded. A locked piece does not react to the pointer: a click on it is a click on the empty table, and a piece behind it can still be clicked. Press **L** with the pointer over a terrain piece to unlock it, as in TTS. Press L again to lock it. A HUD message shows the new state, because a locked piece looks the same as an unlocked one.

An unlocked piece shows a white outline under the pointer. Click it to select it. Press **Delete** with the pointer over it to remove it. A model that stands on a removed piece falls to what is under it. A new map brings its own terrain, all locked again. Unlocked pieces cannot be moved yet.

## Tools

Range tools and movement tools work the same way, except for bending and [Throw / Push](#throw--push). Movement tools can bend and throw. Range tools stay straight. The R1 tool snaps with a corner, not an end, and it has two Place buttons, see [Range 1](#range-1).

A tool hangs 1" above the table. It measures with its outline, which is drawn straight below it on the table and on the tops of terrain. Walls and steep sides (more than about 60°) are not painted. While you drag or rotate the tool, it stays 1" above the table or above any terrain under its outline. Terrain within 0.5" of the outline already raises the tool.

Key **0** removes every tool from the table, as in the mod. Key **6** is the [Toward / Away](#toward--away) tool.

The tool has two states: **snapped** and **free**.

### Snapped

A tool snaps to a model or to a crisis token the same way. "Model" below also means a token.

The tool is snapped to a model when it spawns while that model is selected. With a character and a token selected, it snaps to the one selected last. A tool key with the pointer over a model selects that model and spawns the tool snapped to it, so the model does not have to be selected first. The tool spawns with one end of its outline touching the edge of the model's base, and it points toward the center of the mat.

A free tool also snaps to a model while you drag it: when the pointer moves onto a model (the figure or the base), that model becomes selected. The tool keeps its direction and its bend. It moves so that its end nearer to the base touches the edge of the base. The drag ends there, so moving the pointer further does nothing until you release it. If the drag starts with the pointer already on a model, the tool snaps only after the pointer leaves that model and moves onto a model again.

Dragging a snapped tool rotates it around the center of that model's base. You can grab any part of the tool. The distance between the tool and the base does not change, so the tool keeps touching the base. The TTS mod does the same, but it points the tool at the pointer. The app turns the tool as far as the pointer turns around the base, so the grabbed spot stays under the pointer and the tool does not jump at the start.

Only a free tool snaps during a drag. A drag that starts on a snapped tool never snaps it to another model, also when the pointer passes over one. So models that stand close together do not take the tool from each other.

The tool stays snapped to the same model when you select another model. It also stays snapped when **Place** moves that model, or when you drag it with Place on, because the base keeps touching the tool. When the model leaves the table (a removed character, or a token that a character takes), the tool is free.

### Free

The tool is free when it spawns while no model is selected and the pointer is not over a model. Turning a snapped tool with Q / E makes it free. The TTS mod has a Snap / Unsnap button on the tool for this, and no key.

Dragging a free tool moves it.

**Q** and **E** turn the tool under the pointer, or the tool you drag, 15° around its center, as in TTS. Hold the key to keep turning. Q turns it counter-clockwise and E clockwise, seen from above. The center of a movement tool is its hinge, and the tool keeps its bend. While a drag turns a snapped tool or bends a tool, Q and E do nothing. They turn characters the same way.

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

### Toward / Away

When a character moves Toward or Away from another piece, the rules (p14–15) use a movement tool bent to 90°. Key **6** and **Move → T/A** in the toolbar turn this tool on and off. It is a copy of the long movement tool, and it is always bent to a right angle. It has no Bend, Place or Throw button. Drag and Q / E work the same as on the other tools.

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

Range 1 has no tool of its own. The short side of every range tool is 1", so the width of a range tool measures range 1. **R1** in the toolbar spawns the Range 2 tool, the shortest range tool, and uses it this way. The TTS mod does the same with its "Snap 1" button.

The R1 tool snaps with a corner. The base touches one long side of the tool at its corner, so the tool lies across the line from the base. Along that line, the tool is 1" wide.

- Spawned while a model is selected: the tool is on the side of the base toward the mat center.
- Snapped during a drag: the tool keeps its direction. It moves so that its corner nearer to the base touches the base.
- Dragging the snapped tool rotates it around the base center, the same as other tools. So the corner moves along the base edge. Turn the tool until the corner points at the other model.

While the R1 tool is snapped and another model is selected, the outline is green when that model is within range 1 of the snapped model, and red when it is not. The app measures this edge to edge, seen from above. Touching the tool is not enough, because the tool is 3" long: a base can touch its far end and still be more than 1" away.

The R1 tool is the Range 2 tool, so it has two Place buttons while it is snapped:

- **Place 1** is at the snapped corner, on the half of the tool next to the other long side. It moves the selected character across the tool, so its base touches the other long side at the same corner. Its base edge is then 1" from the snapped base edge. If the selected character is the snapped model, it now touches the other long side, so the tool stays snapped to it. Place 1 does not stay on.
- **Place 2** is at the far end. It works the same as [Place](#place) on other tools. If it moves the snapped model, the base is no longer at a corner, so the tool becomes free.

## Debug mode

**Debug → Mode** in the toolbar turns debug mode on. It is only in the dev server (`pnpm dev`). `pnpm --filter web build` leaves it out.

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

## Spectator view

**View → Spectator** in the toolbar shows a badge above every model, for viewers who do not look at the trays. A badge shows the objective tokens the character holds, the Secure tokens within range 1 of its base, the Damage and Power counters, and the tokens on the character. It uses the same counters and tokens as the character tray, it faces the camera, and it is read-only. Click the button again to hide the badges. See `docs/feature-spectator-view.md`.

## Roster

**Roster** in the toolbar has one text field for each player. In a room, the rosters come from the new room dialog, so only the Red field shows. It replaces or removes the Red roster of the room. Paste an MCT code and press Enter. On a Jarvis roster page, the **Copy MCT code** button gives the code. A code from the TTS mod works too. A new load replaces the old roster of that player. **×** next to the field removes the roster.

The cards lie on the player's side of the table, in the area of the character trays. Row 1 has the characters. Row 2 has the Team Tactic cards. The Secure and Extract cards lie next to the scoring board, on the player's side (see [Game setup](#game-setup)). An Infinity Gem shows as a text line on its character card. The cards are locked. They have no physics body, so a tool key over a card works as over the empty table.

Click a card with an image to open the roster popup. The title shows whose roster it is: Blue or Red player. The popup has 3 tabs: Characters, Tactic cards and Crisis cards. Each tab shows its cards in a loop: after the last card comes the first. The previous and the next card show at the sides, smaller and darker. Drag the card, click a side card, click **‹** / **›**, or press the left and right arrow keys to see the other cards. The popup opens on the tab and the card that you clicked. Click a character card or a Team Tactic card, or its **Flip** button, to see its other side. A character with a second form card, for example Emma Frost, has a switch under its card to show that card. **Open this roster on Jarvis** under the title opens the roster in the Jarvis roster validator. **Open on Jarvis** under a card opens the page of that card on Jarvis. Both open in a new browser tab. Escape, **×** or a click next to the cards closes the popup.

A card that the app has no image for shows as a plate with its name and MCT code. A character without a model also shows "No model". A click on a plate shows an error message and does not open the popup.

A code that the app does not know shows in a message, and the other cards load. A text with no known code shows an error, and the old roster stays. The app does not check the roster: not the counts, and not Banned, Restricted or Rotated cards. Players check it. See `docs/feature-roster.md`.

## Game setup

With both rosters loaded, buttons on the table guide the players from the roll off to round 1. The buttons lie flat on the table and read the same way as the scoring board. The panel between the scoring board and the table edge says what to do in each step.

The crisis cards of each roster lie in 2 rows next to the scoring board, parallel to it: Secure at the table edge, Extract toward the mat.

1. Players roll off with the dice trays. The app does not track the roll off.
2. The winner has Priority. Between their Secure and Extract rows, they click **Use … player Secures** (blue) or **Use … player Extracts** (red). The app draws 2 cards of that deck at random.
3. The 2 drawn cards lie in line with the scoring board. The other player clicks **Use** next to one of them. The app draws 2 cards of the other type from the other player's deck. The player with Priority clicks **Use** next to one of them.
4. The player without Priority chooses the Maximum Threat on the panel: the threat of the Secure card or of the Extract card.
5. The player with Priority turns the mat with **↺** / **↻** until their deployment edge faces them, and clicks **Select board edge**. The two cards go to the ends of the scoring board, and their tokens to the mat. When red has Priority, the tokens turn a half turn, because the bottom of the card map is the side of the player with Priority.
6. Each player clicks **Select squad**, then clicks characters and Team Tactic cards of their roster to add or remove them. A card in the squad has a yellow frame. The panel shows the squad threat and the Team Tactic count. Then the player clicks **Ready**. It does not work when the squad threat is above the Maximum Threat. When both players are Ready, the trays, the models and the Team Tactic cards of both squads go on the table at the same time.

**Restart setup** on the panel starts again. A new roster also starts again. A restart removes the squads and the crisis cards that the setup put on the table, after a confirm. See `docs/feature-setup-game.md`.

## Roadmap

- [ ] Character stat cards
- [ ] Turn and activation tracking
- [ ] Scoring board
- [ ] Hold and drop for Asset, Civilian and VIP tokens
