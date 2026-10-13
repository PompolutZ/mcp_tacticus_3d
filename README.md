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

`apps/api/` is the API (Hono, TypeScript). `infra/` is the AWS CDK app that deploys the API (see `infra/README.md`). The tree below is under `apps/web/`.

```
src/
  Root.jsx         — the page of the URL hash: lobby, room or Sandbox
  App.jsx          — one table: Canvas setup, camera position, the table state
  Table.jsx        — opens the table document of a room or the Sandbox, then mounts App
  net/             — the Yjs document of a table: layout, stores, React hooks
  rooms/           — room records in localStorage, the table document in IndexedDB, the files to load first
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

Open `http://localhost:5173`. The app opens on the lobby. Open the Sandbox or a room to get the table. You can orbit, zoom, and pan with the mouse.

`pnpm test` runs the tests of the API (Vitest) and of the web app (`node --test`). `pnpm --filter web test` runs only the web tests. `pnpm typecheck` checks the API.

### Lint and format

- `pnpm lint` runs oxlint on the whole repo. It fails on errors, not on warnings.
  `no-undef` is on (browser globals in `apps/web/src`, Node elsewhere).
- `pnpm format` formats the code with oxfmt. `pnpm format:check` only checks it.
- `pnpm fallow` finds unused files, exports and dependencies, copied code and complex functions. The config is `.fallowrc.json`. It exits 1 while complexity findings remain.
- The Oxc extension adds both to VS Code.
- To let `git blame` skip the commit of the first format, run once: `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

### Login

Login needs these settings (see `apps/api/.env.example`):

- `apps/api/.env`: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`. `SESSION_SECRET` is optional. Without it the API uses a fixed dev value.
- `apps/web/.env.local`: `VITE_DISCORD_CLIENT_ID`. Git ignores both files.
- The Discord application needs the redirect `http://localhost:5173/`.

Without the Discord values, the **Log in with Discord** button is hidden or answers 503. The **Dev login** field in the lobby header always works in dev. Type a name, and use another name in another browser to get a second user.

The user menu has **Log out** and **Delete account**. **Delete account** asks first, then deletes the account, the room that the user hosts, and the local copies of the user's multiplayer tables. The **Privacy** link in the lobby footer opens `http://localhost:5173/privacy.html`, a static page.

### Dev Mongo

The API uses the memory store by default. A restart of the API empties it, and the testers are logged out. To keep the users, run a Mongo in Docker and set `STORE=mongo` in `apps/api/.env`:

```bash
pnpm --filter api db:up      # starts mongo:8 with a named volume
pnpm --filter api db:down    # stops it, keeps the data
docker compose -f apps/api/compose.yaml down -v   # deletes the data
```

The API refuses an Atlas connection string. Local dev uses only a local Mongo.

`pnpm --filter api test:mongo` runs the Mongo tests. It needs Docker running. It starts its own `mongo:8` container and removes it at the end.

### Multiplayer rooms

A multiplayer room is on the API, so it needs login. To try one on one Mac, use two browsers with two dev logins:

1. In the first browser, log in with the **Dev login** field as `alice`. **+ New room** → **Multiplayer**, a side and a roster → **Create room**.
2. Click **Copy link** in the room toolbar or on the lobby tile.
3. In the second browser, log in as `bob` and open the link. The join page shows the map and the host's roster. Paste a roster and click **Join**.

4. Open the room in both browsers. Within a few seconds the two browsers connect over WebRTC. Both toolbars show "Connected".

Start the local TURN server first with `pnpm --filter api turn:up` (needs Docker). Stop it with `pnpm --filter api turn:down`. `turn:pause` and `turn:resume` freeze and release it. Browsers on one Mac often cannot reach each other directly, and then the data goes through this server. Add `?relay` to both room links to force all data through it. Both toolbars should still show "Connected". The flag works in `pnpm dev` only.

#### Reconnecting

After a dropped network or a sleeping laptop, both browsers show "Reconnecting" and connect again by themselves. A drop makes a new connection. Changes made during the drop show on the other screen after it. To test a drop on one Mac, open the room with `?relay` in both browsers, then run `pnpm --filter api turn:pause` (freezes the TURN server), wait, and `pnpm --filter api turn:resume`. A long drop: `turn:down`, then `turn:up`, then **Try again** if a toolbar shows "Could not connect". Do not restart the API during a test.

Each browser logs `table fingerprint <hash>` once per connection, after 2 s with no change. When both consoles show the same hash, no change is lost.

