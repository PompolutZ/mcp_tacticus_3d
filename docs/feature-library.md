# Feature: Library

Status: in progress. The Library panel replaces the Spawn field and the Tokens panel. Players find characters, Team Tactic cards and tokens in one place and bring them to the table.

## Goal

A player brings 3 kinds of things to the table: characters, Team Tactic cards and tokens. Before this feature, each kind had its own picker: the Spawn field (characters), the Tokens panel (tokens), and nothing for tactic cards. The Library is one panel for all of them, with one search field.

## Panel

The **Library** button in the toolbar opens and closes the panel. Escape also closes it. The panel is on the left side of the screen, under the toolbar.

The panel stays open after a pick. So a player can add 5 characters, then 5 tactic cards, without opening it again.

```
+----------------------------------+
| [Search name or MCT code       ] |
| [All] [Characters] [Tactics] [Tokens]
| For: [Blue] [Red]                |   player who gets characters and tactic cards
+----------------------------------+
| CHARACTERS                       |
| (portrait) Angela         MCP01  |   click: spawn with its tray
| (portrait) Black Panther  ...    |
| TACTICS                          |
| [card] [card] [card]             |   click: into the tactic tray
| TOKENS          [Single] [Pile]  |
| (o)(o)(o)(o)(o)(o)(o)            |   drag: one token or a pile
+----------------------------------+
```

- **Search:** one field for all kinds. A character matches by name or MCT code. A tactic card matches by name or MCT code. A token matches by name.
- **Tabs:** All, Characters, Tactics, Tokens. All shows a section for each kind. The other tabs show one kind.
- **For:** Blue or Red. The player who gets the characters and the tactic cards. Tokens belong to no player.

## Characters

Each row has the portrait, the name and the MCT code. A click spawns the character for the chosen player, with its tray, the same as the old Spawn field (see `docs/characters-hud.md`).

Characters with a 3D model come first. A character without a model is grey. A click on it shows a short message, and nothing spawns.

A player has at most one copy of each character on the table. The characters that the chosen player already has are green in the list. A click on one of them shows a message in the HUD, for example "Blue player already has Angela on the table", and nothing spawns. Both players can have the same character. The two Sentinel MK4 rows are different characters, so a player can have both. `handleSpawn` in `App.jsx` does the check, so it also covers a later spawn from the roster. Added on 2026-10-07.

The rows come from Jarvis (`src/characters/characters.js`), one row per MCT code. Two exceptions, found on 2026-10-07:

- A Jarvis alternate sculpt (`isAlternateSculpt`, for example Mephisto Convention Exclusive) has the MCT code of its main character, so it gets no row.
- The mod has a row for each of the two Sentinel MK4 sculpts in the box: 00510101 and 00510102, with the same card and two models. Jarvis has one entry, 00510101, and uses 00510102 in a roster code for the second Sentinel MK4 of a roster. So a migrated character with its own MCT code and no Jarvis entry gets a row, with the stats of the Jarvis character of the same name.

## Tactic cards

Each card shows as a small image of its back (the card name on art), with the name under it. A click puts the card into the first free slot of the chosen player's tactic tray. See `docs/feature-team-tactic-cards.md`.

The images load only when they scroll into view (`loading="lazy"`), so the panel does not load all 69 images at once.

## Tokens

The tokens are in groups, the same as the old Tokens panel: Conditions, Status, Character, Tactic. A label under the pointer shows the name and the description.

The **Single / Pile** switch in the Tokens section header changes what a drag from the panel brings:

| Mode | Released over a character | Released over the table |
|---|---|---|
| Single | The character gets the token, the same as before (see `docs/characters-hud.md`, "Give tokens by drag and drop") | One token lies there, the same as before |
| Pile | Nothing happens | A pile of that token lies there |

### Pile

A pile is a source on the table that never runs out, the same as a Give source of a tray or the supply pile of a Source card. It looks like a short stack of 3 tokens.

| Input | Result |
|---|---|
| Left drag on the pile | Takes one token. The token then follows the Single rules: it goes to a character, or lies on the table. |
| Shift + left drag on the pile | Moves the pile |
| Delete or Backspace with the pointer over the pile | Removes the pile |

A pile has no physics body. It lies on the table or on the terrain under it, the same as a token on the table (`LooseToken.jsx`).

## State

- `libraryOpen`: the panel is open.
- The search text, the tab, the player and the token mode are state of the panel itself. They stay while the panel is closed, because the panel only hides.
- `tokenPiles: [{ id, key, x, z }]` in `App.jsx`, the same shape as `looseTokens`. All fields are plain JSON, so they fit into a map of the Yjs document in `docs/feature-peer-to-peer.md`.
- The token drag (`tokenDrag` in `App.jsx`) gets two new fields: `pile` (the drag brings a new pile) and `pileId` (the drag moves this pile).

## Out of scope

- A key to open the Library.
- Drag from the Library for characters and tactic cards. A click puts them in a fixed place, so a drag adds nothing now.
- Filters by affiliation. The app has no affiliation data for tactic cards yet.
- Terrain pieces and maps in the Library.

## Decisions

Made on 2026-10-06:

1. One Library panel replaces the Spawn field and the Tokens panel.
2. The panel stays open after a pick.
3. A pile never runs out. A drag takes a token, Shift + drag moves the pile.

Made on 2026-10-07:

4. A player cannot spawn a second copy of a character. Both players can have the same character.
