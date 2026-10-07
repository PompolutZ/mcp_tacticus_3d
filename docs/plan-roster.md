# Plan: Load roster

Implementation plan for `docs/feature-roster.md` (the design). Coder agents do one phase each, in order. Each agent adds a short **Result** to its phase: files, facts found, changes from the plan, open issues. The next agent reads the results of all earlier phases.

## Rules for every phase

- Read `CLAUDE.md`, this plan, and the design sections that the phase names. Do not open the app in a browser. Check with `npx vite build`.
- Do not commit and do not push. Leave the changes in the working tree.
- Match the style of the code around you: plain, short comments that say why. Units are inches, 1 three.js unit = 1".
- Keep tool output small (`head`, `grep`, `jq`, summaries). Do not print the Jarvis JSON files: `jarvis-characters.json` is 110k lines.
- Temporary scripts go in the scratchpad: `/private/tmp/claude-501/-Users-olehlutsenko--dev-mcp-assist-3d/cd246471-f47c-42bd-b839-8e6162a4a896/scratchpad/`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".

## Names used in all phases

| Thing | Value |
|---|---|
| Teams | `blue` (+z), `red` (−z), the same keys as the trays |
| Card kinds | `character`, `tactic`, `secure`, `extract` |
| Roster state in `App.jsx` | `rosters: { blue: null \| { code }, red: null \| { code } }` |
| Parsed roster | `{ characters: [{ code, gems: [code] }], tactics: [code], secure: [code], extract: [code], unknown: [code] }` |
| Team Tactic data | `src/tactics/jarvis-tactics-cards.json`, from `scripts/fetch-jarvis-tactics.mjs` |
| Crisis data | `jarvis-crisis-cards.json`: 72 rows, 45 different codes. Each code has one current printing (`replacedBy: null`). `type` is `Secure` or `Extraction`. |
| Second Sentinel MK4 | `00510102`. It is not in Jarvis. `CHARACTERS` has a row for it (from `characters.json`). |

## Decisions that fill gaps in the design

1. `parseRoster(text, kindOf)` gets the lookup as an argument. `kindOf(code)` returns a card kind or null. So `mct.js` has no imports and Node can load it. `cards.js` exports the lookup and a wrapper for the app.
2. The stored `code` holds only the known codes. The unknown codes show once, in the load warning.
3. Codes after `-` are gems only when the first code of the group is a character. A gem is any code whose kind is `tactic`. An unknown gem code goes to `unknown`, and the character loads without it. When the first code is not a character, each code of the group counts on its own.
4. The text search is `/\d{8}(?:-\d{8})*/g`, with no check of the characters around a match. TTS also uses a plain substring search.
5. A card without an image shows its name and MCT code drawn into a canvas texture on the plate. So the label lies flat and faces the owner, the same as the card images. The `.tray-label` CSS that the design names was removed earlier (see `docs/characters-hud.md`, line ~777).
6. A plate without an image takes no pointer events. It has no action, so the pointer works the same as over the empty table.
7. Roster cards lie at y = 0.01, below the character trays (y = 0.02). When a tray and a roster overlap, the tray draws on top.
8. The toolbar field keeps the text that the player typed. **×** clears the field and the roster.

## Phase 1: Rename and Team Tactic data

Read in the design: "Data", "Code" (the last paragraph). Read `scripts/fetch-jarvis-crisis-cards.mjs` and the Jarvis sections of `scripts/README.md`.

