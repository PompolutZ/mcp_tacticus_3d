# Feature: Tools on the table

Status: built.

## Goal

The users of the app are TTS players. In the mod, their tools lie on the table: a tool tray with the range and movement tools, the dice tray, the Deploy lines and Rotate Map buttons next to the scoring board. So the app puts the same tools on the table:

- a **tool rack** for each player, in front of their dice tray, with the range and movement tools
- an **Automatic Power Phase** button for each player, next to their Team Tactic tray (it belongs to the squad, not to the tools)
- a **board strip** next to the scoring board, with **Cleanup Phase**, **Deploy Lock** and the mat turn **↺** **↻**

A **Settings** menu lets each player choose the table or the HUD (the toolbar) for each of these. It also lists the keys and the mouse controls of the app.

The list of every TTS tool and button, and what the app has for each, is in `docs/plans/table-tools.md`, "TTS tools and buttons".

## Place on the table

The table is 72" × 76" (`src/table.js`). Numbers below are for the host (+z). The guest is the same with z → −z. The dice trays are at x 27 for both players, so the guest rack keeps x and is turned 180° to face the guest. The places are constants in `src/tabletools/layout.js`.

```
                         x = -20.6 … -18.3                                 x = 20.6 … 33.4
z = 12.6 … 18.0          [board strip]
z = 17.0                                                                   dice tray keys lip
z = 18                   ─────────────── mat edge ───────────────
z = 18.3 … 22.4          [Automatic Power  ]      tactic tray
                         [Phase            ]
z = 17.3 … 27.9                                                            [R1][R2][R3][R4][R5]
                                                                           [L ][M ][S ][T/A]
z = 22.7 … 33.75                                  character trays, Give sources
z = 38                   ─────────────── table edge ─────────────
```

