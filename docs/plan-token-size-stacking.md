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

Done 2026-10-11. Not committed.

- `migrate-tokens.mjs` writes `size` (inches) for a `Circle` token (`tSize × 2`), and leaves it out at 0.75. Run: no image converted. 47 of 105 tokens are 1" (all `tLarge`: 37 `tactic`, 10 `character`); 58 are 0.75". Self-Discovery is still missing in the TTS cache (as before).
- `tokenSize(key)` is in `src/tokens/tokens.js`, not `files.js`: the migrate script imports `files.js` and cannot import the JSON. `files.js` keeps `TOKEN_SIZE` (0.75, the tray slot size).
- Used by `LooseToken.jsx` (ground check, `TokenFace` size), `TokenPile.jsx` (`PileStack`, ground check), `TokenDragPreview.jsx` (`OtherSpawnPreview` ground check, new `tokenKey` prop), `Scene.jsx` (own and other preview `TokenFace` size). `TokenFace` has a `size` prop (default `TOKEN_SIZE`, badge and label follow it). Trays pass no size.
- Footprints keep `TOKEN_RADIUS` (0.5", the crisis token radius): it is already the 1" radius, and the 0.75" tokens had it before.
- `tokens.js` no longer filters the `counter` group. Library has a "Counters" group (1 Damage, 1 Power). `TrayControls.jsx` reads the Power icon by key: unchanged.
- Docs: `docs/characters-hud.md`, `docs/feature-library.md`, `scripts/README.md`.
- Checks: test 288 pass, build ok, format ok, lint 41 warnings (same as before), no errors.

For Phase 2:

- Loose token height: `LooseToken.jsx`, `useFrame`: `groupRef.position.set(x, (ground ?? 0) + GAP + lift, z)`, `ground` from `castDown` with a cylinder `HALF_H = 0.02`, `GAP = 0.02`, `lift = TOKEN_DRAG_LIFT` (1) while `follow.current.moved` (remote drag). The token's own bottom is y = 0 of the group; `TOKEN_THICKNESS = 0.08`.
- Drag preview height: `TokenDragPreview.jsx`, `handleMove`: `group.position.set(point.x, point.y + GAP + TOKEN_DRAG_LIFT, point.z)`, with `point` from `tablePoint` (fixed bodies only), written to `pointRef`. `OtherSpawnPreview` (remote) uses `castDown` in `useFrame`, same formula. Piles (`TokenPile.jsx`) have the same `castDown` formula and do not stack.
- Crisis token: `CrisisToken.jsx`. Radius `RADIUS = 0.5` (`TOKEN_RADIUS`), `HALF_H = TOKEN_THICKNESS / 2`; group y = `ground + GAP + HALF_H` (+ `TOKEN_DRAG_LIFT` when lifted), so its top is `ground + GAP + TOKEN_THICKNESS`. Its place is `poseRef.current` `{ x, z, yaw }` (live; `token.x/z` in the document). Markers (control, damage) are flat meshes at `MARKER_Y = HALF_H + 0.002` above the group center, so about `TOKEN_THICKNESS + 0.002` above the token's bottom: practically no thickness. `floorY` (prop) replaces `castDown` when set and not lifted. Crisis token places are not shared in one list today: `Scene.jsx` renders them from `tokens` (App `tokens`), so a shared module needs them passed down, with the live pose for a token being dragged.
- Loose token list: `looseTokens` in `App.jsx` (`useYList(table.looseTokens)`), items `{ id, key, x, z }`. `handleTokenRelease`: a new token is appended (`[...prev, {...}]`), so it is last. A moved token (`looseId`) is mapped in place: it KEEPS its index, it does not go to the end. Phase 2 must move it to the end on a move (remove + append in one update), or the order rule fails.

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

Done 2026-10-11. Not committed.

- `src/tokens/stack.js` (plain, tests in `stack.test.js`): `stackTop(x, z, index, crisis, loose)` is the rule. `createTokenStack()` is a small registry (two Maps, entries changed in place, no allocation per frame). `tokenStack` is the one used by the scene.
- `CrisisToken.jsx` writes `putCrisis(id, x, z, 0.5, top)` each frame, top = group y + `HALF_H` (+0.002 with a control or damage marker). Not written while lifted (drag, remote drag) or held on a tray card (`floorY`). Removed on unmount.
- `LooseToken.jsx` has a new `index` prop (place in `looseTokens`, from `Scene.jsx`). Each frame: `rest = max(ground, tokenStack.topAt(x, z, index))`, y = rest + `GAP`. It writes `putLoose(..., size / 2, y + TOKEN_THICKNESS, index)`. A lifted token (remote drag) is removed from the registry, so the token on top goes down. The local dragged token is not mounted, so it is not in the registry either.
- `App.jsx`, `handleTokenRelease`: a moved loose token is removed and appended (it goes to the end). `net/collections.js` gives it a new `order` above the highest, so the other browser gets the same order.
- Drag preview: new `stacks` prop on `TokenDragPreview` and `OtherSpawnPreview` (true for a character token, false for a supply token and a pile). Height = max(point or ground, `topAt(x, z)` with index Infinity) + `GAP` + lift. `Scene.jsx` passes it (`loose:` key for the other player).
- Docs: `docs/characters-hud.md` ("Tokens on top of tokens"), `docs/feature-library.md`, `docs/feature-crisis.md`.
- Checks: test 294 pass, build ok, format ok, lint 41 warnings (same as before), no errors. No browser used.

Notes:

- The height is never below the ground (max with the table or terrain). The plan said "else the ground"; this only differs when a token below is lower than the terrain under the token on top.
- Frame order: a loose token reads the tops that the other tokens wrote in the frame before or in this frame, by mount order. A stack of 3 may need 2 frames to settle after a change. One frame of lag is not visible.
- The preview updates on pointer move, not each frame (as before), so a token below that moves while the pointer is still is seen at the next move.
- A crisis token held on a tray card (`floorY`) holds nothing.

### User check results

2026-10-11: the user checked 1 to 8: "all works as expected".
