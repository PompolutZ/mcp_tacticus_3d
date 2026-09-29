# Feature: Crisis cards

Status: design. Not started.

## Goal

Players choose one Secure card and one Extract card. The app shows the two cards and puts their tokens on the mat. Players then move, flip, hold and mark the tokens during the game, as in TTS.

## Players apply the rules

The app does not check or apply the crisis rules. It does not find who contests a token, who holds what, or who scores. Players do this themselves.

The reason: the rules can change a lot between Challenger rotations. A rules engine must change with every rotation. An app that only moves and marks tokens keeps working when the rules change.

So the app has a small set of token actions (see [Token actions](#token-actions)). The card text tells the players which actions to use and when.

## Terms

The rules in this doc come from the [Jarvis rules reference](https://www.jarvis-protocol.com/rules-reference), which quotes the rulebook (versions 1.3.0 and 1.4.0) with page numbers. Jarvis has no API for this text. It is in the JS bundle of the site.

| Term | Meaning |
|---|---|
| Interact | A character within Range 1 of an objective token spends 1 Power to Interact with it. It is not an action. A character can Interact with several tokens in one Activation, but with each token only once. (p10) |
| Contest | A character within Range 1 of an objective token contests it. A Dazed character cannot contest. Some cards change the range. For example, Lockdown uses Range 2. (p10) |
| Secure (verb) | The player with the most Healthy characters contesting a token secures it. If no Healthy character contests it, the player with the most Injured characters secures it. There is no marker. Players count at the moment of scoring. (p10) |
| Control | A player who gets Control puts their marker on the token. This removes the marker of the other player. The token stays controlled while the marker is on it, no matter where the characters are. (p10–11) |
| Hold | A character that picks up a token holds it. The token lies on the character's Stat Card. (p10) |
| Drop | A Dazed or KO'd character drops all tokens it holds. The opponent places them within Range 2 of that character. (p10) |
| Limited | A character can hold only one Limited token with the same name. (p22) |
| Cleanup Phase | The end of each round. Players score VP first, then resolve the other effects. Every current card scores in this phase. (p12) |

## Cards

- 24 cards are migrated: 12 Secure and 12 Extract, the 2026 Challenger pool. The TTS cache has no images for the other cards.
- Each card has a threat value from 16 to 20.
- The face image has the card text and the setup map. So the image is enough for players to read the rules.
- Show the Jarvis name, not the mod name. The mod has spelling errors, for example "Sheild".

## Tokens

All current tokens are 1" circles. There are two groups: Extract tokens (red) and Secure tokens (blue).

### Extract: Asset and Civilian

- A character picks the token up and holds it. `docs/character-feature.md` describes where a held token goes.
- A character can drop the token, so the token moves around the mat during the game. A dropped token is placed within Range 2 of the character, by the opponent.
- Asset and Civilian look different (two images), but they are the same kind of token. The difference is only in some rules.

### Extract: Source

- A Source has two sides: Unexhausted and Exhausted.
- A Source never moves. Players can only flip it. When a player drops it, it goes back to its position (TTS `flipLock`).
- When a character interacts with an Unexhausted Source, the player flips it to Exhausted. Then the character takes one supply token (an Asset or a Civilian) and holds it.
- An Exhausted Source cannot be contested, secured or interacted with. (p22)
- In the Cleanup Phase, players flip every Exhausted Source back. On all 4 current Source cards, players also remove the supply tokens from the game at that time, so they go back to the supply.
- The supply is next to the card. The card says how many supply tokens to set aside. On all 4 current Source cards, this is one per Source.
- The supply images are the same as the normal Asset and Civilian images.

Source cards: Evidence, Jailbreak, Sentinel Schematics, Surprise Assault.

### Secure: Point of Interest and Target of Opportunity

- The token has two sides: Point of Interest (keyhole) and Target of Opportunity (key). The card says which side faces up.
- Most Secure tokens never move (TTS `lock`).
- Wedding Party (VIPs) is the one current card with tokens that move. It uses the Target of Opportunity side. In the Cleanup Phase, each player moves the VIPs that the opponent secures.

### Secure: Zone

- The token shows a quarter circle. The quarter circle shows the Arc of the token, so the rotation of the token matters.
- X-Men Infiltrate Secret Weapons Facility is the only Zone card. Its setup gives a rotation for each token.
- The card lets the controlling player move a Zone token up to Range 1 in the Cleanup Phase. When a player Places a Zone token, they can turn it in any direction (p22). So Zone tokens can move and turn.
- Rule (p22): a character is in the Arc of a Zone token if it is within Range 3 of the token and any part of its base is inside the area between the lines on the token.
- On a real table, players measure the Zone with two Range 3 tools, one along each straight side of the quarter circle. The app does not need these tools. It draws the Zone outline on the table and on the tops of terrain, the same way it draws the outline of a range tool. The outline is shown only when a player needs it, for example while the Zone token is selected.
- The outline is a quarter circle. Its corner is at the token center, and its two straight sides follow the lines on the token. Its far edge is a curve at Range 3 from the edge of the token: 6" from the token edge, because the Range 3 tool is 6" long. The far edge is a curve and not a straight line between the ends of the two tools, because players can point a Range 3 tool at a character in any direction.

### Pay-to-flip

On 5 cards, a player gets Control of a Secure token with an Interact and a dice roll: Meteors, Empress, Mutant Madman, Strike Team, X-Men Infiltrate. Jarvis marks these cards with `payToFlip: true`.

The player who gets Control puts their marker on the token. The marker stays until the other player gets Control.

### Damage marker

Lockdown puts a damage token on one Prison Block each Cleanup Phase. That Prison Block cannot be contested, secured or used. Players roll a die and read the setup map on the card to find the block.

## Token actions

| Token | Move | Turn | Flip | Hold | Markers |
|---|---|---|---|---|---|
| Asset, Civilian | yes | no | no | yes | no |
| Source | no | no | yes | no | no |
| Secure (fixed) | no | no | no | no | Control, damage |
| Secure (VIP) | yes | no | no | no | Control, damage |
| Zone | yes | yes | no | no | Control, damage |

The `locked` and `flipOnly` flags in `src/crisis/cards.json` decide if a token can move or flip. The mod sets these flags for each card.

Markers are available on every Secure token, not only on pay-to-flip cards. Because players apply the rules, a new card can use a marker in a new way without a change in the app.

- **Control marker**: the color of the player's table side, blue or red. One marker per token. A player can set it to blue, set it to red, or remove it.
- **Damage marker**: on or off.

## Physical behavior

A token must always be visible and a player must always be able to select it. Its exact height does not matter for the game. What matters is the range around the token, because a character interacts with a token within range 1.

### Tokens and models

- Tokens do not push models, and models do not push tokens.
- Models can stand on tokens. A model can also overlap a token, for example when the token hangs above terrain at the height of the model.

### Where a token rests

Tokens do not use physics. They do not fall, slide or tilt. A token is always flat.

The app looks at the surface under the token's circle, seen from above. This surface is the mat and the tops of terrain.

- The whole circle is on one flat surface: the token lies on that surface. Examples: the token is fully on the mat, or fully on a flat roof.
- The circle is partly on terrain, or the surface under it is not flat: the token hangs flat just above the highest point under the circle. Examples: the edge of a crate, a slope, a rock.

As a result, a token is never inside terrain. So players can always see it from above and select it.

The same rule applies at setup and when a player drops a token during the game.

### Why not copy the table or TTS

- On a real table, players put a token on the mat when it does not fit fully on terrain, and then put the terrain on top of it. In the app, the terrain would then hide the token. The rulebook says that players agree to put a token on top of or under terrain, and that they choose the place where it is easiest to see (p10). The app always chooses the place where the token is easiest to see.
- Two rules stay with the players. If a token overlaps a Size 6 terrain feature, players move the terrain (p18). A token is never placed on top of an overhang (p9). In the app, a token over an overhang hangs above it, so that players can see it. Its range does not change.
- The TTS mod has a button that shakes the terrain so that tokens settle better, because tokens get stuck on the terrain colliders. The app does not need this, because tokens do not use physics.

### Range

The range tools measure along the table from above (see README, section "Tools"). So a token that hangs above terrain has the same range as a token on the mat at the same place.

A range tool snaps to a selected token in the same way as it snaps to a selected model: one end of the tool touches the edge of the token, and a handle turns the tool around the token center.

The short side of every range tool is 1". Players use it to measure range 1 from a token. On a real table, they hold the tool upright with the short side on the table, or they lay it flat. The TTS mod puts one corner or the short end of the range 2 tool against the token and turns the tool around the token.

### Models that cover a token

A model that stands on a token can cover it from above, so a player cannot select the token. On a real table and in TTS, one player lifts the model and the other player measures.

The app can lift all models on the table at once. When the models go back down, each model must return exactly to its old position and rotation. It must not drop with physics, because physics can move it.

The details depend on how players select tokens. They will be decided later.

## Setup flow

1. A player chooses the Secure card and the Extract card from a list. The list shows the name and the threat.
2. The app puts both cards face up on the table, one on each side of the scoring board (see [Scoring board](#scoring-board)). Players expect the cards there, because they place them there on a real table. A player can open a card in a HUD popup to read it. The TTS mod has a button that brings a card forward for the same reason.
3. The app puts the tokens on the mat at the setup positions, with the side and rotation from the card.
4. For a Source card, the app also puts the supply next to the card.
5. The setup positions are always relative to the player sides (blue and red), as the setup map on each card shows. They are never relative to the mat. So when the mat turns (**Mat → ↺ / ↻**), the tokens do not turn with it. Each token stays at its place on the table and rests again on the new surface under it (see [Where a token rests](#where-a-token-rests)). As a result, players cannot know before the game if a token lands on the mat or on terrain.

The bottom edge of the setup map on a card is the deployment edge of the player with Priority, which is the blue side of the app. The top edge is the red side. The rulebook calls these the blue zone and the red zone (p9). The current card images use other colors: green at the bottom and purple at the top.

The positions in `cards.json` already follow this rule after the `z` → `-z` conversion. This was checked on 2026-09-29 with the Survivors card image. Survivors is the only current card with a map that changes after a half turn, so it is the only card that can show a wrong orientation.

In the TTS mod, the Blue seat is at +z. The mod puts the top edge of the card toward +z, so in the mod the bottom edge faces the Red seat. The app is the other way round, because the `z` → `-z` conversion puts TTS +z at the red side of the app. So TTS objects that belong to a seat, such as the VP trackers, change color when the app uses their TTS positions.

A player can choose another card at any time. The app then removes the tokens of the old card and puts the tokens of the new card.

## Data

What exists (see `scripts/README.md`, section "TTS crisis cards"):

- `src/crisis/cards.json`: card id, name, type, threat, tokens (position, image, back image, flags, rotation), supply token.
- `src/crisis/tokens.json`: token images, shape and size.
- `src/crisis/jarvis-crisis-cards.json`: official names, card text, setup map letter, `payToFlip`, legality.
- Positions are TTS x and z in inches from the mat center. `Terrain.jsx` converts them to Three.js with `z` → `-z`.

What is missing:

- A Control marker image. A colored ring or disk in the player color is enough.
- A damage marker image. The mod has a "1 Damage" token. `migrate-crisis.mjs` leaves it out because it is a character token. Character damage tokens will need the same image later.

## Scoring board

The scoring board is a separate feature, but the cards are placed next to it. The rulebook calls it the Mission Tracker (p12). A player wins at once with 16 VP or more. After round 6, the player with the most VP wins (p11).

The board comes from the TTS mod. These facts were found in the mod on 2026-09-29:

- The board is the "Tracker" object. It has a VP track from 1 to 16 and a round track from 1 to 6.
- The mesh is 9" × 4" and the mod uses scale 2, so the board is 18" × 8".
- It is at TTS (-23.1, 0) with rotation 90. So it lies next to the mat edge at x = -18, halfway between the two players.
- The mesh and texture of the board, the Round Tracker, the Priority Token and the two VP trackers are in the TTS cache. The Round Tracker has only a mesh.
- The Lua script of the board reads the VP and the round from the positions of the tokens on it.

The TTS table is wider than it is deep. So the app table is 72" × 48", the same 3:2 shape (see `src/components/Scene.jsx`). The board fits at its TTS position, with room for one card on each side of it.

## Out of scope

- Rule checks: contest, secure, control, hold limits, scoring.
- Phase steps, such as flipping Sources back in the Cleanup Phase.
- Dice. Pay-to-flip, Lockdown and other cards need dice rolls. Players use their own dice for now, or a later dice feature.
- The 21 cards without images in the TTS cache.
- How players choose the cards and the threat, and legality checks. Players do this outside the app and then choose the two cards in the app. Rule (p9): the player with Priority draws 2 cards from one of their decks, and the other player chooses 1. Then the other player draws 2 cards of the other type, and the player with Priority chooses 1. The player without Priority chooses which card's threat is used.
