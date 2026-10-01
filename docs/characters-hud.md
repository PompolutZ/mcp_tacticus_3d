# Feature: Character trays

Status: plan. Not started. See [Open questions](#open-questions) at the end.

## Goal

Players track the game state of each character on the table:

- the side of the stat card that faces up (Healthy or Injured)
- Damage
- Power
- the objective tokens that the character holds (Extract tokens)
- other tokens on the character: special conditions (Bleed, Incinerate, Poison, ...), Activated and Dazed, and tokens from character superpowers or Team Tactic cards (for example Winging It from Star-Lord)
- cards attached to the character: Infinity Gems and Horsemen cards (Apocalypse)

A click on any card opens its image in a full-screen popup that can be closed, the same way as a crisis card today.

## First iteration: a tray in the 3D world

Later, the app should get a 2D HUD that is separate from the 3D world. For the first iteration, each spawned character gets a **character tray** on the table. The tray is the stat card of the character, facing the player who spawned it, with a few buttons and the tokens of the character.

To make the later move to a 2D HUD cheap:

- All tray state lives in `App.jsx`, the same as the crisis tokens. The 3D tray only shows it.
- The tray controls are plain DOM React components (`TrayControls`). The 3D tray mounts them in a drei `<Html transform>` element, the same way as `FlatHtml` in `RulerTool.jsx`. A 2D HUD can later mount the same components in a normal HUD panel.

## Players apply the rules

The app does not apply the game rules, in the same way as the crisis feature (see `docs/feature-crisis.md`, "Players apply the rules"). It does not deal damage, find Dazed or KO'd characters, run the Power Phase or the Cleanup Phase. Players press the buttons.

The app keeps only simple limits that never change: Damage from 0 to the Stamina of the side that faces up, and Power from 0 to 10.

## Rules

From the [Jarvis rules reference](https://www.jarvis-protocol.com/rules-reference) (rulebook 1.3.0 and 1.4.0):

| Rule | Text (short) | Page |
|---|---|---|
| Power | A character can have at most 10 Power. Power above 10 is lost. | 7–8 |
| Spend or lose Power | A character cannot spend or lose more Power than it has. | 8 |
| Excess damage | A character never has more Damage than its current Stamina. More damage is ignored. | 16 |
| Dazed or KO'd | Damage equal to Stamina: a Healthy character is Dazed, an Injured character is KO'd. A KO'd character is removed from the battlefield. | 16 |
| Cleanup Phase | Dazed characters remove all damage, special conditions and the Dazed token, and flip to the Injured side. Then players remove all Activated tokens. | 12 |
| Special conditions | A character cannot have the same special condition twice. | 17 |
| Immunity | A character cannot get a special condition it is immune to. | 21 |
| Hold | A character that picks up an objective token holds it. The token lies on its stat card. | 10 |
| Drop | A Dazed or KO'd character drops all objective tokens it holds. The opponent places them within Range 2 of the character. | 10 |
| Infinity Gems | A character can have only one Infinity Gem. In the Power Phase, it gains 1 more Power per gem. | 20 |
| Grunts | Grunts have no Injured side and cannot have Power. | 21 |

The 10 special conditions: Bleed, Hex, Incinerate, Judgment, Poison, Root, Shock, Slow, Stagger, Stun (p20).

## How TTS does it

These facts were found on 2026-10-01 in the scripts of the "Red Tray Spawner" object (`trayScript`) and the `Database` object of mod 3036795456.

- Each character has a tray in front of its player. The trays are in one row at TTS z = ±28.25, 7.5" apart, centered on x = 0. A tray mesh is 7" × 8". A player can have at most 15 trays.
- The tray has a Power counter (`power / 10`) and a Damage counter (`damage / stamina`). A left click adds 1, a right click removes 1. The Stamina is `cStamH` on the Healthy side and `cStamW` on the Injured side.
- The **Flip Card** button turns the card and sets Damage to 0.
- A player can drop a "1 Power", "3 Power", "1 Damage", "3 Damage" or "5 Damage" token on the tray. The counter changes and the token is deleted.
- Any other token dropped on the tray becomes an icon on the tray and above the model. Each icon is on or off: a character has a token or not, there is no count. Two exceptions have a count: the character's personal token (`perToken`, at most `perMax`, for example Apocalypse's Evolution, at most 6) and Suppression. A click on an icon removes it.
- `cImmune` lists the conditions that the character is immune to. The tray refuses them with a message.
- A held objective token stays on the tray as an object. The tray has 5 slots for held tokens. Its icon shows above the model.
- When the tray spawns, it puts these tokens next to it: Activated, Dazed, the affiliation token, and every token in the character's `cToken` list. For example, Apocalypse: Root, Shock, Bleed, Slow, Incinerate, Evolution, Poison.
- An Infinity Gem card attaches to the tray only if the character can bear it (`cGem`). One gem per character, two for Thanos, The Mad Titan and Adam Warlock. A Horsemen card attaches only if it is in `cHorsemen`.
- The tray also has **Auto Power** and **Auto Cleanup** buttons that apply the Power Phase and Cleanup Phase rules. The app leaves these out (see [Players apply the rules](#players-apply-the-rules)).

## Tray layout

### Place on the table

The table today is 72" × 48" (`src/table.js`). Between the mat edge and the table edge there is a strip of 6" on each player side. The spawned models stand there (`benchPosition` in `Scene.jsx`). There is no free room for trays.

Plan: the table grows from 48" to 60" deep (z from −30 to 30). Each player gets one row of trays between z = 24.5 and z = 29.5 (blue at +z, red at −z). This is close to the TTS row at z = ±28.25.

Changes that follow from this:

- `TABLE_DEPTH` in `src/table.js`. The table halves, the table collider and the table walls follow it.
- `scripts/dice-sim.mjs` uses the same table. Run it once and check that the results do not change. The dice trays are at z = ±10.1, far from the walls, so they should not change.
- The shadow camera in `Scene.jsx` does not need to cover the trays. Trays are flat and do not cast shadows.

### One tray

- The card image is 1800 × 1200 px, so the card plane is 4.5" × 3".
- The controls strip is below the card, on the side of the owner. It is about 1.5" deep.
- So a tray is about 5" × 5". Trays are 5.5" apart, so a row has room for 13 trays. That is enough for a squad with Grunts.
- Trays fill the row from the owner's left, in the order of spawn. This is the same order as the bench slots.
- The card faces the owner. For blue, the top of the image points to −z, the same as a crisis card (`CrisisCard.jsx`). A red tray is turned by 180°.
- A tray has no collider. Models and dice do not touch it.

At the default camera position, the trays are at the edge of the view or outside it. Players pan the camera to see them. A 2D HUD fixes this later.

### Controls

Sketch, seen from the owner's seat:

```
+-----------------------------------+
|                                   |
|     stat card (Healthy/Injured)   |   click: popup
|     held tokens and attached      |
|     cards on the card edge        |
|                                   |
+-----------------------------------+
| Dmg [-] 3/6 [+]  Pow [-] 4/10 [+] |
| [Flip]  [Bleed][Stun][Activated]  |   click on a chip: remove one
| [+ Token]  [Attach]  [Remove]     |
+-----------------------------------+
```

- Damage and Power: `−` and `+` buttons around the value. TTS uses left and right click on the value. Buttons also work on a touch screen.
- When Damage equals Stamina, the counter shows it in a warning color. The app does not add the Dazed token or flip the card.
- Flip: turns the card to the other side and sets Damage to 0, as in TTS.
- Token chips: one chip per token, with the token image and a count when the count is above 1. A tooltip shows the name and the mod's description (`tDescr`).

## Card popup

`CardPopup.jsx` today takes a crisis card key. It changes to take an image URL and an alt text. App keeps `openCard: { src, alt } | null`. The crisis card, the character card and the attached cards all use it. Escape still closes it.

The character card in the popup shows the side that faces up. The popup can have a button to show the other side, because players often read the Injured side while the card is Healthy.

## Tokens from the TTS mod

The mod's `tokenDatabase` (in the `Database` script) has 310 rows. On 2026-10-01, the TTS cache had the images of all of them. The images are PNG. The checked ones are 225 to 375 px.

| Mod type (`tType`) | Rows | Examples | Migrate |
|---|---|---|---|
| Condition, `token/condition/` | 10 + 10 | Bleed, Incinerate, Poison | yes, without the second art (see below) |
| Condition, `token/dice/` | 6 | Hit, Crit, Wild | no: dice results that players put on cards |
| Status | 35 | Activated, Dazed, Winging It, Bounty, Gadget | yes |
| Personal | 21 | Loaded, Genetic Sample, Devil's Deal, Evolution | yes |
| Only Status | 26 | Disarm, Marked for Death, Crew of the Milano | yes, except 3 rows in `token/misc/` (Master of Metal, Antimatter Core, Suppression): AI mode and Infinity Gauntlet event |
| Misc | 7 | 1/3/5 Power, 1/3/5 Damage, Mystic Ward | only `1 Power`, as the icon of the Power counter |
| Use Tools, Pile | 14 | Chimichanga, Astral Ring, LMD | no: these tokens lie on the table, not on a character |
| Affiliation | 34 | Asgard, Wakanda | no |
| Objective types | about 130 | Extract Asset, Secure Zone | no: the crisis feature migrates them |

Notes:

- A row with `altName` is a second art of the same token, for example "Bleed1" with `altName = "Bleed"`. The second art is a round icon. The first art is the shape of the real token. The script migrates only the first art.
- The Damage counter icon is the mod's "1 Damage" token. `migrate-crisis.mjs` already migrated it to `src/assets/crisis/markers/damage.webp`. Use that file.
- The script also stores `cleanup: true` from the mod. It marks the tokens that the Cleanup Phase removes. The app does not use it yet.

About 90 tokens are migrated. At about 15 KB each, this is about 1.4 MB.

Output, in the same style as the crisis migration:

| File | Content |
|---|---|
| `src/assets/tokens/<key>.webp` | Token image, WebP, at most 256 × 256 |
| `src/tokens/tokens.json` | `key → { name, group, description, cleanup }` |
| `src/tokens/files.js` | `characterToken(key)` |
| `scripts/token-manifest.json` | Source URLs, so a second run converts only new or changed files |

`group` is one of `condition`, `status` (Activated and Dazed), `character` (images in `token/character/`) and `tactic` (images in `token/tactic/`). The token picker uses the groups.

## Character data

| Data | Source | Where |
|---|---|---|
| Stamina, Healthy and Injured | Jarvis `statCard.frontSide.stamina`, `backSide.stamina` | `roster.js`, which already loads `jarvis-characters.json` |
| Gems the character can bear | Jarvis `bearableGems` (MCT codes in `bearableGemsWithName`) | `roster.js` |
| Horsemen cards the character can get | Jarvis `assignableToHorsemen`, for example `['death', 'pestilence']` | `roster.js` |
| Tokens the character uses | Mod `cToken` | `characters.json`, written by `migrate-characters.mjs` |
| Immunities | Mod `cImmune` | `characters.json` |

Jarvis has the current official values, so the stats come from Jarvis. Only the mod has the token lists. The Jarvis text also marks tokens (`|<winging_it>Winging It|`) and conditions (`|§bleed§Bleed|`), but the mod's `cToken` list maps directly to the token images.

## State

New fields on each entry of `characters` in `App.jsx`:

```js
{
  // existing: id, key, figure, base, rotation, teamColor, slot
  side: 'healthy',   // card side that faces up: 'healthy' | 'injured'
  damage: 0,         // 0 .. Stamina of `side`
  power: 0,          // 0 .. 10
  tokens: {},        // token key (tokens.json) -> count. A condition has count 1 at most.
  cards: [],         // attached card keys: Infinity Gems and Horsemen
}
```

A held crisis token stays in the `tokens` list of `App.jsx` and gets one new field: `heldBy: characterId | null`. So each token is in one place only, and a change of crisis card still removes the held tokens of the old card.

All fields are plain JSON. So they fit into the `characters` and `tokens` maps of the Yjs document in `docs/feature-peer-to-peer.md`.

## Hold and drop

Only tokens of an Extract card that players can move can be held: Asset, Civilian and the supply tokens of Source cards. `buildMatTokens` and `buildSupplyTokens` set a new `canHold` flag.

- **Hold:** a player drags the token and releases it over the base of a model. The character of that model now holds the token. The token leaves the mat and shows as a chip on the tray. The app does not check the range: players apply the rules.
- **Drop:** the chip on the tray has a Drop button. The app puts the token on the table next to the base of the model and selects it. The opponent then moves it to a place within Range 2.
- **Remove a character:** the character drops all its tokens first.
- A held token is not in the list of models that the range and movement tools snap to.

When this is done, update the status of `docs/feature-crisis.md`. It says that hold and drop are not built.

## Attached cards

- Infinity Gems (7 cards) and Horsemen cards (5 cards) are rows of the mod's `cardDatabase`, types "Infinity Gem" and "Horsemen".
- On 2026-10-01, the TTS cache had all 5 Horsemen faces, but only the Soul gem card. Before the migration, take the gem cards out of the "Infinity Gems" bag in TTS once, so that TTS downloads them.
- The Attach button lists the cards that the character can have first (Jarvis data), then the other cards. The app does not block a card, because players apply the rules.
- The attached card shows as a small image on the edge of the tray card. A click opens it in the popup. The card has a button to remove it.

Team Tactic cards, also Reserve members, are a separate feature. The app does not handle Team Tactic cards yet.

## Phases

Each phase is one short agent session and ends with a working app.

### Rules for every phase

- Read `CLAUDE.md` and this doc. Do not open the app in a browser. Check with `npx vite build`.
- Do not commit and do not push. Leave the changes in the working tree.
- Match the style of the code around you: plain, short comments that say why. Units are inches, 1 three.js unit = 1".
- Keep tool output small (`head`, `grep`, summaries). Do not read big files in full. `jarvis-characters.json` has 110,000 lines, and the mod JSON is 41 MB.
- At the end, add a short **Result** under the phase: files, measured facts, changes from the plan, open issues. The next agent reads the results of all earlier phases.

### Phase 1: Tray with the card

- Grow the table to 72" × 60" (see [Place on the table](#place-on-the-table)). Run `npm run dice-sim` before and after, and compare.
- `src/characters/trays.js`: `trayPosition(teamColor, index)` and the tray sizes.
- `CharacterTray.jsx`: the card plane (Healthy side) and the character name. No controls yet.
- `CardPopup.jsx` takes `{ src, alt }`. The crisis card uses the new form. A click on a tray card opens it.

Done when the trays show in a row for each player and a click on a card opens the popup.

### Phase 2: Damage, Power, Flip

- `roster.js` adds the Stamina of both sides from Jarvis.
- New character fields `side`, `damage`, `power`. Handlers in `App.jsx`, the same way as the token handlers.
- `TrayControls.jsx` (plain DOM) in a flat `<Html transform>` on the tray: Damage and Power counters, Flip.
- The tray card and the popup show the side that faces up.

### Phase 3: Token images

- `scripts/migrate-tokens.mjs`, `npm run migrate-tokens`, with `--list`, `--force` and `--out` like `migrate-crisis.mjs`. Use `loadCrisisDatabase` in `scripts/lib/tts.mjs`, or a new loader next to it.
- Output as in [Tokens from the TTS mod](#tokens-from-the-tts-mod). A section in `scripts/README.md`. A line in `ASSETS.md`.
- No UI change.

### Phase 4: Tokens on the tray

- `migrate-characters.mjs` writes `tokens` (`cToken`, as token keys) and `immune` (`cImmune`) to `characters.json`. Run it again for the migrated characters. The script converts only files that are not in the manifest, so only the JSON changes.
- New character field `tokens`. Chips on the tray. A click on a chip removes one.
- The `+ Token` picker: first this character's tokens, then the conditions, then Activated and Dazed, then all other tokens with a search field. A condition the character already has, or is immune to, is shown as such, but the app does not block it.

### Phase 5: Hold and drop

As in [Hold and drop](#hold-and-drop). `CrisisToken.jsx` reports the drop point, and `Scene.jsx` finds the model under it with the character bodies (`charBodies`).

### Phase 6: Remove, and link the tray to the model

- A Remove button on the tray (with a confirmation) removes the character, its model and its tray. It drops the held tokens first.
- A new character takes the lowest free bench slot, so that it does not stand on a model that is still there.
- A click on the character name on the tray selects the model. A selected model highlights its tray.

### Phase 7: Attached cards

- Migrate the Infinity Gem and Horsemen card images (a new script, or `migrate-tokens.mjs` with a second output).
- `roster.js` adds `bearableGems` and `assignableToHorsemen` from Jarvis.
- New character field `cards`. The Attach button, the card images on the tray, the popup, and Remove.

### Phase 8: Badges above the models (optional)

Small icons above each model: held objective tokens, Activated, Dazed, and maybe Damage and Power. TTS shows the same above each model. Players can then see the board state without looking at the trays.

## Out of scope

- A 2D HUD separate from the 3D world. This is the next step after this feature.
- Team Tactic cards, also Reserve members.
- Auto Power and Auto Cleanup, and any other rule automation.
- Grunts (no Injured side, no Power), second forms (Emma Frost, Diamond Form) and the second card version of some characters (`cards` > 1 in `characters.json`). The tray uses card 1.
- Tokens that lie on the table and not on a character (Use Tools, Pile).
- Affiliation tokens.

## Open questions

1. **Table size.** Grow the table to 72" × 60" for the tray rows (this plan), or put the trays somewhere else?
2. **Counters.** `−` and `+` buttons (this plan), or the TTS way with left and right click on the value, or both?
3. **Hold.** Drag the token onto a model (this plan), or a "Pick up" button in the token panel that lists the characters near the token?
4. **Immunities.** Only show them in the picker (this plan), or block the condition?
5. **Token art.** The first art of the mod (shape of the real token, this plan), or the round second art?
6. **Gem cards.** Can you take the 7 gem cards out of the TTS bag before Phase 7, so that their images are in the cache?