Two more flags test a bad network, in `pnpm dev` only. They act on the browser that has the flag, on what it receives from the other player's live moves. `?drop=30` drops 30 % of the live packets. `?delay=150` delays them by 150 ms. Use both: `?drop=30&delay=150`. The pieces still end at the same place on both screens.

The console of each browser logs the data of the connection: one `console.info` line every 10 minutes, when a connection ends, and on **← Lobby**. The line has the bytes sent and received, the minutes, and direct or relayed, for the connection and for all connections of the open table.

Either player can open the room first. The player who opens it first sees "Waiting" until the other opens it.

Discrete changes show on the other screen at once: mat turn, crisis cards, tokens, new characters, damage and power.

Moves show live. When one player drags a model, a tool, a crisis token, a character token on the table, a pile, a tactic card or a score marker, the other player sees it move, with a footprint on the table. A piece that one player moves cannot be moved by the other player until it rests. If both start at the same moment, one of them keeps the piece. The other player's cursor shows as a ring on the table, in the color of that side. The dice are shared: each player rolls in their own tray, and the other player sees the dice fly and land. The **Rolls** button of the toolbar opens the roll history on the right side of the screen: the newest roll first, with the side color, the time and the face icons.

Each player uses only their own tools. The other player's tools show on the table in the other color. They have no buttons, and a click goes to the piece below. The tools are saved with the room: after **← Lobby** and a new open, they are where they were. The other player's selected character or crisis token has an outline in their color (blue or red). Their selected tool shows the green or red footprint, and the piece that their turning range tool measures has the green or red outline, as on their screen.

A player who has the Red seat sees the Red side at the bottom. Space returns to this view.

The room toolbar shows both seats: avatar and name, and "You" at your own seat. The text at the other player's seat is the connection status:

| Text | Meaning |
|---|---|
| (none) with "Free seat" | The other seat is free, or that player has not opened the room yet |
| Waiting | The other player's page is not seen. The browser asks the API every 2 seconds |
| Connecting | The browsers exchange the offer and the answer |
| Connected | The data channel is open. Changes sync |
| Could not connect | The answer came, but the browsers could not connect. A network blocks peer-to-peer. Click **Try again** |
| Not here | 15 minutes with no sign of the other player. The browser stopped asking. Click **Try again** |

When the other player reloads or closes the page, the status goes back to "Waiting". It shows "Connected" again when the page is back.

If the other player's app version differs, a warning shows. In a dev build, `?build=test` in the page URL sends a fake version, to test it: `http://localhost:5173/?build=test#room=<code>`.

While the two browsers are connected, only the host writes the table to the API (60 seconds after a change). The guest writes on **← Lobby** and when the tab is hidden. Alone in the room, each player writes 60 seconds after a change, on **← Lobby**, and when the tab is hidden. A user hosts one room at a time. To host a new one, delete the old one in the lobby.

With the memory store, a restart of the API deletes the rooms. With the dev Mongo (see above), the rooms stay.

## Lobby, rooms and Sandbox

The app opens on the **lobby**. It lists the single player rooms of this browser and, when you are logged in, your multiplayer rooms, the last changed room first. Each tile shows the map card, the map name, the room code and the time of the last change. A multiplayer tile also shows the players, and **Delete** shows only for the host. Click a tile to enter the room. **Blue** and **Red** show that roster of the room in the roster popup. **Delete** removes a room after a confirm.

**+ New room** opens a dialog. With login on, it has a choice: **Single player** (a room in this browser) or **Multiplayer** (a room on the server, see above). **Random map** is on by default: the app picks the map when it creates the room. Turn it off to choose the map in a carousel of map cards. Paste the MCT codes of the rosters into **Blue roster** and **Red roster**. Red is optional: the toolbar can load it later. The game setup needs both rosters. A warning box names the characters without a 3D model and the Team Tactic cards without an image, because the app cannot show them. **Create room** works when the Blue code has a known card, and it enters the new room.

In a **single player room**, you are the Blue player. The map and the Blue roster are fixed, so the toolbar has no map picker and only the Red roster field. That field replaces or removes the Red roster of the room. The room saves itself in the browser storage. The room record (map, rosters, dates) is in `localStorage`. The table is a Yjs document in IndexedDB: the characters with their positions, damage and tokens, the crisis cards and tokens, the tactic cards and the score. The shelf of each dice tray is saved. Dice in the well and in the air are not. The tools are. The loading screen stays until the map and the models of both rosters are in.

The **Sandbox** is the free table: map picker and both roster fields. Nothing in it is saved.

