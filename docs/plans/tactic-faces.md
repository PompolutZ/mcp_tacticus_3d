# Plan: Generated faces of the Team Tactic cards

Requested on 2026-10-13. The face images from the TTS mod are pale scans, and some have old text. The user wants faces that look like the Jarvis Protocol cards: the card art at low opacity, with clean text from the Jarvis data. Jarvis draws its faces in HTML. A prototype drew 12 cards this way (see "Prototype files" below). The user approved the result.

## Facts

Checked on 2026-10-13:
- All 400 released cards are migrated: face and back (`src/assets/tactics/`, 800 files). Faces are mod scans. Backs are the card art with the name bar.
- Jarvis has no face image. Its page draws the face in HTML: the art (`card_backs/<slug>.png` on its CDN, the same art as our backs) at opacity 0.2, a title bar, affiliation, type, text. Its CSS card size is 446 × 640.
- The list `GET /api/team_tactics_cards` already has the full card data: `type`, `body`, `secondaryBody`, `intermediaryBody`, `superPowers`, `attacks`, `artist`, `affiliation`, `squished`, `biggerIcons`. So one request gets all cards. `fetch-jarvis-tactics.mjs` keeps only a few of these fields now.
- Match with `src/tactics/cards.json`: 383 cards by `exportCode` = `id`, 14 more by slug = key. 3 match neither: `go-getem-tiger`, `parts-of-a-whole`, `replusor-refraction` (spelling differences).
- Jarvis uses paid fonts (Agency FB, Avenir Next LT Pro, Minion Pro). The prototype uses free fonts with the SIL Open Font License: Barlow Condensed (title, affiliation, footer, superpower names) and Noto Sans at `font-stretch: 75%` (type line, text).
- Jarvis icons are PNGs in its JS bundle (`/assets/images/<hash>.png`), mostly 32 × 32, a few 68 × 68. They have no licence notice. They show the AMG game symbols. About 25 icons are in use: range, power, damage, dice results, size, attack types, superpower types, and others.
- Jarvis body markup, parser `ZS` in its bundle. The body is split on `|`. The first character of a part sets its kind:
  - `\` is a paragraph break.
  - `!x` is the icon x.
  - `*` is bold.
  - `~` is a bullet. Inside a bullet, `&` stands for `|`.
  - `-` is a row.
  - `§slug§Label` and `<token>Label` are a condition or token name, written as plain text.
  - A part that starts with `.` joins the previous part.
- Type labels come from the Jarvis translation file:
  - `active` is "Active".
  - `reactive` is "Reactive".
  - `active_action` is "Active: Action".
  - `both` is "Active and Reactive", drawn as two blocks.
  - `reactive_reactive` is two Reactive blocks.
- Block order on the card:
  1. the title bar
  2. the attack panel, if the card has one
  3. affiliation and type
  4. body
  5. the 1st superpower
  6. `intermediaryBody`
  7. the remaining superpowers
  8. the footer: `© MARVEL © AMG`, feather, artist. With no artist, the feather is left out too.
- No browser library is in the repo. The prototype used `playwright-core` from the npx cache.

Prototype files, outside the repo in `/Users/olehlutsenko/_dev/tactic-faces-prototype/`:
- `template.html`: the card template, with the parser and the fit loop
- `build.mjs`, `shot2.mjs`, `old.mjs`: build, screenshot and old-face scripts. Their paths still point to the old session scratchpad.
- `data/`: the Jarvis entries of the test cards
- `icons/` and `icon_hashes.json`: the Jarvis icons and their bundle hashes
- `renders/`: the approved renders
- `compare/`: each render next to the old scan, plus contact sheets

Phase 2 copies what it needs into the repo. The folder is deleted when the plan is done.

## Decisions

1. **A script renders the faces to WebP.** The app does not change: it still loads `<key>-face.webp`. A text update from Jarvis means: fetch, then render again.
2. **The generated face replaces the mod scan**, same file name. `migrate-tactics.mjs` stops converting faces. It still converts backs and writes `cards.json`. A card without Jarvis data, and the Infinity Gems, keep the mod scan. The script converts those faces only.
3. **The card text stays out of the app bundle.** `src/tactics/jarvis-tactics-cards.json` keeps its current fields, because the app imports it. The fetch script writes the text fields to a second file, `scripts/jarvis-tactics-text.json`. Only the render script reads it.
4. **Match:** first `exportCode`, then slug. The 3 cards that match neither go into a small map of key to Jarvis slug in the render script.
5. **Art:** our back image (`<key>-back.webp`) at opacity 0.2. The title bar covers the art's own name bar fully.
6. **Fonts:** Barlow Condensed and Noto Sans, as `.woff2` files in the repo, with their OFL licence file. No Google Fonts link, so a render works offline and gives the same result on every run.
7. **Fit:** the text starts at 19.5 px and shrinks in 0.5 px steps until all blocks fit, with at least 14 px above the footer and below the title. The `squished` flag is not used. The script prints the cards that need less than 15 px, so a person can check them.
8. **Browser:** `playwright-core` as a dev dependency of `apps/web`, with the installed Chrome (`channel: 'chrome'`). No browser download.
9. **Output size:** the layout is 446 × 640 CSS px. It is rendered at device scale 2.33, and the WebP is about 1040 px high, the same as `CARD_SIZE` today.
10. **Icons:** the Jarvis PNGs first, stored in the repo. They look a bit soft at the output size, because a 32 px icon is drawn at about 50 px. A later plan replaces them with our own SVGs, one at a time. The user chose this on 2026-10-13.

## Phase 1: Jarvis text data

Read: this plan, `scripts/fetch-jarvis-tactics.mjs`, `scripts/lib/jarvis.mjs`, `scripts/README.md` ("Jarvis Team Tactic cards").

Work:
1. `fetch-jarvis-tactics.mjs` also writes `scripts/jarvis-tactics-text.json` (decision 3). Per card: `slug`, `exportCode`, `name`, `type`, `body`, `secondaryBody`, `intermediaryBody`, `superPowers`, `attacks`, `artist`, the affiliation name, `biggerIcons`. Sorted by slug.
2. The script prints how many cards of `src/tactics/cards.json` match by code, by slug, and not at all.
3. README: the new file and its fields.

Checks: one real run (one request). `pnpm format`, `pnpm lint`. Commit with the new JSON.

## Phase 2: Render script

Read: this plan, the prototype files, `scripts/migrate-tactics.mjs`, `scripts/lib/manifest.mjs`, `src/tactics/files.js`, `scripts/README.md` ("TTS tactic cards").

Work:
1. `scripts/tactic-face/`:
   - `template.html` with its CSS
   - `body.mjs`: the body parser, a pure function from the Jarvis body string to a list of parts, with a unit test in the style of `lib/*.test.js`
   - `fonts/` with the `.woff2` files and `OFL.txt`
   - `icons/`
2. `scripts/render-tactics.mjs`:
   - What it renders: all cards with Jarvis data, or the keys given as arguments. `--out <dir>` for a trial run, as in the migrate scripts.
   - For each card: data, art, page, screenshot, WebP into `src/assets/tactics/<key>-face.webp`. Decisions 4 to 9.
   - One browser page for all cards.
   - It prints the cards with small text (decision 7), and the cards without Jarvis data.
3. Prototype fixes:
   - The title bar covers the art's name bar (decision 5). Example: Stolen Power of Cyttorak.
   - Superpower and attack names in small caps, as on the real card.
   - The superpower panel a little see-through, as on the scan.
4. `migrate-tactics.mjs`: decision 2. Its `--list` shows if a face is generated or a mod scan.
5. `package.json`: the script `render-tactics`, and the dev dependency `playwright-core`.
6. README: a new section "Generated tactic faces", covering the facts, the markup and the run order. The run order is `fetch-jarvis-tactics`, then `migrate-tactics` (backs), then `render-tactics`.

Checks:
- Render the 12 prototype cards: `patch-up`, `spirit-of-wakanda`, `foreign-assignment`, `immortal-servants`, `chronal-manipulation`, `clean-up`, `caught-in-a-ham`, `scientific-method`, `venomized`, `mutant-traitor`, `stolen-power-of-cyttorak`, `the-invaders`. Compare them with the prototype PNGs.
- Run `pnpm format`, `pnpm lint`, the tests, and `pnpm --filter web build`.
- Commit the script and these 12 faces only.

## Phase 3: All faces

Work:
1. Run `render-tactics` for all cards.
2. Look at a contact sheet of the cards from the small-text list, and of 20 random cards. Fix the layout problems found. Repeat.
3. `docs/features/team-tactic-cards.md`:
   - "Cards": the face is generated from Jarvis data, and the Gems and unmatched cards keep the scan.
   - "Out of scope": the card text is now in the repo (for the renderer only).
   - "Decisions": the new decision.

Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build`. Commit the faces. Then the user checks the cards in the app.

## Later

- Icons as SVG, one at a time (decision 10).
- The same template for character stat cards, or for custom cards, as Jarvis has.
