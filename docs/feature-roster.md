# Feature: Load roster

Status: done, 2026-10-07. Not checked in a browser.

## Goal

A player loads their roster with an MCT code. The app puts the roster cards on that player's side of the table. Both players see both rosters until they choose their squads. Later, spectators see them too (see `docs/feature-peer-to-peer.md`).

Choosing the squad from the roster is the next feature: `docs/feature-setup-game.md`.

## Terms

| Term | Meaning |
|---|---|
| Roster | The cards a player brings to an event: 10 characters, 10 Team Tactic cards, 5 Secure and 5 Extract crisis cards. These counts come from the Jarvis roster checker. |
| Squad | The characters and Team Tactic cards a player chooses from the roster for one game |
| MCT code | The 8-digit id of a card, for example `01520101` for Angela. Jarvis (`exportCode`), the TTS mod (`ID`), Cerebro and Longshanks use the same id. A roster code is a list of MCT codes. |

## Players apply the rules

The app does not check a roster. It does not check the counts, duplicates, Banned, Restricted or Rotated cards, or which character can hold an Infinity Gem. It loads every code that it knows. Players check the roster themselves, the same as for the cards in the other features (see `docs/feature-crisis.md`, "Players apply the rules").

So a draft roster with fewer codes loads in the same way.

## How TTS does it

These facts were found on 2026-10-07 in mod 3036795456, in the scripts of the "Blue Roster Maker" and "Blue Roster Tray" objects. The red objects have the same scripts.

- Each player has a Roster Maker (a bag) and a Roster Tray. They lie next to the table, left of the scoring board, at TTS x ≈ −41 and z ≈ ±14.6.
- The Roster Maker has an input field: "Paste MCT codes OR Drop cards inside". When the text has more than one line, the first line is the roster name. **Create Roster** makes a roster object. Its script lists the codes.
- The script finds every known code in the text with a substring search. So the separators between the codes do not matter.
- The player puts the roster object on the Roster Tray and clicks **Show Roster**. The tray lays out the cards next to itself: 2 rows of 5 character cards, then 1 row of 10 crisis cards (5 Secure, then 5 Extract), then 1 row of 10 Team Tactic cards. The rows are 4.75" apart. The character cards are 3.5" apart, the other cards 2.5" apart.
- The cards are locked, so players cannot move them. Each character card has a **SELECT** button for the squad (see `docs/feature-setup-game.md`).
- A character with an Infinity Gem has the code `<character>-<gem>`, or `<character>-<gem>-<gem>` with two gems. The gem card lies on the character card, a little to the side.
- Unreleased, Restricted and Banned cards get a mark on the card (a decal).
- The tray shows at most 10 characters, 5 Secure, 5 Extract and 10 Team Tactic cards. The mod also has Battle Realm and Collector Pack rosters, with other limits.
- When a player creates a roster, the mod sends the player name and the card names to a Google Sheet and to an AWS log. The app does not do this.

## MCT code

On a Jarvis roster page, the **Copy MCT code** button gives the code. Jarvis builds it like this (`getCode` in the Jarvis JS bundle):

- Entries are separated by commas. The order is: characters, Team Tactic cards, Secure cards, Extract cards.
- A character with Infinity Gems: the character code, then `-` and the code of each gem. Example: `01910101-01910104` is Adam Warlock with Infinity Gem: Bonded Soul.
- The second Sentinel MK4 of a roster has the code `00510102` (see `docs/feature-library.md`, "Characters").

Jarvis says that this code works with TTS, Longshanks and other roster tools.

### Parse rules

1. Find every group of the form `12345678` or `12345678-12345678-…` in the text. The app ignores everything else: commas, spaces, line breaks, `|`, a roster name. So a code with a name line (TTS) or with other separators also works.
2. Find the first code of a group in the Jarvis data: a character, a Team Tactic card or a crisis card (Secure or Extract).
3. The codes after `-` are the Infinity Gems of that character.
4. The app puts the cards into the 4 groups. Inside a group, it keeps the order of the text.
5. A code that the app does not know goes into a warning. The other cards load.
6. A text with no known code is an error. The old roster stays.

A new character that Jarvis adds after the last `npm run fetch-jarvis-characters` is an unknown code. The same is true for Team Tactic cards and crisis cards.

### Data

The app needs a name for every code, also for cards without files in the app.

| Kind | Source | Rows on 2026-10-07 |
|---|---|---|
| Characters | `src/characters/jarvis-characters.json` (exists) | 248 |
| Crisis cards | `src/crisis/jarvis-crisis-cards.json` (exists) | 72, 45 different codes. Each code has one current printing |
| Team Tactic cards and Infinity Gems | New: `src/tactics/jarvis-tactics-cards.json` from `GET /api/team_tactics_cards` | 519, 512 with a code, 401 different codes, 14 gems |