1. `git mv src/characters/roster.js src/characters/characters.js`. Rename the export `ROSTER` to `CHARACTERS`. Update the 6 imports in `src` (`grep -rn "characters/roster" src`).
2. `Library.jsx` already has a local `const CHARACTERS` (available characters first). Give the local list another name, for example `LIBRARY_ROWS`.
3. Update the docs that name `roster.js` or `ROSTER`: `docs/feature-library.md`, `docs/characters-hud.md`. Do not change `docs/feature-roster.md`.
4. `scripts/fetch-jarvis-tactics.mjs`, the same shape as `fetch-jarvis-crisis-cards.mjs`. API: `GET https://www.jarvis-protocol.com/api/team_tactics_cards` (needs the same `Referer` header). Keep every row, sorted by slug. Keep only these fields: `exportCode`, `slug`, `name`, `isInfinityGem`, `affiliation`, `tags`, and the legality fields. Look at one row first to find the legality field names; the crisis data uses `challengerStatus`, `standardTimelineStatus` and similar. Print the number of rows, rows with a code, and gems.
5. Add `"fetch-jarvis-tactics"` to `package.json` scripts. Run it. Expected on 2026-10-07: 519 rows, 512 with a code, 14 gems.
6. Add a section to `scripts/README.md`, next to the other Jarvis scripts.

Checks: `npx vite build`. `grep -rn "ROSTER\|characters/roster\|roster\.js" src scripts docs README.md` finds only `docs/feature-roster.md` and this plan.

### Result

Files:
- Renamed `src/characters/roster.js` to `characters.js`, export `CHARACTERS`. Imports updated in `App.jsx`, `Scene.jsx`, `Library.jsx`, `TrayControls.jsx`, `TrayPopup.jsx`, `CharacterTray.jsx`.
- `Library.jsx`: local list is now `LIBRARY_ROWS`.
- Docs: `docs/feature-library.md`, `docs/characters-hud.md`.
- New: `scripts/fetch-jarvis-tactics.mjs`, `src/tactics/jarvis-tactics-cards.json` (248 KB). Changed: `package.json`, `scripts/README.md`.

Fetch script output: `519 cards: 512 with a code, 14 Infinity Gems`. The 512 rows have 401 different codes.

Legality fields kept: `timelines`, `standardTimelineStatus`, `extendedTimelineStatus`, `computedStatus`, `latestComputedStatus`. Tactic rows have no `challengerStatus`. Missing fields are written as null.

Changes from the plan: none.

Open issues: none. The "6 imports" in the plan were 6 files, and all are updated.

## Phase 2: Parser and card lookup

Read in the design: "Players apply the rules", "MCT code", "Parse rules", "Data", "Cards without files". Read `src/characters/characters.js`, `src/tactics/cards.js`, `src/tactics/files.js`, `src/crisis/cards.js`, `src/crisis/files.js`, `src/characters/files.js`.

1. `src/rosters/mct.js`, no imports:
   - `parseRoster(text, kindOf)` returns a parsed roster (see "Names"). Follow the parse rules and decisions 1–4. Keep the text order inside each group. Keep duplicates.
   - `formatMctCode(parsed)` returns the Jarvis format: characters (`code-gem-gem`), then tactics, Secure, Extract, joined by `,`. No unknown codes.
   - `isEmptyRoster(parsed)`: true when no group has a known card.
2. `src/rosters/cards.js` (app side, it imports JSON):
   - Index every code once. Characters: `CHARACTERS` by `mctCode`. Team Tactic cards: the first row of each `exportCode` in `jarvis-tactics-cards.json`. Crisis cards: the current printing of each code (`Secure` → `secure`, `Extraction` → `extract`).
   - `cardKind(code)`: the kind or null.
   - `rosterCard(code)`: `{ code, kind, name, image, model }` or null. `image` is a path relative to `src/assets` for a card that the app has files for, else null: `characterCard(slug, 'healthy')` when the character is `available`, `tacticCardFace(key)` from `tactics/cards.json` by `id`, `crisisCardFace(key)` from `crisis/cards.json` by `id`. `model` is the character's `available`; false for the other kinds.
   - `parseRosterText(text)` = `parseRoster(text, cardKind)`.
