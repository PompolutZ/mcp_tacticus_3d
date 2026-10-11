# Plan: Character trays

The feature is `docs/features/character-trays.md`. This plan holds the phases that built it, with their results. The feature is the authority when it differs from this plan.

Requested by the user on 2026-10-01. The first iteration is a tray in the 3D world, with a 2D HUD later.

## Phases

Each phase is one short agent session and ends with a working app.

### Rules for every phase

- Read `CLAUDE.md` and the feature `docs/features/character-trays.md`. Do not open the app in a browser. Check with `npx vite build`.
- Do not commit and do not push. Leave the changes in the working tree.
- Match the style of the code around you: plain, short comments that say why. Units are inches, 1 three.js unit = 1".
- Keep tool output small (`head`, `grep`, summaries). Do not read big files in full. `jarvis-characters.json` has 110,000 lines, and the mod JSON is 41 MB.
- At the end, add a short **Result** under the phase: files, measured facts, changes from the plan, open issues. The next agent reads the results of all earlier phases.

### Phase 1: Tray with the card

- Grow the table to 72" × 60" (see [Place on the table](../features/character-trays.md#place-on-the-table)). Run `npm run dice-sim` before and after, and compare.
- `src/characters/trays.js`: `trayPosition(teamColor, index)` and the tray sizes.
- `CharacterTray.jsx`: the card plane (Healthy side) and the character name. No controls yet.
- `CardPopup.jsx` takes `{ src, alt }`. The crisis card uses the new form. A click on a tray card opens it.

Done when the trays show in a row for each player and a click on a card opens the popup.

#### Result

Files: `src/table.js` (table depth), `src/characters/trays.js` (new), `src/components/CharacterTray.jsx`
(new), `src/components/CrisisCard.jsx`, `src/components/CardPopup.jsx`, `src/App.jsx`,
`src/components/Scene.jsx`, `src/characters/characters.js` (`characterName` helper), `src/index.css`
(`tray-label`).

`npm run dice-sim`, seed 1, default throw counts:

| | Before (48" deep table) | After (60" deep table) |
|---|---|---|
| Single die chi-squared | 5.54 PASS | 5.07 PASS |
| Single die tilted / out-of-well | 0.7% / 0.1% | 0.6% / 0.1% |
| 10-dice chi-squared | 5.64 PASS | 9.81 PASS |
| 10-dice tilted / out-of-well | 0.4% / 2.5% | 0.6% / 2.5% |
| Settle time avg/max | 2.70s / 3.59s | 2.74s / 3.60s |
| 42-dice perf | 0.268 ms/step | 0.268 ms/step |

All within normal run-to-run noise. The dice trays did not move, so this is expected.

Changes from the plan:

- `CardPopup` takes a `card` prop (`{ src, alt } | null`), not bare `src`/`alt` props. App still
  stores `openCard` as `{ src, alt } | null`, unchanged from the plan.
- The character name is a floating `<Html>` label (like a terrain label), not drawn into the card
  area, because Phase 1 has no DOM controls strip yet to anchor it to.
- `trays.js` also exports `trayYaw(teamColor)`, not only `trayPosition` and sizes, so `CharacterTray.jsx`
  and a later `TrayControls.jsx` do not duplicate the "card faces the owner" rule.
- The row center z (27, mirrored to -27) is a hardcoded constant in `trays.js`, not derived from
  `table.js` or the mat size, because the bench strip depth is a local constant inside `Scene.jsx`
  and is not exported.

Open issues:

- The tray card always shows the Healthy side; Phase 2 adds `side`, `damage`, `power` and the Flip
  control.
- No collider and no drag: trays are fixed at their slot position, as planned.
- Tray row can hold 13 characters per side; nothing stops a 14th spawn from overlapping the last
  tray. Not a problem yet, since no squad in the data needs that many.

### Phase 2: Damage, Power, Flip

- `characters.js` adds the Stamina of both sides from Jarvis.
- New character fields `side`, `damage`, `power`. Handlers in `App.jsx`, the same way as the token handlers.
- `TrayControls.jsx` (plain DOM) in a flat `<Html transform>` on the tray: Damage and Power counters with `−` and `+`, Flip.
- The tray card and the popup show the side that faces up.

#### Result

Files: `src/characters/characters.js` (`staminaHealthy`/`staminaInjured`, `characterStamina`),
`src/App.jsx` (`side`/`damage`/`power` on spawn, `handleCharacterDamage`/`Power`/`Flip`),
`src/components/Scene.jsx` (forwards the three handlers to each tray), `src/components/CharacterTray.jsx`
(card shows `character.side`, mounts the controls, builds the popup's `altSrc`), `src/components/TrayControls.jsx`
(new), `src/components/CardPopup.jsx` (`altSrc` + "Show other side" button), `src/index.css`
(`--warn`, `.tray-controls*`, `.tray-counter*`, `.card-popup-content`).

Measured: Jarvis stores `statCard.frontSide.stamina` / `backSide.stamina` as strings, not numbers
(`Number(...)` in `characters.js`). Every character with an `exportCode` has both sides, except
Multiple Man, whose stamina is the string `"?"` (variable stamina, not a fixed number); that case
falls back to 0 and is harmless today since Multiple Man has no migrated model (`available: false`,
so the Spawner blocks it).

Changes from the plan:

- `TrayControls` does not clamp Damage or Power itself. The `−`/`+` buttons send the next value to
  App's handlers, and App applies the 0..Stamina and 0..10 limits (`characterStamina` looks up the
  Stamina of the side that currently faces up). This keeps `TrayControls` a plain presentational
  component, as the doc asks for reuse in a future 2D HUD.
  - Also added a `data-character-id` attribute on the tray controls root, as the doc asks: not used
  yet, so drag-and-drop in Phase 4 has somewhere to land.
- Card popup: `CardPopup` takes an optional `card.altSrc`. When present it shows a "Show other
  side" button that flips a local `showAlt` flag inside the popup; it does not call `onFlip` or
  change `App`'s `side` field, so opening the popup never affects the tray. The flag always resets
  when a different card opens.
- No Power icon, as planned (Phase 3 migrates the "1 Power" token); the Power counter shows the
  text "Pow" instead of an icon.
- Added `--warn` to `index.css` (a single CSS variable), since no warning color existed yet.

Open issues:

- `TrayControls` is mounted through a drei `Html transform`, which maps roughly 40 CSS px per
  three.js unit (no extra `distanceFactor`). The whole 5"x2" controls strip is therefore about
  200x80 CSS px; fonts and buttons are sized down to fit (9-11px). Not checked in a browser per
  the project's rules; only `vite build` was run.
- Flip does not check Grunts (no Injured side) or second forms; out of scope for this phase (see
  "Out of scope").
- No tokens, no immunities, no Give/On rows yet (Phase 4/5). No Remove button yet (Phase 7).

### Phase 3: Token images

- `scripts/migrate-tokens.mjs`, `npm run migrate-tokens`, with `--list`, `--force` and `--out` like `migrate-crisis.mjs`. Use `loadCrisisDatabase` in `scripts/lib/tts.mjs`, or a new loader next to it.
- Output as in [Tokens from the TTS mod](../features/character-trays.md#tokens-from-the-tts-mod). A section in `scripts/README.md`. A line in `ASSETS.md`.
- No UI change.

#### Result

Files: `scripts/migrate-tokens.mjs` (new), `src/tokens/files.js` (new, `characterToken(key)`),
`src/tokens/tokens.json` (new, 88 entries), `scripts/token-manifest.json` (new), `src/assets/tokens/*.webp`
(new, 88 files), `package.json` (`migrate-tokens` script), `scripts/README.md`, `ASSETS.md`,
`src/components/TrayControls.jsx` (Power icon).

Measured, 2026-10-01: `tokenDatabase` has 310 rows, all cached. 88 rows match the "yes" rows of the
table (condition 10, status 3, character 34, tactic 41), converted to WebP, max 256×256, quality 85,
same `imageToWebp` as the crisis script. Total `src/assets/tokens/` size: 1.5 MB. Re-running
`npm run migrate-tokens` converts 0 files (all "already migrated"), confirming the manifest works.

Skipped, with reasons already in the plan table: the 6 dice results (`token/dice/`), the second art
of every row with `altName` (20 condition rows → 10 kept, 4 Activated/Dazed rows → 2 kept), the 3
`Only Status` rows in `token/misc/` (Master of Metal, Antimatter Core, Suppression), the other 6 Misc
rows (3/5 Power, 1/3/5 Damage, Mystic Ward), Use Tools/Pile, Affiliation and the ~130 Objective rows
(migrated by `migrate-crisis.mjs` instead).

`group` is assigned from the mod's folder, not `tType`: a `Personal` row in `token/tactic/` (Memory)
gets `group: 'tactic'`, and several `Status`/`Only Status` rows in `token/character/` or `token/tactic/`
get `group: 'character'`/`'tactic'`, not a `status` group. Only Activated, Dazed and "1 Power" (all
three in `token/misc/tracker/`) get `group: 'status'`.

"1 Power" decision: it is not a character token (no `cToken` list has it), but it has no group of its
own among the 4 in the plan either. It lives in `token/misc/tracker/`, the same folder as Activated and
Dazed, so it got `group: 'status'`. The Tokens panel (Phase 4) should probably not list it alongside
real status tokens, since nothing ever puts it "on" a character; that is left as an open issue.

`description` and `cleanup` are left out of a `tokens.json` entry when the mod row has none/false,
the same optional-field style as `src/crisis/cards.json`. Only the 10 Condition rows have a
description (`tDescr`); every other migrated row has an empty `tDescr` in the mod.

Changes from the plan:

- Used `loadCrisisDatabase()` directly (it already loads all of `tokenDatabase`), not a new loader,
  since no extra fields were needed.
- `tokens.json` leaves out `description`/`cleanup` when empty/false, rather than always including
  all 4 keys, matching the existing crisis JSON style.

UI: added the Power icon to `TrayControls.jsx` (`characterToken('1-power')`), same as Damage. It is
a one-line-per-counter change, as allowed by the plan.

Open issues:

- "1 Power" group placement (see above) may need revisiting once the Phase 4 Tokens panel groups
  tokens for display.
- Not checked in a browser, only `npx vite build`.

### Phase 4: Give tokens by drag and drop

- New character field `tokens`. The **On** row on the tray. A click on a chip removes one.
- The **Tokens** panel in the HUD, with a toolbar button.
- The drag from the panel onto a model or a tray: the drag state and the token copy under the pointer in `App.jsx`, `data-character-id` on the tray controls, and `characterAt` in `Scene.jsx`. Escape cancels.
- Conditions, Activated and Dazed stay at 1.

#### Result

Files: `src/tokens/tokens.js` (new, the token list and `isCappedToken`), `src/components/TokensPanel.jsx`
(new), `src/components/TrayControls.jsx` (the **On** row and `TokenChip`), `src/components/CharacterTray.jsx`
(`objectRef` on the card mesh, forwards `onTokenRemove`), `src/components/Scene.jsx` (`characterAt`,
`characterAtRef`, `trayObjects`), `src/components/Toolbar.jsx` (Tokens button), `src/App.jsx`
(`tokens: {}` on spawn, give/remove handlers, the drag state and ghost, `findCharacterAt`),
`src/index.css` (`.tokens-panel*`, `.token-chip*`, `.token-drag-ghost`, `.tray-controls-on`),
`scripts/migrate-tokens.mjs` (`1-power` → group `counter`), `src/tokens/tokens.json` (re-migrated,
same 88 entries, only `1-power`'s `group` changed), `scripts/README.md`.

Measured: after the `counter` change, `npm run migrate-tokens` converted 0 images (all "already
migrated", the manifest URLs did not change) and rewrote only `tokens.json`, confirming the plan's
"should not convert images again". Group counts in the shipped `tokens.json`: condition 10, status
2 (Activated, Dazed only, now that `1-power` moved out), character 34, tactic 41, counter 1.

Changes from the plan:

- `group: 'counter'` is new, not one of the 4 groups the doc's "Tokens from the TTS mod" table
  lists (`condition`, `status`, `character`, `tactic`). The doc already flagged `1-power`'s group
  as an open issue after Phase 3; this phase resolves it by giving it its own group instead of
  reusing `status`, so `isCappedToken` (condition/status cap at 1) and the Tokens panel's group
  list do not need to special-case one key by name.
- Token drag position is not stored in React state on every `pointermove`. `tokenDrag` state only
  carries `{ tokenKey, x, y }` from `pointerdown`, for the ghost `<img>`'s first render; after that
  `moveDragGhost` sets the element's `transform` directly from the `pointermove`/`pointerup`
  listeners, so a drag does not re-render `App` on every pointer move. The doc's "App stores the
  drag" is still true; only the continuous position update is kept out of state.
- `characterAt` lives directly in `Scene` (it already runs inside the `Canvas`, so `useThree` is
  available there), not in a separate component. It is registered into `characterAtRef.current` in
  a plain `useEffect` with no dependency array, so the closure is refreshed every render and always
  sees the current `characters` prop and object maps, the same way `registerTrayActions` keeps
  `trayActionsRef` current.
- `findCharacterAt` (DOM `data-character-id` first, then `characterAtRef`) is a standalone function
  in `App.jsx`, not inlined into the drag's `pointerup` handler, exactly so `CrisisToken.jsx` can
  reuse it in Phase 6 without depending on drag state.
- The Tokens panel chips are bare icon buttons (`title` has the name and description) with no name
  text next to them, unlike `CharacterSpawner`'s dropdown rows. With ~85 tokens the icon grid reads
  faster than a 85-row list; the search field narrows it when a player knows the name.

Open issues:

- The Tokens panel is a fixed-position panel (`top: 56px; left: 12px`), not anchored to its
  toolbar button. If the toolbar wraps to a second row (narrow window), the panel can sit under it.
- No visual feedback while dragging over a valid drop target (character highlight, cursor change):
  the ghost image is the only feedback, as the doc's sketch does not ask for more.
- `characterAt` is a linear scan of every character's model and tray card per `pointerup`/Extract
  release; fine at the player counts this game has, not checked at a larger scale.
- Not checked in a browser, only `npx vite build`, per the project's rules.

### Phase 5: Give row and immunities

- `migrate-characters.mjs` writes `tokens` (`cToken`, as token keys) and `immune` (`cImmune`, as token keys) to `characters.json`. Run it again for the migrated characters. The script converts only files that are not in the manifest, so only the JSON changes.
- The **Give** row on each tray: Activated, Dazed and the character's tokens. The same drag as in phase 4.
- A drop of a condition on an immune character does nothing and shows a short message in the HUD for a few seconds, like the spawner message.

#### Result

Files: `scripts/migrate-characters.mjs` (`tokens`/`immune` fields, mapped from `cToken`/`cImmune`),
`src/characters/characters.json` (re-migrated, same 21 characters, only `tokens`/`immune` added),
`src/characters/characters.js` (`characterGiveTokens`, `characterImmune`), `src/components/TrayControls.jsx`
(the **Give** row, `GiveChip`), `src/components/CharacterTray.jsx`, `src/components/Scene.jsx`
(forward `onTokenDragStart`), `src/App.jsx` (`handleCharacterTokenGive` checks immunity, `hudMessage`
state and `showHudMessage`), `src/index.css` (`.tray-controls-row-label`, `.tray-controls-give`,
`.token-chip--give`, `.hud-message`), `scripts/README.md`.

Mapping rule: a `cToken`/`cImmune` name maps to a `tokens.json` key with the same slug function
`migrate-tokens.mjs` used to build the keys (lowercase, strip `'`/`’`/`.`, other runs of
non-alphanumerics become `-`). A name that does not match a migrated key is left out and printed
as a warning (not guessed), the same way the script already warns about missing files.

Measured, 2026-10-01: re-ran `npm run migrate-characters` for all 21 already-migrated characters
(by MCT id). All 21 were "already migrated" (no file conversion); `git status` after the run shows
only `src/characters/characters.json` changed, no asset/model/manifest file. 13 of 21 characters
got a `tokens` field, 5 got `immune` (`m-baku`, `storm`, `the-mighty-thor`, `thor-hero-of-midgard`,
`thor-prince-of-asgard`); the other characters have an empty or missing `cToken`/`cImmune` in the
mod.

Checked the mapping against the mod's full `characterDatabase` (263 characters, 653 `cToken`/`cImmune`
names total), not only the 21 migrated ones, to see what a later migration would hit: 11 distinct
names do not map to a migrated token key, none of them on a migrated character. By reason:
`Blank`, `Crit`, `Fail`, `Hit`, `Shield`, `Wild` (Adam Warlock's `cToken`) are dice-result tokens,
which Phase 3 skips on purpose (`token/dice/`); `Astral Projection` (Shadow King), `Leviathan Armor`
(Red Skull, Master of Hydra), `Rage` (The Incredible Hulk) are personal tokens Phase 3's `tokenDatabase`
scan did not select, cause not investigated here; `Posion` (Captain Marvel, Cosmic Avenger and Lady
Mastermind) is a typo for Poison in the mod's own data, left unmapped rather than guessed;
`Incinerate, Stun` (Blue Marvel's `cImmune`) is one comma-joined string in the mod instead of two
list entries, also left unmapped. None of this affects the current `characters.json`, since none of
the 21 migrated characters use these names; a future migration of these characters would print a
warning for them and leave `tokens`/`immune` without that one entry.

Give row: Activated and Dazed are not stored in `characters.json` (every character gets them, so
`TrayControls.jsx` prepends `ALWAYS_GIVEN = ['activated', 'dazed']` itself), only the
character-specific tokens are. A chip's `title` is the token name (no description, unlike an "On"
chip, to save space). The On and Give rows sit on one line each with a small inline text label
("On"/"Give") before the chips, and Give chips get a dashed border + grab cursor (`.token-chip--give`)
so the two rows are easy to tell apart without a second line of height.

`TRAY_CONTROLS_DEPTH` (`src/characters/trays.js`) is unchanged (still 2"), so trays stay within
z = 24.5..29.5 as before. The Give row did not need the extra depth: the controls mount through a
drei `<Html center transform>` (see `CharacterTray.jsx`), which is only anchored at a 3D point, not
clipped to the 2"x5" box; `TRAY_CONTROLS_DEPTH` only sets the spacing between the card and the row
center, and the spacing between trays in the row. The On row already grows past its nominal box the
same way when it wraps to a second line (Phase 4), so the Give row does the same without changing
the geometry. Not checked in a browser; only reasoned from the CSS (both rows are one line for
every migrated character today: the longest Give list is 5 chips, Apocalypse-sized lists are not
migrated yet).

Immunity message: `App.jsx` adds a `hudMessage` state with the same clear-timeout/set-timeout(3000)
pattern as `CharacterSpawner`'s own `showMessage`, but lifted to `App` and shown in a new
`.hud-message` element fixed at the top center of the screen, not next to one panel, since a drop
can land on any tray. `handleCharacterTokenGive` checks `characterImmune(character.key)` before
giving a token and, if blocked, shows `"<name> is immune to <token>."` and returns without changing
state. The check is independent of where the drag started (Give row or Tokens panel): both call
the same `handleTokenDragStart`/`handleCharacterTokenGive` path from Phase 4.

Changes from the plan:

- `tokens`/`immune` map by slug, not by an explicit name table, because every value among the 21
  migrated characters already matched a token key this way; no case needed a hand-written mapping.
- The immunity message element is new (`.hud-message`), not a reuse of `.spawner-message`: that
  class is positioned `absolute` relative to the spawner's own box, which is wrong for a message
  that can be triggered from any tray on the table.

Open issues:

- The 11 unmapped mod names found while checking the full character database (see above) are not
  fixed (typo, comma-joined string) or investigated (3 personal tokens Phase 3 did not select);
  they only matter once a character that uses them is migrated.
- Give row chips show no name/description in their tooltip, only the name (`title={token.name}`);
  unlike an On chip, no `token.description`. Kept short since the row is already tight on space.
- Not checked in a browser, only `npx vite build`, per the project's rules.

### Phase 6: Hold and drop

As in [Hold and drop](../features/character-trays.md#hold-and-drop). `CrisisToken.jsx` reports the release, and `Scene.jsx` finds the character with `characterAt`.

#### Result

Files: `src/App.jsx` (`canHold`/`heldBy` in `buildMatTokens`/`buildSupplyTokens`, `handleTokenHold`,
`handleTokenDrop`, `handleDropCharacterTokens`, `modelPositionRef`), `src/components/Scene.jsx`
(`modelPosition`, `matTokens`, `onTokenHold`/`onTokenDrop`/`modelPositionRef` props, filters held
tokens out of the 3D render and `toolModels`), `src/components/CrisisToken.jsx` (`onHold`,
`findCharacter` props, the drop-on-a-character check in `onPointerUp`), `src/components/CharacterTray.jsx`
(`heldTokens`, `onTokenDrop` passthrough), `src/components/TrayControls.jsx` (the **Held** row,
`HeldChip`), `src/index.css` (`.tray-controls-held`, `.token-chip--held`), `docs/features/crisis.md`
(status line).

`canHold`: `card.type === 'extract' && canMove(t)` in `buildMatTokens` (true only for `extract-asset`
and `extract-civilian` mat tokens; a Source's `extract-unexhausted-source` mat token has `flipOnly`,
so `canMove` is already false for it) and unconditionally `true` in `buildSupplyTokens` (its tokens
are always a Source's Asset/Civilian supply, checked against `cards.json`: every card with `supply`
is `type: 'extract'`, see `scripts/README.md`/the crisis migration). Checked the current `cards.json`:
Secure (VIP, Zone, fixed) tokens are `type: 'secure'`, so they never get `canHold`, matching the
"Token actions" table (only Asset/Civilian have Hold: yes).

Hold: `CrisisToken.jsx`'s existing drag (select, then drag past a threshold) is unchanged; only its
`onPointerUp` changed. For a `canHold` token, it calls a new `findCharacter` prop (Scene's own
`characterAt`, passed straight through, not `App`'s `findCharacterAt`, so a release over the tray's
DOM controls does not count — only the model or the tray's card mesh, both 3D objects `characterAt`
already raycasts, per the doc). A hit calls `onHold(characterId)`; a miss falls back to the existing
`onMove`, so a `canHold` token that is not dropped on a character still just repositions on the mat,
as it already could. `App.handleTokenHold` sets `heldBy` and clears the token's selection (it is no
longer a 3D piece for `TokenPanel`).

Not rendered as a 3D token: `Scene.jsx` derives `matTokens = tokens.filter(t => !t.heldBy)` once and
uses it for both the `CrisisToken` list and the token half of `toolModels`, so a held token is also
out of the range/movement tools' snap list in the same change.

Held row: `TrayControls.jsx` gets a new `heldTokens` array (`Scene.jsx` computes it per character:
`tokens.filter(tok => tok.heldBy === ch.id)`, the full `tokens` array, not `matTokens`) and renders
it between the existing "On" and "Give" rows. Its `HeldChip` shows the token's current face
(`token.up === 'front' ? token.frontKey : (token.backKey ?? token.frontKey)`, the same rule
`CrisisToken.jsx` itself uses) with `crisisToken()`/`tokenInfo()` from the crisis module, not
`characterToken()`/`tokens.json`: a held piece is still a crisis token, not a character token, and
never appears in `tokens.json`/`isCappedToken`. A click drops it (`onClick`, not a button inside the
chip): the doc allows either, and a chip here is a target that is only ever clicked (never dragged
the way a Give chip is), so one button is the simplest reading.

Drop: `handleTokenDrop(id)` reads the live position through `modelPositionRef` (a ref `Scene.jsx`
fills the same way as `characterAtRef`, pointing at a new `modelPosition(id)`: the Rapier body's
`translation()` first, else the model object's `getWorldPosition`, else `null`). It places the token
at that position offset by the holder's base radius (`BASE_DIAMETER[holder.base] / 2`) plus the
token radius (0.5", matching `CrisisToken.jsx`'s `RADIUS`) plus a small gap along `+x`, clears
`heldBy`, and selects the token (`TokenPanel` then shows, so a player can set Control/damage or flip
it right away, same as any mat token). `handleDropCharacterTokens(characterId)` calls
`handleTokenDrop` for every token currently held by that character; Phase 7 can call it before
removing a character. It is unused until then (`vite build` does not run a linter, so this is not a
build error).

A crisis card change already removes a held token with its old card: `handleCrisisChange` filters
`tokens` by `cardKey` regardless of `heldBy`, unchanged from Phase 1-5 — no new code needed for that
part of the spec.

Changes from the plan:

- A held token still carries its last on-mat `x`/`z`/`control`/`damage` fields while held (only
  `heldBy` changes); they are unused while held and overwritten by `handleTokenDrop` on drop. Simpler
  than stripping and re-adding fields, and nothing reads them while `heldBy` is set (filtered out of
  every render and tool list).
- The Held chip's drop placement always offsets along `+x` from the model, not toward any particular
  open space. The doc only asks for "next to the base"; `+x` is simplest and always clear of the
  model's own footprint, same spirit as the fixed bench-row offsets in `trays.js`/`Scene.jsx`.

Open issues:

- `modelPosition` returns `null` for a `figure: 'standee'` character: `Character.jsx` (the standee
  renderer) never calls a `bodyRef`/`objectRef`, so `charBodies`/`charObjects` have no entry for it.
  This is a pre-existing gap (the range/move tools' `toolModels.getCenter` already falls back to
  `{x:0,y:0,z:0}` for the same reason, not introduced by this phase). `handleTokenDrop` falls back to
  the token's last mat position instead of `{0,0,0}`, so a standee's drop does not teleport to the
  table center, but it is still not the character's actual position. Only one migrated character
  (`characters.json`) uses `standee` today. Fixed on 2026-10-07: a standee is now `StandeeModel` in
  `CharacterModel.jsx`, with the same body, selection and tools as a 3D model, and a base of the
  game size (`BASE_DIAMETER`). `Character.jsx` is removed.
- No visual feedback while dragging a `canHold` token over a valid character (same open issue Phase 4
  noted for the Tokens-panel drag): the token itself is the only feedback.
- `characterAt` is called again on every `canHold` token release (already a linear scan over every
  character's model and tray, per Phase 4's note); still fine at this game's player counts.
- Not checked in a browser, only `npx vite build`, per the project's rules.

### Phase 7: Remove, and link the tray to the model

- A Remove button on the tray (with a confirmation) removes the character, its model and its tray. It drops the held tokens first.
- A new character takes the lowest free bench slot, so that it does not stand on a model that is still there.
- A click on the character name on the tray selects the model. A selected model highlights its tray.

#### Result

Files: `src/App.jsx` (`lowestFreeSlot`, `handleCharacterRemove`, `handleTokenDrop`/
`handleDropCharacterTokens` reworked, `findCharacterAt` passed to `Scene`), `src/components/Scene.jsx`
(`onCharacterRemove`, `findCharacterAt` props, `CrisisToken`'s `findCharacter` now `findCharacterAt`,
`CharacterTray` gets `onRemove`/`selected`/`onSelect`), `src/components/CharacterTray.jsx` (`selected`,
`onSelect`, `onRemove` props, the name `<Html>` is clickable, `useOutline` on the card mesh,
`characterId` added to the popup's `openCard`), `src/components/TrayControls.jsx` (Remove button,
`window.confirm`), `src/components/CrisisToken.jsx` (doc comment only, no logic change), `src/index.css`
(`.tray-label` cursor, `.tray-controls-actions`, `.tray-controls-remove`).

Remove: `handleCharacterRemove` calls `handleDropCharacterTokens` (reads the character while it is
still in state, so `modelPositionRef` still finds its live position), then filters it out of
`characters`, then clears `selection` and `openCard` if either points at the removed id.
`charBodies`/`charObjects`/`trayObjects` (the Rapier body and 3D object maps in `Scene.jsx`) need no
explicit cleanup: `CharacterModel` and `CharacterTray` unmount with the character, and their
`bodyRef`/`objectRef` callbacks already run with `null` on unmount (existing pattern, unchanged).
`toolTarget` in `Scene.jsx` is
derived from `selection`, so clearing `selection` already drops a stale tool target; the ruler tools
themselves are not forced to close (same as any other deselect, e.g. Escape with no tool active).

Confirmation: a plain `window.confirm` inside `TrayControls.jsx`'s own click handler, not a new popup
component. `TrayControls` already imports `characterGiveTokens` from `characters.js`; it now also imports
`characterName` for the confirm text, no new dependency.

Lowest free slot: `lowestFreeSlot(characters, teamColor)` scans the current `slot` values of that
team and returns the first integer not in use, replacing the old `prev.filter(...).length` (which
only ever grew). `trayPosition`/`benchPosition` already key off `slot`, unchanged, so a reused slot
places the new tray and model exactly where a removed one stood.

Select from the tray name: the name `<Html>` lost `pointerEvents="none"` and gained an `onClick`
(`e.stopPropagation()` then `onSelect()`), reusing `Scene`'s existing `toggleSelect('character', id)` —
the same toggle a model's own click uses, so clicking the name of an already-selected character
deselects it, consistent with clicking the model again.

Tray highlight: `CharacterTray.jsx` calls `useOutline(cardRef, outlineMode(selected, false))` on the
card mesh, the same `SelectionOutlines.jsx` helper `CharacterModel.jsx`/`CrisisToken.jsx` already use,
so a selected character's tray card gets the same orange outline as a selected model, with no new
rendering path. No hover state is tracked for the tray card (`outlineMode(selected, false)`): the doc
only asks for "a selected model highlights its tray", not a hover highlight.

Fix 1 (Extract token release vs. tray controls): `Scene.jsx` passed its own 3D-only `characterAt` as
`CrisisToken`'s `findCharacter` prop. It now passes `findCharacterAt`, a new prop `App.jsx` fills with
its existing `findCharacterAt` function (DOM `data-character-id` first, then `characterAtRef`'s
`characterAt`) — the same function the token-panel drag already used. `CrisisToken.jsx` itself is
unchanged (only its doc comment), so the DOM-first/3D-fallback logic lives in exactly one place.

Fix 2 (spread dropped tokens, cap selection): `handleTokenDrop(id, { rowOffset = 0, select = true })`
replaces the old `handleTokenDrop(id)`. `rowOffset` moves the drop point along the model's local z
(perpendicular to the existing +x offset), so several tokens line up in a short row instead of
stacking; `select` lets a caller skip selecting the dropped token. The tray's single Drop button
still calls `onTokenDrop(token.id)` with no second argument, so its behavior (offset 0, selects the
token) is unchanged. `handleDropCharacterTokens` now spaces `rowOffset` by `TOKEN_ROW_SPACING`
(token diameter + two gaps = 1.2") per token, centered on 0, and passes `select: false` for every
one, so a character with several held tokens selects none of them when removed.

Changes from the plan:

- The Remove confirmation is the browser's own `window.confirm`, not an in-app dialog: the app has
  no existing modal/dialog component to reuse, and a native confirm needs no new state or CSS.
- `openCard` gained an optional `characterId` field (character cards only) so `handleCharacterRemove`
  can tell whether the open popup shows the removed character's card. Not in the plan's "State"
  section, which only describes `characters`/`tokens` entries, not `openCard`'s shape.
- `handleDropCharacterTokens`'s tokens are spread in a straight row (fixed `+x`, varying `z`), not
  an arc: simpler, and the doc's "for example along a short row or arc" allows either.

Open issues:

- `window.confirm` blocks the render thread and looks like a plain browser dialog, not styled with
  the rest of the UI. Acceptable for now; an in-app confirmation can replace it later without
  changing `onRemove`'s shape.
- The tray highlight only outlines the card mesh, not the controls strip (a `Html` element, which
  the outline system cannot outline). A selected character's Damage/Power/Flip/Remove row has no
  visual tie to the highlight beyond sitting right next to the card.
- Not checked in a browser, only `npx vite build`, per the project's rules.

### Phase 8: Badges above the models (optional)

Small icons above each model: held objective tokens, Activated, Dazed, and maybe Damage and Power. TTS shows the same above each model. Players can then see the board state without looking at the trays.

### Fixes after Phase 7

After testing, the tray row moved next to the mat and models now spawn on their tray's card, not on a separate bench:

- Tray row: next to the mat edge, flush with the mat's width, not centered on the whole table and not in a table corner. A row holds 6 trays (was 13, centered on the table width); a second row behind the first holds 6 more, 12 per player total. `src/characters/trays.js`: `TRAY_COLUMNS`, `TRAY_ROWS`, `rowCenterZ`, `trayPosition` rewritten. Checked: no overlap with the crisis cards/supply tokens (`x = -23.1`/`-27`, about 3.4" clear of the nearest tray) or the dice trays (`x = 27`, about 7.1" clear); the farthest tray background stays 0.7" inside the table edge at z.
- Models spawn on the tray: `benchPosition` in `Scene.jsx` is gone. `trayModelPosition(teamColor, slot)` (`trays.js`) returns the table position at the center of that slot's card; `CharacterModel`/`Character` use it instead of `benchPosition`. The model's own rotation from the spawner is unchanged. Tray and model share the same slot, so they always match and neither moves when another character spawns or is removed.
- Tray background: a plate (`TRAY_BG_WIDTH` × `TRAY_BG_DEPTH`, 5.6" × 5.6") under the card and the controls strip, darker than the table, no collider, no shadow, just above the table and below the card. The card's selection outline (Phase 7) is unchanged.
- Tray name label removed: the clickable `<Html>` name and `.tray-label` CSS are gone (`CharacterTray.jsx`, `index.css`). It set the model's selection, which the model itself already does on click, so `CharacterTray`'s `onSelect` prop and its use in `Scene.jsx` are also gone. `selected` stays, so a selected model still highlights its tray card.

### Real-size tokens and one tray row

Asked on 2026-10-02: the tokens a character gives and the tokens on a character are real size. Each Give source never runs out, and a token can go anywhere on the table. A player has only one tray row.

#### Result

Files: `src/tokens/files.js` (`TOKEN_SIZE`), `src/characters/trays.js` (new tray parts and token positions, one row), `src/components/TokenFace.jsx` (new), `src/components/LooseToken.jsx` (new), `src/components/TokenDragPreview.jsx` (new), `src/components/CharacterTray.jsx` (On row and Give sources in 3D, the plate is the drop target), `src/components/TrayControls.jsx` (On and Give rows removed), `src/components/Scene.jsx`, `src/App.jsx` (`looseTokens`, the new drag, Delete key), `src/keyboard.js` (`DELETE_KEYS`), `src/index.css`.

Changes:

- The **On** row is above the card, and the Give sources are below the controls strip. Both are real-size 3D tokens (see [Controls](../features/character-trays.md#controls)).
- One drag for every character token: from a Give source, from the Tokens panel, and from the table. The DOM copy of the token under the pointer is gone. A real-size 3D token shows under the pointer instead (`TokenDragPreview.jsx`).
- The drop target of a tray is its whole background plate, not only the card. A token dropped anywhere on a tray goes to its character, as in TTS.
- `handleCharacterTokenGive` returns false when the character is immune, so a token from the table stays there.
- `TRAY_ROWS` and the second row are gone. With 13 or more trays, the row goes past the table edges.
- Every tray has 2 Give rows, so all trays have the same size. The mod's longest `cToken` list has 8 tokens: with Activated and Dazed, that is 10 sources.

Open issues:

- The size of a TTS `Custom_Token` (conditions, Activated, Dazed) is not measured. All tokens are 0.75".
- Tokens have no shadow. The hover outline of `SelectionOutlines.jsx` is not used for them. A label and the cursor show the token under the pointer.
- Since 2026-10-03, tokens are 2 mm (0.08") thick solids, not flat planes. The app finds the outline of the token image from its transparent pixels and extrudes it, the same way TTS builds a Custom_Token (`src/tokens/solid.js`). Real tokens are 1–2 mm thick. Crisis tokens and the VP markers use the same thickness.
- The range and movement tools do not snap to a token on the table.
- Wider trays (a grunt card, characters with 2 forms) need a width per tray in `layoutTrays`. Today every tray has the same width.
- Not checked in a browser, only `npx vite build`, per the project's rules.
