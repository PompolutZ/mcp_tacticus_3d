# Feature: Tools on the table

Status: built.

## Goal

The users of the app are TTS players. In the mod, their tools lie on the table: a tool tray with the range and movement tools, the dice tray, the Deploy lines and Rotate Map buttons next to the scoring board. So the app puts the same tools on the table:

- a **tool rack** for each player, in front of their dice tray, with the range and movement tools
- an **Automatic Power Phase** button for each player, next to their Team Tactic tray (it belongs to the squad, not to the tools)
- a **board strip** next to the scoring board, with **Automatic Power Phase**, **Deploy Lock** and the mat turn **↺** **↻**

A **Settings** menu lets each player choose the table or the HUD (the toolbar) for each of these. It also lists the keys and the mouse controls of the app.

The list of every TTS tool and button, and what the app has for each, is in `docs/plans/playtest/table-tools.md`, "TTS tools and buttons".

## Place on the table

The table is 72" × 76" (`src/table.js`). Numbers below are for the host (+z). The guest is the same with z → −z. The dice trays are at x 27 for both players, so the guest rack keeps x and is turned 180° to face the guest. The places are constants in `src/tabletools/layout.js`.

```
                         x = -20.6 … -18.3                                 x = 20.6 … 33.4
z = 12.6 … 18.0          [board strip]
z = 17.0                                                                   dice tray keys lip
z = 18                   ─────────────── mat edge ───────────────
z = 18.3 … 22.4          [Automatic Power  ]      tactic tray
                         [Phase            ]
z = past the lip                                                           [R1][R2][R3][R4][R5]
                                                                           [L ][M ][S ][T/A]
                                                                           [LOS]
z = 22.7 … 33.75                                  character trays, Give sources
z = 38                   ─────────────── table edge ─────────────
```

- **Tool rack**, in front of the dice tray of its player, centered on it. It starts a gap past the keys lip of the tray. It is narrower than the tray, so a row of 7 character trays does not touch it. The tools lie along z, as seen from the player, with 5 columns from the owner's left: (R1 chip, L, LOS chip), (R2, M), (R3, S), (R4, T/A chip), (R5). In a column, the first item is on the mat side and the second below it. The chips have the text toward the owner. The columns are spaced so that a chip fits. The numbers are constants in `src/tabletools/layout.js`.
- A row of 7 character trays ends at x 20.5, so it does not touch the rack. A row of 8 or more reaches under it. The rack draws above the tray plates, so the tools stay visible.
- The rack is hidden while the roster rows of its side are on the table (the setup, before the squads are shown). A tool that is already on the table stays. The hidden rack takes no pointer, and a tool dropped there does not go back.
- **Automatic Power Phase button**, 5.4" × 1" (the strip row, along z), in row 1 of the board strip of its side: x −20.5 … −19.5 (center −20), z ±12.6 … ±18.0.
- **Cleanup Phase button**, one for the table, 5.4" × 1" along z, in the gap between the scoring board (x edge −19.1) and the mat edge (x −18), the gap is 1.1" deep: x −19.05 … −18.05, z −2.7 … 2.7. Its top faces −x, as the strip.
- **Board strip**, in the corner between the mat and the end of the scoring board on the player's side: x −20.6 … −18.3, z 12.6 … 18.0. Nothing else lies there, also during the setup.
- The start view shows the own rack (`docs/features/key-shortcuts.md`, "Start view").
- A setting never moves a piece. It only shows or hides it. So the two browsers of a room have the same table.

## Tool rack

- A plate like the tray plates. On it, the real-size tool meshes in the player tint, lying along z. They have no physics body.
- Columns from the owner's left: **R1** chip and L, R2 and M, R3 and S, R4 and a **T/A** chip, R5. A **LOS** chip is under L. The first item of a column is on the mat side. Range 1 uses the R2 tool, and Toward / Away is a copy of the long tool, so they have chips, not tools of their own.
- A tool that is on the table is a faint copy on the rack, the same as an empty place on the TTS tray. When R1 is on the table, R2 is faint and the R1 chip is on. When the Toward / Away tool is on the table, its chip is on. The same for the LOS chip and the Line of Sight line.
- Hover over a tool: a label with its name and key, for example "Range 3 · key 3".
- **Click**: the same as the toolbar button of that tool. It turns the tool on or off. A new tool snaps to the selected piece, else it spawns free at the table point in the middle of the screen.
- **Drag**: a flat outline of the tool follows the pointer on the table. The release works the same as the tool key at that point. Over a character, a crisis token or a token on the table (Bifrost, Portal), the tool snaps to it. Over the table or terrain, the tool spawns free there. Over the rack or off the table, nothing happens. The LOS chip is different: the release works only over a character (the looker, see `line-of-sight.md`), and over the table or terrain nothing happens. Escape cancels the drag (key-shortcuts.md). The outline has the footprint of the tool (the Toward / Away outline is the L shape of its two arms), in the player tint, turned as the tool spawns free. It is dimmed over the own rack, as a hint that a release does nothing, and hidden off the table.
- **Return**: when a turn drag of the Line of Sight line ends with the pointer over the own rack, the line is removed. The line never moves by a drag.
- **Return**: when a move drag of an own tool (not a turn or a bend) ends with the tool center over the own rack, the tool goes back to the rack (it is removed from the table). TTS has this as the tool tray setting "Cleanup", on by default.
- **Which racks.** A multiplayer room shows both racks. A player uses only their own rack. The other rack shows the other player's tools on the table as faint copies, and does not react to the pointer. The Sandbox and a single player room show only the host rack, because that browser has only the host's tools (`ownSide` in `App.jsx`).