The Team Tactic file is new. A new script `scripts/fetch-jarvis-tactics.mjs` downloads it, the same as the other Jarvis scripts. The full response is 1 MB. The script keeps only the fields that the app uses: `exportCode`, `slug`, `name`, `isInfinityGem`, `affiliation`, `tags`, the legality fields. Some cards appear twice with the same code (for example "Infinity Gem: Mind"). The app uses the first row of each code. Three ids in `src/tactics/cards.json` have 7 digits, and `src/rosters/cards.js` pads them to 8.

Setup game also needs this file: 11 Team Tactic cards give a Leadership ability (see `docs/feature-setup-game.md`).

## Input

```
Toolbar: … | Crisis … | Roster [Blue: MCT code] [x] [Red: MCT code] [x] | Deploy … |
```

- The toolbar gets a **Roster** group with one text field per player. The placeholder is "MCT code".
- In a room, the Blue roster comes from the new room dialog, and only the Red field shows (added on 2026-10-07, see `docs/feature-rooms.md`).
- Enter loads the roster.
- A new load replaces the old roster of that player.
- **×** next to the field removes the roster of that player, and its cards leave the table.
- Errors and warnings show in the HUD message at the bottom of the screen (`hud-message`), the same as the other messages. Examples: "No known MCT code in the text", "3 unknown codes: …".

## VP picker

The **VP** group of the toolbar goes away with this feature. Setup game will choose the token of each VP marker from the squad (see `docs/feature-setup-game.md`).

Until then, both VP markers show the Unaffiliated token (`DEFAULT_AFFILIATION`). The Control markers on the Secure tokens use the same affiliation (see `docs/feature-crisis.md`, "Data"), so they show it too. The ring in the player color still shows which player controls a token.

The `affiliations` state in `App.jsx` stays, so that Setup game can set it.

## On the table

The app puts the cards in the area where the character trays lie during a game. That area is empty before the players choose their squads. The numbers below are for blue (+z). Red is the same at −z, turned 180°.

```
      mat edge (z = 18)
      tactic tray            z = 18.3 … 22.4
row 1 [char][char][char][char][char][char][char][char][char][char]                    z = 22.7 … 25.7
row 2 [ttc]x10        [secure]x5        [extract]x5                                   z = 26.0 … 30.8
      table edge (z = 34)
```