- **Tool rack**, in front of the dice tray of its player: x 20.6 … 33.4 (12.8" wide, centered on the tray), z 17.32 … 27.92 (10.6" deep, starting 0.3" past the keys lip of the tray, which ends at z 17.02). The tools lie along z, as seen from the player, with 5 columns from the owner's left: (R1 chip, L), (R2, M), (R3, S), (R4, T/A chip), (R5). In a column, the first item is on the mat side and the second below it, with a gap of 0.4". The margin is 0.3". The chips are 2" × 1" with the text toward the owner. The columns are spaced so that a 2" chip fits.
- A row of 7 character trays ends at x 20.5, so it does not touch the rack. A row of 8 or more reaches under it. The rack draws above the tray plates, so the tools stay visible.
- The rack is hidden while the roster rows of its side are on the table (the setup, before the squads are shown). A tool that is already on the table stays. The hidden rack takes no pointer, and a tool dropped there does not go back.
- **Automatic Power Phase button**, 7.48" × 1.2" (the size of the other table buttons: 12px font, icon 22px), in the row of the Team Tactic tray, to the owner's left of the tactic plate (host: −x), with a gap of 0.6" from the plate edge: x −16.73 … −9.25, z 19.75 … 20.95 (center z = the tactic tray center). Free space there is x −20.6 … −8.65, z 18.3 … 22.4. 
- **Board strip**, in the corner between the mat and the end of the scoring board on the player's side: x −20.6 … −18.3, z 12.6 … 18.0. Nothing else lies there, also during the setup.
- The start view shows the own rack (`docs/features/key-shortcuts.md`, "Start view").
- A setting never moves a piece. It only shows or hides it. So the two browsers of a room have the same table.

## Tool rack

- A plate like the tray plates. On it, the real-size tool meshes in the player tint, lying along z. They have no physics body.
- Columns from the owner's left: **R1** chip and L, R2 and M, R3 and S, R4 and a **T/A** chip, R5. The first item of a column is on the mat side. Range 1 uses the R2 tool, and Toward / Away is a copy of the long tool, so they have chips, not tools of their own.
- A tool that is on the table is a faint copy on the rack, the same as an empty place on the TTS tray. When R1 is on the table, R2 is faint and the R1 chip is on. When the Toward / Away tool is on the table, its chip is on.
- Hover over a tool: a label with its name and key, for example "Range 3 · key 3".
- **Click**: the same as the toolbar button of that tool. It turns the tool on or off. A new tool snaps to the selected piece, else it spawns free at the table point in the middle of the screen.
- **Drag**: a flat outline of the tool follows the pointer on the table. The release works the same as the tool key at that point. Over a character or a crisis token, the tool snaps to it. Over the table or terrain, the tool spawns free there. Over the rack or off the table, nothing happens. Escape cancels the drag. The outline has the footprint of the tool (the Toward / Away outline is the L shape of its two arms), in the player tint, turned as the tool spawns free. It is dimmed over the own rack, as a hint that a release does nothing, and hidden off the table.
- **Return**: when a move drag of an own tool (not a turn or a bend) ends with the tool center over the own rack, the tool goes back to the rack (it is removed from the table). TTS has this as the tool tray setting "Cleanup", on by default.
- **Which racks.** A multiplayer room shows both racks. A player uses only their own rack. The other rack shows the other player's tools on the table as faint copies, and does not react to the pointer. The Sandbox and a single player room show only the host rack, because that browser has only the host's tools (`ownSide` in `App.jsx`).

## Automatic Power Phase button

- One for each player. It lies flat and faces its owner. Its place is under "Place on the table".
- Look: the green of the Power token (#42B534) with dark text, the Power token image left of the label **Automatic Power Phase**. A lighter green on hover. No player tint. The other player's button in a room looks disabled.
- A press gives Power to the characters of that side on the board, by the rules of `docs/features/round-phases.md`. The TTS button also gives Power to its own player's trays only. In the Sandbox, a player presses both buttons.
- The toolbar **Power** (when it is in the HUD) gives Power to all sides that the browser plays.
- In a multiplayer room, the other player's button is disabled, with the title "Only the Red player presses this." (or Blue).

## Board strip

- One for each player, both the same. It reads like the scoring board and the setup panel: its top faces the table edge (−x).
- Row 1: **Cleanup Phase**. The same action, disabled state and title as the toolbar **Cleanup** (`docs/features/round-phases.md`).
- Row 2: **Deploy Lock** (on or off, the shared `game.deployLine`), **↺** and **↻** (turn the mat 90°).
- These buttons change shared state, so any player can press them.
- **↺** **↻** only show where the toolbar has them: not in a multiplayer room, where the game setup chooses the board edge.

## Settings menu

**Settings** at the right end of the toolbar opens a popup. ✕ or Escape closes it. While it is open, the keys of the table do nothing.

### On the table or in the HUD

One row for each item, with the choice **Table** or **HUD**. The default is **Table**.

| Item | On the table | In the HUD (toolbar) |
|---|---|---|
| Range and movement tools | The tool rack | Groups **Range** (R1–R5) and **Move** (S, M, L, T/A) |
| Automatic Power Phase | The Automatic Power Phase buttons | **Phase** → **Power** |
| Cleanup Phase | Row 1 of the board strip | **Phase** → **Cleanup** |
| Deploy Lock | **Deploy Lock** in the board strip | **Deploy** → **Lock** |
| Mat turn (Sandbox and single player rooms) | **↺** **↻** in the board strip | **Mat** → **↺** **↻**. The map select stays in the toolbar |

- An item is in one place at a time. The keys work the same in both cases.
- A board strip with no rows is not drawn. A row with no buttons is not drawn.
- When the rack is in the HUD, a tool does not go back to the rack. The rack is not on the table.
- The **Mat** group of the toolbar stays while it has the map select (the Sandbox).
- The settings are in localStorage, key `mcp-assist-3d/settings`: `{ tools: { rack, power, cleanup, deployLock, matTurn }, sound: { volume }, bindings }`. Each tool is `'table'` or `'hud'`, the volume a whole number from 0 to 100. `bindings` is `{ [actionId]: [{ code, shift, ctrl, alt, meta, when }] }` with only the actions that differ from the defaults (`{}` is all defaults; an empty list is an action with no key). An unknown action, code or condition is dropped. They belong to the browser, not to the user or the room. A missing or unknown value is the default. When localStorage cannot be read, the defaults apply.

### Sound

A **Sound** section has a volume slider, 0 to 100, default 10. 0 is off. See `sounds.md`.

### Keys and mouse

**Keys:** one row for each action, in the groups Camera, Pieces, Tools, Dice and Other. A row has the bindings as chips (× removes one), **+** to add one, and **Reset** when it differs from the defaults. **Reset all keys** restores every default. The rules are in `docs/features/key-shortcuts.md`, "Changing the keys". **Mouse:** a read-only table from `src/settings/controls.js` (`MOUSE_ROWS`). The source is `docs/features/key-shortcuts.md`.

## Not on the table

These stay in the toolbar: the room and the players, **Library**, **Rolls**, the map select, **Crisis**, **Roster**, **View**, **Debug**, **Settings**. In TTS, some of them are objects on the table (card bags, the Roster Maker, the Automatic Crisis Deployment buttons). The Library, the roster field and the game setup replace them.

## How TTS does it

- Each player has a Tool Tray between the mat and the dice tray, with Range 2–5 and the three movement tools. A player picks a tool up and drops it near a character, then presses **Snap** on the tool. The tray buttons are **Refresh** (all tools back) and **Settings** (three toggles and tool skins).
- **Automatic Power Phase** and **Automatic Cleanup Phase** are HUD buttons at the bottom right, one of each for each player. Power gives Power to the trays of that player. Cleanup cleans the trays of both players.
- The Automatic Crisis Deployment object lies between the scoring board and the table edge. It has the deploy lines toggle (**Off** / **On**) and **Rotate Map**, with buttons to set up the map and the crisis tokens.
- **Mod Settings** is a HUD button that opens a panel with view options: token UI, streamer view, header, dice, characters, timers, top-down view.
