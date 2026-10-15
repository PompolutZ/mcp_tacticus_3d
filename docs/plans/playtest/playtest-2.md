# Plan: Feedback from the second playtest

Requested by the user on 2026-10-13. Status: all parts done.

Branch `playtest-2`, worktree `../mcp_assist_3d-playtest-2`. One coder step and one commit for each part. Each part writes its **Result** below when it is done.

## Requests

1. Tokens of a team tactic card spawn under the Automatic Power Phase button. Move the power button into the board strip, one per side, where the Cleanup Phase button is now. The Cleanup Phase button affects both players, so it moves to the middle, under the scoring board.
2. Some tactic cards collect tokens (N'Kantu Captured Soul, Mephisto Devil's Deal, Spider-Sleuth Evidence). These tokens should build a pile with a number. A player takes tokens off the pile one by one.
3. New rules let a model stand under an overhang of terrain. The Wakanda tree has a collider like an upside-down triangle, so a base fits under its edge. Today a dragged model always goes on top. Keep that as the default. During a model drag over an overhang, R moves the base to the floor under the overhang. So a model can be dragged on two floors.

## Facts

### Buttons

- Power button: `powerButton(side)` in `src/tabletools/layout.js`. Host place x ≈ -12.99, z 20.35, 7.48" × 1.2". It is in the tactic tray row, to the owner's left of the tactic plate.
- Tactic token piles: `tacticPilePlace` in `src/tactics/layout.js`. Row 0 for host: x -9.45 to -15.45, z 20.35. That is inside the footprint of the power button, so the button covers them.
- Board strip: `boardStrip(side)` in `src/tabletools/layout.js`, x -20.6 to -18.3, z ±12.6 to ±18, length 5.4" along z. Row 1 (x -20, nearer the table edge): Cleanup Phase. Row 2 (x -18.9): Deploy Lock and the mat turn buttons. The strip reads like the scoring board: its top faces -x.
- Scoring board: `src/scoreboard/board.js`, x -27.1 to -19.1, z -9 to 9. Its top faces -x, so "under the board" is its mat side. The gap between the board and the mat edge (x -18) is 1.1".
- Buttons are drawn in `src/components/TableButtons.jsx`.

### Token piles

- A pile is `{ id, key, x, z, card? }` (`tokenPiles`). It never runs out. A left drag takes a new loose token. Shift + drag moves the pile (`src/components/TokenPile.jsx`). A click does nothing.
- A loose token has no count (`looseTokens`, `src/components/LooseToken.jsx`). Loose tokens can lie on top of each other in height (`src/tokens/stack.js`).
- Card tokens come from the TTS mod: `scripts/migrate-tactics.mjs` writes `tokens` of each card into `src/tactics/cards.json`. Token data: `src/tokens/tokens.json` (`migrate-tokens.mjs`).
- Tokens on a character already have a count: a token dropped on a character tray joins the same tokens there and shows a number, and the player removes them one by one (`docs/features/character-trays.md`, "Give tokens by drag and drop"). Devil's Deal and Captured Soul are character tokens from the Give sources of Mephisto and N'Kantu, so they work already (user test, 2026-10-13).
- So a counted pile is missing only for tokens that lie on a tactic card or on the table.

### Drag height

- Model drag: `src/components/CharacterModel.jsx`. Each frame, `baseGroundY` (`src/characters/base.js`) casts the base cylinder down from y = 100 (`castDown` in `src/physics.js`). The first hit is the top surface, so the base never goes under an overhang.
- `castAlong` (`physics.js`) casts a shape in any direction. `castDown` takes a start height `from`.
- Terrain colliders: most pieces, `wakanda-tree` too, are one convex hull (`src/terrain/pieces.js`, `Terrain.jsx`). A hull is solid. The space under an overhang exists only outside the hull, for example under the slanted underside of the canopy.
- R is `lift` (`src/input/bindings.js`). During a model drag, Lift returns at once (`CharacterModel.jsx`, `toggleLift`), so R does nothing there now. A model drag does not count as `dragging` in the key resolver (`src/keyboard.js`).

## Decisions

1. **Buttons.**
   - The power button moves to row 1 of the board strip, one per side, where the Cleanup Phase button is now. Its label becomes "Auto Power Phase", so it fits in the 5.4" strip. It keeps its rule that only the owner presses it.
   - The Cleanup Phase button becomes one button at z 0, between the scoring board and the mat (x about -18.55), turned the same way as the strip. Both players can press it, as now.
   - The tactic tray row then has nothing over the token piles.