- **Row 1, on the mat side:** character cards, 4.5" × 3", the same size and Healthy side image as the card on a tray. The cards are 0.3" apart, so 10 cards are 47.7" wide.
- **Row 2:** 10 Team Tactic cards (2.5" × 3.5", face up), then the 5 Secure cards, then the 5 Extract cards (2.75" × 4.8", the size of a crisis card on the table). The cards are 0.3" apart, with 1" between the groups. So the row is 59.6" wide and 4.8" deep.
- Each row is centered on x = 0. The order is from the owner's left, the same as the trays.
- When a row is wider than the table, its cards get smaller so that the row fits. The app does not limit the number of cards (see [Players apply the rules](#players-apply-the-rules)).
- The cards face their owner, the same as the trays and the tactic cards. So the other player sees them upside down, the same as in TTS. A click opens a card the right way up.
- An Infinity Gem shows as a text line on the lower edge of its character card, for example "+ Soul Gem". The app has no gem card images.

### Cards without files

On 2026-10-07, the app has files for 65 of 233 character codes, 69 of 401 Team Tactic codes and 24 of 45 crisis codes. For example, the "Spider-foes 2foe2furious" roster on Jarvis community has files in the app for 0 of 10 characters, 2 of 10 Team Tactic cards and 5 of 10 crisis cards.

- A card without an image is a plain plate of the same size, with the card name and the MCT code as a label. The label is a canvas texture on the plate, so it lies flat and faces the owner, the same as the card images. The `tray-label` CSS was removed earlier.
- A click on a plate does not open the roster popup. The HUD message shows an error instead: "No card image for <name> (<code>)". For a character it is "No card image or model for <name> (<code>)", because a character without an image also has no model.
- A character without a 3D model also gets the mark "No model", the same as the grey row in the Library. It cannot be spawned.

### Card actions

| Action | Input | Result |
|---|---|---|
| Open | Left click on a card | The roster popup opens on that card, see [Roster popup](#roster-popup). A card without an image shows an error, see [Cards without files](#cards-without-files) |
| Move | — | Not possible. The cards are locked, the same as in TTS |

- A roster card has no physics body. Models and dice do not touch it.
- A roster card is not a piece for the range and movement tools. A tool key over a roster card works the same as over the empty table.
- When a player has character trays on the table, the trays and the roster overlap. The app does not move either of them. The player removes the roster with **×**. Setup game will remove the roster when the squad is chosen.

### Roster popup

Added on 2026-10-07. `RosterPopup.jsx` shows the roster of one player in a full-screen popup.

- The popup has no panel. The title, the tabs, the cards and the buttons lie on a dark backdrop that blurs the table, the same as the single card popup (`CardPopup.jsx`). Only the cards and the buttons take clicks. A click anywhere else goes to the backdrop.
- The title says whose roster it is: "Blue player roster" or "Red player roster", in the player color.
- The popup has 3 tabs: **Characters**, **Tactic cards** and **Crisis cards**. The Crisis tab has the Secure cards, then the Extract cards. A tab without cards is disabled.
- Each tab shows its cards in a carousel, in the order of the table. The shown card is in the middle. The other cards show at the sides, smaller and darker: half of the previous and the next character card, more of the narrower Team Tactic and crisis cards. A click on a side card moves it to the middle. The Flip button and the gem lines show only under the card in the middle.
- All cards have the same height in every tab, and the carousel has the same width in every tab. So the carousel and the buttons under it do not move when the player changes the tab. The width fits 2 character cards. Team Tactic and crisis cards are narrower than character cards, so more of them show.
- The carousel is a loop in both directions: after the last card comes the first. Embla can loop only when all cards but one fill the visible part. So the loop needs 3 character cards, or about 6 Team Tactic or crisis cards (5 on a small screen). With fewer cards the carousel does not loop. The carousel uses Embla (`embla-carousel-react`), the same library as the wuclub carousel.
- The popup opens on the tab and the card that the player clicked. A new tab starts at its first card.
- Drag the card, click **‹** / **›**, or press the left and right arrow keys to see the other cards. The text "Card 3 of 10" shows the place.
- A character card or a Team Tactic card flips with a click on the card or on the **Flip** button under it. A character card shows its Injured side, a Team Tactic card its back. The pointer cursor over the card shows that a click flips it. Only the card in the middle flips. A crisis card does not flip: its back shows only the card type. Each card keeps its side until the player changes the tab or closes the popup.
- A character with a second form that has its own card (Ant-Man, Emma Frost, see `docs/characters-hud.md`, "Second forms") has a card switch under its card, at the left: for example **Emma Frost** and **Diamond form**. The label of the second form comes from Jarvis (`secondFormSlug`). The shown card keeps its side. A character whose second form is its Injured side (Hulkbuster, Phoenix) has no switch, because Flip shows it. The switch is ready for grunts: a host can list its grunt cards in `variants` (`rosters/cards.js`). The app has no grunt files yet: no host or grunt is migrated, and the TTS cache has none of their files.
- A card without an image shows as a plate with its name and MCT code, the same as on the table. The popup never opens on such a card, but the carousel can move to it. The Infinity Gems of a character show as text lines under its card, below the Flip button.
- **Open this roster on Jarvis** under the title opens the roster in the Jarvis roster validator (`/roster-validator?mctCode=…`), in a new browser tab. The validator reads the code by place: entries 1–10 are characters, 11–20 Team Tactic cards, 21–30 crisis cards. So the link gives each group exactly 10 places, and an empty entry fills a free place of a draft roster. Cards after the 10th of a group are left out, because the validator does not read them. A full roster gives the same code as **Copy MCT code** on Jarvis. Added on 2026-10-07.
- **Open on Jarvis** under the bottom right corner of the card in the middle opens the page of that card on Jarvis, in a new browser tab: `/characters/<slug>`, `/team-tactics-cards/<slug>` or `/crisis-cards/<slug>`. The slug comes from the Jarvis data. A migrated character can have another slug in the app, for example `the-mighty-thor` for Jarvis `mighty-thor`. So `CHARACTERS` keeps the Jarvis slug as `jarvisSlug`. Both forms of a character link to the same page. A plate also has the link, so a player can read a card that has no image in the app. Added on 2026-10-07.
- Both links show the Jarvis logo: the Jarvis site icon, 64 px, in `src/assets/jarvis-logo.webp`.
- Escape, **×** in the top right corner of the screen, or a click on the backdrop closes the popup. A new load or **×** of that roster also closes it.

`App.jsx` stores the open popup as `openRoster: { team, tab, index } | null`. App handles all keys (see `keyboard.js`), so App also owns the shown card. A drag in the carousel reports the new card to App.

## State

`App.jsx` gets a new object:

```js
rosters: {
  blue: null | {
    code,   // the MCT code in Jarvis order and format, built by the parser
  },
  red: null | { … },
}
```

- `code` is the only roster data in the state. A pure function `parseRoster(text, kindOf)` gives the 4 card groups, the gems and the unknown codes. The components call it, so the state cannot disagree with itself.
- A roster is an object and not a plain string, so that Setup game can add fields to it, for example the chosen squad.
- All fields are plain JSON. So they fit into the `rosters` map of the Yjs document in `docs/feature-peer-to-peer.md`. Both browsers must run the same app version, so that they have the same Jarvis data. The P2P plan already requires this.

## Code

| File | Content |
|---|---|
| `src/rosters/mct.js` | `parseRoster(text, kindOf)`, `formatMctCode(parsed)`, `jarvisValidatorCode(parsed)`, `isEmptyRoster(parsed)`. `kindOf(code)` is an argument, so the module has no imports and a Node script can test it |
| `src/rosters/cards.js` | `cardKind(code)`, `rosterCard(code)` (kind, name, image file or null, model or not, Jarvis page), `parseRosterText(text)`, `jarvisRosterUrl(parsed)` |
| `src/rosters/layout.js` | `rosterLayout(team, parsed)`, `ROSTER_CARD_Y`, `rosterRowInfo`. Card positions for each side. Plain module, the same as `characters/trays.js` |
| `src/components/RosterCards.jsx` | The cards of one roster on the table |
| `src/components/RosterPopup.jsx` | The roster popup: tabs and a card carousel |
| `src/components/Toolbar.jsx` | The Roster group. The VP group goes away |
| `scripts/fetch-jarvis-tactics.mjs` | The Team Tactic data, with a section in `scripts/README.md` |

`src/characters/roster.js` is the list of all characters for the Library, not a player roster. It becomes `src/characters/characters.js`, and its `ROSTER` export becomes `CHARACTERS`. So "roster" in the code means only a player's roster.

## Steps

1. Rename `ROSTER` to `CHARACTERS` and `src/characters/roster.js` to `src/characters/characters.js`. Update the imports and the docs that name them.
2. `fetch-jarvis-tactics.mjs` and `src/tactics/jarvis-tactics-cards.json`.
3. `mct.js`. Check it in Node with a few MCT codes from Jarvis community rosters, including one with an Infinity Gem and one with two Sentinel MK4.
4. State and the Roster group in the toolbar. Remove the VP group.
5. `layout.js` and `RosterCards.jsx`.
6. README section "Roster", `scripts/README.md`.

## Out of scope

- Loading a roster from a Jarvis link. The MCT code is the standard way to share a roster in the community. Jarvis also blocks calls from other sites, so a link needs a proxy.
- Squad choice, crisis card choice from the roster, and the VP marker. See `docs/feature-setup-game.md`.
- Roster checks (see [Players apply the rules](#players-apply-the-rules)).
- A roster name. The toolbar field has one line, so the name line of a TTS code is lost. Jarvis puts no name in the code.
- Marks for Unreleased, Restricted and Banned cards. Jarvis has the data, so a later change can add them.
- Gem card images, and the images of the other cards. They need a migration first (see `scripts/README.md`).
- Battle Realm and Collector Pack rosters.
- Saving rosters in the app. Jarvis stores rosters.
- Building a roster from cards dropped into a bag (the TTS Roster Maker).

## Decisions

Made on 2026-10-07:

1. A roster loads only from an MCT code, not from a Jarvis link.
2. The VP picker goes away now. The VP markers show the Unaffiliated token until Setup game.
3. The Library list is called `CHARACTERS`, so "roster" means only a player's roster.
4. A draft roster is a roster with fewer codes. It needs no special case.
5. The roster cards lie in the tray area on the owner's side. **×** removes a roster.
6. `parseRoster(text, kindOf)` gets the lookup as an argument, so `mct.js` has no imports.
7. The stored `code` holds only known codes. Unknown codes show once, in the load warning.
8. Codes after `-` are gems only when the first code of the group is a character. A gem is a code of kind `tactic`. An unknown gem code goes to the warning.
9. The text search is `/\d{8}(?:-\d{8})*/g`, with no check of the characters around a match. TTS also uses a plain substring search.
10. A card without an image shows its name and MCT code in a canvas texture on the plate.
11. A click on a plate shows an error in the HUD message. The roster popup opens only on a card with an image. (Changed on 2026-10-07. Before, a plate took no pointer events.)
12. Roster cards lie at y = 0.01, below the character trays (y = 0.02). The tray draws on top of a roster.
13. The toolbar field keeps the typed text. **×** clears the field and the roster.
14. A click on a roster card opens the roster popup on that card, not the single card popup. App owns the open tab and card, so the arrow keys can move the carousel.
15. The roster popup links to Jarvis: the roster in the roster validator, and each card to its page. The links go out of the app, so they need no proxy.