**← Lobby** at the start of the toolbar goes back to the lobby. The Sandbox asks first, because its table is lost. The URL shows the page: `#room=K7Q2-M9XD` for a room, `#sandbox` for the Sandbox, so the browser back button works. See `docs/features/rooms.md`.

## Scene units

1 Three.js unit = 1 inch.

| Object | Dimensions |
|---|---|
| Game mat | 36 × 36 units (36" × 36", matching the physical MCP mat) |
| Table surface | 72 × 76 units: 72 along x, 76 along z (between the players). The TTS table is 72 × 48. The extra depth holds the trays, the tactic trays and the rack band of each player (`docs/features/table-tools.md`) |
| Camera default height | 20 units above the mat |

## Assets

Assets come from the Tabletop Simulator mod **3036795456** (community MCP mod). See `ASSETS.md` for the full inventory: character images, 3D models, terrain pieces, and crisis cards cached locally by TTS.

## Table sides

One half of the table is blue and the other half is red. Blue is the side of the player who won the priority roll-off. Red is the other player's side. Blue is at the bottom of the default view.

In game setup, the player with priority chooses the edge of the mat to deploy from. **↺ / ↻** turn the mat. They are in the board strip on the table, or in the toolbar under **Mat** (the choice is in **Settings**). They turn the mat and all its terrain 90° around the mat center. Turn it until the chosen edge faces the blue side. Models and tools do not turn with the mat.

## Settings

**Settings** at the right end of the toolbar opens a popup. For the range and movement tools, Power Phase, Cleanup Phase, Deploy Lock and the mat turn, choose **Table** or **HUD** (the toolbar). The default is Table. A choice applies at once and stays in this browser. It does not change the table of the other player. The popup also lists the keys and the mouse controls.

## Selection

