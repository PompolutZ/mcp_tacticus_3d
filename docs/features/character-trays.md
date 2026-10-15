# Feature: Character trays

Status: built.

Not built yet:

- Badges above the models: small icons for held tokens, Activated, Dazed, Damage and Power. TTS shows them. Players can then see the board state without looking at the trays.
- Constructs of Phoenix: the app handles them, but her construct files are not migrated yet (see [Constructs](#constructs)).
- Room for the grunt block on the table: the tray of a host with grunts needs the last inches before the table edge (see [Grunts](#grunts)).
- Horsemen cards and Reserve members (see [Out of scope](#out-of-scope)).
- Attach or remove a gem by hand. Gems come only from the roster. A character added from the Library has none.
- Gem cards other than Soul and Mind. They migrate when the TTS cache has them.
- A 2D HUD separate from the 3D world.

## Goal

Players track the game state of each character on the table:

- the side of the stat card that faces up (Healthy or Injured)
- Damage
- Power
- the objective tokens that the character holds (Extract tokens)
- other tokens on the character: special conditions (Bleed, Incinerate, Poison, ...), Activated and Dazed, and tokens from character superpowers or Team Tactic cards (for example Winging It from Star-Lord)

A click on a character card opens the whole tray in a full-screen popup (see [Tray popup](#tray-popup)).

Infinity Gems attached to a character show on its tray (see [Attached cards](#attached-cards)). Horsemen cards of Apocalypse and Reserve members come later.

## First iteration: a tray in the 3D world

Later, the app should get a 2D HUD that is separate from the 3D world. For the first iteration, each spawned character gets a **character tray** on the table. The tray is the stat card of the character, facing the player who spawned it, with a few buttons and the tokens of the character.

To make the later move to a 2D HUD cheap:

- All tray state lives in `App.jsx`, the same as the crisis tokens. The 3D tray only shows it.
- The tray controls are plain DOM React components (`TrayControls`). The 3D tray mounts them in a drei `<Html transform>` element, the same way as `FlatHtml` in `ToolButtons.jsx`. A 2D HUD can later mount the same components in a normal HUD panel.

## Players apply the rules

The app does not apply the game rules, in the same way as the crisis feature (see `docs/features/crisis.md`, "Players apply the rules"). It does not deal damage, find KO'd characters, or score VP. Players press the buttons. The exceptions are the Power Phase gain, which the **Power** button in the toolbar runs (see [Power Phase](#power-phase) and `docs/features/round-phases.md`), and the steps of the Cleanup Phase that need no choice, which the **Cleanup** button runs (see [Cleanup Phase](#cleanup-phase) and `docs/features/round-phases.md`).

The app keeps only simple limits that never change:

- Damage is from 0 to the Stamina of the side that faces up.
- Power is from 0 to 10.
- A character has each special condition at most once (p17). Activated and Dazed are also at most once.
- A character cannot get a special condition it is immune to (p21). The app does not add it and shows a short message, for example "Okoye is immune to Bleed." The immunities come from Jarvis (see [Immunities](#immunities)), so they are data, not a rules engine.

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
| Immunity | A character cannot get a special condition it is immune to. If it already has it, it removes it. | 21 |
| Hold | A character that picks up an objective token holds it. The token lies on its stat card. | 10 |
| Drop | A Dazed or KO'd character drops all objective tokens it holds. The opponent places them within Range 2 of the character. | 10 |
| Grunts | Grunts have no Injured side and cannot have Power. | 21 |

The 10 special conditions: Bleed, Hex, Incinerate, Judgment, Poison, Root, Shock, Slow, Stagger, Stun (p20).

## How TTS does it

These facts were found in the scripts of the "Red Tray Spawner" object (`trayScript`) and the `Database` object of mod 3036795456.

- Each character has a tray in front of its player. The trays are in one row at TTS z = ±28.25, 7.5" apart, centered on x = 0. A tray mesh is 7" × 8". A player can have at most 15 trays.
- The tray has a Power counter (`power / 10`) and a Damage counter (`damage / stamina`). A left click adds 1, a right click removes 1. The Stamina is `cStamH` on the Healthy side and `cStamW` on the Injured side.
- The **Flip Card** button turns the card and sets Damage to 0.
- A player can drop a "1 Power", "3 Power", "1 Damage", "3 Damage" or "5 Damage" token on the tray. The counter changes and the token is deleted. The app uses only the `−` and `+` buttons for this.
- Any other token dropped on the tray becomes an icon on the tray and above the model. Each icon is on or off: a character has a token or not, there is no count. Two exceptions have a count: the character's personal token (`perToken`, at most `perMax`, for example Apocalypse's Evolution, at most 6) and Suppression. A click on an icon removes it.
- `cImmune` lists the conditions that the character is immune to. The tray refuses them with a message.
- A held objective token stays on the tray as an object. The tray has 5 slots for held tokens. Its icon shows above the model.
- When the tray spawns, it puts these tokens next to it: Activated, Dazed, the affiliation token, and every token in the character's `cToken` list. For example, Apocalypse: Root, Shock, Bleed, Slow, Incinerate, Evolution, Poison. Players drag them from there onto the target. The "Token Tray" object next to the table has a copy of every token.
- The tray also has **Auto Power** and **Auto Cleanup** buttons that apply the Power Phase and Cleanup Phase rules. The app has a **Power** button in the toolbar for the Power Phase (see [Power Phase](#power-phase)) and a **Cleanup** button for the Cleanup Phase (see [Cleanup Phase](#cleanup-phase)). The Cleanup button works for both players at once, as in TTS (see `docs/features/round-phases.md`).

## Tray layout

### Place on the table

The table is 72" × 76" (`src/table.js`). The last 4" at each end, past the Give sources, hold nothing. The tool rack lies in front of the dice tray (`docs/features/table-tools.md`). The mat is 36" × 36" (`MAT_SIZE` in `Scene.jsx`), centered on the table, so its edge is 18" from the table center on every side.

Each player's trays sit in one row on that player's side (host at +z, guest at −z), past the player's tactic tray. So the order from the mat is the same as in TTS: mat, tactic tray, character trays. The tactic tray plate ends 22.4" from the table center (see `docs/features/team-tactic-cards.md`, "Tactic tray"). A player never has a second row. The row is centered on the middle line of the table (x = 0), the same as TTS (`arrangeTrays` in the Red Tray Spawner). 12 trays fit in the table width. A row of more than 6 trays is wider than the mat, so it goes past the mat corners. See `src/characters/trays.js`.

Changes that follow from this:

- `TABLE_DEPTH` in `src/table.js`. The table mesh, the table collider and the table walls follow it.
- `scripts/dice-sim.mjs` uses the same table. Run it once and check that the results do not change. The dice trays are at z = ±10.1, far from the walls, so they should not change.
- The shadow camera in `Scene.jsx` does not need to cover the trays. Trays are flat and do not cast shadows.

### One tray

- The card image is 1800 × 1200 px, so the card plane is 4.5" × 3".
- Tokens on a tray are real size (0.75", see [Real-size tokens](#real-size-tokens)). A row of 6 tokens fills the 5" tray width.
- From the mat side to the owner's side, a tray has: the **On** row of tokens (0.95"), the card (3"), and the controls strip (1.5").
- So a tray is 5" × 5.45" (`TRAY_WIDTH` × `TRAY_DEPTH`). A background plate under all parts is slightly larger (5.6" × 6.05"), so the tray stands out from the table. The plate ends 28.75" from the table center.
- The **Give** sources are not part of the tray. They lie on the table on the owner's side of the plate, 0.3" from it, in 2 rows of 6 (1.6"). The second row ends 30.65" from the table center; the table edge is at 34". They move with the tray.
- There is a 0.3" gap between two plates, and between the tactic tray and the row. Without it, two trays look like one. So trays sit 5.9" apart, center to center, and `floor((72 + 0.3) / 5.9) = 12` trays fit in the table width.
- The row is centered on the middle line of the table. One tray sits on the line. Two trays sit one on each side of the line, and so on. The order is the spawn order, from the owner's left.
- So every tray of a player moves when that player adds or removes a character. A removed character's tray leaves the row, and the row closes the gap. The same happens in TTS.
- The card faces the owner and sits on the mat side of the tray; the controls strip sits on the owner's side, away from the mat. For the host, the top of the card image points to −z, the same as a crisis card (`CrisisCard.jsx`). A guest tray is turned by 180°.
- A tray has no collider. Models and dice do not touch it.
- A newly spawned model stands on the table at the center of its tray's card, not on a separate bench. The model faces the mat, toward the opponent, as in TTS (see "Models face the mat"). The model reads that position only once, when its body mounts. A Rapier `RigidBody` moves its body when its `position` prop changes, so a later tray move must not reach the body through that prop. A model that is still loading when the row shifts mounts on its tray's new place.
- When a tray moves, a model that still stands on that tray moves with it (`Scene.jsx`). A model that the player moved off its tray, for example onto the mat, stays where it is. TTS does the same (`moveTray` in the tray script). TTS checks "not on the mat"; the app checks "on its own tray plate, or on the table past it, as wide as the plate" (`inTrayArea` in `trays.js`), so a spare model (see [Second forms](#second-forms)) moves too.

The start view (`CAMERA_TARGET` and `CAMERA_POSITION` in `src/camera.js`) shows the tactic trays and the character trays of both players. It also shows the own tool rack, in front of the dice tray. Its bottom edge is at z = 37.5" (`docs/features/key-shortcuts.md`, "Start view").

### Controls

Sketch, seen from the owner's seat:

```
+-----------------------------------+   (mat side)
| (Bleed)(Stun)(Activated)          |   On row: click a token to remove one
+-----------------------------------+
|                                   |
|     stat card (Healthy/Injured)   |   click: tray popup
|                                   |
+-----------------------------------+
| Dmg [-] 3/6 [+]  Pow [-] 4/10 [+] |   DOM controls strip
| [Flip]                   [Remove] |
| Held: [Asset]                     |
+-----------------------------------+
  (Act)(Dazed)(Root)(Shock)             Give sources on the table: drag a new
                                        token from one; second row for 7 to 12
                                        (owner's side)
```

The whole tray is a drop target for tokens. The Give sources are outside the tray, so a token dropped on them lies on the table.

- Damage and Power: `−` and `+` buttons around the value.
- When Damage equals Stamina, the counter shows it in a warning color. The app does not add the Dazed token or flip the card.
- Flip: turns the card to the other side and sets Damage to 0, as in TTS. The F key does the same with the pointer over the card or the model, or with the character selected (see `docs/features/key-shortcuts.md`).
- **On** row, above the card, where TTS shows the tokens on a character: one real-size 3D token per token key, with a count badge when the count is above 1. The tokens start at the owner's left, in the order the character got them. With more than 6 tokens they overlap, so the row stays as wide as the tray. A label above a token under the pointer shows its name and the mod's description (`tDescr`). A click on a token removes one.
- **Give** sources, on the table below the tray: the tokens that this character gives to others or to itself: Activated, Dazed, and the tokens in its `cToken` list. They are real-size 3D tokens, in rows of 6 from the owner's left. TTS spawns these tokens at the same place, on the table below the tray, in rows from the owner's left. Each source never runs out: a drag takes a new token from it.

### Models face the mat

A model that spawns on its card, and one that goes back to it (Remove), faces the mat. A host model and a guest model start 180 deg apart. The TTS tray turns a model by the tray rotation + 180 + the character's `cModelRot`; a standee gets no `cModelRot`. The tray rotation is 180 for the mod's Red seat (the app's host side) and 0 for Blue. A TTS Y rotation `r` is `-r` in Three.js. The tray part (tray rotation + 180) is the start turn of the body, so Q / E and the stored pose include it. The `cModelRot` part is the turn of the figure on its body, plus the 180 deg import turn of the mod GLBs (`IMPORT_ROTATION` in `Terrain.jsx`). A stored pose keeps its own turn. The second model has the first model's `cModelRot`. See `src/characters/models.js`. One exception in TTS is not built: Ant-Man, Captain Marvel Cosmic Avenger and Emma Frost (`twoCards` with `newCard`) spawn their models with the tray rotation + 90 and no `cModelRot`.

## Attached cards

A character can have cards attached to it. Today these are the Infinity Gems of its roster entry. The field `attached` of the character holds their MCT codes. The setup sets it when the squad goes on the table (`revealSquad` in `setup/useGameSetup.js`). A character with no gem has no field, and an old document has none either. Both mean no attached cards.

The gem cards come with the Team Tactic card files: `migrate-tactics.mjs` also takes the released rows with `type = tInf`, and the images go to `src/assets/tactics/` and `src/tactics/cards.json`. The Library and the other lists of Team Tactic cards leave the gems out. They use the Jarvis flag `isInfinityGem`, not the name. The app has the Soul and Mind cards, the two that the TTS cache has. The field is called `attached` and not `gems`, so Horsemen cards and Reserve members can use it later.

In TTS, the gem cards lie next to the character card on the roster tray. A player drops a gem on the character tray. The tray takes it only when the character can have that gem (`cGem` of the character row). The tray puts it at a fixed place on the tray, with a **Remove Card** button. Thanos and Adam Warlock can have a second gem. The app does not copy this: the trays are 0.3" apart and have no free space at their sides, and a card over a part of the tray would cover the stat card. So the app shows a chip and a popup.

- **Remove** takes the character off the board (a KO'd character, p16, see `docs/features/round-phases.md`, decision 16). Its held tokens drop next to the model, then each model goes back to its place on the tray card with its spawn turn, and the new pose is stored. The character, its tray, tokens, Damage and Power stay. No confirm: a player can drag the model back. A model that the other player moves is skipped. **Remove** is disabled while no model of the character is on the mat. The Delete key over a tray card deletes the character, its models and its tray, after a confirm.
- The controls strip of the 3D tray has one chip per attached card, above Flip and Remove. Its text comes from the card name: "Infinity Gem: Soul" gives "Soul Gem".
- A click on the chip opens the gem card in the card popup. A gem without an image shows the HUD message "No card image for <name> (<code>)".
- The tray popup shows no chips. It shows each attached card as a small thumbnail (90 px wide) in a column at the side of the stat card, so the popup keeps its height. On a narrow screen (560 px or less) the thumbnails go in a row under the stat card.
- A click on a thumbnail shows that card large over the stat card, centered, about `min(70vh, 520px)` high. A click on the large card or on its thumbnail makes it small again. A click on another thumbnail shows that card instead. One card is large at a time. The open thumbnail has an outline. The state is gone when the popup closes.
- Both players see the chips, and both can open the cards. Reading a card changes nothing.
- The strip has room for two chips (Thanos and Adam Warlock). More than two would need a second row.
- The chip text comes from the card name. "Infinity Gem: Bonded Soul" gives "Bonded Soul Gem".
- The app does not check which character can hold a gem, and does not check the range. The Power Phase counts the gems (see `docs/features/round-phases.md`, decision 1). Players apply the other rules.

## Power Phase

The **Power** button in the toolbar (group Phase) gives each of your characters on the mat the Power of the Power Phase: 1, the extra Power of its superpower, and 1 per gem (2 for the Power gem), with the Stun, Poison and cap rules. Grunts and characters off the mat get nothing. A HUD message lists the changes. The rules, the data and the decisions are in `docs/features/round-phases.md`.

## Cleanup Phase

The **Cleanup** button in the toolbar (group Phase) does the steps of the Cleanup Phase that need no choice, for both players. Dazed characters get Damage 0, the Injured side, and lose the Dazed token and the special conditions. All characters lose Activated and the tokens with `cleanup: true`, and so do loose tokens on the table. Exhausted Sources flip back, supply tokens leave the game, and the round marker moves to the next round. It is one change, so the other browser gets it at once. The button is disabled (`aria-disabled`, the title gives the reason) while a character on the board has neither an Activated nor a Dazed token, and while no character is on the board. Players score VP first. The rules, the data and the decisions are in `docs/features/round-phases.md`.

## Second forms

Some characters have a second form with its own model. The mod marks each of them with one of two flags in its `Database`:

| Mod flag | Characters | Cards | Second model |
|---|---|---|---|
| `twoCards` | Ant-Man, Captain Marvel Cosmic Avenger, Emma Frost, Hood, Ms. Marvel, Wasp | 2: one card per form (`cCard` and `cTCard`), each with a Healthy and an Injured side | spawns on card 2 |
| `oneCard` | Hulkbuster (Iron Man), Phoenix (Phoenix Unleashed) | 1: the Injured side is the second form | spawns on the table past the Give sources |

In TTS, the tray spawns both models for both flags (`assignValues` in the Red Tray Spawner). For `twoCards`, the tray mesh has room for two cards. For `oneCard`, the second model stands 5" from the first. The second model is a clone of the first one with the other bundle, so it has the same turn.

The app does the same:

- **Two cards:** card 2 lies under card 1, toward the owner, with the same side up. Flip turns both cards. Every part after card 1 moves 3.1" toward the owner (card height + 0.1" gap): card 2, the controls strip, the plate edge and the Give sources. The mat side of the tray stays in line with the other trays. A click on either card opens the tray popup, which shows both cards.
- **Spare model:** the second model of a `oneCard` character stands past the last row of Give sources, 0.3" from the tokens, in the middle of the tray width.
- Both models are full models: a player selects, moves and turns each one, and the tools measure against each one. A token dropped on either model goes to the character. Both models show the spectator badge.
- A model that stands on its tray plate, or on the table past it (the Give sources and the spare model), moves with the tray when the row shifts (`inTrayArea` in `trays.js`).
- Held objective tokens lie on card 1.
- Damage and Power are one counter for the character, as in TTS. The Damage limit is the Stamina of the side that faces up. In Jarvis, both forms of each `twoCards` character have the same Stamina, so one limit is correct.
- Players move the model of the form in use onto the mat by hand. The app does not swap the models (see [Players apply the rules](#players-apply-the-rules)).

Space: a tray with two cards ends 31.85" from the table center, and its second row of Give sources ends 33.75". So the table grew from 66" to 68" deep (edge at 34"). A spare model past two rows of Give sources has its center 1.6" + 0.3" + its base radius past the plate, so even a large base (Phoenix Unleashed) ends 33.5" from the center.

Data:

- The card of the second form is `transform-card-healthy.webp` and `transform-card-injured.webp`, from the mod's `cTCard`. `characters.json` has `transform.card: true` when the character has it. `migrate-characters.mjs` writes it, and it requires the card for a `twoCards` character. A `transform` without `card` is a spare model.
- Item 2 of the mod's `cCard` list is not always the second form: for Emma Frost it is an alternate card. The mod's tray uses `cTCard` (see `scripts/README.md`).
- The roster copies `transform` to the character entry in App state, as it does for `figure`, `base` and `rotation`. It is plain JSON.
- `src/characters/models.js` lists the models of a character. The first model has the character's id. The second model has the id `<character id>:2`. Selection, hover, the tools and the Rapier body maps use model ids. `characterAt` and the tray use the character id.

## Give tokens by drag and drop

A player gives a token to a character by dragging it onto the model or onto the tray of that character. This works the same way for all tokens:

| Token | Drag from | Result |
|---|---|---|
| Character token (condition, Activated, Dazed, superpower or Team Tactic token) | A **Give** source of any tray, the **Library**, a pile, or the table | The token count on the target goes up by 1, with the limits in [Players apply the rules](#players-apply-the-rules) |
| Extract objective token (Asset, Civilian, supply token) | The table, or the supply pile of a Source card | The tray card holds the token, see [Hold and drop](#hold-and-drop) |

The **Library** HUD panel shows every migrated token, in groups, with a search field (see `docs/features/library.md`). It replaced the old Tokens panel. It has the same purpose as the TTS "Token Tray": a player can give a token that is not among the Give sources of any tray, for example a token from a Team Tactic card. In Pile mode, a drag from the Library puts a pile on the table that never runs out.

A click on a **Give** source (a press with no drag) gives 1 of that token to the character of that tray, with the same limits as a drop on it. A token that cannot be given (an immunity) shows the same HUD message.

A character token can also lie on the table, as in TTS. A player drags it there from a Give source, a pile or the Library, and later drags it on to a character or to another place. The Delete key (or Backspace) removes the token under the pointer.

How the drag works:

- A drag starts on `pointerdown` on a Give source (3D, the press also knows the character of the tray), a token or a pile on the table (3D) or a Library token chip (DOM). App stores it (`tokenDrag`) and turns off the camera controls.
- The drag becomes active after the pointer moves 4 px. Then `TokenDragPreview` shows the token at real size on the table or terrain point under the pointer. A token from the table is hidden at its old place. A release before 4 px is a click. On a Give source, the click gives 1 token to that tray's character (`giveId`, the 4th argument of `onTokenDragStart`); on any other piece, nothing happens.
- On `pointerup`, App decides:
  1. Over a HUD panel: nothing happens. So a drag back onto the Library cancels it.
  2. Over a character: the character gets the token. An Extract token is held only when the release is on a tray card (the plate or a `data-character-id` element); over a model on the table it goes to the table (step 3). DOM first: the nearest element with `data-character-id` under the pointer (the tray controls have it, and a later 2D HUD can use the same attribute). Then 3D: `Scene.jsx` gives App a `characterAt(clientX, clientY)` function through a ref. It casts a ray from the camera and hits the model objects (`charObjects`) and the tray background plates. `{ models: false }` hits only the plates; a crisis token (Extract, below) uses it. A token from the table is used up, also when the character is at the limit for that token, the same as TTS. It stays on the table when the character is immune.
  3. Over the table or terrain: a new token lies there, or the token from the table moves there.
  4. Over the space around the table: nothing happens.
- Escape cancels the drag.
- An Extract token is a 3D object, and `CrisisToken.jsx` already drags it. On release, it calls the same `findCharacterAt` at the pointer position.

## Real-size tokens

Character tokens have the real size of the TTS tokens on the table. On a tray, every token keeps the slot size of 0.75". These facts were found in the mod (`spawnToken` in the tray script, `tokenDatabase` in the `Database` script):

- A token row has `tSize`: `tSmall = 0.375` or `tLarge = 0.5`. Mystic Portal, Black Bifrost, Masked Menace, Mystic Ward and 43 other tokens are `tLarge`.
- A token with `tShape = "Circle"` spawns as a `Custom_Tile` with scale `tSize`. A tile with scale 1 is 2" wide (see `scripts/README.md`), so a `tSmall` token is 0.75" wide and a `tLarge` token is 1" wide.
- A token with `tShape = "Other"` (conditions, Activated, Dazed) spawns as a `Custom_Token` with scale `tSize / 2`. Its size in inches was not measured. The app uses 0.75" for it too (`TOKEN_SIZE` in `src/tokens/files.js`).
- `migrate-tokens.mjs` writes `size` (inches) into `tokens.json` for a `Circle` token: `tSize × 2`. It leaves `size` out when the token is 0.75". `tokenSize(key)` in `src/tokens/tokens.js` reads it, with 0.75" as the default.
- The size counts on the table: a loose token, a pile, the drag preview, and the ground check under them. A tray (the **On** row and the **Give** sources) keeps 0.75" for every token, because the rows are laid out for it. The footprint of a dragged token stays the radius of a crisis token (0.5").
- The tray spawns the Give tokens below the card, in rows of 6 from the owner's left, 0.85" apart.

Every token image is square, with transparent corners around the circle or the rounded diamond. The app draws a square plane with `alphaTest`, so the plane shows the token's own shape (`TokenFace.jsx`).

## Card popup

`CardPopup.jsx` takes an image URL and an alt text. App keeps `openCard: { src, alt } | null`. Only the crisis card uses it. Escape closes it.

## Tray popup

A click on a tray card opens the whole tray in a full-screen popup (`TrayPopup.jsx`). App keeps `openTrayId`, the id of the character, or null.

- The popup shows the tray from the same live state as the 3D tray: the **On** row of tokens, the stat card at full size, and the controls (`TrayControls.jsx`, the same component as on the 3D tray). A change in the popup shows on the 3D tray too.
- The **Give** sources are not part of the tray, so the popup does not show them.
- A click on a token in the **On** row removes one, the same as on the 3D tray. Its tooltip shows the name and the mod's description.
- The card shows the side that faces up. A button shows the other side, because players often read the Injured side while the card is Healthy. A Flip goes back to the side that faces up.
- The cross button, Escape, or a click outside the tray closes the popup. Other keys do nothing while it is open.
- **Remove** works as on the 3D tray, and the popup stays open, because the character stays.
- Attached cards show as thumbnails at the side of the stat card (see [Attached cards](#attached-cards)). Flip and **Show other side** keep the large card open.

## Tokens from the TTS mod

The mod's `tokenDatabase` (in the `Database` script) has 310 rows. The TTS cache has the images of all of them. The images are PNG. The checked ones are 225 to 375 px.

| Mod type (`tType`) | Rows | Examples | Migrate |
|---|---|---|---|
| Condition, `token/condition/` | 10 + 10 | Bleed, Incinerate, Poison | yes, without the second art (see below) |
| Condition, `token/dice/` | 6 | Hit, Crit, Wild | yes, group `dice`, collected: Cosmic Awareness holds them |
| Status | 35 | Activated, Dazed, Winging It, Bounty, Gadget | yes |
| Personal | 21 | Loaded, Genetic Sample, Devil's Deal, Evolution | yes |
| Only Status | 26 | Disarm, Marked for Death, Crew of the Milano | yes, except 3 rows in `token/misc/` (Master of Metal, Antimatter Core, Suppression): AI mode and Infinity Gauntlet event |
| Misc | 7 | 1/3/5 Power, 1/3/5 Damage, Mystic Ward | only `1 Power`, as the icon of the Power counter; and the tokens of tactic cards (next row) |
| Use Tools, Pile | 14 | Chimichanga, Astral Ring, LMD | only the tokens of tactic cards (next row): these tokens lie on the table, not on a character |
| Tokens of tactic cards | 17 more | Mystic Ward, Mystic Portal, Chimichanga | yes, any type: a released tactic card names them in `tokens` (`docs/features/team-tactic-cards.md`, "Token piles") |
| Affiliation | 36 | Asgard, Wakanda | no |
| Objective types | about 130 | Extract Asset, Secure Zone | no: the crisis feature migrates them |

Notes:

- A row with `altName` is a second art of the same token, for example "Bleed1" with `altName = "Bleed"`. The second art is the old round design. The first art is the new design: for conditions, a rounded diamond. The script migrates only the first art.
- The Damage counter icon is the mod's "1 Damage" token. `migrate-crisis.mjs` already migrated it to `src/assets/crisis/markers/damage.webp`. Use that file.
- The script also stores `cleanup: true` from the mod. It marks the tokens that the Cleanup Phase removes. The **Cleanup** button uses it (`CLEANUP_KEYS` in `src/tokens/tokens.js`).

About 90 tokens are migrated. At about 15 KB each, this is about 1.4 MB.

Output, in the same style as the crisis migration:

| File | Content |
|---|---|
| `src/assets/tokens/<key>.webp` | Token image, WebP, at most 256 × 256 |
| `src/tokens/tokens.json` | `key → { name, group, description, cleanup }` |
| `src/tokens/files.js` | `characterToken(key)` |
| `scripts/token-manifest.json` | Source URLs, so a second run converts only new or changed files |

`group` is one of `condition`, `status` (Activated and Dazed), `character` (images in `token/character/`) and `tactic` (images in `token/tactic/`). The Library shows the groups.

## Character data

| Data | Source | Where |
|---|---|---|
| Stamina, Healthy and Injured | Jarvis `statCard.frontSide.stamina`, `backSide.stamina` | `characters.js`, which loads the trimmed `jarvis-rows.json` (`staminaHealthy`, `staminaInjured`) |
| Tokens the character uses (Give sources) | Mod `cToken` | `characters.json`, written by `migrate-characters.mjs` |
| Immunities, per side and form | Jarvis, the superpower names of the stat card sides | `immunity.js`, used by `characters.js` |

Jarvis has the current official values, so the stats come from Jarvis. Only the mod has the token lists as data. The Jarvis text also marks tokens (`|<winging_it>Winging It|`) and conditions (`|§bleed§Bleed|`), but the mod's `cToken` list maps directly to the token images.

### Immunities

The immunities come from the Jarvis data (`scripts/jarvis/characters.json`), not from the mod. The TTS mod gives only assets: models, card images, token images. The mod `cImmune` was wrong for three cases: Blue Marvel ("Incinerate, Stun" is one name there, so no token matched), Emma Frost (immune only in Diamond form) and Apocalypse (3 for both sides). The other characters had the same immunities in both sources. The text is in the superpower names of a stat card side, for example "Flight, Immunity [Incinerate, Stun]". `immunity.js` reads it.

- Per side. `frontSide` is Healthy, `backSide` is Injured. The tray uses the side that faces up (`characterImmune(slug, side)`). Apocalypse: Bleed, Incinerate, Stun when Healthy, every special condition when Injured.
- Two forms. A character with a second form that has its own card has `secondStatCard`. The app does not know which form is in use (players move the model by hand), so a give is refused only when every form is immune on that side. A refused give that the rules allow is worse than a give that players undo. Emma Frost is immune only as Diamond, so the app never refuses her, and players apply it by hand.
- "Special Conditions" means all ten conditions of `tokens.json` (`SPECIAL_CONDITIONS` in `immunity.js`).
- A name maps to the token key with the same slug ("Incinerate" to `incinerate`). `immunity.test.js` checks that every name in the data maps to a token key. Two French names ("Secoué" is `shock`, "Hémorragie" is `bleed`) are in a small table, checked against the `immuneTo*` tags of the row.
- Phoenix writes "Immune [...]", not "Immunity [...]". The parser takes both. "Psychic Immunity" (Emma Frost, form 2) has no list and is skipped.
- The text wins over the `immuneTo*` tags. Havok has "Immunity [Incinerate]" in the text but no tag. The tags are the union of all sides and forms, so they cannot give the immunity of one side.
- A stat card side can be null (7 grunt rows have no `backSide`). It counts as no immunity.
- `characters.json` has no `immune` field. `tokens` (the Give sources) stays from the mod, because the special tokens of a character (Kill Count, Devil's Deal, ...) exist only there.

## Constructs

Magneto and Phoenix come with 2 constructs each (the mod's `construct` field: two Metal Construct models). In the rules, a construct is a terrain feature, not a character. So the app spawns it as a model of the host, not as a character.

- **Spawn:** the constructs spawn with the host, on the table under the host card: on the owner's side of the tray, past the Give sources. They stand in a row from the owner's left, each 0.3" from the next. A spare model (see [Second forms](#second-forms)) comes first, in the middle of the tray width, and the row lies past it. A Library spawn and a roster spawn do the same.
- **Look:** the 3D model from `construct-<n>.glb` (`characterConstruct` in `files.js`), small base, the team color of the host.
- **No tray, no card, no stats.** A construct has no Damage, Power or tokens. Hover shows no card, and F does nothing on it. The spectator badge is not shown on it.
- **Moves like a model:** a player selects, moves and turns it, and the tools measure against it. It moves with the tray when the row shifts, as long as it stands on the tray area (`inTrayArea`).
- **Not the host on the mat.** `characterOnBoard` ignores constructs, so a construct on the mat does not make the host count as on the mat in the Power Phase and the Cleanup Phase. The players count Magneto's constructs themselves (see [Players apply the rules](#players-apply-the-rules)).
- **No tokens.** A token dropped on a construct is a drop on whatever is under it, the table or the mat. It does not go to the host (`characterAt` in `components/useModelRegistry.js` skips construct models).
- **Remove:** the tray's Remove button puts the constructs back to their places with the other models. A construct that is destroyed is put back by Remove, or the player drags it off the mat.
- **Delete** of the host removes its constructs, with their stored poses.
- **No "Spawn Construct" button.** Magneto has at most 2 constructs at a time.
- Ids: construct n of a character has the model id `<character id>:c<n>`, after the first model and the second model (`models.js`). Poses, claims and P2P sync work on model ids, so they treat it like the second model.
- Data: `characters.json` has `constructs`, the number of construct GLBs. It is missing or 0 for a character without constructs. The character entry in App state copies it.

## Grunts

A grunt is a minion that comes with a host: Hand Ninjas (Elektra, Shadowland Daredevil), Sand Constructs - Twisty and Sand Construct - Fisty (Sandman), and others. The mod has 7 hosts with grunts: Elektra, Multiple Man, Nick Fury, Red Skull Master of Hydra, Sandman, Shadowland Daredevil and Ultron Metal Tyrant. A grunt is its own `Database` row with a card, a model, `cStamH`, tokens and immunities. A host is spawnable once its grunts are migrated (`grunts` in `characters.json`, see `scripts/README.md`).

- **Spawn:** when a host spawns, one character per grunt spawns with it, in the same state update: from the Library, from the roster popup and with a squad reveal. The grunt is a normal entry of `characters` with `host: <host id>` (`newCharacters` in `newCharacter.js`). So Damage, tokens, the model, P2P sync and the room preload work as for any character. The host stays first in the list.
- **Not in the Library list.** Jarvis gives a grunt no MCT code, so a grunt is not a row of the Library or of a roster. `characters.js` keeps the grunt rows of a host in `grunts`, and finds the stats in the Jarvis row of the same name.
- **Card size:** a grunt card image is portrait, 808 × 1404 px, not 3:2 like a character card. It is drawn 2.75" wide and 4.78" high (`GRUNT_CARD_WIDTH` and `GRUNT_CARD_HEIGHT` in `trays.js`), the width of a crisis card, whose image (800 × 1400) is the same shape. TTS spawns it as a custom card with scale 1.5 (`setupGruntOne` in the Red Tray Spawner). The crisis card scale is not recorded in the repo, so the equal size is a choice by image shape, not a measured TTS value.
- **Card on the host tray:** the grunt card lies on the tray of its host, below the host card(s) and the controls strip. It has its own "On" row above it (as wide as the card) and its own controls strip below it. The tray grows toward the owner by the depth of a grunt unit: On row, card and controls strip, 7.2", and a gap. The grunt has no tray of its own and no place in the row: it has the position of its host (`layoutTrays`).
- **Sandman:** his 2 grunt cards lie side by side, 2.85" apart (card width and a gap), the first under the host card. His plate is 7.3" wide, wider toward the owner's right, and the host card, the "On" row and the Give sources keep their places. The trays after it move on, and the row stays centered (`layoutTrays`).
- **Popups:** the tray popup sizes a grunt card by its own aspect and by the viewport height, so the card and the controls stay on the screen. The roster popup shows a grunt variant at the height of a character card, centered in its slide. The card popup of an Alt peek shows the image at its own shape, within the viewport.
- **Model:** the grunt model spawns on its card, and moves with the tray like any model on the tray area.
- **Controls:** Damage (limit: the grunt Stamina) and Remove. No Power, no Flip and no "Show other side" in the popup. The card has only the Healthy side. F over a grunt does nothing.
- **Tokens:** a grunt has its own tokens and can get a token by a drag onto its card or model. The Give sources of the host tray are shared: they hold the tokens of the host and of its grunts. A click on a source gives a token to the host, a drag onto the grunt card gives it to the grunt.
- **Held tokens** lie on the grunt card, kept inside its edges (`trayGruntHeldClamp`). The tray popup shows them on the grunt card image.
- **Delete:** the Delete key on the host card removes the host with its grunts and its constructs, after the same confirm (it says so). Tokens that they hold drop first. The Delete key on a grunt card removes nothing and says so. A restart of the setup removes the host and its grunts together.
- **Rules:** a grunt cannot have Power (p21). The Power Phase skips it. In the Cleanup Phase a Dazed grunt has no Injured side to flip to, so it keeps its Damage and side and only loses Dazed and the special conditions (`cleanupCharacter`). The spectator view shows Damage only for a grunt.
- **Roster popup:** the grunt cards of a host are in `variants` (see `docs/features/roster.md`).
- **Space:** a host with one grunt row: the plate ends 36.1" from the table center, and one row of Give sources ends 37.1" (a second row, 38.0"). The table edge is at 38", so a second row of Give sources is at the table edge. The tool rack is in front of the dice tray and does not meet the grunt block.

## State

New fields on each entry of `characters` in `App.jsx`:

```js
{
  // existing: id, key, figure, base, rotation, team, slot
  side: 'healthy',   // card side that faces up: 'healthy' | 'injured'
  damage: 0,         // 0 .. Stamina of `side`
  power: 0,          // 0 .. 10
  tokens: {},        // token key (tokens.json) -> count. Conditions, Activated and Dazed: 1 at most.
}
```

Character tokens on the table are a separate list in `App.jsx`: `looseTokens: [{ id, key, x, z }]`.

A held crisis token stays in the `tokens` list of `App.jsx` and gets two new fields: `heldBy: characterId | null` and `heldAt: [x, z] | null`, its place on the holder's card in tray-local coordinates. So each token is in one place only, and a change of crisis card still removes the held tokens of the old card.

All fields are plain JSON. So they fit into the `characters` and `tokens` maps of the Yjs document in `docs/features/peer-to-peer.md`. `looseTokens` needs its own map there.

### Tokens on top of tokens

A token on the table lies on the highest token under its center (`src/tokens/stack.js`). No physics. Both browsers get the same stack, because it comes from the synced places and the order of `looseTokens`.

- It lies on a crisis token (its top, with the control and damage markers), or on a loose token that comes earlier in `looseTokens`. The center must be inside the circle of the token below (a crisis token 1", a loose token its own size). Else it lies on the table or the terrain. Never lower than the table or the terrain.
- A token that is dropped or moved goes to the end of `looseTokens`, so it lies on top.
- A token that is picked up (dragged by any player) holds nothing. The token on top goes down at the next frame.
- A pile does not stack, nothing lies on a pile, and a crisis token never lies on a loose token.
- The drag preview shows the height where the token would land. The other player's drag preview too.
- The rule needs no physics. A fixed collider per token would also stop models and dice, and a token would hit its own collider. The rule gives the same result in both browsers, because the order of `looseTokens` is in the document.
- A token that is moved goes to the end of `looseTokens` (the app removes it and appends it, so it gets a new `order` above the highest). The other browser gets the same order.
- A crisis token that is lifted (dragged by any player) or held on a tray card holds nothing.
- The drag preview of a character token stacks. The preview of a supply token and of a pile does not.
- Each token writes its place and top to a small registry every frame (`tokenStack`), no React state. A stack of three or more settles in a few frames, one level per frame at worst.

## Hold and drop

Only tokens of an Extract card that players can move can be held: Asset, Civilian and the supply tokens of Source cards. `buildMatTokens` and `supplyToken` set a new `canHold` flag.

- **Hold:** a player drags the token and releases it over a tray card (see [Give tokens by drag and drop](#give-tokens-by-drag-and-drop)). That character now holds the token. As in TTS, only the card holds: a release on a model on the table leaves the token on the table at the release point. A character has no limit of held tokens. The token leaves the mat and lies on the tray card as a 3D token, as in TTS. Its default place is the character art, in the left column of the card (`trays.js`, `trayHeldDefault`). A second token goes a little higher on the art and lies on top of the first. The app does not check the range: players apply the rules.
- **Move on the card:** a player drags the held token and releases it on the same tray. The token stays held and lies at the release point, moved so that the whole token is on the card.
- **Drop:** a player drags the held token from the card and releases it on the table. It is no longer held. The opponent then moves it to a place within Range 2. This drag has no wait and no notice: the players do it by hand.
- **Dazed:** a new Dazed token on a character that holds tokens makes it drop them (p10). The tokens go on the table next to the base of the model, in a row, and wait for their place (see "Wait for the place").
- **Remove from the board:** the tray **Remove** button with held tokens drops them the same way, and waits (see "Wait for the place"). Without held tokens, the models go back on the card at once.
- **Delete a character:** the character drops all its tokens first, next to the base. They do not wait.
- **Take from the supply:** a player drags a new token from the supply pile of a Source card. The pile never runs out (see `docs/features/crisis.md`, "Extract: Source"). Released over a character, the token goes to the default place on the card. Released on the table, it lies there.
- **Delete:** the Delete key (or Backspace) removes the held token under the pointer, as in TTS. Players use it for the supply tokens in the Cleanup Phase.
- A held token is not in the list of models that the range and movement tools snap to.
- The tray popup shows the held tokens on the card image, at the same place as on the 3D card. They cannot be moved there.

### Wait for the place

A token dropped by Dazed or **Remove** waits for its place (`src/tokens/dropWait.js`). The token has `placeBy` (a side) and `placeFrom` (`{ characterId, x, z, radius, offBoard }`: the base it dropped from) while it waits.

- **Who places:** the opponent of the character. The controlling player when the superpower text of the side that faces up says "instead of their opponent" (S.H.I.E.L.D. Agents, The Black Widow; `src/characters/dropPlacer.js`, read from Jarvis the same way as the immunities). In a multiplayer room only the browser of that side can drag the token. In the Sandbox and a single player room, one browser plays both sides and can place any waiting token.
- **Place it:** a drag and a release put it on the table at the release point. The release never holds it, also over a model. **Done** in the notice places it where it lies. The token then has no wait and drags freely.
- **Notice:** a HUD notice (`HudNotice.jsx`), one line for each character while its tokens wait. The player that places sees "Place Hulk's Asset within Range 2" with **Show** and **Done**, and hears the `notice` sound once for each drop. The other player sees "Waiting for Nelly to place Hulk's Asset" with **Show**. **Show** moves the camera target to the first waiting token, smooth (`panToPoint` in `src/camera.js`), and keeps the angle and the distance.
- **Remove waits:** with held tokens, **Remove** drops them and leaves the models on the board (`placeFrom.offBoard`). When the last waiting token of the character is placed, the models go back on their cards, the same as **Remove** without tokens. Only the browser that places the last token does it. While a token waits, **Remove** is disabled with the title "Waiting for Nelly to place Hulk's Asset".
- **Range 2 tool:** when a token starts to wait for a side this browser plays, the own Range 2 tool snaps to the model, once for each drop (the same as the key 2 over a model; the model is selected). A browser writes only its own tools, so in the Sandbox and a single player room it is the own tool also when the guest places. Tokens that wait when the table opens snap nothing.
- **Drag limit:** a waiting token cannot be dragged farther than base radius + Range 2 + token radius from the centre of the base it dropped from (`placeFrom`), so some part of the token stays within Range 2 of the base edge. Range 2 is the reach of the snapped tool, 3.002" (twice `RANGE_TIP[2]`, `clampToRange` in `dropWait.js`). Once placed, the token drags freely.
- **Log:** "Hulk dropped Asset. Nelly places it." and "Nelly placed Hulk's Asset." (`game-log.md`).
- A crisis card that changes removes its tokens, also a waiting one. The models of a Remove then stay on the board, and the player moves them by hand.

## Out of scope

- A 2D HUD separate from the 3D world. This is the next step after this feature.
- Horsemen cards and Reserve members attached to a character. Infinity Gems are built (see [Attached cards](#attached-cards)). Facts: in TTS, a gem or Horsemen card attaches to the tray only if the character can have it (`cGem`, `cHorsemen` in the mod; `bearableGems`, `assignableToHorsemen` in Jarvis). The TTS cache has all 5 Horsemen faces, but only the Soul gem card.
- Rule automation beyond the Power Phase and Cleanup Phase buttons (see `docs/features/round-phases.md`) and the drop of objective tokens: VP scoring, character effects of the Cleanup Phase.
- A "Spawn Construct" button for more constructs than the host has, and the constructs of Ultimate Encounters (see [Constructs](#constructs)).
- The Wounds counter of a grunt in TTS. The Damage counter does its job.
- The second card version of a character without a second form (`cards` > 1 and no `transform` in `characters.json`, for example Mephisto). The tray uses card 1.
- Other immunities of a second form (p21), and the mod's `twoModels` and `sideways` flags (Ms. Marvel).
- Tokens that lie on the table and not on a character (Use Tools, Pile).
- Affiliation tokens on characters. The VP markers of the scoring board show them (see `docs/features/crisis.md`, "Scoring board").
- The Power and Damage tokens of TTS. The counters use `−` and `+`.

## Decisions

1. The table grows to 72" × 60" for the tray rows.
2. Damage and Power use `−` and `+` buttons.
3. Players give character tokens by dragging them onto a model or a tray. Extract tokens are held only on a tray card.
4. Immunity blocks a condition.
5. Attached cards: the Infinity Gems are built. Horsemen cards and Reserve members wait.
6. Tokens use the new art of the mod (rounded diamond for conditions), not the old round art.
7. A player has one tray row only. A tray with 2 grunt cards (Sandman) is wider.
8. Character tokens are real size. A Give source never runs out, and a token can lie anywhere on the table.
9. The Delete key removes a token on the table, as in TTS. A Tokens panel drag can also place a token on the table.
10. A Source card has one supply pile that never runs out, below the card text. The Delete key also removes a crisis token that a character holds.
11. A character with a second form spawns both models, as in TTS.
12. A second card lies under the first card. Flip turns both. Each model spawns on its own card.
13. The second model of a `oneCard` character spawns past the Give sources.
14. The table grows from 66" to 68" deep. Sandman's 2 grunt cards sit side by side, so only his tray is wider.
15. A grunt is its own character with a link to its host, not a part of the host: it has its own Damage and tokens, and a tray part on the host tray.
