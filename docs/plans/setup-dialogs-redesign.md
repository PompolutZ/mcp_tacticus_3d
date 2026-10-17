# Plan: Setup dialogs redesign

Requested by the user on 2026-10-17. Status: plan written, waiting for the user's OK. Branch `setup-dialogs-redesign`, worktree `../mcp_assist_3d-setup-dialogs-redesign`.

Each step makes one commit and writes its **Result** below. Each step updates the feature docs where the look or the labels change: `squad-breakdown.md` (Step 1), `setup-game.md` "Crisis cards" (Steps 2 and 3).

## Request

Build the comic look (from `lobby-redesign.md`) for 3 more parts of the table, from the Claude Design canvas "Hero Table 3D — UI refresh" (https://claude.ai/artifact/UVHSDJX9zM8SBYjitoJTbJ):

- Breakdown tab of the roster popup: board "Roster viewer — blue player, breakdown".
- Compare crisis cards overlay: board "HUD — compare secures / extracts".
- Choose 1 overlay: boards "HUD — choose 1 secure (blue)" and "HUD — choose 1 extract (red)".

The board "Table HUD" is not in this plan. It will be designed separately.

## Facts in the app

Read on 2026-10-17.

- `rosters/BreakdownTab.jsx` (295 lines): threat chips with counts, Must have row, **More filters** (count in the label) with Must not have, Affiliation (chips with icons), At least 2 affiliations, With a leader, Min size, Max size, **Reset filters**. Count line, hint line (or `chooseBlock`), rows. A row is a `div` with `role="button"` when a click chooses. Styles `breakdown-*` and `chip` in `index.css` (from line 1727).
- `rosters/RosterPopup.jsx` and `rosters/roster.css`: comic frame, header, tabs, rays stage (lobby-redesign Step 4). The Breakdown tab is still in the old look inside it.
- `crisis/CrisisCompare.jsx` (150 lines): `Dialog`, tabs, the deck button (`deckButton`, only in the deck step, for the Priority player), two halves with `Carousel` (my side on top; Sandbox and solo: the side of the clicked card). `CrisisFace` (image or plate) is also used by `CrisisChoose`.
- `crisis/CrisisChoose.jsx` (68 lines): the 2 drawn cards, **Choose this card** per card (`pickButton` lock and title), only for the chooser. The other player sees "Waiting for … to choose a card.". A pick closes the overlay.
- Styles `crisis-compare*`, `crisis-choose*` in `index.css` (from line 2116; some `crisis-choose` rules are there twice). They also use `.roster-popup`, `roster-popup-title`, `roster-popup-tabs`, `roster-popup-card`, `roster-popup-plate`, `card-popup`, `roster-popup-backdrop`.
- Shared parts: `ui/Dialog.jsx` (`closeClassName` for the yellow ×), `ui/Carousel.jsx` (`fan`, `renderNav`), `rooms/Burst.jsx`, `rooms/SeatPlate.jsx`, `rooms/comicBase.js` (fonts and `.comic`), `rooms/comic.css` (`.pop`, `.comic-button`, `.comic-go`).
- The table has no player avatars. Names come from `setup/names.js`.

## The look

The look of `lobby-redesign.md` ("The look"): ink, paper, yellow, red, blue, night; Bangers, Barlow, Barlow Condensed, JetBrains Mono; thick outlines, hard shadows, hover up-left, press down-right.

### Breakdown tab (Step 1)

- A paper panel on the rays stage, with a border and a hard shadow, scrolls inside.
- Head: "Squad breakdown" (Bangers) and under it "Pick a threat level" (condensed italic caps, muted). On the right, the threat buttons: a big Bangers number and a black count chip (JetBrains Mono). The selected one is yellow, turned −2°, bigger shadow; the others are white. `aria-label` "Threat 19, 38 squads".
- Filter box: white, border, hard shadow. Rows with a label column (130 px, condensed caps) and chips. A character chip has a round portrait and the name; Must have on: yellow with shadow; Must not have on: red, white text, line through. Affiliation and size chips are condensed caps segments, yellow when on. Two checkboxes with red `accent-color`. The open part has a dashed top line.
- **More filters** / **Fewer filters**: yellow button with a chevron. **Reset filters**: underlined text, only when the filters are open.
- Count line: "38 squads" (Bangers) and the hint line on the right (condensed italic caps).
- Squad row: white, border, hard shadow. The threat in big red Bangers with outline, the round portraits (62 px) with the name under each, the affiliation tags on the right (black, white caps, yellow star for the leader). The current squad: yellow with a red shadow.

### Compare crisis cards (Step 2)

- Comic frame (as the roster popup), on the blurred and dotted backdrop. Yellow × on the top right corner.
- Header in halftone, blue on the Secures tab and red on the Extracts tab. Tag "You vs James" (turned). Title "Compare secures" / "Compare extracts" (white Bangers with outline). On the right, the deck button: yellow, skewed, Bangers, "Choose my secures!".
- Folder tabs **Secures** / **Extracts** at the bottom of the header: the selected one yellow and up, the other paper and down.
- Rays stage with two lanes, one over the other. Each lane: fan carousel, then a skewed paper plate with a person icon and the name, then ← "Secure N of M" →.

### Choose 1 (Step 3)

- Comic frame, 2 cards. Header in halftone, blue for secures and red for extracts. Tag "James · secures · pick one". Title "Choose 1 of James's secures!".
- Rays stage: the 2 cards big, side by side, hard shadow. Under each card, **Choose this card!** (red, skewed, Bangers).

## Decisions

1. **Header color by card type**, not by side: Secure blue, Extract red, as in all 3 boards. The side colors stay on the table only.
2. **Breakdown threat buttons:** one button per value of `threats`, as today. The count is the number of squads with the current filters, as today. Clicking the selected value does nothing.
3. **Breakdown rows** become real `<button>` elements when a click chooses (`aria-pressed` for the current squad). When a click does not choose, a row is a plain element, and the hint line shows `chooseBlock`, as today.
4. **Breakdown keeps** what the design does not show: affiliation icons on the affiliation chips, the filter count in the **More filters** label, the "more than N characters" message, the "No squad has threat …" lines.
5. **Compare tag:** "You vs <other>" when the viewer has a side (`mySide`). In the Sandbox and a solo room: "<top name> vs <other name>". Names from `playerName`.
6. **Compare deck button label:** always "Choose my secures!" / "Choose my extracts!". A player picks which of their own cards to play, so the label speaks for the viewer. Same lock, disabled state and title as today (`deckButton`). A click chooses and closes. Only in the deck step, as today.
7. **Compare lanes:** `Carousel` with `fan` and `renderNav` (from lobby-redesign Step 4), not a copy of the design's card code. Drag, swipe and the arrow keys (`stepRef`) stay. A lane with no cards shows "No secure cards" in the comic style.
8. **Lane plate:** a person icon in a small square, not an avatar, because the table has no avatars. Reuse `SeatPlate` if its look fits; else a small `comic` rule. No copy of the plate code.
9. **Choose 1:** the design toggles "Chosen!". The app picks the card and closes the overlay, as today. No "Chosen!" state.
10. **Choose 1, the other player:** no buttons, and "Waiting for James to choose a card." under the cards in the comic style (yellow note).
11. **Styles:** a new `crisis/crisis.css` for Steps 2 and 3, `.comic` on the dialog root, fonts from `comicBase.js`. Breakdown rules go to `rosters/roster.css` (scoped to the popup). Remove the old `breakdown-*`, `crisis-compare*`, `crisis-choose*` rules from `index.css`, and the `roster-popup-*` rules that nothing uses after Step 3 (check Settings first, it uses some).
12. **Narrow screen:** the frame fills the screen with a 16 px gutter. Breakdown: the label column goes above the chips, rows wrap. Compare: cards smaller. Choose 1: the 2 cards smaller, still side by side. No horizontal scroll.

## Steps

### Step 1: Breakdown tab

- Files: `rosters/BreakdownTab.jsx`, `rosters/roster.css`, `index.css` (remove `breakdown-*` rules that nothing uses).
- Docs: `squad-breakdown.md` "Breakdown tab" (look, button labels **Fewer filters**, the head line). Keep the rules text.
- Checks: `pnpm format`, `pnpm lint`, web tests, `pnpm --filter web build`.

### Step 2: Compare crisis cards

- Files: `crisis/CrisisCompare.jsx`, `crisis/crisis.css` (new), `rooms/SeatPlate.jsx` only if decision 8 needs a prop, `index.css` (remove `crisis-compare*`).
- Docs: `setup-game.md` "Crisis cards" (labels: tabs **Secures** / **Extracts**, **Choose my secures!**, the tag).
- Checks: format, lint, web tests, build.

### Step 3: Choose 1

- Files: `crisis/CrisisChoose.jsx`, `crisis/crisis.css`, `crisis/CrisisCompare.jsx` (`CrisisFace` if the card needs a class), `index.css` (remove `crisis-choose*` and unused `roster-popup-*`).
- Docs: `setup-game.md` "Crisis cards" (**Choose this card!**, the tag).
- Checks: format, lint, web tests, build.

## Results