## Automatic Power Phase button

- One for each player, in row 1 of the board strip. It lies flat like the strip (its top faces −x). Its place is under "Place on the table".
- Look: the green of the Power token (#42B534) with dark text, the Power token image left of the label **Auto Power Phase** (short, to fit the 5.4" strip). A lighter green on hover. No player tint. The other player's button in a room looks disabled.
- A press gives Power to the characters of that side on the board, by the rules of `docs/features/round-phases.md`. The TTS button also gives Power to its own player's trays only. In the Sandbox, a player presses both buttons.
- The HUD **Power** (when it is in the HUD) gives Power to all sides that the browser plays.
- In a multiplayer room, the other player's button is disabled, with the title "Only the Red player presses this." (or Blue).

## Board strip

- One for each player, both the same. It reads like the scoring board and the setup panel: its top faces the table edge (−x).
- Row 1: **Automatic Power Phase** (see above). Only its owner presses it in a multiplayer room.
- Row 2: **Deploy Lock** (on or off, the shared `game.deployLine`), **↺** and **↻** (turn the mat 90°).
- Deploy Lock and the mat turn change shared state, so any player can press them.
- **Cleanup Phase** is not in the strip. It is one button at z 0 between the scoring board and the mat, for both players. The same action, disabled state and title as the toolbar **Cleanup** (`docs/features/round-phases.md`). Any player presses it.
- **↺** **↻** only show where the toolbar has them: not in a multiplayer room, where the game setup chooses the board edge.

## Toolbar

One row at the top, never wrapped. The height is the CSS variable `--hud-top` on the HUD root (`src/useHudTop.js`, a ResizeObserver). The Library, the Log and the notice start under it.

The look is the comic look of the lobby (`rooms.md`, "Lobby"): paper boxes with a black border and a hard shadow. Each part of the bar has the `.comic` class on its own root, so the HUD parts that keep the old look are not touched.

- **Left box:** the yellow **← Lobby** button, then **Room**, the code and a copy icon button (**Copy link**), or **Sandbox** with no icon. In a multiplayer room a black divider and the players follow. The room code box always has the copy icon in a room.
- **Setup** (Sandbox and single player rooms): a box of its own next to the left box, with the **Setup** button.
- **Middle:** the table controls that the settings put in the HUD: **Mat**, **Range** and **Move**, **Deploy**. Each group is a paper box. Its buttons are white, and yellow when on. On a narrow window this part scrolls sideways. The page never scrolls sideways.
- **Right box**, always in this order: **Library**, **Log**, **Streamer**, **Settings**. They are toggle buttons (`aria-pressed`): open is yellow and pressed in, closed is white with a shadow. Library, Log and Streamer can be open together. **Settings** opens the dialog. This box never shrinks, so nothing covers it.
- **Setup** toggles a panel under its button, "Prepare for battle", with the **Crisis** selects and the **Roster** fields. The roster fields have a Blue and a Red plate before them. Escape and a click outside close it.

## Settings menu

**Settings** at the right end of the toolbar opens a popup. ✕ or Escape closes it. While it is open, the keys of the table do nothing.

### On the table or in the HUD

One row for each item, with the choice **Table** or **HUD**. The default is **HUD** for Automatic Power Phase and Cleanup Phase, **Table** for the rest. The two HUD phase buttons appear only in a Versus room, after both squads are on the table, and stay for the rest of the room (`docs/features/round-phases.md`). Saved settings from before the `version` field get Power and Cleanup in the HUD once; after that the saved choice stays.

| Item | On the table | In the HUD |
|---|---|---|
| Range and movement tools | The tool rack | Groups **Range** (R1–R5) and **Move** (S, M, L, T/A) |
| Automatic Power Phase | Row 1 of the board strips | Bottom right corner: **Auto Power Phase** (first) |
| Cleanup Phase | One button between the scoring board and the mat | Bottom right corner: **Auto Cleanup Phase** (after Power) |
| Deploy Lock | **Deploy Lock** in the board strip | **Deploy** → **Lock** |
| Mat turn (Sandbox and solo rooms) | **↺** **↻** in the board strip | **Mat** → **↺** **↻**. The map select stays in the toolbar |

- An item is in one place at a time. The keys work the same in both cases.
- A board strip with no rows is not drawn. A row with no buttons is not drawn.
- When the rack is in the HUD, a tool does not go back to the rack. The rack is not on the table.
- The **Mat** group of the toolbar stays while it has the map select (the Sandbox).
- The settings are in localStorage, key `mcp-assist-3d/settings`: `{ version, tools: { rack, power, cleanup, deployLock, matTurn }, sound: { volume }, spectator: { size }, turn: { step }, labels, rethrowTilted, bindings }`. Each tool is `'table'` or `'hud'`, the volume a whole number from 0 to 100, the spectator size a whole number from 60 to 150 (percent, default 100), the turn step a whole number from 5 to 15 (degrees, default 15), `labels` a boolean (default `false`), `rethrowTilted` a boolean (default `false`, **Throw tilted dice again** in the Dice section, see `docs/features/dice-rolling.md`). `bindings` is `{ [actionId]: [{ code, shift, ctrl, alt, meta, when }] }` with only the actions that differ from the defaults (`{}` is all defaults; an empty list is an action with no key). An unknown action, code or condition is dropped. They belong to the browser, not to the user or the room. A missing or unknown value is the default. When localStorage cannot be read, the defaults apply.

### Debug

A **Debug** section has **Mode** (dev server only) and **Labels** (the piece name and game Size above each terrain piece). Labels shows in every build. Labels is off by default and stored with the settings. The piece under the pointer shows its label with Labels off.

### Labels

A label hides while terrain is between the camera and the label. This covers every label and control drawn in the 3D scene: the terrain labels, the LOS label, the token name and count, the tool rack label, the ruler tool buttons and labels, the boards on the table (setup, Deploy Lock), the dice tray keys and die menu, the character tray controls and counters, and the spectator badge. A hidden label takes no pointer events. A terrain piece does not hide its own label. The check runs about 10 times a second, and only when the camera, a label or the terrain changed. It uses one physics ray from the camera to each label (`scene/LabelOcclusion.jsx`). A board or tray control is checked at its center. A tray does not hide its own keys or die menu.

### Sound

A **Sound** section has a volume slider, 0 to 100, default 10. 0 is off. See `sounds.md`.

### Spectator

A **Spectator** section has a "Spectator columns size" slider, 60 to 150 percent, default 100. It scales the squad columns of the spectator view (`spectator-view.md`, "Squad columns").

### Turn

A **Turn** section has a "Turn step" slider, 5° to 15°, step 1°, default 15°, with the value shown. It is the step of every Q / E press and wheel step on the table: characters and tools, turns and bends. The speed of a held key (90° per second) does not change. The terrain page keeps its own 15° (`maps.md`).

### Keys and mouse

**Keys:** one row for each action, in the groups Camera, Pieces, Tools, Dice and Other. A row has the bindings as chips (× removes one), **+** to add one, and **Reset** when it differs from the defaults. **Reset all keys** restores every default. The rules are in `docs/features/key-shortcuts.md`, "Changing the keys". **Mouse:** a read-only table from `src/settings/controls.js` (`MOUSE_ROWS`). The source is `docs/features/key-shortcuts.md`.

## Recovery

- The 3D view sits in an error boundary (`src/crash/SceneBoundary.jsx`). An error in the scene is logged as `[scene error]`, and the view mounts again with a new Physics world. The table state is read again from the document. The page does not turn black.
- Three errors within 10 seconds show a "Reload" button instead of a loop.
- The first uncaught error, unhandled rejection or scene error is logged as `[first error]` (`src/crash/errors.js`). After the first Rapier fault every call fails, so the first error shows the trigger.
- A body call from a listener, an effect or peer data first checks `liveBody(world, body)` (`src/physics.js`). A removed body is skipped.
- A component clears its body refs on unmount, and cancels its running drag.

## Not on the table

These stay in the toolbar: the room and the players, **Library**, **Log**, the map select, **Setup** (**Crisis**, **Roster**), **Streamer**, **Settings**. In TTS, some of them are objects on the table (card bags, the Roster Maker, the Automatic Crisis Deployment buttons). The Library, the roster field and the game setup replace them.

## How TTS does it

- Each player has a Tool Tray between the mat and the dice tray, with Range 2–5 and the three movement tools. A player picks a tool up and drops it near a character, then presses **Snap** on the tool. The tray buttons are **Refresh** (all tools back) and **Settings** (three toggles and tool skins).
- **Automatic Power Phase** and **Automatic Cleanup Phase** are HUD buttons at the bottom right, one of each for each player. Power gives Power to the trays of that player. Cleanup cleans the trays of both players.
- The Automatic Crisis Deployment object lies between the scoring board and the table edge. It has the deploy lines toggle (**Off** / **On**) and **Rotate Map**, with buttons to set up the map and the crisis tokens.
- **Mod Settings** is a HUD button that opens a panel with view options: token UI, streamer view, header, dice, characters, timers, top-down view.
