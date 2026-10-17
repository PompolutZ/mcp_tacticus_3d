# Plan: Lobby redesign

Requested by the user on 2026-10-17. Status: plan confirmed by the user on 2026-10-17. Steps not started. Branch `lobby-redesign`, worktree `../mcp_assist_3d-lobby-redesign`.

No new feature doc. Each step updates `docs/features/rooms.md` and `docs/features/auth.md` ("Lobby and room UI") where the behavior or the labels change. Each step makes one commit and writes its **Result** below.

## Request

Build the new look of the Lobby from the Claude Design canvas "Hero Table 3D — UI refresh" (https://claude.ai/artifact/EGuC7wkJMghgYpikmumAse), boards "Lobby" and "Roster viewer". The New room dialog, the Join page and the room (Table HUD, camera buttons) are not in this plan. The canvas has boards for them, for a later plan.

Answers of the user:

- **Join by code:** build the "Got a room code?" box in the lobby.
- **Scope:** only the lobby for now, plus the roster popup.
- **Enter the fight:** each room tile gets a red **Enter the fight →** button. Only the button enters the room; the tile is no longer clickable.
- **Sandbox image:** the user's screenshot `~/Desktop/Screenshot 2026-10-17 at 11.03.45.png`.
- **Seat colors:** neutral plates on a multiplayer tile, blue/red only on a single player tile.
- **Roster popup:** the new look on the lobby and on the table (one component). Keep the carousel with drag and swipe, in the fan look of the design.
- **Sandbox image:** the user gives a screenshot of the table.

## The look

- **Style:** comic book. Dark blue page with dots, yellow rays, thick black outlines (3–5 px), hard black shadows (offset, no blur), slightly turned or skewed blocks, star bursts ("3D", "VS", "+").
- **Colors:** ink `#0B0B0F`, paper `#FFF6E0`, yellow `#FFD400` / `#FFB300`, red `#D11F27`, blue `#1D4ED8`, night `#141B3D` / `#212C63`, muted text `#3D3D46`, disabled `#D9D2BF` / `#5A5560`.
- **Fonts:** Bangers (titles, buttons), Barlow 400/500/600 (body), Barlow Condensed 500/700 and italic 700 (labels, caps), JetBrains Mono 600 (room codes, MCT codes). From `@fontsource` packages, not Google Fonts, so the app loads no file from another site. `@fontsource/barlow-condensed` is already a dependency.
- **Hover/press:** a button moves up-left on hover and down-right on press, and its shadow shrinks.

## Facts in the app

Read on 2026-10-17.

- `src/rooms/Lobby.jsx` (269 lines), `LobbyHeader.jsx` (also used by the join page), `JoinRoom.jsx`, `NewRoomDialog.jsx`, `auth/UserMenu.jsx`, `rooms/CopyLinkButton.jsx`.
- All styles are global CSS in `src/index.css` (3186 lines, lobby part from about line 1797). Class names: `lobby-*`, `new-room-*`, `join-room-*`, `chip`, `switch`, `carousel-*`. The UI font is the system font.
- Shared parts: `ui/Dialog.jsx` (backdrop, ×, focus trap, Escape), `ui/Switch.jsx`, `ui/Carousel.jsx` (Embla, also in the roster popup), `rosters/RosterField.jsx` (MCT field with summary and warnings).
- Map cards: `src/assets/maps/<mapId>.webp` and `back.webp`. `mapFace(mapId)` gives `{src, name}`; `null` gives the card back and "Random map". There are 22 maps.
- A map has only `id` and `name` as text. So the design's tags "Competitive" and "New York City · Construction site" have no data.
- The room code format is `K7Q2-M9XD` (hyphen). The design writes it with an en dash; the app keeps the hyphen.
- No component tests exist for these pages.

## Decisions

1. New styles go to a new file `src/rooms/lobby.css`, imported by the lobby. The old `lobby-*` rules move out of `index.css`; the `new-room-*` and `join-room-*` rules stay. Colors are CSS variables on a `.comic` class, set on the lobby root and the roster popup root, so the rest of the table UI does not change.
2. Small shared parts as components: `Burst` (star burst with text or icon) and `SeatPlate` (skewed name plate). The lobby tile, the join page and later the table HUD use them.
3. `LobbyHeader` is also the header of the join page. The join page gets the new header and the page background, nothing else.
4. Join by code: a pure function `parseRoomCode(text)` accepts lower case, spaces and a missing hyphen, and returns `K7Q2-M9XD` or `null`. **Join!** sets `#room=<code>`. The current room page logic then opens the room, the join page, or the lobby with a notice. A wrong code shows an error under the field.
5. Tags with no data ("Competitive", map place) are left out. A tile shows one tag: "Multiplayer" or "Single player".
6. The logged-in user button shows the Discord avatar in the square (the design shows a letter). The menu (Log out, Delete account) stays.
7. The footer keeps the Marvel / AMG disclaimer and the Privacy link.
8. Roster popup: the parts that the design does not show stay, in the new style: character variant chips, plates for cards with no image, **Add to squad** and the Breakdown tab (table only). The header line ("Room K7Q2-M9XD · challenger") shows only when the caller gives a room code and a seat.

## Steps

### Step 1: base, header

- Add `@fontsource/bangers`, `@fontsource/barlow`, `@fontsource/jetbrains-mono`. Import the weights listed above in `lobby.css` or the lobby entry.
- `src/rooms/lobby.css`: variables, page background (dots), `.pop` hover/press, button and field base styles.
- `Burst` component.
- `LobbyHeader`: logo "Hero Table" + "3D" burst, link to the lobby. `UserMenu` restyled (logged out, logged in, error).
- Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build`.

### Step 2: lobby hero and join by code

- Hero: "Meanwhile, on a table near you…", "Assemble at the table!", the intro text, **New room!**, **Open sandbox**.
- Blue box with "Got a room code?", field, **Join!**, the example code. `parseRoomCode` in `src/rooms/roomCode.js` with tests (rules: normal form, wrong length, wrong characters; no copy of a constant).
- Notices (`lobby-notice`) in the new style.
- `rooms.md` "Lobby" and "Pages": join by code.
- Checks: format, lint, tests, build.

### Step 3: room tiles, sandbox section, footer

- "Your rooms" title and the count badge ("1 battle in progress").
- Room tile (not clickable): code badge with copy (the current **Copy link** behavior), map card, tag, map name, last change, seats with `SeatPlate` and "VS" burst, roster links, **Delete** (host only), **Enter the fight →** (the only way to enter the room).
- "+" tile: "Start a new room!", "Single player or multiplayer".
- Sandbox section with the screenshot (`src/assets/lobby/sandbox.webp`, converted with `magick`), speech bubble, **Open sandbox**, "Wham!".
- Footer.
- `rooms.md`, `auth.md`: tile content.
- Checks: format, lint, build.

### Step 4: roster popup

- `Dialog` gets a `className` prop for the comic shell and the yellow × button. Other dialogs do not change.
- `RosterPopup`: blue header with the title (white Bangers with outline), the optional room line, **Open whole roster on Jarvis**. Tabs with counts.
- Card area with dark rays. `Carousel` keeps Embla (drag, swipe, arrow keys). Side cards smaller, darker and turned, the middle card with the hard shadow. Check that the roster popup is the only `Carousel` user that changes (the new room dialog keeps its look).
- Footer: ← "Card N of M" →, **Flip!**, **This card on Jarvis**, the variant chips, **Add to squad**.
- `lobby.css` holds the shared variables, so the popup on the table gets them too (the `.comic` class on the popup root).
- `roster.md`: the look, if the doc describes it.
- Checks: format, lint, tests, build.

## Results

(none yet)