3. Check in Node with a scratchpad script. Load the real `cards.js` through Vite, so the check uses the real data: `createServer({ root: <repo>, server: { middlewareMode: true }, appType: 'custom' })`, then `ssrLoadModule('/src/rosters/cards.js')`. If the bare `vite` import fails from the scratchpad, import it by its absolute path in `node_modules`. Cases:
   - A full code in Jarvis format, built from real codes (10 characters, 10 tactics, 5 Secure, 5 Extract).
   - The same codes with spaces, line breaks, `|` and a TTS name line.
   - Adam Warlock with one gem (`01910101-01910104`) and with two gems.
   - Two Sentinel MK4: `00510101,00510102`.
   - An unknown code (`99999999`), and an unknown gem code.
   - A text with no codes: `isEmptyRoster` is true.
   - `formatMctCode(parseRosterText(formatMctCode(x)))` equals `formatMctCode(x)`.
   - Counts of cards with an image, to compare with the design ("Cards without files").

Checks: the Node script, `npx vite build`. Put the script's cases and output (short) in the Result.

### Result

Files: new `src/rosters/mct.js` (no imports) and `src/rosters/cards.js`.

API:
- `mct.js`: `parseRoster(text, kindOf)`, `formatMctCode(parsed)`, `isEmptyRoster(parsed)`.
- `cards.js`: `cardKind(code)`, `rosterCard(code)` giving `{ code, kind, name, image, model }` or null, `parseRosterText(text)`.
- `image` is relative to `src/assets`. Characters use `characterCard(slug, 'healthy')` when `available`.

Check: scratchpad `check2.mjs` loads the real `cards.js` through Vite. Output:
- Full code, 10 characters / 10 tactics / 5 Secure / 5 Extract: parses to 10/10/5/5, no unknown, `formatMctCode` gives the input back.
- Same codes with spaces, line breaks, `|` and a name line: same result, same output code.
- `01910101-01910104`: one gem. With `-00250101`: two gems.
- `00510101,00510102`: two characters, no gems.
- `99999999,01520101`: 1 character, `unknown = [99999999]`.
- `01910101-99999999`: character with no gems, `99999999` unknown.
- A group whose first code is a tactic (`tactic-secure`): each code counted alone.
- No codes (`hello 123 abc`) and only `99999999`: `isEmptyRoster` true. Full roster: false.
- `formatMctCode(parseRosterText(formatMctCode(x)))` equals `formatMctCode(x)`: true.

Image counts (codes / with image): characters 233 / 65 (all 65 have a model), tactics 401 / 69, Secure 23 / 12, Extract 22 / 12. That is 45 crisis codes, 24 with an image. These match the design (65, 69, 24). The 512 tactic rows have 401 codes.

Changes from the plan:
- Three ids in `src/tactics/cards.json` lost the leading zero (`1430206`, `1430207`, `1430209`). `cards.js` pads ids to 8 digits, so these cards get their image. Without it the count was 66.
- A character code wins over a tactic or crisis row with the same code (first one indexed). No such clash exists now.

Open issues: `src/tactics/cards.json` still has the 7-digit ids. Setup game must pad them too, or the file should be fixed in `scripts/migrate-tactics.mjs`. Some crisis rows have an empty `exportCode`; they are skipped.

## Phase 3: State and toolbar

Read in the design: "Input", "VP picker", "State". Read `src/components/Toolbar.jsx`, the `.toolbar` and `.chip` rules in `src/index.css`, and in `src/App.jsx`: the state block (lines ~115–220), `showHudMessage`, and the `<Toolbar>` props.

1. `App.jsx`: add the `rosters` state. `handleRosterLoad(team, text)`:
   - Parse with `parseRosterText`. When `isEmptyRoster`, show "No known MCT code in the text" and keep the old roster.
   - Else set `{ code: formatMctCode(parsed) }`. When there are unknown codes, show "N unknown codes: a, b, c". Use "1 unknown code" for one. Show at most 5 codes, then "…".
   - `handleRosterRemove(team)` sets null.
2. `Toolbar.jsx`: a **Roster** group after **Crisis**. One text input per team, with `chip chip--player-<team>` classes, placeholder "MCT code", and a title. Enter calls `onRosterLoad(team, text)`. A **×** button after each input calls `onRosterRemove(team)` and clears the input. The input text is local state in the toolbar (decision 8).
3. Remove the **VP** group, its `AFFILIATIONS` import and the `onAffiliationChange` prop. In `App.jsx`, keep the `affiliations` state and add a comment: Setup game sets it (see `docs/feature-setup-game.md`).
4. CSS for the text input in `index.css`, so that it looks like the other chips. Keys typed in the input must not start tools; `isEditing` in `src/keyboard.js` already handles inputs, so check that it covers this one.

