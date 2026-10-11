# Plan: Token piles of Team Tactic cards

Requested by the user on 2026-10-11, for the first real game in production. The friend's roster has Mystic Ward (`00690204`) and Pentagram of Farallah (`00230201`). Both cards need tokens on the table.

Design notes that this plan follows: `docs/feature-team-tactic-cards.md` ("Tactic tray", "Card on the table"), `docs/feature-library.md` ("Pile"), `docs/characters-hud.md` ("Tokens from the TTS mod").

## Goal

When a Team Tactic card goes on the table, a pile of each of its tokens goes on the table next to the tactic tray. A player takes tokens from the pile, the same as from a Library pile.

## How TTS does it

Found on 2026-10-11 in the mod (`Database` script and the script of each tactic card):
- A tactic card row has `tokens`: a list of token names, for example Mystic Ward → "Mystic Ward", Pentagram of Farallah → "Mystic Portal", Founding Members → six conditions. 82 rows have it.
- When the card lands on a tactic tray, its script spawns the tokens (`spawnTokens`): one token per name, 2.85" in front of the card toward the mat, at x − 1.5, − 0.5, + 0.5 and + 1.5 from the card center. A token of type "Pile" becomes a pile.
- When the card is picked up, its script deletes its tokens.
- The token rows: Mystic Ward is type "Misc", Mystic Portal is type "Use Tools". `migrate-tokens.mjs` skips both types today (`docs/characters-hud.md`, "Tokens from the TTS mod"). The TTS cache has both images (`token/tactic/MYSTIC_WARD.png`, `token/tactic/MYSTIC_PORTAL.png`).

## Decisions

1. **Always a pile.** The app puts one pile per token name of the card, also where TTS spawns a single token. A pile never runs out, so a card that places two tokens (Pentagram: two Mystic Portals) needs no count.
2. **The link is asset data from TTS.** Which tokens belong to a card is in the mod row only. Jarvis has no token images or names. So `migrate-tactics.mjs` writes `tokens` (token keys) into `src/tactics/cards.json`, the same exception as the Give tokens of a character (`docs/plan-jarvis-immunities.md`, decision 5).
3. **Token images.** `migrate-tokens.mjs` also migrates every token that a released tactic card names, of any type, when its image is in the TTS cache. Group `tactic` or `condition`, as the existing rule by image folder says. A name with no image in the cache is left out with a warning.
4. **Where the piles lie.** In the app, the tactic tray is 0.3" from the mat edge. The TTS place (2.85" toward the mat) would be on the mat, at the edge where players deploy. So the piles lie on the table past the owner's left end of the tactic tray plate, 0.3" from it, in a row going outward, 1.2" apart. The 6th and later cards go past the right end (`docs/feature-team-tactic-cards.md`, "Free slot"), so the left end is free. The piles of all cards share this row, in the order of the cards' slots. More than 6 piles go in a second row, behind the first, still beside the plate.
5. **When.** The piles come when a card goes on the table: when the squad goes on the table (`revealSquad`), and when a player adds a card from the Library. A card that moves on the table (drag) does not bring new piles.
6. **Removal.** A pile entry gets `card`: the id of its tactic card. When the card leaves the table (Delete key, the restart of the setup), its piles go too, as in TTS. A pile without `card` (from the Library) is not touched. Old documents have no `card` field. No new `SCHEMA`.

## Phase 1: Token images and data

Work:
1. `migrate-tokens.mjs`: decision 3. Run it: Mystic Ward and Mystic Portal migrate. Report others.
2. `migrate-tactics.mjs`: decision 2. Map each token name to a key the same way `migrate-tokens.mjs` makes keys. Write only keys that exist in `src/tokens/tokens.json`, and warn about the rest. Run it, so the existing cards get `tokens`.
3. `scripts/README.md`: both scripts.

