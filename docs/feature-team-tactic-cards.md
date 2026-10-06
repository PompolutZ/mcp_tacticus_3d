# Feature: Team Tactic cards

Status: in progress. Players take Team Tactic cards (TTC) from the Library (see `docs/feature-library.md`). A card goes into the player's tactic tray. Players can move, flip, open and delete it.

## Goal

Each player picks 5 Team Tactic cards for a game. These are the only cards the player can use in that game. The app shows the 5 cards of each player on the table, the same as the TTS mod: on a tactic tray between the mat and the character trays.

## Players apply the rules

The app does not check the card rules. It does not check the affiliation of a card, its cost, when a player can play it, or how many cards a player has. Players do this themselves, the same as for the crisis cards (see `docs/feature-crisis.md`, "Players apply the rules").

So the app does not stop a 6th card. The 6th card lies on the table next to the tray (see [Tactic tray](#tactic-tray)).

## How TTS does it

These facts were found on 2026-10-06 in the save of mod 3036795456.

- Each player has a "Blue Tactic Tray" or "Red Tactic Tray" object (`Custom_Assetbundle`). They are at TTS z = ±21.15, centered on x = 0, with scale 1.15 × 1. The mat edge is at 18, so the tray lies right next to the mat.
- The character trays are further out, at z = ±28.25 (`arrangeTrays` in the Tray Spawner, see `docs/characters-hud.md`, "How TTS does it").
- A tactic tray has 5 snap points in one row, about 3.09 apart in local x. With the scale of 1.15, that is 3.55" between slot centers on the table.
- A card is a `CardCustom` with scale 1.18 and its own face and back image. `HideWhenFaceDown` is false, so the back (card name on art) does not hide anything. Both sides are public.
- The "Tactic Cards" bag has every released card. Players take their cards from the bag and put them on the tray.

## Cards

- 69 of the 389 released cards are migrated (see `scripts/README.md`, "TTS tactic cards"). The app knows only their key, MCT code (`id`) and name (`src/tactics/cards.json`).
- A real card has the size of a poker card: 2.5" × 3.5". The app uses this size for every card. The face images are about 720 × 1040 px, so the image is 3% shorter on the table than in the file. The card size in TTS was not measured.
- The **face** has the rules text on pale art. The **back** has the card name on full-colour art.
- A new card lies face up, with the rules text showing.

## Tactic tray

Each player always has one tactic tray, also with no cards. See `src/tactics/layout.js`.

- The tray has 5 slots in one row, 3.55" apart (the TTS distance). Each slot is a card-sized area, a little lighter than the plate.
- The plate is 0.3" larger than the slots on every side: 4 × 3.55 + 2.5 + 0.6 = 17.3" wide, 3.5 + 0.6 = 4.1" deep.
- It lies 0.3" from the mat edge, centered on x = 0. Blue at +z, red at −z. So its plate covers z = 18.3 to 22.4 on the blue side.
- The slots are numbered from the owner's left, the same as the character trays (`docs/characters-hud.md`, "One tray").
- A card faces its owner: for blue, the top of the image points to −z. A red card is turned 180°.
- The tray has no collider, the same as a character tray.

The character trays move out to make room: their row now starts 0.3" past the tactic tray plate. See `docs/characters-hud.md`, "Place on the table". The table is 66" deep now.

### Free slot

A slot is free when no card center lies inside the slot area.

- **Add from the Library:** the card goes into the first free slot of the chosen player, from the owner's left. When all 5 slots are full, the row goes on past the right end of the plate, at the same distance. So a 6th card lies on the table next to the tray.
- **Drop on a tray:** a card released over the plate of a tactic tray goes into the nearest free slot of that tray. This is the same as a TTS snap point. When that tray has no free slot, the card lies where it was released. A card dropped on the other player's tray turns to face that player.

## Card on the table

| Action | Input | Result |
|---|---|---|
| Move | Left drag on the card | The card follows the pointer, a little above the table. On release it lies there, or in a slot (see [Free slot](#free-slot)). Released outside the table, it goes back. |
| Open | Left click on the card | The side that faces up opens in the full-screen popup (`CardPopup.jsx`), the same as a crisis card |
| Flip | F with the pointer over the card | The card turns to the other side |
| Delete | Delete or Backspace with the pointer over the card | The card is removed |

- A card has no physics body. It lies on the table or on the terrain under it, the same as a character token on the table (`LooseToken.jsx`).
- Cards can overlap. The card that was added or moved last lies on top.
- A card is not a piece for the range and movement tools. A tool key over a card works the same as over the empty table.
- A card does not turn with Q / E. It always faces its owner.

## State

`App.jsx` has a new list:

```js
tacticCards: [{
  id,           // crypto.randomUUID()
  key,          // key in src/tactics/cards.json
  team,         // 'blue' | 'red': the player the card faces
  x, z,         // table position of the card center
  up,           // 'face' | 'back'
}]
```

The order of the list is the stack order: the last card lies on top. A move puts the card at the end.

All fields are plain JSON. So they fit into the `tactics` map of the Yjs document in `docs/feature-peer-to-peer.md`.

## Out of scope

- Card text, affiliation and legality (Rotated, Restricted, Banned). The mod's data has errors (see `scripts/README.md`), and Jarvis was not checked yet. Then the Library could filter cards by the player's affiliation.
- The other 320 card images. TTS must download them first.
- Hidden cards. In TTS, both sides of a card are public.
- Cards attached to a character: Reserve members, Infinity Gems, Horsemen cards (see `docs/characters-hud.md`, "Out of scope").
- A list of the 5 cards per player (the `rosters` map in `docs/feature-peer-to-peer.md`). The cards on the tray are the list.

## Decisions

Made on 2026-10-06:

1. Each player has a tactic tray with 5 slots between the mat and the character trays, as in TTS. The table grows from 60" to 66" deep for it.
2. A new card lies face up, with the rules text showing.
3. Cards are poker size, 2.5" × 3.5".
4. The app does not stop a 6th card. It lies next to the tray.