Checks: `npx vite build`. `grep -n "affiliation" src/components/Toolbar.jsx` is empty.

### Result

Files: `src/App.jsx`, `src/components/Toolbar.jsx`, `src/index.css`, `src/rosters/cards.js`.

- `cards.js`: added `.js` to the 4 local imports. JSON imports keep `.json`.
- `App.jsx`: new state `rosters`, `handleRosterLoad(team, text)`, `handleRosterRemove(team)`. Messages as in the plan (max 5 codes, then "…"). `affiliations` state stays, with a comment that Setup game sets it.
- `Toolbar.jsx`: props added `onRosterLoad`, `onRosterRemove`. Removed `affiliations`, `onAffiliationChange`, the VP group, the `AFFILIATIONS` import. New **Roster** group after Crisis: one text input per team, **×** button, input text in toolbar state.
- `index.css`: `.roster-field`, `.chip--text` (width 110px, text cursor, light placeholder).
- `isEditing` in `keyboard.js` matches `input`, so typing in the field starts no tool. No change needed. The keyup handler only clears held keys, so it is harmless.

Changes from the plan: none. The element gets an extra class `chip--text`.

Open issues: `rosters` is not used until Phase 4. `setAffiliations` is unused until Setup game. Not checked in a browser.

## Phase 4: Cards on the table

Read in the design: "On the table", "Cards without files", "Card actions". Read `src/table.js`, `src/tactics/layout.js`, `src/crisis/layout.js`, the top of `src/characters/trays.js` (sizes, `trayYaw`), `src/components/CrisisCard.jsx`, `src/components/TacticCard.jsx`, and in `src/components/Scene.jsx`: the props, `characterAt`, `terrainAt`, the crisis card and tactic tray blocks (lines ~575–720).

1. `src/rosters/layout.js`, plain module (no React, no `assets/index.js`):
   - Use the size constants of the other layout modules: `TRAY_CARD_WIDTH`/`HEIGHT`, `TACTIC_CARD_WIDTH`/`HEIGHT`, crisis `CARD_WIDTH`/`HEIGHT`, `TACTIC_TRAY_OUTER_Z`, `TABLE_WIDTH`.
   - Row 1 starts 0.3" past `TACTIC_TRAY_OUTER_Z`. Row 2 starts 0.3" past row 1. Cards are 0.3" apart, groups 1" apart. Row 2 cards are centered on the row's center line. Crisis cards are portrait (2.75" × 4.8").
   - Order from the owner's left. Compute in the owner's local space, then mirror for red, the same as `trays.js`.
   - A row that is wider than the table (keep a small margin) gets one scale factor for its cards and gaps.
   - `rosterLayout(team, parsed)` returns `[{ code, kind, gems, x, z, width, height, yaw }]`. Export `ROSTER_CARD_Y = 0.01` (decision 7).
2. `src/components/RosterCards.jsx`: the cards of one roster. Props: `team`, `code`, `onOpen`. Parse with `parseRosterText(code)` in a `useMemo`, then lay out.
   - A card with an image: a textured plane, the image top toward the mat, the same as a tray card. Left click calls `onOpen({ src, alt })` with `stopPropagation`. Hover shows the pointer cursor (`useHoverCursor`). Wrap each textured card in its own `Suspense`.
   - A card without an image: a plain plate with a canvas texture: name, MCT code, and "No model" for a character without a model (decisions 5 and 6). Dispose the texture on unmount.
   - A gem: a text line "+ <gem name>" on the lower edge of its character card (canvas texture).
   - No `RigidBody`, no collider.
