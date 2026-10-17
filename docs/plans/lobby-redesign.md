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

Added by the user on 2026-10-17 (Step 5): the New room dialog, from the boards "New room — versus, random map", "New room — versus, pick a map" and "New room — solo, two rosters" (local copy `~/Downloads/Hero Table 3D — UI refresh.html`).

- **Labels:** the design words everywhere in the UI: **Solo** ("Run both sides yourself") and **Versus** ("Share a code with a friend"). They replace "Single player" and "Multiplayer" in the dialog, the room tile tag, the "+" tile and the Settings label.
- **Branch:** Step 5 of this plan, same branch.

Added by the user on 2026-10-17 (Step 6): the Join room page in the same style, from the board "Join room".

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

### Step 5: New room dialog

The design, one component in 3 states. Frame 960×640 px, black border 5 px, hard shadow. Two columns with a 5 px black gap.

- **Left column (380 px, yellow rays):** caption tab in the top left corner: "A mystery map awaits…" (Random map on) or "Pick your battleground!" (off). Random on: one card back, turned −4°, hard shadow. Random off: the map fan, the middle card turned −2° with the hard shadow, side cards smaller, darker, turned. Under it: ← (square button), box "Map N of M" + map name (Bangers), → (square button).
- **Right column (paper):** title **New room!** (red Bangers, black outline, shadow, turned −2°). "Choose your battle" legend and two big buttons, **Solo** / **Versus** with the line under each. The active one is yellow, turned −1°, bigger shadow.
- **Random map row (white box):** "Random map" + hint ("Turn off to pick the map yourself" / "Browse the maps on the left"), comic switch (blue track with yellow knob "ON", grey track with white knob "OFF").
- **Versus:** "Your roster" field. **Solo:** "Rosters", a **Blue** plate (blue halftone) + field, a **Red** plate + field with a dashed border, placeholder "Optional — paste an MCT code".
- **Footer:** yellow note, turned: Versus random "The map is revealed when the second player joins…", Versus pick "Your rival will fight on this map…", Solo "Red roster is optional — add it now or at the table.". **Cancel** (underlined text), **Create room!** (red, skewed, hard shadow). Disabled: grey, title "Paste a roster first".
- **×:** yellow square on the top right corner, turned 6°.

Decisions:

1. Keep all behavior of `NewRoomDialog.jsx`: login off (no Solo/Versus choice), Versus disabled when logged out with the reason text, the "You host room … already" error, the create error, the storage error, Random map rules, Create rules, arrow keys, Escape/backdrop.
2. Map fan: `Carousel` with `fan` and `renderNav` (from Step 4), not a copy of the design's 3 card code. Drag and swipe stay. The fan look of the map picker gets its own rules (class on the dialog), so the roster popup does not change. The caption and the "Map N of M" box use `MAPS[id].name`.
3. `RosterField` keeps the summary, the unknown codes and the missing files box under the field, in the comic style. It gets an optional plate prop (Blue / Red). The join page also uses `RosterField`: its look there does not change in this step (the dialog styles are scoped to the dialog).
4. The comic switch: `Switch` gets a `className` (or variant) prop. The other look stays for any other user (today only this dialog uses `Switch`; coder checks).
5. Styles in a new `src/rooms/newRoom.css`, scoped to the dialog class, `.comic` on the dialog root, fonts from `comicBase.js`. Remove the old `new-room-*` rules from `index.css` that nothing uses after the change (check `JoinRoom.jsx` and `RosterField.jsx`, which share some).
6. Narrow screen (phone): the columns stack, map column on top and smaller, right column scrolls. No horizontal scroll, 16 px side gutter.
7. Labels: "Solo" and "Versus" replace "Single player" and "Multiplayer" in `Lobby.jsx` (tile tag, "+" tile "Solo or versus"), `SettingsPopup.jsx` ("Mat turn (Sandbox and solo rooms)") and the logged-out hints ("Log in with Discord to play versus", "Versus is not available: the server does not answer."). Code names (`multiplayer`, `single`) and test names do not change. In the docs, the labels and quoted texts change in `rooms.md` and `auth.md`; the other feature docs use "single player room" / "multiplayer room" as terms and stay.

Steps for coder:

- Files: `rooms/NewRoomDialog.jsx`, `rooms/newRoom.css` (new), `rosters/RosterField.jsx`, `ui/Switch.jsx`, `ui/Carousel.jsx` only if `fan` needs an option for the map size, `rooms/Lobby.jsx`, `settings/SettingsPopup.jsx`, `index.css`.
- Docs: `rooms.md` "New room" (look, labels, notes), `auth.md` "Lobby and room UI" (labels).
- Checks: `pnpm format`, `pnpm lint`, web tests, `pnpm --filter web build`.

