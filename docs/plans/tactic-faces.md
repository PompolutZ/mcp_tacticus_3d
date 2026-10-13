# Plan: Generated faces of the Team Tactic cards

Requested on 2026-10-13. The face images from the TTS mod are pale scans, and some have old text. The user wants faces that look like the Jarvis Protocol cards: the card art at low opacity, with clean text from the Jarvis data. Jarvis draws its faces in HTML.

The first version of this plan rendered the faces to WebP files with a script. The user changed the request: the app draws the face with a React component, from the back art, the Jarvis data, our fonts and our icons. A test step (commit `67486e2`) drew 3 cards this way, as DOM in the popup and as a canvas texture on the table. The user checked it in Chrome, Safari and Firefox, and it works.

## Facts

Checked on 2026-10-13:
- All 400 released cards are migrated: face and back (`src/assets/tactics/`, 800 files, 127 MB). Faces are mod scans. Backs are the card art with the name bar.
- Faces are shown in these places:
  - 3D, as a texture: `TacticCard.jsx`, `RosterCards.jsx` (`Face`).
  - HTML, as `<img>`: `CardPopup.jsx`, the Alt peek (`useCardPeek.js`), `RosterPopup.jsx`, `TrayPopup.jsx` (gems only).
  - `Library.jsx` shows only the back.
- Jarvis has no face image. Its page draws the face in HTML: the art at opacity 0.2, a title bar, affiliation, type, text. Its CSS card size is 446 × 640. That is not the real card shape (2.5 × 3.5).
- The list `GET /api/team_tactics_cards` already has the full card data: `type`, `body`, `secondaryBody`, `intermediaryBody`, `superPowers`, `attacks`, `artist`, `affiliation`, `squished`, `biggerIcons`. So one request gets all cards. `fetch-jarvis-tactics.mjs` keeps only a few of these fields now.
- Match with `src/tactics/cards.json`: 383 cards by `exportCode` = `id`, 14 more by slug = key. 3 match neither: `go-getem-tiger`, `parts-of-a-whole`, `replusor-refraction` (spelling differences).
- Fonts: Barlow Condensed (`@fontsource/barlow-condensed`) and Noto Sans with the width axis (`@fontsource-variable/noto-sans`, family `Noto Sans Variable`). Both use the SIL Open Font License. Jarvis uses paid fonts.
- Jarvis icons are PNGs in its JS bundle, mostly 32 × 32, a few 68 × 68. The prototype has 28. They show the AMG game symbols.
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
- Test step results:
  - The texture method: mount the component off screen, wait for fonts and layout, copy the DOM into an SVG `<foreignObject>` with fonts, art and icons inlined as data URLs, draw the SVG into a canvas, use it as a `CanvasTexture`. Safari needs 2 draws with a frame between.
  - One card is about 0.6 MB of SVG. Most of it is the art and the fonts.

Prototype files, outside the repo in `/Users/olehlutsenko/_dev/tactic-faces-prototype/`: `template.html` (template, parser, fit loop), `data/` (Jarvis entries of 12 test cards, `en.json`), `icons/` and `icon_hashes.json`, `renders/` (approved renders), `compare/`. The folder is deleted when the plan is done.

## Decisions

1. **The face is a React component, `TacticFace`.** HTML places render it directly. 3D places use a canvas texture drawn from the same component. There is one layout, so the table and the popup look the same.
2. **Card shape:** the layout is 457 × 640 CSS px, the real 2.5 × 3.5 shape. The texture is 728 × 1019 px (scale 1.59).
3. **Data:** `fetch-jarvis-tactics.mjs` writes the text fields to `src/tactics/jarvis-tactics-text.json`. The app loads it with a dynamic `import()`, so it is a separate chunk and the main bundle does not grow. `jarvis-tactics-cards.json` does not change.
4. **Match:** first `exportCode`, then slug. The 3 cards that match neither go into a small map of key to Jarvis slug in the fetch script.
5. **Art:** our back image (`<key>-back.webp`) at opacity 0.2. The title bar covers the art's own name bar fully.
6. **Fit:** the text starts at 19.5 px and shrinks in 0.5 px steps until all blocks fit, with at least 14 px above the footer and below the title. The `squished` flag is not used. In dev, the console lists the cards that need less than 15 px.
7. **Icons:** the Jarvis PNGs, converted to lossless WebP in `src/assets/tactic-icons/`, named by meaning. A later plan can replace them with SVGs one at a time. The component does not change for that.
8. **Texture life:** a texture is drawn when a card first needs it, and then cached by key. Until it is ready, the face shows the art at opacity 0.2 on the card color, without text.
9. **The mod face scans go away** for every card with Jarvis data. `migrate-tactics.mjs` stops writing those faces. The Infinity Gems are drawn too (changed after Phase 2: Jarvis has full text for them, and draws them with the same template plus a threat pill). A card with no Jarvis data would keep the scan and use the old `<img>` and texture path; today there is none. (Changed in Phase 4: such a card shows its back instead.)

