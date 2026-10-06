# Feature: Spectator view

Status: built on 2026-10-06. Not checked in a browser yet.

## Goal

A viewer reads the state of each character from the model, without looking at the trays. **View → Spectator** in the toolbar shows a badge above every model. A second click hides the badges.

The badge is made of the same pieces as the character tray, so it looks the same. From top to bottom, a badge shows:

- the objective tokens the character holds (Extract Asset, Civilian, supply tokens), and the Secure tokens within range 1 of its base. The same 3D disk as a crisis token on the mat or on the tray card.
- the Damage and Power counters of the tray (`TrayCounters` in `TrayControls.jsx`), without the − and + buttons
- the tokens on the character (conditions, Activated, Dazed, character and tactic tokens), as the same 3D tokens as in the tray's "On" row (`TokenFace.jsx`), with the count when it is above 1

## How TTS does it

These facts were found on 2026-10-06 in mod 3036795456: the `modelUI` XML in the "Scripts" object, the model script inside the "Red Tray Spawner" and "Blue Tray Spawner" (`checkForSecure`, `updateObjective`, `updateStats`, `updateVisible`), and the "UI Controller" object.

- Each model has its own object UI above it. From top to bottom: up to 5 held objective icons and a "Securing" icon in one row, the three Defense values, a Damage bar (`wounds / stamina`), a Power bar (`power / 10`), and a row of status token icons.
- The Damage bar is orange (`#ff9d00`) on the Healthy side and red (`#ff0000`) on the Injured side. The Power bar is green (`#31b32b`). Grunts have no Power bar.
- The height of the UI above the model is a value per character in the `Database` (`UIOffset`, mostly 200 to 300).
- The UI stands upright above the model. It does not follow the camera. The model script sets its turn from the model's turn when the model spawns (`init`) and after each drop (`onDropped`). The bars have one copy for Blue players and one for all other colors (`Bluebars`, `Redbars`), turned 180° from each other.
- A settings panel ("Click to Toggle Visibility") has 4 toggles per player: Extract objective icons, Secure objective icon, character bars, status tokens. The "UI Controller" stores, for each part, the list of player colors that see it. A "Telecasting" mode also shows a portrait image above each model.
- The Securing check: center distance < base diameter / 2 + 1 + token size / 2. So the base edge is less than 1" from the token edge, which is range 1.
- The current mod does not show the Securing icon. `updateObjective` sets `contest = false` before the check (comment `-- CB Test`), so it always clears the icon. Both spawners have this code.
- TTS also hides the Securing icon of a Dazed model, and never shows it for Nebula and S.H.I.E.L.D. Agents.

## How the app does it

- `SpectatorBadge.jsx` is a 3D group that stands upright, as in TTS. On every frame it turns around the vertical axis to face the camera, so a viewer can read it from any side of the table. It does not tilt with the camera: a tilted badge looked like a token on the mat when the camera looked down. It holds the tray's pieces at 1.25 times the tray size (`BADGE_SCALE`, picked by look). It gets smaller with distance, as the TTS UI does.
- The crisis token disk is `TokenDisk` in `CrisisToken.jsx`, without the drag and the markers. Its textures come from `useTokenMaps`, the same hook as `CrisisToken`, so both share the loaded images.
- The counters are DOM in a drei `<Html transform>`, the same as on the tray. They are always on top of the canvas. So the badge's 3D tokens draw last and without the depth test (`drawOnTop`), and terrain or another model never hides a part of the badge.
- The badge pose is set at frame priority −1, before drei's Html reads it at priority 0. So the counters and the 3D tokens turn in the same frame.
- Tokens on the character are in rows of 4 from the top left. The tray has rows of 6 that overlap, but overlapping tokens without the depth test can draw in the wrong order.
- One toggle for the whole badge, not 4. Only one player uses the app for now (see `docs/feature-peer-to-peer.md`).
- The badge sits above the top of the model. The app measures the model height from the model file (`modelTop` in `CharacterModel.jsx`), so it needs no `UIOffset` data. A standee uses its card height.
- The model draws the badge inside its `RigidBody` (the `overlay` prop), so the badge moves with the model, also during a drag, a lift (R) or a Throw. The badge stays straight above the base center when the model tips over.
- The badge is read-only. A player changes Damage, Power and tokens on the tray.
- Range 1 to a Secure token is checked on every frame, edge to edge, seen from above, the same as the R1 tool (README "Range 1") and TTS. The badge shows the disk of each Secure token in range.
- The app does not apply the game rules (see `docs/characters-hud.md`, "Players apply the rules"). A Dazed character still shows the Secure token. Nebula and S.H.I.E.L.D. Agents are not special cases.
- No Defense values and no Telecasting portrait.
