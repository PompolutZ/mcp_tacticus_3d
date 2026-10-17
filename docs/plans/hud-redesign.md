# Plan: HUD redesign

Requested by the user on 2026-10-17. Status: all steps built on 2026-10-17, waits for the user test. Branch `hud-redesign`, worktree `../mcp_assist_3d-hud-redesign`.

No new feature doc. Each step updates the feature docs where the look or the labels change. Each step makes one commit and writes its **Result** below.

## Request

Build the comic look of the table HUD from the Claude Design canvas "Hero Table 3D — UI refresh" (https://claude.ai/artifact/UVHSDJX9zM8SBYjitoJTbJ). The boards are "HUD — plain", "HUD — library", "HUD — settings", "HUD — streamer" and "HUD — cleanup ready (power done)". They are one component in 5 states (file `project/Hud.dc.html`). The crisis boards are built already (plan `setup-dialogs-redesign.md`). The board "Table HUD — earlier concept" gives the look of the Sandbox Setup panel.

Answers of the user:

- **Scope:** the parts in the design, plus the toolbar parts that the design does not show (Sandbox **Setup** chip and panel, Mat, Range, Move, Deploy groups) and the HUD warnings, the notice and the HUD message. Dice keys, the token panel, the tray popup, the card popup and the game setup panel keep the old look. A later plan can do them.
- **Label:** **Streamer** replaces **Spectator** in the UI: the toolbar button, the Settings section and "Streamer columns size (%)". Code names (`spectator`), setting keys and the feature doc file name do not change.
- **Settings toggles:** the design words: **Mode on** / **Mode off**, **Labels on** / **Labels off**, **Re-throw on** / **Re-throw off**.

Added by the user on 2026-10-17, after the first plan:

- **Mouse table:** same look as the other redesigned Settings rows.
- **Log bubble:** shows only when a new entry is added, and hides after 3 seconds. When the Log is open, the bubble shows the last 10 entries and scrolls. A bigger Log redesign comes in a later plan, so this step does not add values that the design misses.
- **Dice symbols in the log:** no white box, at their own aspect ratio. Use the icons the tactic cards already have, no dice script change. Blank has no symbol, so the log writes "Blank".

## The design

Same style as the lobby (plan `lobby-redesign.md`, "The look"): ink `#0B0B0F`, paper `#FFF6E0`, yellow `#FFD400`, red `#D11F27`, blue `#1D4ED8`, night `#141B3D`. Fonts Bangers, Barlow, Barlow Condensed, JetBrains Mono. Thick black outlines, hard shadows, skewed plates. New color: power green `#1E9E44` with a light green gem `#8FE04A`.

- **Top left box (paper, border, shadow):** yellow **← Lobby** button, "Room" + code (JetBrains Mono) + copy icon button, a black divider, then one plate per player: skewed plate in the side color (halftone dots), small avatar, name (Bangers, white with outline), a tag after it: "You" (black) or the connection state ("Connected", yellow).
- **Top right box:** 4 buttons **Library**, **Log**, **Streamer**, **Settings** (Bangers). Open: yellow and pressed in (inner shadow). Closed: white with shadow.
- **Log:** a speech bubble under the **Log** button, its tail points to the button. Closed: "Log" caption and the newest entry in one line. Open: the list, entries split by dashed lines.
- **Library:** panel on the left, from under the top box to the bottom. Black header: "Library" (yellow Bangers), search field with a yellow border, filter buttons **All**, **Characters**, **Tactics**, **Tokens** (yellow outline, yellow when on). Body on paper: section title (Bangers) + "More (N) ›". Characters: white rows, round portrait, name, MCT code. Tactics: 3 columns of cards with border and shadow, name under each. Tokens: **Single** / **Pile** as joined buttons, "Conditions" and "Status" groups, 5 columns of square token buttons.
- **Streamer:** a column on each side. Header in the side color: name, yellow "N VP" tag, "Round N" tag. Rows: round portrait, "Dmg" bar (red) and "Pwr" bar (yellow) with the values. The right column starts under the log bubble.
- **Phase buttons, bottom right, one column:** the button that can run now is big: **Auto power phase!** (green, gem icon) or **Auto cleanup phase!** (yellow, turn icon), skewed, hard shadow. The one that cannot run is small and grey with its reason as the title ("Power phase done this round", "Available after the power phase").
- **Settings:** a dialog 900 px wide. Night header with dots and "Settings" (white Bangers, outline, shadow). Paper body. Section titles as black tags with yellow Bangers, turned −1°. Rows split by dashed lines. **Table** / **HUD** as joined buttons. Sliders in red with the value in a small white box. Toggles: yellow when on. Keys: **Reset all keys**, the hint text, group titles ("Camera"), each key as a key cap with × and a dashed **+** button. Yellow × on the top right corner, turned 6°.

## Facts in the app

Read on 2026-10-17.

- `App.jsx` renders the HUD parts: `.hud-top` with `ui/Toolbar.jsx`, `tokens/TokenPanel.jsx`, `ui/Library.jsx`, `log/LogPanel.jsx`, `ui/SpectatorColumns.jsx`, `settings/SettingsPopup.jsx` (+ `KeyBindings.jsx`), `ui/HudNotice.jsx`, `game/PhaseButtons.jsx`, `ui/HudWarnings.jsx`, the `hud-message` div.
- `Toolbar.jsx` (312 lines): ← Lobby, room code or "Sandbox", `CopyLinkButton` (only while the guest seat is free), `rooms/RoomPlayers.jsx` (multiplayer), Sandbox **Setup** chip with a panel (crisis selects, roster fields), Mat group (map select, ↺ ↻), Range R1–R5, Move S M L T/A, Deploy Lock, then Library, Log, Spectator, Settings.
- HUD styles are in `src/index.css` (2235 lines): `hud-top`, `toolbar*`, `group`, `chip`, `library*`, `log*`, `phase-button*`, `hud-warning*`, `hud-notice*`, `hud-message`, `room-player*`, `settings-*`, `key-*`, `spectator-*`. The class `chip` is also used by dice keys, the tray popup, the token panel and the game setup panel. Those keep `chip`.
- The comic base: `rooms/comicBase.js` (fonts + `rooms/comic.css`). `.comic` holds the color variables, the font and also the night page background with dots. `rooms/Burst.jsx`, `rooms/SeatPlate.jsx`, `CopyLinkButton` `icon` prop exist.
- `useHudTop.js` sets `--hud-top` from the height of `.hud-top`. Library, Log and notice start there.
- `PhaseButtons` gets `powerBlock` (reason text or null) and `cleanupDisabled` + `cleanupTitle`. `HudWarnings` `lifted` moves the warnings above the phase buttons.
- The Log state is per browser in localStorage. Escape collapses it. Closed, it is a bar with the newest entry. Open, it shows all entries.
- Dice icons `src/assets/dice/icons/<symbol>.webp` are 110×75: a white rounded box with a black symbol, transparent corners. The log shows them at 16×16, so they are squeezed. `dice/DiceKeys.jsx` also uses them (out of scope).
- The tactic cards have the Jarvis face icons in `src/assets/tactic-icons/` (`tactics/faceIcons.js`, `faceIconUrl(file)`): 32×32, a white symbol in a black circle, transparent corners. Dice faces there: `hit`, `critical`, `block`, `failure` (skull), `wild`. No blank.
- No component tests for these parts.

## Decisions

1. **One base for the HUD.** `.comic` gives the variables and the font only. The night background with dots moves to a new class `.comic-page`, which the lobby, the join page and other current `.comic` roots that need it get. Coder checks every `.comic` user, so their look does not change. Each restyled HUD part gets `.comic` on its own root, not the whole HUD root, so the parts out of scope keep their look.
2. **Styles** in a new `src/ui/hud.css` (top bar, phase buttons, warnings, notice, message), `src/ui/library.css`, `src/log/log.css`, `src/ui/streamer.css`, `src/settings/settings.css`. Each step removes the old rules in `index.css` that nothing uses after it. `chip` and `group` stay while other parts use them.
3. **The 4 HUD buttons are toggle buttons** with `aria-pressed`, not tabs, because Library, Log and Streamer can be open at the same time. Settings opens the dialog.
4. **Copy icon:** the room code box always shows the copy icon in a room (`CopyLinkButton icon`, it copies the link, as on the lobby tile). Today it shows only while the guest seat is free. The Sandbox shows "Sandbox" and no icon.
5. **Player plates:** `SeatPlate` if it fits the toolbar size, else a small toolbar plate that shares its css. Side color from `useSideColors`. "Free seat" and "Deleted player" stay. **Try again** stays for a failed or stopped connection. The status words stay as today ("Waiting", "Reconnecting", "Could not connect", ...).
6. **Toolbar parts not in the design** use the top box look: each group is a paper box with border and shadow, buttons in the style of **← Lobby** (white, yellow when on). The Setup panel takes the "Prepare for battle" panel of the earlier board: paper, black tag, labels in condensed caps, white selects and fields, Blue / Red plates (halftone) on the roster fields. The narrow window rule stays: the middle groups scroll sideways.
7. **Log bubble:**
   - Closed: no bubble. When a new entry is added (a dice entry or a log entry), the bubble shows it under the **Log** button for 3 seconds, then hides. A next new entry replaces the text and starts the 3 seconds again. Entries that come with the table load (the first state, a sync from the other player at connect) do not show the bubble. A click on the bubble opens the Log.
   - Open (the **Log** button, or a click on the bubble): the bubble shows the last 10 entries, the newest first, and scrolls. **Collapse** and Escape close it. The open state stays in localStorage as today.
   - Entries keep the time and the side color (a left mark or the text color, coder picks what reads well on white). No other new values.
   - The 3 seconds and the 10 entries are constants in `log/LogPanel.jsx` (or `log/open.js`), named, not inline.
8. **Dice symbols in the log:** the Jarvis face icons of the tactic cards, through `faceIconUrl`. One map from dice symbol to icon file (`crit` → `critical`, `skull` → `failure`, the others by name), next to `faceIcons.js` or in `dice/faces.js`, not in the log component. Square, so the aspect ratio stays. The blank face has no icon: the log shows the word "Blank" in bold, as the tactic cards do (Lovable Misfits: `|!block| or a |*blank|`, `*` is bold in `tactics/faceBody.js`). No new files, no script change. Dice keys keep their icons.
9. **Phase buttons** follow the settings as today (each shows only when it is set to HUD). The big or small look comes from the existing block state: `powerBlock` set → small grey; `cleanupDisabled` → small grey. `aria-disabled` stays, so the title shows. `HudWarnings` `lifted` gets the new height.
10. **Library:** the **For** row (Sandbox and solo rooms) stays, as Blue / Red plates. Spawned, unavailable and no side states, the gem tag, the HUD message, the token titles stay, in the new look. Drag from token buttons stays.
11. **Streamer:** affiliation mark, held crisis tokens, tokens, KO and the off-mat look stay. `--spectator-size` stays. The left column moves inward when Library is open, the right one when the Log is open, as today.
12. **Settings:** uses `Dialog` with `closeClassName` for the yellow × (as the roster popup). All rows of today stay, also the dev-only Debug mode row. The key groups and the capture flow of `KeyBindings` stay. The Mouse table gets the same look as the key rows: section tag "Mouse", rows split by dashed lines, the action as text, the mouse input as a key cap (no × and no +, it cannot change).
13. **Narrow window:** no horizontal page scroll. Library and Streamer columns get a max width of the window minus the gutter. Settings dialog fills the window with a 16 px gutter.

## Steps

### Step 1: base, top bar

- `rooms/comic.css`: split `.comic` (variables, font) and `.comic-page` (background). Add `.comic-page` to every root that needs it.
- `ui/hud.css` (new), imported by `Toolbar.jsx` with `rooms/comicBase.js`.
- `Toolbar.jsx`: top left box (← Lobby, Room + code + copy icon, divider, players), top right box with the 4 toggle buttons (**Streamer** label), Setup chip and panel, Mat / Range / Move / Deploy groups in the new look.
- `RoomPlayers.jsx`: plates and tags.
- `index.css`: remove the `toolbar*`, `toolbar-room`, `setup-chip`, `toolbar-setup-panel`, `roster-field`, `room-player*` rules nothing uses.
- Docs: `table-tools.md` "Toolbar", `peer-to-peer.md` "Room and players", `rooms.md` (copy icon, Streamer label), `spectator-view.md` and `auth.md` where they name the button.
- Checks: `pnpm format`, `pnpm lint`, web tests, `pnpm --filter web build`.

### Step 2: log bubble, phase buttons, warnings, notice, message

- `log/LogPanel.jsx` + `log/log.css` (new): bubble under the Log button (decision 7). The "new entry" check as a pure function with tests (rules: an entry newer than the last seen shows; the first load shows nothing).
- Log dice symbols from the tactic face icons (decision 8).
- `game/PhaseButtons.jsx`: big / small look, power gem icon (inline svg as in the design), cleanup turn icon.
- `ui/HudWarnings.jsx`, `ui/HudNotice.jsx`, `hud-message` in `App.jsx`: paper boxes with border and shadow, yellow for the notice, **Close** / **Show** / **Done** as comic buttons.
- `index.css`: remove `log*`, `phase-button*` (if the table buttons do not share them; coder checks `TableButtons.jsx`), `hud-warning*`, `hud-notice*`, `hud-message`.
- Docs: `game-log.md` "Panel" (bubble, 3 seconds, last 10), `round-phases.md` and `table-tools.md` where they describe the HUD buttons.
- Checks: format, lint, web tests, build.

### Step 3: Library

- `ui/Library.jsx` + `ui/library.css` (new): header, search, filters, sections, rows, tactic grid, token grid, Single / Pile, For plates (decision 9).
- `index.css`: remove `library*`, `token-chip` only if the token panel does not use it (coder checks).
- Docs: `library.md` "Panel".
- Checks: format, lint, web tests, build.

### Step 4: Streamer columns

- `ui/SpectatorColumns.jsx` + `ui/streamer.css` (new): header in side color with VP and Round tags, rows with round portrait and labeled bars (decision 10). Right column under the log bubble.
- `SettingsPopup.jsx`: section "Streamer", "Streamer columns size (%)" (the rest of Settings in Step 5).
- `index.css`: remove `spectator-col`, `-head`, `-name`, `-list`, `-row`, `-portrait`, `-bar*`, `-ko` rules nothing uses. `SpectatorBadge` (3D badges) keeps its rules.
- Docs: `spectator-view.md` (look, the label **Streamer**), `table-tools.md` "Spectator" settings section.
- Checks: format, lint, web tests, build.

### Step 5: Settings

- `settings/SettingsPopup.jsx`, `settings/KeyBindings.jsx` + `settings/settings.css` (new): night header, section tags, rows, joined Table / HUD buttons, sliders, toggles with the design words, key caps, dashed +, **Reset all keys**, Mouse rows in the same look, yellow × (decision 12).
- `index.css`: remove `settings-*` and `key-*` rules nothing uses.
- Docs: `table-tools.md` "Settings menu" (toggle labels), `key-shortcuts.md` if it names the buttons.
- Checks: format, lint, web tests, build.

## Results

### Step 1

- `comic.css`: `.comic` has variables and font; `.comic-page` has the night background. Only Lobby and JoinRoom roots needed it (the dialogs set their own background).
- Plate rules (`.seat-plate*`, `.seat-avatar`, `.seat-name`) and the copy icon rules (`.room-copy*`) moved from `lobby.css` to `comic.css`, so the table loads them with `comicBase.js`.
- New `ui/hud.css`: top bar, boxes, Lobby button, 4 toggle buttons, Setup box and panel, Mat / Range / Move / Deploy groups. `.hud-top` moved there from `index.css`.
- `RoomPlayers.jsx` uses the `seat-plate` classes plus a tag. Team name is now the plate title only.
- Differed from the plan: `CopyLinkButton` lost its text-button branch and the `icon` prop (the icon is the only look now). `guestSeatFree` removed from `Toolbar` and `App`. `useHudTop` gap 8 to 12 for the box shadow. The copy result text hangs under the box.
- `index.css`: removed `.hud-top`, `toolbar*`, `.group`, `setup-chip`, `roster-field`, `room-player*`. `chip` and `group-label` stay (used elsewhere).

### Step 2

- `log/LogPanel.jsx` + `log/log.css`: the bubble (flash 3 s on a new entry, open list of 10). `log/bubble.js` has the constants and the pure `freshItem` (with tests). A new entry also needs to be at most 5 s old, so a sync at connect shows nothing. The tail finds the Log button through `data-hud-button="log"` (set in `Toolbar.jsx`).
- Dice symbols: `tactics/diceIcons.js` (map, tested; no asset import, so Node tests can load it) and `diceIconUrl` in `faceIcons.js`. Blank shows bold "Blank".
- `PhaseButtons.jsx`: big or small look, inline gem and turn icons, labels with "!" when big. `HudWarnings` `lifted` bottom is 168 px.
- Warnings, notice, HUD message: paper boxes in `ui/hud.css`; notice yellow; comic buttons.
- `index.css`: removed `log*`, `hud-message`, `hud-notice*`, `hud-warning*`, `phase-button*`. The table buttons shared the green Power rule; only its `.phase-button--power` selectors went.
- Differed: the closed bubble is a `div role="button"` (it holds block entries). The streamer right column does not move under the bubble yet (Step 4).

### Step 3

- `ui/Library.jsx` + `ui/library.css`: black header (title, search, filter toggle buttons with `aria-pressed`), paper body, rows, 3-column cards, 5-column token buttons, Single / Pile as joined toggle buttons. `.comic` on the root; width is the window minus the gutter at most.
- The For row uses `seat-plate--blue` / `--red`; the chosen plate is full, the other fades. Spawned rows are light green, unavailable rows grey. Message, titles, gem tag, drag stay.
- `index.css`: removed `library*` and `token-chip` (only the Library used it). `chip` and `chip--player-*` stay.

### Step 4

- `ui/SpectatorColumns.jsx` + `ui/streamer.css`: header in the side color with VP and Round tags, round portrait, "Dmg" red and "Pwr" yellow bars with values. `.comic` on each column root. Class names are `streamer-*`; the setting key stays `spectator`.
- Right column: starts below the area of the flashing log bubble (fixed offset); with the Log open it moves left of the bubble and starts at `--hud-top`. Max width is the window minus the gutter (minus the pushing panel when pushed).
- Injured side: the Dmg bar is striped red (the old orange/red split is gone).
- `SettingsPopup.jsx`: labels "Streamer" and "Streamer columns size (%)". `index.css`: removed the `spectator-*` column rules.

### Step 5

- `settings/SettingsPopup.jsx`, `KeyBindings.jsx`, `settings.css` (new): night header (the `.comic-page` background), paper body that scrolls, black section tags, dashed rows, joined Table / HUD, red sliders with a value box, toggles "Mode on / off", "Labels on / off", "Re-throw on / off", key caps with x and a dashed +, yellow x (`closeClassName`). Mouse rows are the same rows with a key cap, no x and no +. Narrow window: the dialog is the window minus the gutter.
- Small fix from Step 4: `--library-w` and `--log-w` are set once in `rooms/comic.css` and used by `library.css`, `log.css` and `streamer.css`.
- `index.css`: removed `settings-*` and `key-*` rules.
- Differed: the Reset, Add and Cancel buttons of a key row are small dialog buttons (the design shows none). The Keys tag and **Reset all keys** share one line.

### Fixes after the user test

- Log list scrolls, up to 50 entries (commit d04aaba).
- Streamer rows: tokens on the character in a row above the bars; only held crisis tokens sit beside the bars, in a fixed slot.
- Streamer columns start at the same top; the closed log bubble draws over the right column.
- Streamer "Pwr" bar in power green: one `--comic-green` (`rooms/comic.css`) shared with the Power phase button and the Library.
