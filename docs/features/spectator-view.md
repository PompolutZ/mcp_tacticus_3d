# Feature: Spectator view

Status: built.

## Goal

A viewer reads the state of each character from the model, without looking at the trays. **Streamer** in the toolbar shows a badge above every model. A second click hides the badges.

The badge is made of the same pieces as the character tray, so it looks the same. From top to bottom, a badge shows:

- the objective tokens the character holds (Extract Asset, Civilian, supply tokens). The same 3D disk as a crisis token on the mat or on the tray card.
- the Damage and Power counters of the tray (`TrayCounters` in `TrayControls.jsx`), without the − and + buttons
- the tokens on the character (conditions, Activated, Dazed, character and tactic tokens), as the same 3D tokens as in the tray's "On" row (`TokenFace.jsx`), with the count when it is above 1

## Squad columns

**Streamer** also shows two HUD columns, one per squad, read-only (`SpectatorColumns.jsx`). My squad is on the left and the opponent's on the right. In the Sandbox and a single player room, Blue (the host) is on the left.

- Look: the comic style of the HUD (`streamer.css`). Each column is a paper box with a border and a hard shadow.
- Header: in the side color (`useSideColors`). It has the player name, the affiliation icon of the side, a yellow "N VP" tag and a "Round N" tag. The icon is the affiliation token image (`affiliationTokenKey`, `characterToken`), its name as the title. Unaffiliated has an icon too; with no affiliation set there is none. It follows `game.affiliations`. The 3D badge has no header, so only the HUD columns show it. VP and the round come from the score markers (`scoreFromMarkers` in `scoreboard/board.js`, the same read as the Cleanup Phase). A VP marker on no spot counts 0 VP. The round is not shown when its marker is on no spot.
- One row per character and grunt, in tray order (the order of the row on the table; a player changes it by swapping two trays, see `character-trays.md`, "Swap trays"). Constructs have no row. A row has: the round portrait, the "Dmg" bar (`damage / stamina`, red; striped on the Injured side), the "Pwr" bar (`power / 10`, power green `--comic-green`; a grunt has none), each with its value. The tokens on the character with counts (the tray's `OnToken`, name as the title) are in a row above the bars, next to the portrait; a character with none has no such row. The crisis tokens it holds are in a fixed slot beside the bars, so the bars line up between rows.
- A character off the mat (`characterOnBoard` is false) has a grey row. It gets the label "KO" once the deploy is over (`setup.deployed`, or a setup with no deploy step). Before that it has no label, because every character is off the mat before the deploy.
- A squad that is still hidden (multiplayer, the opponent's squad before the reveal) shows only its header.
- Layout: the columns start at `--hud-top`. Both columns start at the same top. The Log bubble that shows a new entry draws on top of the right column. They stay clear of the phase buttons at the bottom right and the token panel at the bottom center. A tall squad scrolls inside its column. An open Library pushes the left column inward. An open Log is a tall bubble, so the right column then moves left of it. A column is never wider than the window minus the gutter.
- Size: Settings → "Streamer columns size". See `table-tools.md`.
- The portrait is always the character's own portrait; the second form has no separate state to read.

## How TTS does it

These facts come from mod 3036795456: the `modelUI` XML in the "Scripts" object, the model script inside the "Red Tray Spawner" and "Blue Tray Spawner" (`checkForSecure`, `updateObjective`, `updateStats`, `updateVisible`), and the "UI Controller" object.

- Each model has its own object UI above it. From top to bottom: up to 5 held objective icons and a "Securing" icon in one row, the three Defense values, a Damage bar (`wounds / stamina`), a Power bar (`power / 10`), and a row of status token icons.
- The Damage bar is orange (`#ff9d00`) on the Healthy side and red (`#ff0000`) on the Injured side. The Power bar is the power green (`--comic-green` in `rooms/comic.css`, as the Power phase button). Grunts have no Power bar.
- The height of the UI above the model is a value per character in the `Database` (`UIOffset`, mostly 200 to 300).
- The UI stands upright above the model. It does not follow the camera. The model script sets its turn from the model's turn when the model spawns (`init`) and after each drop (`onDropped`). The bars have one copy for Blue players and one for all other colors (`Bluebars`, `Redbars`), turned 180° from each other.
- A settings panel ("Click to Toggle Visibility") has 4 toggles per player: Extract objective icons, Secure objective icon, character bars, status tokens. The "UI Controller" stores, for each part, the list of player colors that see it. A "Telecasting" mode also shows a portrait image above each model.
- The Securing check: center distance < base diameter / 2 + 1 + token size / 2. So the base edge is less than 1" from the token edge, which is R1 (the tool width).
- The current mod does not show the Securing icon. `updateObjective` sets `contest = false` before the check (comment `-- CB Test`), so it always clears the icon. Both spawners have this code.
- TTS also hides the Securing icon of a Dazed model, and never shows it for Nebula and S.H.I.E.L.D. Agents.

## How the app does it

- `SpectatorBadge.jsx` is a 3D group that stands upright, as in TTS. On every frame it turns around the vertical axis to face the camera, so a viewer can read it from any side of the table. It does not tilt with the camera: a tilted badge looked like a token on the mat when the camera looked down. It holds the tray's pieces at 1.25 times the tray size (`BADGE_SCALE`, picked by look). It gets smaller with distance, as the TTS UI does.
- The held objective tokens are shown at all times. The crisis token disk is `TokenDisk` in `CrisisToken.jsx`, without the drag and the markers. Its textures come from `useTokenMaps`, the same hook as `CrisisToken`, so both share the loaded images.
- The counters are DOM in a drei `<Html transform>`, the same as on the tray. They are always on top of the canvas. So the badge's 3D tokens draw last and without the depth test (`drawOnTop`), and terrain or another model never hides a part of the badge.
- The badge pose is set at frame priority −1, before drei's Html reads it at priority 0. So the counters and the 3D tokens turn in the same frame.
- Tokens on the character are in rows of 4 from the top left. The tray has rows of 6 that overlap, but overlapping tokens without the depth test can draw in the wrong order.
- One toggle for the whole badge, not 4. Only one player uses the app for now (see `docs/features/peer-to-peer.md`).
- The badge sits above the top of the model. The app measures the model height from the model file (`modelTop` in `CharacterModel.jsx`), so it needs no `UIOffset` data. A standee uses its card height.
- The model draws the badge inside its `RigidBody` (the `overlay` prop), so the badge moves with the model, also during a drag, a lift (R) or a Throw. The badge stays straight above the base center when the model tips over.
- The badge is read-only. A player changes Damage, Power and tokens on the tray.
- The badge does not show whether a model contests a Secure token. It gave good players too much help (user, playtest 6). TTS has the same check, but the current mod turns it off (see above). The app has no contest check, so a Dazed model, Nebula and S.H.I.E.L.D. Agents need no special case. `contestRange` stays in `cards.json` as card data.
- No Defense values and no Telecasting portrait.
