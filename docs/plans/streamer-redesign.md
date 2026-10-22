# Plan: Streamer redesign

Requested by the user on 2026-10-22. Branch `card-peek-zoom`, worktree `../mcp_assist_3d-card-peek-zoom` (after the Alt card zoom commit).

## Request

Build the new HUD parts of the Claude Design canvas "Hero Table 3D - UI refresh" (https://claude.ai/artifact/UVHSDJX9zM8SBYjitoJTbJ), file `project/Hud.dc.html`, board "HUD - streamer". The design changed after plan `hud-redesign.md`.

Answers of the user:

- **Scoreboard:** build it. It shows at all times.
- **Crisis strip:** shows only while Streamer is on.
- **Phase buttons:** while Streamer is on, they move to the bottom center, in one row, as in the design.
- **Used tactic:** a Team Tactic card that its player flipped (`up === 'back'`).
- **Power bar:** stays green.

## The design

Same look as `hud-redesign.md`, "The design".

- **Scoreboard, top center:** in one row: the plate of the left player (skewed, side color with halftone dots, name in white Bangers with outline, a tag under it: "You" black or the connection state yellow), a paper box with the VP number (big Bangers) and "VP", a black-and-yellow burst with "Round" and the number, the VP box of the right player, the plate of the right player. The plates lean outward (skew), the shadows point outward.
- **Top left box:** only **<- Lobby**, "Room" + code + copy icon. The player plates move into the scoreboard.
- **Crisis strip, under the scoreboard (Streamer on):** one bar per crisis card in play. Left: a tag in the card type color, "Secure" (blue) or "Extract" (red). Right: the card name in upper case Barlow Condensed, cut with "..." when too long, full name as the title. Paper background, yellow on hover.
- **Streamer columns:** both start under the crisis strip, at the same top.
  - Header: the player name only, in the side color. The VP and Round tags go away, because the scoreboard shows them. The affiliation icon stays (decision 3).
  - Row: the character name in Bangers next to the portrait, before the Injured / Knocked out tag. A KO name is grey and crossed out.
  - **Team tactics** section at the end of the column: a title "Team tactics" and "N of M used" on the right. A grid of 5 columns with the card images (5:7), the name under each. A used card is grey and faded, with a red skewed "Used" stamp across it.
- **Phase buttons (Streamer on):** bottom center, in one row, centered. Streamer off: bottom right, one column, as today.

## Facts in the app

Read on 2026-10-22.

- `ui/Toolbar.jsx` renders the top left box with `rooms/RoomPlayers.jsx` (the player plates, `seat-plate` classes in `rooms/comic.css`).
- `ui/SpectatorColumns.jsx` + `ui/streamer.css`: columns, header with VP and Round tags from `scoreFromMarkers(scoreMarkers)` (`scoreboard/board.js`). My squad left, opponent right; Sandbox and a single player room: Blue (host) left.
- Tactic cards: `tacticCards` in `App.jsx`, `{ id, key, team, x, z, up }`, `up` is `'face' | 'back'` (`docs/features/team-tactic-cards.md`, "State"). A player can have more than 5 cards (a 6th lies next to the tray).
- Crisis cards: the chosen cards are `setup.picks` (`setup/setup.js`). After **Choose this edge** they lie on the board ends. The Sandbox can add a crisis card from the toolbar.
- `crisis/CrisisCompare.jsx` works only in the setup steps roll off, deck, first and second (`crisisShown` in `App.jsx`).
- `game/PhaseButtons.jsx`, `.phase-buttons` in `ui/hud.css`: bottom right, one column.
- `tokens/TokenPanel.jsx`: bottom center, only while a crisis token is selected.

## Decisions

1. **One source for the score.** The scoreboard and nothing else reads VP and the round: `scoreFromMarkers`, the same as the columns read today. A VP marker on no spot counts 0. The round burst shows "-" when the round marker is on no spot.
2. **Scoreboard order follows the columns.** Left plate = left column: my side on the left; Sandbox and single player room: Blue (host) left. The side colors come from `useSideColors`, as in the columns.
3. **Kept from today:** the affiliation icon in the column header, the tokens row, the held crisis tokens, the look of a character off the mat before the deploy, the green power bar. A hidden squad (before the reveal) shows only its header: no rows and no Team tactics section.
4. **Tag of a plate:** "You" for my side; the connection state for the other player, as `RoomPlayers` shows it today. Sandbox and single player room: no tag. The plates reuse the `seat-plate` classes; `RoomPlayers` changes, there is no copy of it.
5. **Crisis strip source:** the crisis cards that lie on the board ends (the same list the table draws), Secure first. Nothing in play: no strip. During the setup steps, the strip does not show (the rows on the table show the cards then).
6. **Crisis strip click:** opens the card in the card popup (`CardPopup.jsx`), the same as a click on the card on the board end. The compare overlay works only in the setup steps, and the strip shows only after them.
7. **Team tactics:** all tactic cards with `team` of that side, in the order of the slots (by x from the owner's left, as `layout.js` numbers the slots). "N of M used", M = the number of cards, so a 6th card counts. Image: the face of the card (`TacticFace`, the same as the Library and the card popup) or its small image, whichever the Library tactic grid uses. Alt over a card in the column does nothing (the columns are read-only HUD).
8. **Phase buttons and the token panel:** while Streamer is on and a crisis token is selected, the phase row sits above the token panel, so they do not overlap.
9. **Narrow window:** no overlap and no horizontal page scroll. When the scoreboard does not fit between the top left and top right boxes, it moves to a row under them, centered. The columns then start under it.
10. **Streamer columns size** setting keeps its range (`settings.js`). The design's 50% is not a decision of the user.

## Steps

Each step is one commit, after the user checks the diff. `pnpm format`, `pnpm lint` (no new warnings vs main), web tests and `pnpm --filter web build` pass in each step.

### Step 1: Scoreboard

- New `ui/Scoreboard.jsx` (+ rules in `ui/hud.css`): plates, VP boxes, round burst (decisions 1, 2, 4, 9).
- `ui/Toolbar.jsx`: the top left box loses the player plates. `rooms/RoomPlayers.jsx` gives what the scoreboard plates need, no copy.
- `ui/SpectatorColumns.jsx`: remove the VP and Round tags; the header keeps the name and the affiliation icon.
- A pure function for the scoreboard sides (left / right team, name, tag) with tests: the left side is mine; Sandbox: host left; the sides are never the same team.
- Docs: `table-tools.md` "Toolbar", `peer-to-peer.md` "Room and players", `spectator-view.md` (header without tags).

### Step 2: Crisis strip, row names, phase row

- New `ui/CrisisStrip.jsx` (decisions 5, 6), rendered only while Streamer is on.
- `ui/SpectatorColumns.jsx` + `streamer.css`: columns start under the strip; character name in each row, KO name grey and crossed out.
- `game/PhaseButtons.jsx` + `hud.css`: a `streamer` modifier class for the bottom center row (decision 8).
- Docs: `spectator-view.md` (strip, names, phase row), `round-phases.md` where it says where the buttons are.

### Step 3: Team tactics in the columns

- `ui/SpectatorColumns.jsx` + `streamer.css`: the Team tactics section (decision 7). The used rule (`up === 'back'`) and the order in a pure function with tests: count of used is never more than the count of cards; the order follows the slots.
- Docs: `spectator-view.md` "Squad columns".

## Results

### Step 1: Scoreboard

- `ui/Scoreboard.jsx` + rules in `ui/hud.css`: plates, VP boxes, round burst (reuses `Burst`, `seat-plate` classes, `useSideColors`, `scoreFromMarkers`, `playerName`). `ui/Toolbar.jsx` renders it (it knows the Setup box and the tools).
- Pure `ui/scoreboardSides.js` + tests: left side is mine (host in the Sandbox), never the same team, tags.
- `rooms/RoomPlayers.jsx` is now `PlayerTag` (tag and Try again); the words moved to `rooms/connectionStatus.js`. The toolbar box lost the plates and the divider. `SpectatorColumns.jsx` lost the VP and Round tags (and the `scoreMarkers` prop).
- `useHudTop.js`: `--hud-top` goes under the scoreboard when it has moved to a row under the toolbar.
- Deviations: (1) the plate has no avatar (the design has none); the own plate shows the account name, "You" is the tag. (2) The narrow breakpoint is 1360px, or 1540px when the toolbar has a Setup box or table tools (they sit in the middle, under the scoreboard). The plan said only "when it does not fit"; CSS cannot measure it. Widths are estimates, not tested in a browser.

### Step 2: Crisis strip, row names, phase row

- `ui/CrisisStrip.jsx` + `ui/crisisStrip.js` (pure `crisisStripItems`, tests): one bar per card of `game.crisis`, Secure first; none during the setup steps up to the edge (the Sandbox has no steps). A click calls `setOpenCard` with the card image, the same call as `CrisisCard`. App renders it only while Streamer is on.
- `useHudTop.js` sets `--score-bottom` and `--streamer-top`; `streamer.css` columns start at `--streamer-top`. Row name `streamer-char-name` before the tag; KO name grey and crossed out.
- `game/PhaseButtons.jsx` + `hud.css`: `phase-buttons--streamer` (bottom center row), `--above-panel` when a crisis token is selected. `HudWarnings` is not lifted while Streamer is on.
- Step 1 fix: the guessed breakpoints and the `crowded` prop are gone. `useHudTop.js` measures: `scoreboardFits` (pure, tested) checks the scoreboard's own max-content width against the boxes of the bar (room box, Setup, table tools, panel buttons), and sets `data-below` on it. Resize, ResizeObserver and a MutationObserver (tools come and go) trigger it.
- Docs: `spectator-view.md` (strip, names, phase row), `round-phases.md`, `table-tools.md`.
- Deviations: the token-panel lift is a fixed offset in `hud.css`, not measured. The strip hides during all setup steps up to the edge (the plan named "the setup steps"); the cards are not on the board ends before the edge anyway.

### Step 3: Team tactics in the columns

- Pure `ui/teamTactics.js` + tests: cards of the team only, slot order from the owner's left (by x times `sideSign`), used = `up === 'back'`, used <= total.
- `SpectatorColumns.jsx`: new prop `tactics` (the Yjs list `table.tactics`, read with `useYList` in the component, so App does not re-render on a card drag). `TeamTactics` section + rules in `streamer.css`. Image: `tacticCardBack(key)`, as the Library grid. No section for a hidden squad or no cards.
- Docs: `spectator-view.md` "Squad columns".
- Deviations: none.