Checks: `pnpm --filter web test`, `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

### Result

Done 2026-10-11. Not committed.

- `migrate-tokens.mjs`: also migrates every token that a released tactic card names, of any type, matched in lower case. A name with no migrated token gives a warning. 17 new tokens, 105 of 106 rows now (the 1 missing is Self-Discovery, not in the cache, not named by a tactic card). No warnings for tactic tokens: all 65 names have rows and images.
- New tokens: Mystic Ward, Mystic Portal, and Astral Incursion, Astral Ring, Black Bifrost, Chimichanga, Demolition Charge, Dossier, Experiment, Flare, Gamma Drain, Jonathan, LMD, Masked Menace, Obscuring Mist, Stash, 1 Damage.
- `1 Damage` (Steal the Future) is in `token/misc/tracker/`, which the group rule maps to `status`. That would put it in the Tokens panel as a capped status. So it gets the group `counter`, like `1 Power` (`COUNTER_ROWS` in the script). `TOKENS` in `src/tokens/tokens.js` already leaves `counter` out of the Library.
- `migrate-tactics.mjs`: writes `tokens` per card, only keys of `tokens.json`, no warnings. Images were not converted again. 13 of the 75 migrated cards have `tokens`, among them Mystic Ward (`mystic-ward`) and Pentagram of Farallah (`mystic-portal`). The other 67 released cards with tokens have no card images in the cache yet, so they get `tokens` when their images migrate.
- `scripts/README.md` and `docs/characters-hud.md` (token table) updated.
- Checks: tests pass, build passes, format ok, lint has only the old warnings (Scene.jsx, Root.jsx).

#### For Phase 2

- Card: `cards.json[key].tokens`, an array of token keys. Absent when the card has no tokens. Read it with `tactics/cards.js` or the JSON entry: `card.tokens ?? []`. Keys are unique per card (a double token is one key).
- Token: `tokens.json[key]` (`getToken(key)` in `src/tokens/tokens.js`), image `characterToken(key)` in `src/tokens/files.js`. `group` of the new tokens: `tactic`, `condition`, `character` or `counter` (1 Damage).
- A pile entry is `{ id, key, x, z }` plus `card`. `key` is the token key.
- Token size for the pile spacing: `TOKEN_RADIUS = 0.5` in `App.jsx` (diameter 1"). The TTS large token is also 0.5. Piles 1.2" apart leave a 0.2" gap.
- `src/tactics/cards.js` spreads the JSON entry, so its card objects already have `tokens`.

## Phase 2: Piles on the table, docs

Work:
1. The pile place (decision 4) in a plain module with a test (`src/tactics/layout.js` or next to it).
2. `App.jsx`: decisions 5 and 6, in the same change of the document as the cards.
3. Docs: `docs/feature-team-tactic-cards.md` (token piles), `docs/feature-library.md` (the `card` field of a pile).

Checks: `pnpm --filter web test`, `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

### Result

Done 2026-10-11. Not committed.

- `src/tactics/layout.js`: `tacticPilePlace(team, index)` and `freePilePlaces(team, piles, count)`. Test: `layout.test.js` (blue, red, 7 piles, taken places).
- Place: blue at -x, red at +x of the plate (the owner's left, as the slots). 6 piles per row. The second row is 1.2" further from the mat, still within the plate depth.
- `freePilePlaces` skips a place when any pile lies within 0.6" of it, not only card piles. So it also fills a gap after a card was deleted.
- `App.jsx`: `makeCardPiles` and `removeCardPiles`. `revealSquad` and `handleTacticSpawn` add the piles in the same `table.transact` as the cards. `handleTacticSpawn` now reads the free slot from the document, not from an updater. `handleTacticRemove` and `restartSetup` remove the piles of the card in the same change.
- Docs: `feature-team-tactic-cards.md` ("Token piles"), `feature-library.md` (`card` field).
- Checks: 288 tests pass, build passes, format ok, lint has only the old warnings.

## User

After Phase 2, in a single player room, with the friend's roster as Blue:
1. Choose a squad with Mystic Ward and Pentagram of Farallah, and Ready. A Mystic Ward pile and a Mystic Portal pile lie past the left end of the Blue tactic tray.
2. Drag from each pile: a token comes off, the pile stays.
3. Add a card with tokens from the Library: its pile comes too.
4. Delete Mystic Ward (Delete key over it): its pile goes. The Mystic Portal pile stays.
5. Restart the setup: the placed cards and their piles go.
6. Red side: the same, at the Red tactic tray.
7. Multiplayer (one pair): the other player sees the piles.

### User check results