### Step 6: Join room page

The design: the lobby header and night background (already there), then two panels side by side, which wrap on a narrow screen.

- **Left panel (rays, border, hard shadow):** tab "Incoming challenge!" on the top left corner, the map card (turned −4°, hard shadow).
- **Right panel (paper, border, hard shadow):** yellow tag on the top edge, turned: "Room" + code (JetBrains Mono). "Join room" (red, condensed caps), the map name (big Bangers).
- **Seats row:** "Host" label, host plate (skewed, Bangers), "View roster ›" link. "VS" burst. "Challenger" label, a plate: dashed white "You?" with "Paste a roster below" until the roster has a known code, then a solid plate with the own name and "Roster ready".
- "Your roster" field.
- Yellow note with a warning icon, turned: "Heads up! Once you join, the players and rosters of this room are locked in."
- **Footer:** **← Lobby** (white, hard shadow), **Join the fight!** (red, skewed). Disabled: grey, title "Paste your roster first".

Decisions:

1. Keep all behavior of `JoinRoom.jsx`: logged out (Discord login button, or "Log in above to join"), the join error, busy state, host gone ("Deleted player"), the roster popup of the host, the random map hint "The map spawns when you join.". A random room shows the card back and "Random map" as the title (`mapFace(null)`).
2. The map name is an h2, because the header logo is the page h1 (as in Step 2).
3. Plates: `SeatPlate` (Step 3) with the host avatar. The plates are neutral, the same as on a multiplayer lobby tile; the design's blue and red are left out, because the side colors of a multiplayer room are set later. The challenger plate gets a dashed "empty" look. `Burst` for "VS".
4. Labels from the design: **Join the fight!** replaces **Join**, the new note text replaces "After you join, the players and the rosters of this room cannot change.", **View roster ›** replaces "roster".
5. `RosterField` comic look: the Step 5 rules scoped to the new room dialog become shared rules (one class for both), not a copy.
6. Styles in `src/rooms/joinRoom.css` (or with the Step 5 shared rules where they are shared). Remove the `join-room-*` and the `new-room-*` rules from `index.css` that nothing uses after the change.
7. Narrow screen: the panels stack, the map panel on top and shorter. No horizontal scroll.

Steps for coder:

- Files: `rooms/JoinRoom.jsx`, `rooms/joinRoom.css` (new), `rooms/newRoom.css`, `rooms/SeatPlate.jsx` (dashed variant), `rosters/RosterField.jsx` only if the shared class needs it, `index.css`.
- Docs: `rooms.md` (join page look and labels, **Join** → **Join the fight!**), `auth.md` if it quotes the join labels.
- Checks: `pnpm format`, `pnpm lint`, web tests, `pnpm --filter web build`.

## Results

### Step 1 (commit 7dd345e)

Fonts from `@fontsource` (Bangers, Barlow, Barlow Condensed, JetBrains Mono), `rooms/comicTheme.js`, `rooms/lobby.css` (`.comic` variables, `.pop`, `.comic-button`, `.comic-input`, burst), `Burst.jsx`, new `LobbyHeader`, restyled user menu.

### Step 2

- `LobbyHero.jsx`: hero (tag, "Assemble at the table!", intro, **New room!**, **Open sandbox**) and join box (bubble form, **Join!**, example code). The hero title is an h2, because the header logo is the page h1. The old Sandbox section stays until Step 3.
- `rooms/roomCode.js`: `parseRoomCode`, with `CODE_CHARS` and `CODE_LENGTH` moved here from `store.js` (store imports them; one source). Tests in `roomCode.test.js`.
- **Join!** calls `onOpenRoom(code)` (Root sets `#room=<code>`); an invalid text shows an inline `role="alert"` error.
- `.lobby-notice` restyled (yellow comic box).
- `rooms.md`: Lobby, Pages, Code table.
- Checks: format, lint (no new warnings), build, web tests pass.

### Step 3

- `Lobby.jsx`: "Your rooms" title and count badge, room tile (article, not clickable; **Enter the fight →** is the only entry), "+" tile (last in the grid, as in the design), sandbox section, footer. The old seat line and `Seat` are gone.
- `SeatPlate.jsx`: skewed plate (name, optional avatar) with the "Roster ›" link under it. Multiplayer plates are neutral, single player plates blue/red halftone from the room's colors.
- `CopyLinkButton.jsx`: `icon` prop for the code badge (icon button, result text beside it, `role="status"`). The toolbar keeps the text button.
- `src/assets/lobby/sandbox.webp`: the screenshot, `magick` 1600 px wide, quality 80, loaded with `assetUrl`.
- `lobby.css`: new rules for the tiles, sandbox and footer. Old lobby rules removed. `.lobby-seat-avatar` stays (JoinRoom).
- `rooms.md`, `auth.md`: updated.