3. `Scene.jsx`: render `RosterCards` for each team with a roster. `App.jsx` passes `rosters` to `Scene`. Reuse `onCardOpen`.
4. Find how a tool key (1–6) finds the point and piece under the pointer. Confirm that a roster card does not change the result. If it does, fix it so that a roster card counts as the empty table. Write what you found in the Result.

Checks: `npx vite build`. A Node script that prints the layout for a full roster (10 / 10 + 5 + 5) for both teams, and for a row of 15 characters. Expected for blue: row 1 at z = 22.7…25.7, row 2 at z = 26.0…30.8, row 2 width 59.6". Every card inside the table (x within ±36, z within ±34).

### Result

Files: new `src/rosters/layout.js` (`rosterLayout`, `ROSTER_CARD_Y`, plus `rosterRowInfo` for the Node check) and `src/components/RosterCards.jsx`. Changed: `Scene.jsx` (prop `rosters`, renders `RosterCards` per team before the tactic cards), `App.jsx` (passes `rosters`).

Layout check (scratchpad `check4.mjs`, real `layout.js`). Full roster 10 / 10 + 5 + 5, both teams:
- Row 1 |z| = 22.70 to 25.70, width 47.7", x = -23.9 to 23.9.
- Row 2 |z| = 26.00 to 30.81 (crisis), tactic cards 26.66 to 30.16, width 59.6", x = -29.8 to 29.8. Scale 1.
- Red is the mirror: same |z|, yaw π. No card outside x ±36, z ±34.
- 15 characters: row width 70", scale 0.976, x = -35 to 35, all inside.
- 30 tactics + 5 + 5: scale 0.606, x = -35 to 35, all inside.

Tool keys (step 4): a key 1–6 takes the piece from `hoveredRef`, which only `onPieceHover` sets (characters and tokens). Roster cards never call it. With no piece, the key only toggles the tool, and tools spawn at fixed positions. The drag looks at the plane and at model objects only (`modelUnder`), `terrainAt` at terrain objects only, and `castDown` at fixed bodies only. A roster card has none of these. So a card counts as the empty table. No fix needed.

Changes from the plan:
- Rows scale to the table width minus 1" on each side (70").
- A gem line is 0.45" high at scale 1, one more line above it for each further gem. It takes no pointer events, the same as a plate.
- An unknown code in the stored roster is skipped when drawing (cannot happen, the stored code holds known codes only).

Open issues: not checked in a browser. Canvas text size and plate colors are by guess. A gem line covers the bottom of the card art.

## Phase 5: Docs

1. `README.md`: a short section "Roster" before "Roadmap". How to load, how to remove, what shows on the table, unknown codes, no roster checks.
2. `docs/feature-roster.md`: set the status to done. Update the "Code" table and "Data" numbers where the code changed them (`parseRoster(text, kindOf)`, crisis codes: 45 different codes).
3. Read the Results of all phases. List the open issues for the user.

### Result

Files: `README.md` (new section "Roster" before "Roadmap"), `docs/feature-roster.md` (status done, "Data", "Code", "Cards without files", Decisions 6 to 13), `src/components/RosterCards.jsx`.

Code fixes in `RosterCards.jsx`: the gem material has `polygonOffset` with factor and units -2, so it draws on top of its card. `NO_RAYCAST` is a module constant.

Changes from the plan: the crisis count in "Cards without files" is now 24 of 45 codes (was 66 rows).

Open issues from all phases:
- Nothing was checked in a browser. Canvas text size and plate colors are by guess.
- A gem line covers the bottom of the card art.
- `src/tactics/cards.json` has three 7-digit ids (`1430206`, `1430207`, `1430209`). `cards.js` pads them. Setup game must pad them too, or `scripts/migrate-tactics.mjs` should be fixed.
- Some crisis rows have an empty `exportCode`. The app skips them.
- A character code wins over a tactic or crisis row with the same code. No such clash exists now.
- `setAffiliations` is unused until Setup game. Both VP markers show the Unaffiliated token until then.
- The roster and the character trays overlap when both are on the table. The player removes the roster with **×**.
- A new card that Jarvis adds is an unknown code until the fetch scripts run again.