2. **Collected tokens.** A token gets `collect: true` in the token data. Only such tokens can build a counted pile. They are tokens that collect on a tactic card or on the table, not on a character (a character tray counts already). Candidate list from the card texts, for the user to check:
   - `sleuthevidence` (Spider-Sleuth: Evidence on the card)
   - `memory` (Are You Sure You Want To Remember?: up to 3 on the card)
   - `genetic-sample` (Cloning Banks: moved onto the card)
   - `sleuthconfession` (Spider-Sleuth: Confession on the card, added by Part 2)
   - `1-damage` (Steal the Future: damage on the card, up to 5+; added by Part 2)
   - `1-power` (The White-Hot Room: 2 power on the card, 1 removed per Power Phase; added by Part 2)
   - Rejected: LMD and Obscuring Mist (random reveal); Cosmic Awareness (1 block token, single, no token); Deeds Worth of Song (Worthy Deeds, no token in `tokens.json`); Devil's Deal, Phoenix, Confidence (on a character).
3. **Counted pile.** A loose token of a collected kind gets `count` (default 1, no field when 1). A number on the token shows the count when it is 2 or more.
   - **Click on the card pile:** the first click puts one loose token on the card that owns the pile. Each later click adds 1 to that token. A pile without a card (from the Library) puts the token next to the pile.
   - **Drop onto a token:** a dropped collected token on a loose token of the same kind joins it. The counts add up.
   - **Take one:** a left drag on a token with count 2 or more takes one token off. The count goes down by 1. Shift + drag moves the whole pile, as for a card pile.
   - **Delete key:** removes the whole counted pile.
   - The count syncs to the other player with the loose token, as the other fields do.
4. **Two floors.** During a model drag, R switches between the top floor (default) and the lower floor.
   - Lower floor: cast the base up from the table (`castAlong`) to the underside of the overhang. If the gap is taller than the base, cast down from that point (`castDown` with `from`). The hit is the lower floor.
   - In lower floor mode, each drag frame uses the lower floor. Where there is no overhang, the lower floor is the same as the top floor, so the model moves on as normal.
   - The mode ends at the drop. The next drag starts on the top floor.
   - The figure above the base can go into the terrain. The rules allow the base under the overhang, so the app checks only the base.
   - The drop already keeps the model in place: the body becomes dynamic 0.3" above the floor and falls onto it.
   - The key resolver lets R through during a model drag: a new action (for example `floor`), bound to R under a model-drag condition. Lift keeps R outside a drag. Settings show the new binding.

## Part 1: Buttons

Work:
1. `src/tabletools/layout.js`: `powerButton(side)` goes to row 1 of `boardStrip(side)`, length along z. New `cleanupButton()`: one place at z 0, between the board and the mat. Update the comments.
2. `src/components/TableButtons.jsx`: the power button in row 1 of the strip, with the new label. Cleanup Phase at the new middle place, turned like the strip.
3. `src/tabletools/layout.test.js`: update the places.
4. Docs: `docs/features/table-tools.md` (Automatic Power Phase button, board strip), `docs/features/round-phases.md` (Cleanup Phase button place).

Checks: `pnpm format`, `pnpm lint`, the web tests, `pnpm --filter web build`.