### Step 4

- `ui/Dialog.jsx`: `closeClassName`; with it the × is the first child of the dialog element (so a style can put it on the frame corner). Other dialogs unchanged.
- `rooms/comic.css` + `rooms/comicBase.js` (fonts and shared `.comic` look) split from `lobby.css`; `comicTheme.js` = base + `lobby.css`. The roster popup imports only `comicBase.js`, so the table loads no lobby layout.
- `rosters/roster.css` (new) and `RosterPopup.jsx` rewritten: comic frame, header (tint by `color`, optional tag from `roomCode` + `seat`), folder tabs with count chips (Breakdown without count), stage with rays, footer ← "Card N of M" → / **Flip!** / **This card on Jarvis**, variants, **Add to squad**, gem tags. Flip side and variant state moved from the slide to `CardCarousel` (per card index), so the footer acts on the middle card.
- `ui/Carousel.jsx`: `fan` (slides get `--rel` and `data-dist`, css in `roster.css`) and `renderNav`. Embla unchanged. The map picker and the crisis compare keep their look.
- `Lobby.jsx`, `JoinRoom.jsx`, `RoomRosterPopup.jsx`: pass `roomCode` and `seat` (host/guest, or side color).
- `index.css`: removed the `jarvis-link*`, `roster-popup-*` rules only the old popup used. Kept those that CrisisCompare, CrisisChoose and Settings use (`.roster-popup`, title, tabs, card, plate, backdrop).
- `roster.md`, `rooms.md` updated. `src/assets/jarvis-logo.webp` is no longer used by the popup.

### Step 5

- `NewRoomDialog.jsx` rewritten in the comic look (`.comic new-room-comic`): rays map column with caption tab, card back or map fan (`Carousel` `fan` + `renderNav`, ← "Map N of M" + name →), paper column with title, **Solo** / **Versus**, Random map row, roster fields, yellow footnote, **Cancel**, **Create room!**. Yellow × through `closeClassName`. All behavior kept; the old `chip` buttons and `new-room-title` are gone.
- `rooms/newRoom.css` (new): all rules scoped to `.new-room-comic`; the map fan rules are scoped there, so the roster popup is unchanged. Narrow screen (max-width 720 px): columns stack, map smaller, right column scrolls, 16 px gutter.
- `RosterField`: `plate` prop (Blue / Red plate, label hidden for screen readers), `new-room-input--optional` (dashed). The join page has the same markup without them, so its look is unchanged.
- `Switch`: `variant="comic"` and `hint` (ON / OFF row). `rooms/comic.css` holds the look. The dialog is the only `Switch` user.
- Labels: "Solo" / "Versus" in the dialog, the tile tag, the "+" tile, `SettingsPopup.jsx` and the logged-out hints. Placeholder of the Red field: "Optional — paste an MCT code".
- `index.css`: removed `new-room-backdrop`, `new-room`, `-title`, `-card`, `-random`, `-choice`, `-kinds`, `.new-room .carousel`. Kept `-hint`, `-roster`, `-input`, `-status`, `-error`, `-warning`, `-missing*`, `-actions` (join page, `RosterField`).
- `rooms.md` "New room", `auth.md`, `table-tools.md` (Settings label) updated.
- Differences from the design: the × is the Bangers glyph as in the roster popup, not an svg; the Random map row is one button (the whole row switches); the disabled Create room! title is "You host a room already" when the host has a room. Not checked in a browser.

### Step 6

- `JoinRoom.jsx` rewritten in the comic look: map panel (rays, tab "Incoming challenge!", turned card) and room panel (tag, "Join room", map name h2, seats row, roster field, yellow note, **← Lobby**, **Join the fight!**). All behavior kept. The challenger plate shows the own name and avatar (`useUser`) once the roster has a known code.
- `rooms/joinRoom.css` (new). `SeatPlate`: `empty` (dashed), `rosterText`, `note`. `Burst` and `room-vs-text` reused for "VS".
- Shared, not copied: `rosters/rosterField.css` (the RosterField rules moved out of `newRoom.css`, scoped to `.comic`); `.comic-go` in `comic.css` (the red skewed button, sizes by variables) now also styles **Create room!**.
- `index.css`: removed the `new-room-hint|roster|input|status|error|warning|missing*|actions`, `link-button` and `join-room*` rules. `.lobby-seat-avatar` removed from `lobby.css`.
- Labels: **Join the fight!**, **View roster ›**, the new note text.
- `rooms.md` (new "Join page" section), `auth.md` updated.
- Differences from the design: the page title h2 (logo is h1); the hint for a random room under the title; the note shows only when logged in; plates neutral (decision 3). Not checked in a browser.
