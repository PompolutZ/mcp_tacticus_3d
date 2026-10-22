# Feature: Spectator view

Status: built.

## Goal

A viewer reads the state of each character from the model, without looking at the trays. **Streamer** in the toolbar shows a badge above every model. A second click hides the badges.

The badge is made of the same pieces as the character tray, so it looks the same. From top to bottom, a badge shows:

- the objective tokens the character holds (Extract Asset, Civilian, supply tokens). The same 3D disk as a crisis token on the mat or on the tray card.
- the Damage and Power counters of the tray (`TrayCounters` in `TrayControls.jsx`), without the − and + buttons. On the Injured side the Damage counter has a red border and red tint, as on the tray, so the Injured state shows at a glance
- the tokens on the character (conditions, Activated, Dazed, character and tactic tokens), as the same 3D tokens as in the tray's "On" row (`TokenFace.jsx`), with the count when it is above 1

## Squad columns

**Streamer** also shows two HUD columns, one per squad, read-only (`SpectatorColumns.jsx`). My squad is on the left and the opponent's on the right. In the Sandbox and a single player room, Blue (the host) is on the left.

- Look: the comic style of the HUD (`streamer.css`). Each column is a paper box with a border and a hard shadow.
- Header: in the side color (`useSideColors`). It has the player name and the affiliation icon of the side. VP and the round are not here, the scoreboard shows them (`table-tools.md`, "Toolbar"). The icon is the affiliation token image (`affiliationTokenKey`, `characterToken`), its name as the title. Unaffiliated has an icon too; with no affiliation set there is none. It follows `game.affiliations`. The 3D badge has no header, so only the HUD columns show it.
- One row per character and grunt, in tray order (the order of the row on the table; a player changes it by swapping two trays, see `character-trays.md`, "Swap trays"). Constructs have no row. A row has the round portrait on the left. Right of it, from the top: the name line (the character name in Bangers, `streamer-char-name`, then the Injured or Knocked out tag, then the tokens), the "Dmg" bar (`damage / stamina`, red; striped on the Injured side) and the "Pwr" bar (`power / 10`, power green `--comic-green`), each with its value. A grunt has no Pwr bar, but its row is as tall. The bars start at the same place in every row.
- Fixed row height: every row has the same height, whatever it holds. The tokens on the character (the tray's `OnToken`, with counts) and the crisis tokens it holds are small chips in one line, at the right end of the name line. More than a few show as a "+N" chip; its title lists all of them. A token, a tag or KO never changes the row height, so the layout does not jump.
- A row of a character on the Injured side has a pale red background instead of the paper (`streamer.css`), so the Injured state shows at a glance.
- Team tactics: at the end of a column, a title "Team tactics" and "N of M used" on the right. M is the number of Team Tactic cards of that side (a 6th card counts). A grid of 5 columns shows the card images, the same image as the Library tactic grid, with the name under each. The order is the slot order from the owner's left (`teamTactics.js`). A card the player flipped (face down) is used: it is grey and faded, with a red skewed "Used" stamp. A squad with no cards, or a hidden squad, has no section. The section is always fully visible. Alt over a card does nothing here.
- Injured: a character on the Injured side has a small skewed red tag "Injured" after the name, besides the pale red row and the striped Dmg bar.
- KO: a character off the mat (`characterOnBoard` is false) once the deploy is over (`setup.deployed`, or a setup with no deploy step) is KO. Its row is beige with a faint diagonal hatch, the portrait is grey and faded, the bars are faded, a black skewed tag "Knocked out" is after the name, the name is grey and crossed out, and a small red "KO!" burst sits on the lower right of the portrait. The tokens stay. A KO character shows no Injured tag.
- Off before the deploy: a character off the mat before the deploy is over has a plain grey row, no tag and no burst, because every character is off the mat then.
- A squad that is still hidden (multiplayer, the opponent's squad before the reveal) shows only its header, with no rows and no Team tactics section.
- Layout: the columns start under the crisis strip (`--streamer-top`), or at `--hud-top` when there is no strip. Both columns start at the same top. The Log bubble that shows a new entry draws on top of the right column. They stay clear of the phase row at the bottom center. All characters of a squad are visible at once, up to 7 each: the column (header, rows, Team tactics) fits between the top and the bottom gutter. The rows share the free height equally; when it is short, all rows scale down together (portrait, name, bars, tokens), never above their normal size (`rowFit.js`, measured in `useRowFit.js`). Only when rows are at their smallest size and still do not fit, the list scrolls. This works together with the Size setting. An open Library pushes the left column inward. An open Log is a tall bubble, so the right column then moves left of it. A column is never wider than the window minus the gutter.
- Phase buttons: while Streamer is on, the Power and Cleanup buttons are in one row at the bottom center, not in a column at the bottom right. When a crisis token is selected, the row sits above the token panel. HUD warnings do not lift then (`round-phases.md`).
- Size: Settings → "Streamer columns size". See `table-tools.md`.
- The portrait is always the character's own portrait; the second form has no separate state to read.

## Crisis strip

**Streamer** also shows a strip of the crisis cards in play, under the scoreboard, centered (`CrisisStrip.jsx`, `crisisStrip.js`). It is for the viewer: the card names are on screen.

- One bar for each card on the board ends (the same `game.crisis` that the table draws), Secure first. Nothing in play: no strip.
- Left of a bar: a tag in the card type color, "Secure" (blue) or "Extract" (red). Right: the card name in upper case, cut with "..." when too long. The full name is the title. The bar is paper, yellow on hover.
- A click opens the card in the card popup, the same as a click on the card on the board end. The compare overlay is for the setup steps only.
- It does not show during the setup steps up to the edge choice, because the cards are not on the board ends yet and the rows on the table show them. The Sandbox has no setup steps, so a card set from its Setup box shows at once.
- The columns start under the strip. `useHudTop.js` sets `--score-bottom` and `--streamer-top`.

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