Click a piece to select it. Click it again to deselect it. A drag moves a model, a tool or a crisis token that can move at once, and selects it. A piece that is already selected stays selected. One character, one crisis token, one unlocked terrain piece (see [Terrain lock](#terrain-lock)), the range tool, the movement tool and the Toward / Away tool can be selected at the same time. Selecting another character deselects the old character. The same is true for a token and a terrain piece. A click on the empty table deselects the character, the token and the terrain piece. Escape deselects everything and removes the selected tools from the table.

A tool measures against the character or token selected last. A new tool also snaps to it. See [Tools](#tools).

## Overlapping models

A model passes through other models. Drag it through one: physics does not push either apart. Terrain still stops a model, and tokens do not.

While two bases overlap by more than 0.01" at the same height, the model that moved last is red, with a red outline. Its place is probably wrong. A move is a drag, or a Throw or Push. The red goes away when the bases no longer overlap. A lifted model (R) is at another height, so it has no mark.

The red shows during a drag, as soon as the base enters another model. A drag that ends inside a model puts the model back at the last place of the drag where it overlapped nothing, or at its start. Throw and Push can still end inside a model. Then the mark shows.

## Terrain lock

Every terrain piece is locked when its map is loaded. A locked piece does not react to the pointer: a click on it is a click on the empty table, and a piece behind it can still be clicked. Press **L** with the pointer over a terrain piece to unlock it, as in TTS. Press L again to lock it. A HUD message shows the new state, because a locked piece looks the same as an unlocked one.

The **Labels** chip of the toolbar is on at the start. Each terrain piece then shows a label above it: "Tree - Size 2 - (L)ocked" or "Tree - Size 2 - Un(L)ocked" (a piece with no Size: "Tree - (L)ocked"). The label follows the lock state. With Labels off, only the piece under the pointer shows its label, locked or not. A model that you drag shows a light grey footprint on the table, and a red one over another model.

Every piece that you can use with the pointer shows a white outline under it: a model, a tool, a token, a card, a marker, a supply pile, a tool of your rack, a die on your shelf, an unlocked terrain piece. Locked terrain, the table, the mat and the other player's rack and dice tray have none. Click an unlocked piece to select it. Press **Delete** with the pointer over it to remove it. A model that stands on a removed piece falls to what is under it. A new map brings its own terrain, all locked again. Unlocked pieces cannot be moved yet.

## Tools

Range and movement tools (R1 to R5, Short to Long, Toward / Away) measure and place characters. See [docs/features/range-movement-tools.md](docs/features/range-movement-tools.md).

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

The range and movement tools also snap to a selected token, the same way they snap to a model (see [Tools](#tools)). Hold and drop are not built yet; see `docs/features/crisis.md`.

## Spectator view

**View → Spectator** in the toolbar shows a badge above every model, for viewers who do not look at the trays. A badge shows the objective tokens the character holds, the Secure tokens within range 1 of its base, the Damage and Power counters, and the tokens on the character. It uses the same counters and tokens as the character tray, it faces the camera, and it is read-only. Click the button again to hide the badges. See `docs/features/spectator-view.md`.

## Roster

**Roster** in the toolbar has one text field for each player. In a room, the rosters come from the new room dialog, so only the Red field shows. It replaces or removes the Red roster of the room. Paste an MCT code and press Enter. On a Jarvis roster page, the **Copy MCT code** button gives the code. A code from the TTS mod works too. A new load replaces the old roster of that player. **×** next to the field removes the roster.

The cards lie on the player's side of the table, in the area of the character trays. Row 1 has the characters. Row 2 has the Team Tactic cards. The Secure and Extract cards lie next to the scoring board, on the player's side (see [Game setup](#game-setup)). An Infinity Gem shows as a text line on its character card. The cards are locked. They have no physics body, so a tool key over a card works as over the empty table.

Click a card with an image to open the roster popup. The title shows whose roster it is: Blue or Red player. The popup has 3 tabs: Characters, Tactic cards and Crisis cards. Each tab shows its cards in a loop: after the last card comes the first. The previous and the next card show at the sides, smaller and darker. Drag the card, click a side card, click **‹** / **›**, or press the left and right arrow keys to see the other cards. The popup opens on the tab and the card that you clicked. Click a character card or a Team Tactic card, or its **Flip** button, to see its other side. A character with a second form card, for example Emma Frost, has a switch under its card to show that card. **Open this roster on Jarvis** under the title opens the roster in the Jarvis roster validator. **Open on Jarvis** under a card opens the page of that card on Jarvis. Both open in a new browser tab. Escape, **×** or a click next to the cards closes the popup.

A card that the app has no image for shows as a plate with its name and MCT code. A character without a model also shows "No model". A click on a plate shows an error message and does not open the popup.

A code that the app does not know shows in a message, and the other cards load. A text with no known code shows an error, and the old roster stays. The app does not check the roster: not the counts, and not Banned, Restricted or Rotated cards. Players check it. See `docs/features/roster.md`.

## Game setup

With both rosters loaded, buttons on the table guide the players from the roll off to round 1. The buttons lie flat on the table and read the same way as the scoring board. The panel between the scoring board and the table edge says what to do in each step.

The crisis cards of each roster lie in 2 rows next to the scoring board, parallel to it: Secure at the table edge, Extract toward the mat.

1. Players roll off with the dice trays. The app does not track the roll off.
2. The winner has Priority. Between their Secure and Extract rows, they click **Use … player Secures** (blue) or **Use … player Extracts** (red). The app draws 2 cards of that deck at random.
3. The 2 drawn cards lie in line with the scoring board. The other player clicks **Use** next to one of them. The app draws 2 cards of the other type from the other player's deck. The player with Priority clicks **Use** next to one of them.
4. The player without Priority chooses the Maximum Threat on the panel: the threat of the Secure card or of the Extract card.
5. The player with Priority turns the mat with **↺** / **↻** until their deployment edge faces them, and clicks **Select board edge**. The two cards go to the ends of the scoring board, and their tokens to the mat. When red has Priority, the tokens turn a half turn, because the bottom of the card map is the side of the player with Priority.
6. Each player clicks the **+** button on the characters and Team Tactic cards of their roster to add or remove them (or **Add to squad** in the roster popup). A card in the squad has a yellow frame. The panel shows the squad threat and the Team Tactic count. Then the player clicks **Squad ready**. It does not work when the squad threat is above the Maximum Threat. When both players are Ready, the trays, the models and the Team Tactic cards of both squads go on the table at the same time.

**Restart setup** on the panel starts again. A new roster also starts again. A restart removes the squads and the crisis cards that the setup put on the table, after a confirm. See `docs/features/setup-game.md`.

## Roadmap

- [ ] Character stat cards
- [ ] Turn and activation tracking
- [ ] Scoring board
- [ ] Hold and drop for Asset, Civilian and VIP tokens

## Known bugs

- [x] A model that you drag must not move anything else on the table. Found on 2026-10-09, fixed on 2026-10-10. A dragged model passes through other models, and can be dropped inside one. Both stay where they are. It does not pass through terrain, and it can overlap tokens. The fix also changes step 9 of `docs/plans/implement-backend.md`: rule 6 of "Moving objects" in `docs/features/peer-to-peer.md` (a moving body pushes shared bodies) goes away.
