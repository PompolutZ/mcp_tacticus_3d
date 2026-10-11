# Plan: Token size and tokens on top of tokens

Bugs found by the user on 2026-10-11, before the first real game in production.

1. Some tokens on the table have the wrong size. They should be 1" wide: Mystic Portal (Pentagram of Farallah), Black Bifrost, the Camera token (the "Masked Menace" token), maybe more.
2. A token must be able to lie on top of another token. Examples: a 1 Damage token on a Secure token (Lockdown), a Mystic Ward token on any Secure or Extract token. Today a Mystic Ward token dropped on a crisis token lies inside it, at table height.

## Facts

- The mod's `tokenDatabase` gives each token `tShape` and `tSize`: `tSmall = 0.375`, `tLarge = 0.5`. A `Circle` token spawns as a tile with scale `tSize`, and a tile with scale 1 is 2" wide. So a `tSmall` circle is 0.75" and a `tLarge` circle is 1" (`docs/characters-hud.md`, "Real-size tokens"). Mystic Portal, Black Bifrost, Mystic Ward, Chimichanga, LMD and Flare are `tLarge`.
- The app draws every character token `TOKEN_SIZE` (0.75") wide (`src/tokens/files.js`): on the table (`LooseToken.jsx`), in piles, in the drag preview, and on the trays.
- A token on the table finds its height each frame with `castDown` (`physics.js`): a shape cast against fixed colliders, which are the table and the terrain. Crisis tokens and other tokens have no fixed collider, so the cast does not see them.
- Lockdown already has a damage marker on a Secure token (`docs/feature-crisis.md`, "Damage marker"). A 1 Damage token on top is another way, and the rules allow both.

## Decisions

1. **Size from the mod.** `migrate-tokens.mjs` writes `size` (inches) into `src/tokens/tokens.json`: a `Circle` token is `tSize × 2`. A token with `tShape = "Other"` keeps 0.75", because its real size was never measured (`docs/characters-hud.md`). `tokenSize(key)` in `src/tokens/files.js` reads it, with 0.75" as the default.
2. **Where the size counts.** On the table: a loose token, a pile, the drag preview and its footprint. On a tray (the **On** row and the **Give** sources), every token keeps the slot size of 0.75", because the rows are laid out for it.
3. **Tokens on top of tokens, without physics.** A token on the table lies on the highest token under its center. The app computes the height, the same in both browsers:
   - The bottom layer: the crisis tokens, with their markers (control, damage) on top. Their tops are known from their place and thickness.
   - A loose token lies on a crisis token, or on a loose token that comes before it in the `looseTokens` list, when its center is inside that token's circle. Else it lies on the table or the terrain, as today.
   - A dropped or moved token goes to the end of the list (as today, check this), so it lies on top.
   - When the token below moves away, the token on top goes down to what is under it now, at the next frame.
   - Piles do not stack, and nothing stacks on a pile. Crisis tokens do not lie on loose tokens.
   - The drag preview shows the height where the token would land.
   Reasons: a fixed collider per token would also stop models and dice, and a token would hit its own collider. The rule above needs no physics and gives the same result in both browsers, because the list order is in the document.

## Phase 1: Token size

Work:
1. `migrate-tokens.mjs`: decision 1. Run it so `tokens.json` gets `size`. It must not convert images again. Report every token that is not 0.75".
2. `src/tokens/files.js`: `tokenSize(key)`. Use it on the table (decision 2): `LooseToken.jsx`, the pile component, `TokenDragPreview.jsx`, the footprints. Keep the tray rows at 0.75".
3. The Library lists the `counter` group too (1 Damage, 1 Power), so a player can make a 1 Damage pile. Today it leaves the group out. Check that the Power counter icon on the trays does not change.
4. Docs: `docs/characters-hud.md` ("Real-size tokens"), `docs/feature-library.md`, `scripts/README.md`.

Checks: `pnpm --filter web test`, `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

User, after this phase:
1. Mystic Portal, Black Bifrost, Masked Menace (Camera) and Mystic Ward tokens and piles on the table are 1" wide, as wide as a crisis token. Character tokens (Bleed, Stun) stay 0.75".
2. On a tray, all tokens have the same size as before.
3. The Library has 1 Damage and 1 Power. A 1 Damage pile works.

### Result

## Phase 2: Tokens on top of tokens

Work:
1. A plain module with the rule of decision 3 and its tests: the height of each loose token from the crisis tokens and the loose tokens before it.
2. `LooseToken.jsx`, `TokenDragPreview.jsx` and the crisis token component: they share what they need for the rule (the places and tops of the crisis tokens, the list of loose tokens). Keep the per-frame work small.
3. Docs: `docs/feature-library.md` or `docs/characters-hud.md`, where the loose tokens are described; `docs/feature-crisis.md` ("Physical behavior": tokens on top).

Checks: `pnpm --filter web test`, `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

User, after this phase:
4. Drop a Mystic Ward token on a Secure token: it lies on top, fully visible. The same on an Extract token.
5. Drop a 1 Damage token (from a Library pile) on a Secure token: on top.
6. Drop a second token on the first: it lies on top of both.
7. Move the crisis token below away: the token on top goes down to the table.
8. Multiplayer: the other player sees the same stack.

### Result

### User check results