## Phase 1: Data and icons

Read: this plan, `scripts/fetch-jarvis-tactics.mjs`, `scripts/lib/jarvis.mjs`, `scripts/README.md` ("Jarvis Team Tactic cards"), `src/tactics/spikeFaces.js`.

Work:
1. `fetch-jarvis-tactics.mjs` also writes `src/tactics/jarvis-tactics-text.json` (decisions 3 and 4). Keyed by our card key. Per card: `type`, `body`, `secondaryBody`, `intermediaryBody`, `superPowers`, `attacks`, `artist`, the affiliation name, `biggerIcons`. Only the fields the face uses.
2. The script prints how many cards match by code, by slug, by the map, and not at all.
3. All 28 prototype icons to lossless WebP in `src/assets/tactic-icons/`, named by meaning. A map from the Jarvis icon id (as used in `!x`) to the file. Remove the icons nobody uses after the full data is in.
4. README: the new file and its fields, and the icons.

Checks: one real run (one request). `pnpm format`, `pnpm lint`. Commit.

## Phase 2: The component everywhere

Read: this plan, the spike files (`TacticFace.jsx`, `TacticFace.css`, `tacticFaceFit.js`, `tacticFaceTexture.js`, `useTacticFaceTexture.js`, `src/tactics/faceBody.js`, `spikeFaces.js`), `TacticCard.jsx`, `RosterCards.jsx`, `CardPopup.jsx`, `useCardPeek.js`, `RosterPopup.jsx`, `docs/features/team-tactic-cards.md`.

Work:
1. `TacticFace` reads from `jarvis-tactics-text.json` (decision 3). All markup kinds, all type labels, attack panel, superpowers, footer.
2. Layout 457 × 640, texture 728 × 1019 (decision 2).
3. Fixes from the prototype review:
   - The title bar covers the art's name bar. Example: Stolen Power of Cyttorak.
   - Superpower and attack names in small caps, as on the real card.
   - The superpower panel a little see-through, as on the scan.
4. Texture: decision 8. One shared module and hook for both 3D places.
5. Use it in `TacticCard.jsx`, `RosterCards.jsx`, `CardPopup.jsx`, the Alt peek and `RosterPopup.jsx`. The gems were added later, see the note under Phase 2.
6. A dev-only page that shows all faces in a grid, with the font size under each card. It is for the layout check in phase 3. It is not in the production build.
7. Remove `spikeFaces.js` and `spike-faces.json`.
8. Feature doc `team-tactic-cards.md`: the face is drawn from Jarvis data; decisions 1, 7, 8, 9.

Checks: `pnpm format`, `pnpm lint`, the tests, `pnpm --filter web build`. Commit. The user checks the cards in the app.

Result note, gems (commit `tactic faces: Infinity Gems drawn too`): the 7 Infinity Gems are drawn too. Jarvis has their text (`superPowers`, `threatLevel`, `artist`; no `body`, no affiliation) and draws them with the same card template. The one gem part: a card with a `threatLevel` has a threat pill (round badge image `images/02e15e0cacfb89a6849d.png`, saved as `threat-level.webp`, and the number) in place of the affiliation, type and body, and its text sits at the lower end. The fetch script matches gems by slug (the reprints `-ca10` and `-cp222` share the code) and writes `threatLevel`. `TrayPopup.jsx` draws attached gems with `TacticFaceScaled`. No card keeps its scan.

## Phase 3: Layout check of all cards

Work:
1. The user opens the dev page and lists the cards that look wrong. (If the user allows it, the coder takes screenshots of the page instead.)
2. Fix the layout problems. Repeat.

Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build`. One commit per round.

Result: skipped. The user checked the cards in the app and found them good.

## Phase 4: Remove the scans

Work:
1. `migrate-tactics.mjs`: decision 9. Its `--list` shows if a face is drawn or a mod scan.
2. Delete the face scans of all cards that have a drawn face: the Team Tactic cards and the 7 Infinity Gems.
3. README: a section "Tactic faces", covering the data, the markup, the icons and the run order (`fetch-jarvis-tactics`, then `migrate-tactics`).
4. Delete the prototype folder.

Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build`. Commit.

Result (commit `tactic faces: remove mod face scans`): 400 face scans deleted (41 MB; all Team Tactic cards and the 7 gems). `tacticCardFace` removed from `src/tactics/files.js`. Fallback for a card with no Jarvis data (none today): the back, on both sides (`image` of a tactic card in `rosters/cards.js` is its back; `TacticCard.jsx` uses the back as the face). `migrate-tactics.mjs` migrates only the back; `tactic-manifest.json` lost its 400 face entries; `--list` shows "face drawn" or "no Jarvis data, back used". README section "Tactic faces" added. The prototype folder is deleted.

## Later

- Icons as SVG, one at a time.
- The same component for character stat cards, or for custom cards, as Jarvis has.