**Result:** Done. `powerButton(side)` is row 1 of the strip (x -20, 1" x 5.4" along z, label "Auto Power Phase", smaller gap/icon in CSS to fit 135 px). New `cleanupButton()`: x -18.55, z 0, 1" x 5.4" along z. The gap is 1.1", so the 1" depth fits (0.05" each side); no change needed. Both turned like the strip. Settings `show` flags unchanged. Tests and docs updated.

## Part 2: Collected token data

Work:
1. List the candidate collected tokens from `src/tactics/jarvis-tactics-text.json` (cards that put, gain or collect a number of tokens on the card or on the table). If a card lacks the token in `cards.json`, add it through an extra list in `migrate-tactics.mjs`, so that a new migration keeps it. Write the list into this plan for the user to check.
2. `collect: true` in the token data for the chosen tokens. If `tokens.json` is generated, the flag goes into `migrate-tokens.mjs` (or a list it reads).
3. Docs: `docs/features/team-tactic-cards.md`, tokens of a card.

Checks: as Part 1.

**Result:** Done. Chosen (card, reason):
- `sleuthevidence`: Spider-Sleuth, Evidence put on card, remove 3.
- `sleuthconfession`: Spider-Sleuth, Confession put on card.
- `memory`: Are You Sure You Want To Remember?, up to 3 on card.
- `genetic-sample`: Cloning Banks, any number moved onto card. Added to `cards.json` via `EXTRA_TOKENS`.
- `1-damage`: Steal the Future, damage on card. Already in `cards.json`.
- `1-power`: The White-Hot Room, 2 power on card. Added via `EXTRA_TOKENS`.

Rejected: LMD, Obscuring Mist (random reveal); Cosmic Awareness (single block token, not in `tokens.json`); Deeds Worth of Song (Worthy Deeds not in `tokens.json`); Devil's Deal, Phoenix, Confidence (on a character).

`COLLECT_KEYS` in `migrate-tokens.mjs` sets `collect: true` (also written in `tokens.json`). `isCollected(key)` in `src/tokens/tokens.js`, tested in `tokens.test.js`. Feature doc: "Collected tokens".


## Part 3: Counted pile

Work:
1. Loose token: `count` field. `LooseToken.jsx` shows the number on top when count ≥ 2.
2. Take one: a left drag on a counted token starts a drag of a new token and lowers the count. Shift + drag moves the pile.
3. Drop: a collected token dropped on a loose token of the same kind merges into it.
4. `TokenPile.jsx`: a click (no drag) on a pile of a collected token adds one to the loose token on its card, or puts the first one there.
5. Unit tests for the count rules (merge, take one, click add) in plain modules.
6. Docs: `docs/features/team-tactic-cards.md` and `docs/features/library.md` (Pile).

Checks: as Part 1.

**Result:** Done. `src/tokens/count.js` (+ `count.test.js`): count, take one, merge, click add, first place, drop. `TokenFace` got `upright` (screen-facing count label, readable from both seats); `LooseToken` shows it. `useTokenDrag.js`: click on a collected pile (`clickPile`, via `onClick`), take one (`takeFrom`, applied at the drop, so Escape changes nothing; Scene shows count - 1 while the drag is active), Shift + drag moves whole, merge at the drop. Loose token gets `count?` and `pile?`. Decisions: the count drops at the drop, not at the press; a taken token dropped on a character is given and the source goes down; a token on a card does not follow the card. Docs updated.

## Part 4: Two floors

Work:
1. `src/physics.js`: a function that finds the lower floor under a point for a base shape (cast up, then down), or null.
2. `CharacterModel.jsx`: a floor mode on the drag. R switches it. Each frame uses the floor of the mode.
3. `src/input/bindings.js`, `src/keyboard.js`: the new action on R during a model drag. Lift stays on R outside a drag.
4. Docs: `docs/features/key-shortcuts.md` (R), the feature doc for the model drag (`docs/features/table-tools.md` or the one that describes the drag).

Checks: as Part 1. A headless test of the lower floor with a simple overhang collider, if the physics setup allows it (see the memory note on the physics harness).

**Result:** Done. `physics.js`: `lowerFloor` (cast up from the table, then down from `LOWER_MARGIN` below the underside; returns `{ floor, limit }` or null; only the lowest overhang counts; a down cast that starts touching the overhang hits it at once, hence the margin). `CharacterModel.jsx`: `floorMode` ('top' default, reset at drag start, end, cancel), `toggleFloor` (returns the HUD message), lower floor used each drag frame, hover cut to `limit - floor` so the base top stays under the overhang. New condition `modelDrag` and action `floor` (R) in `bindings.js`; `keyboard.js` reads `s.modelDrag`; App holds `modelDragRef` and `floorPieceRef` (Scene fills them). Live pose already carries y. Tests: `physics.test.js` (headless rapier 0.14 via @react-three/rapier, slab on a post), keyboard and bindings tests. Docs: `key-shortcuts.md` (no separate model drag doc exists, so the behavior is there).

## User checks

After all parts:
- [ ] The power button is in the board strip on each side, with the label "Auto Power Phase". Only its owner can press it.
- [ ] One Cleanup Phase button between the scoring board and the mat, in the middle. Both players can press it.
- [ ] Tactic card token piles are not covered.
- [ ] Spider-Sleuth: a click on the Evidence pile puts a token on the card. More clicks raise the number on it.
- [ ] Drag from a token with a number takes one token off. The number goes down. Shift + drag moves the whole pile.
- [ ] Drop an Evidence token onto another Evidence token: they join and the number adds up.
- [ ] Wakanda tree: drag a model over the canopy edge, press R. The base goes under the canopy. R again brings it on top. Drop under the canopy: the model stays there.
- [ ] Multiplayer: counts and the lower floor place show on the other screen.
