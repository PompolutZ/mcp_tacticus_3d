# Feature: Team Tactic cards

Status: partly built.

Players take Team Tactic cards (TTC) from the Library (see `docs/features/library.md`). The Library lists the Infinity Gems after the tactic cards, but a gem cannot be added from it (see [Cards](#cards)). A card goes into the player's tactic tray. Players can move, flip, open and delete it. The Team Tactic cards of a squad go on the tray from the game setup (`docs/features/setup-game.md`).

Not built yet:

- Card images for most released cards (see [Out of scope](#out-of-scope)).

## Goal

Each player picks 5 Team Tactic cards for a game. These are the only cards the player can use in that game. The app shows the 5 cards of each player on the table, the same as the TTS mod: on a tactic tray between the mat and the character trays.

## Players apply the rules

The app does not check the card rules. It does not check the affiliation of a card, its cost, when a player can play it, or how many cards a player has. Players do this themselves, the same as for the crisis cards (see `docs/features/crisis.md`, "Players apply the rules").

So the app does not stop a 6th card. The 6th card lies on the table next to the tray (see [Tactic tray](#tactic-tray)).

## How TTS does it

These facts come from the save of mod 3036795456.

- Each player has a "Blue Tactic Tray" or "Red Tactic Tray" object (`Custom_Assetbundle`). They are at TTS z = ±21.15, centered on x = 0, with scale 1.15 × 1. The mat edge is at 18, so the tray lies right next to the mat.
- The character trays are further out, at z = ±28.25 (`arrangeTrays` in the Tray Spawner, see `docs/features/character-trays.md`, "How TTS does it").
- A tactic tray has 5 snap points in one row, about 3.09 apart in local x. With the scale of 1.15, that is 3.55" between slot centers on the table.
- A card is a `CardCustom` with scale 1.18 and its own face and back image. `HideWhenFaceDown` is false, so the back (card name on art) does not hide anything. Both sides are public.
- The "Tactic Cards" bag has every released card. Players take their cards from the bag and put them on the tray.

## Cards

- 73 released cards are migrated, plus the Soul and Mind Infinity Gem cards (see `scripts/README.md`, "TTS tactic cards"). The app knows only their key, MCT code (`id`) and name (`src/tactics/cards.json`).
- The Library lists the 7 Infinity Gem cards (`TACTICS` in `src/tactics/cards.js`, `gem: true`) after the Team Tactic cards, with an "Infinity Gem" label. A gem is not played from a tray. It attaches to a character, and only the roster does that today (`docs/features/character-trays.md`, "Attached cards"). A click on a gem in the Library shows a HUD message and adds nothing.
- A real card has the size of a poker card: 2.5" × 3.5". The app uses this size for every card. The face images are about 720 × 1040 px, so the image is 3% shorter on the table than in the file. The card size in TTS was not measured.
- The **face** has the rules text on pale art. The **back** has the card name on full-colour art. The app draws the face of every Team Tactic card and every Infinity Gem itself (see [Generated face](#generated-face)).
- A new card lies face up, with the rules text showing.

## Generated face

The face of a Team Tactic card is drawn by the app from the Jarvis data, not loaded as an image. The look follows the Jarvis Protocol card: the back art at opacity 0.2, a title bar, the attack panel, the affiliation and type, the text, the superpower panels and the footer.

- **One React component, `TacticFace`.** HTML places render it (the card popup, the Alt peek, the roster popup). 3D places (a card on the table, a roster card) draw the same component into a canvas and use it as a texture, so the table and the popup look the same. The method is in `src/components/tacticFaceTexture.js`.
- **Data:** `src/tactics/jarvis-tactics-text.json`, by card key, made by `fetch-jarvis-tactics.mjs`. It is loaded with a dynamic `import()` on the first need, so it is its own chunk.
- **Shape:** 457 × 640 CSS px (2.5 × 3.5). The texture is 728 × 1019 px.
- **Fonts:** Barlow Condensed and Noto Sans (width axis), both open licence. Jarvis uses paid fonts, so the letters differ a little. The texture embeds the latin subsets, which hold all characters of the card text.
- **Text fit:** the text starts at 19.5 px and shrinks in 0.5 px steps until all blocks fit. The result is kept per card key, so the DOM face and the texture use the same size. In the dev server, the console lists the cards that need less than 15 px.
- **Icons:** the Jarvis PNGs as lossless WebP in `src/assets/tactic-icons/`, named by meaning. An unknown icon id (`!Ulik`) is drawn as plain text. A later change can replace a file with an SVG without a change in the component.
- **Texture life:** a texture is drawn when a card first needs it, and its canvas is kept by key (about 3 MB each, never freed). Until it is ready, the face shows the art at opacity 0.2 on the card color, without text. The texture of a card is freed with the card.
- **Gems:** the Infinity Gem cards are drawn the same way, from their Jarvis entry. A card with a `threatLevel` shows a threat pill (round badge and the number) in place of the affiliation, type and body, and its text sits at the lower end. The tray popup draws attached gems with the component.
- **Dev page:** in the dev server, `#tactic-faces` shows all faces in a grid with the font size under each, and a filter for font < 15 px. It is not in the production build.

## Tactic tray

Each player always has one tactic tray, also with no cards. See `src/tactics/layout.js`.

- The tray has 5 slots in one row, 3.55" apart (the TTS distance). Each slot is a card-sized area, a little lighter than the plate.
- The plate is 0.3" larger than the slots on every side: 4 × 3.55 + 2.5 + 0.6 = 17.3" wide, 3.5 + 0.6 = 4.1" deep.
- It lies 0.3" from the mat edge, centered on x = 0. Host at +z, guest at −z. So its plate covers z = 18.3 to 22.4 on the host side.
- The slots are numbered from the owner's left, the same as the character trays (`docs/features/character-trays.md`, "One tray").
- A card faces its owner: for the host, the top of the image points to −z. A guest card is turned 180°.
- The tray has no collider, the same as a character tray.

The character trays move out to make room: their row starts 0.3" past the tactic tray plate. See `docs/features/character-trays.md`, "Place on the table".

### Free slot

A slot is free when no card center lies inside the slot area.

- **Add from the Library:** the card goes into the first free slot of the chosen player, from the owner's left. When all 5 slots are full, the row goes on past the right end of the plate, at the same distance. So a 6th card lies on the table next to the tray.
- **Drop on a tray:** a card released over the plate of a tactic tray goes into the nearest free slot of that tray. This is the same as a TTS snap point. When that tray has no free slot, the card lies where it was released. A card dropped on the other player's tray turns to face that player.

## Token piles

Some cards bring tokens, for example Mystic Ward (a Mystic Ward token) and Pentagram of Farallah (a Mystic Portal token). `tokens` in `cards.json` lists the token keys of a card. TTS spawns the tokens in front of the card, on the mat. The app puts a pile of each token instead, so players take tokens from it the same as from a Library pile (`docs/features/library.md`, "Pile"). A pile never runs out, so a card that places two tokens needs no count.

How TTS does it (from the `Database` script and the script of each tactic card):

- A tactic card row has `tokens`: a list of token names, for example Mystic Ward → "Mystic Ward", Pentagram of Farallah → "Mystic Portal", Founding Members → six conditions. 82 rows have it.
- When the card lands on a tactic tray, its script spawns the tokens (`spawnTokens`): one token per name, 2.85" in front of the card toward the mat, at x − 1.5, − 0.5, + 0.5 and + 1.5 from the card center. A token of type "Pile" becomes a pile. When the card is picked up, its script deletes its tokens.

Data:

- **Always a pile.** The app puts one pile per token name of the card, also where TTS spawns a single token.
- **The link is asset data from TTS.** Which tokens belong to a card is in the mod row only. Jarvis has no token images or names. So `migrate-tactics.mjs` writes `tokens` (token keys) into `src/tactics/cards.json`. Only keys that exist in `src/tokens/tokens.json` are written. This is the same exception as the Give tokens of a character.
- **Token images.** `migrate-tokens.mjs` migrates every token that a released tactic card names, of any type (Misc, Use Tools, Pile, ...), when its image is in the TTS cache. The group (`tactic` or `condition`) comes from the image folder. A name with no image in the cache is left out with a warning. See `docs/features/character-trays.md`, "Tokens from the TTS mod".

- **Place:** the TTS place (2.85" toward the mat) would be on the mat, at the edge where players deploy, because the tactic tray lies 0.3" from the mat edge. So the piles lie on the table past the owner's left end of the plate (`tacticPilePlace` in `layout.js`), 0.3" from it, in a row going outward, 1.2" apart, at the z of the slot row. The 6th and later cards go past the right end, so this side is free. The piles of all cards of a player share the row, in the order of the cards. A 7th pile goes in a second row, behind the first (away from the mat), still beside the plate.
- **A new pile** takes the first place that no pile lies on (`freePilePlaces`). So a card added from the Library after the squad gets the next free place.
- **When:** when a card goes on the table: when the squad is revealed, and when a player adds a card from the Library. In the same change of the document as the cards. A card that is dragged brings no piles.
- **Removal:** a pile made this way has `card`, the id of its card. When the card is deleted (Delete key) or removed by the restart of the setup, its piles go in the same change. A pile without `card` stays. A player can still move a pile with Shift + drag. A saved document without `card` in its piles stays valid.

## Card on the table

| Action | Input | Result |
|---|---|---|
| Move | Left drag on the card | The card follows the pointer, a little above the table. On release it lies there, or in a slot (see [Free slot](#free-slot)). Released outside the table, it goes back. |
| Open | Left click on the card | The side that faces up opens in the full-screen popup (`CardPopup.jsx`), the same as a crisis card |
| Flip | F with the pointer over the card | The card turns over around its long side in 0.4 s. It goes up while it turns, so its edges stay above the table. |
| Delete | Delete or Backspace with the pointer over the card | The card is removed |

- A card has no physics body. It lies on the table or on the terrain under it, the same as a character token on the table (`LooseToken.jsx`).
- Cards can overlap. The card that was added or moved last lies on top.
- A card is not a piece for the range and movement tools. A tool key over a card works the same as over the empty table.
- A card does not turn with Q / E. It always faces its owner.

## State

`App.jsx` has this list:

```js
tacticCards: [{
  id,           // crypto.randomUUID()
  key,          // key in src/tactics/cards.json
  team,         // 'host' | 'guest': the player the card faces
  x, z,         // table position of the card center
  up,           // 'face' | 'back'
}]
```

The order of the list is the stack order: the last card lies on top. A move puts the card at the end.

All fields are plain JSON. So they fit into the `tactics` map of the Yjs document in `docs/features/peer-to-peer.md`.

## Out of scope

- Card text, affiliation and legality (Rotated, Restricted, Banned). The mod's data has errors (see `scripts/README.md`), and Jarvis was not checked yet. Then the Library could filter cards by the player's affiliation.
- The other 320 card images. TTS must download them first.
- Hidden cards. In TTS, both sides of a card are public.
- Cards attached to a character: Reserve members, Infinity Gems, Horsemen cards (see `docs/features/character-trays.md`, "Out of scope").
- A list of the 5 cards per player (the `rosters` map in `docs/features/peer-to-peer.md`). The cards on the tray are the list.

## Decisions

1. Each player has a tactic tray with 5 slots between the mat and the character trays, as in TTS. The table grows from 60" to 66" deep for it.
2. A new card lies face up, with the rules text showing.
3. Cards are poker size, 2.5" × 3.5".
4. The app does not stop a 6th card. It lies next to the tray.
