# Plan: Automatic Cleanup Phase

Requested by the user on 2026-10-11, together with the Power Phase button (`docs/plans/power-phase.md`). Status: plan approved by the user on 2026-10-11. Phase 1, 2 and 3 done on 2026-10-11. The user checked Phase 2 and 3 on 2026-10-11: all checks pass. Build it after the Power Phase plan, because that plan adds the **Phase** group in the toolbar and `characterOnBoard`.

User input on 2026-10-11: the button is disabled until every character on the board has an Activated or a Dazed token (decision 2). The tray **Remove** button no longer deletes a character: it puts the model back on its card. The Delete key over the card deletes the character, after a confirm (decision 10). The mod's list of tokens to remove is fine for now; the user will report wrong ones.

## Goal

A player presses one button, and the app does the Cleanup Phase steps that need no choice:

- Dazed characters remove all damage, special conditions and the Dazed token, and flip to the Injured side
- all characters remove the Activated token and the tokens that last until the end of the round
- Exhausted Sources flip back, and the supply tokens leave the game
- the round marker moves to the next round

Today players do each step by hand on the trays, the tokens and the scoring board.

The button works only when every character on the board has an Activated or a Dazed token. A KO'd character must leave the board first, so the tray **Remove** button now puts the model back on its card instead of deleting the character.

## Rules

From the Jarvis rules reference (rulebook p12, "Cleanup Phase"):

1. Players score Victory Points for controlling, securing or holding objectives.
2. Players resolve player effects, then non-player effects.
3. Dazed characters remove all damage, special conditions and the Dazed token from their stat cards, and flip to the Injured side.
4. If the player that activated the last character has the Priority token, they pass it to the opponent.
5. Players remove all Activated tokens, move the Round token to the next round, and start the next round with a Power Phase.

The 4 current Source cards (Evidence, Jailbreak, Sentinel Schematics, Surprise Assault) say: "During the Cleanup Phase, remove all <supply tokens> from the game and flip each Exhausted <Source>." Players score VP for held supply tokens before that (step 1).

## How TTS does it

Found on 2026-10-11 in the mod scripts (`autoCleanup` in "Red Tray Spawner", "UI Controller", Global; `autoCleanupCrisis` in "Automatic Crisis Deployment"; `advanceRoundToken` in "Tracker"):

- Each player has an **Automatic Cleanup Phase** button. One press cleans the trays of **both** players.
- Every tray: the Activated token goes, and every token with `cleanup = true` in the mod's token database goes.
- A tray with the Dazed token: the Dazed token and every special condition go, and the card flips (Damage goes to 0).
- The mat: every flipped crisis token with `flipFront` (the Sources) turns back to its front. Every token with `cleanup = true` on the mat is deleted, except affiliation tokens.
- The round token moves to the next round spot. It stays on round 6.
- The Priority token moves to the player with fewer characters left to activate. The app has no Priority token (`docs/features/setup-game.md`, "Not built yet").
- TTS does not score VP and does not run character effects of the Cleanup Phase.

## Facts in the app

- A character's tokens are `ch.tokens` (key → count). Dazed is `dazed`, Activated is `activated`. The 10 special conditions are `SPECIAL_CONDITIONS` in `src/characters/immunity.js`.
- `src/tokens/tokens.json` already has `cleanup: true` from the mod (`docs/features/character-trays.md`: "The app does not use it yet"). 41 tokens have it: Activated, 5 character tokens (Degeneration, Expert Tracker, StarHerb, Winging It, X-Gene) and 35 Team Tactic tokens (for example Mystic Ward, Rocket Boots, Target). No special condition and no affiliation token has it.
- Loose tokens on the table are `looseTokens` (`{ id, key, x, z }`). Piles are separate and never run out.
- Crisis tokens are `tokens` in `App.jsx`. A Source has `flipOnly` in `src/crisis/cards.json`, front `extract-unexhausted-source`, back `extract-exhausted-source`. A supply token has the `supply` key of its card as `frontKey` (`extract-source-asset` or `extract-source-civilian`). A character holds a token when `heldBy` is its id.
- The round marker is `scoreMarkers.round`. `ROUND_POINTS` in `src/scoreboard/board.js` has the 6 round spots, and `snapPoint` finds the spot under a marker.
- `handleCharacterFlip` toggles the side and sets Damage to 0.
- Today the tray **Remove** button asks "Remove X from the table?" (`TrayControls.jsx`), then `handleCharacterRemove` drops the held tokens next to the model and deletes the character, its models, its tray and its poses. The row of trays closes the gap.
- A model on its tray stands on the card at `trayModelPosition` (card 1 or 2), and a spare model at `traySpareModelPosition` (`src/characters/trays.js`, `modelSpawnPosition` in `Scene.jsx`).
- The rest pose of each model is in the table document (`poses`). Scene moves a model that nobody claims when its stored pose changes (`applyPose`), in both browsers.
- The Delete key deletes the piece under the pointer: a token on the table, a held crisis token, a pile, a Team Tactic card, an unlocked terrain piece (`docs/features/key-shortcuts.md`). Not a character.

## Decisions

1. **One button for the whole table.** A **Cleanup** chip in the **Phase** group, next to **Power**. It cleans both sides, because the round marker and the crisis tokens are shared. This is the TTS way. Any player can press it.
2. **Disabled until every character on the board is done.** The chip is disabled while a character on the board (`characterOnBoard`, both sides) has neither an Activated nor a Dazed token, and while no character is on the board. Reason: such a character is suspicious. For example, it was KO'd, but its damage was not set and its model was not removed from the board. Players fix that by hand first.
   - The chip title gives the reason: "Each character on the board needs an Activated or Dazed token: Hulk, Angela." When the chip is enabled: "Cleanup Phase for both players. Score VP first."
   - The chip uses `aria-disabled` and a disabled style, not the `disabled` attribute, because some browsers show no title on a disabled button. A click on it does nothing.
   - The condition also blocks a second press: after a Cleanup, no character has Activated or Dazed.
   - No confirm dialog. The condition replaces it.
3. **Dazed characters.** Damage 0, side Injured, and the `dazed` token and every special condition go. The app sets the side to Injured. It does not toggle it, so a Dazed token on an Injured card does not flip it back to Healthy. Other tokens stay, except the ones in decision 4. Held objective tokens stay: a character drops them when it is Dazed (p10), and players do that by hand.
4. **All characters**, also the ones not on the board: `activated` and every token with `cleanup: true` go.
5. **Loose tokens.** Every loose token with `cleanup: true` goes, the same as TTS. Piles stay.
6. **Crisis tokens.** Every Source shows its front (Unexhausted). Every supply token goes, on the table and held. The 4 current Source cards say so. The app does not read the card text, so a new Source card with another rule needs a code change.
7. **Round marker.** It moves to the next spot of `ROUND_POINTS`. It stays on round 6. When the marker is on no spot (a player moved it off the track), it does not move, and the message says so.
8. **One change.** All of it is one `table.transact`, so the other browser gets it at once.
9. **Feedback.** A HUD message: "Cleanup Phase: round 3. Flipped: Hulk, Angela." Without Dazed characters: "Cleanup Phase: round 3."
10. **Remove from the board, and Delete.**
    - The tray **Remove** button removes the character from the board (a KO'd character, p16). Its held tokens drop next to the model, as today. Then each model of the character goes back to its place on the tray (card 1, card 2 or the spare place), with its spawn turn. The new pose goes into `poses`, so the other browser moves it too. The character, its tray and its tokens, Damage and Power stay. No confirm: a player can drag the model back.
    - **Remove** is disabled when no model of the character is on the board. Title: "Remove from the board: the model goes back on its card. Delete key over the card deletes the character."
    - The Delete key with the pointer over a tray card (card 1 or 2) deletes the character: a confirm "Remove X from the table? Its tray is removed too." then today's `handleCharacterRemove`.
    - The tray popup keeps its **Remove** button with the new meaning.
    - A model that the other player drags at that moment is skipped (Scene does not move a claimed model).

## Not in this plan

- VP scoring. Players move the VP markers first.
- The Priority token. The app has none on the table.
- Character effects in the Cleanup Phase, for example Dormammu (an ally with 5 or more Power suffers 1 damage) and Killmonger (Herb tokens give damage and Power, see `docs/plans/power-phase.md`, "Later: variable Power").
- Non-player effects of other crisis cards.
- TTS special cases, for example Bob, Agent of Hydra.
- A KO'd mark on the tray. A KO'd character is a character whose model is on its card.

## Phase 1: Cleanup rules as plain functions

Work:
1. `src/characters/cleanup.js`: `cleanupCharacter(ch, cleanupKeys)` returns the new character (decisions 3 and 4). `cleanupKeys`: the keys with `cleanup: true`, from `tokens.json`. A token with count 0 leaves the map, the same as elsewhere in the app (check `handleCharacterTokenGive` and the token remove handler). Also `cleanupBlockers(characters, poses)`: the characters on the board with neither Activated nor Dazed (decision 2).
2. `src/crisis/cleanup.js`: `cleanupCrisisTokens(tokens, cards)` returns the new list (decision 6). A Source is a token whose card token has `flipOnly`. A supply token is a token whose `frontKey` is the `supply` of its card.
3. `src/scoreboard/board.js`: `nextRoundSpot(position)` returns the next spot, the same spot on round 6, or null when the marker is on no spot (decision 7).
4. Tests: `src/characters/cleanup.test.js`, `src/crisis/cleanup.test.js`, and a test for `nextRoundSpot`:
   - a Dazed Healthy character with Damage, Bleed, Stun, Activated, Winging It and a non-cleanup token: Injured, Damage 0, only the non-cleanup token stays
   - a Dazed Injured character stays Injured
   - a character that is not Dazed keeps its conditions and Damage, and loses Activated and cleanup tokens
   - `cleanupBlockers`: a character on the board without Activated or Dazed is listed; with Activated, with Dazed, or on its card, it is not
   - an Exhausted Source turns to its front; an Unexhausted Source does not change; supply tokens go, held and on the table; other crisis tokens do not change
   - round 1 → 2, round 5 → 6, round 6 stays, a marker off the track gives null

Checks: `pnpm --filter web test`, `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

## Phase 2: Remove from the board, Delete key

Work (decision 10):
1. `Scene.jsx`: a ref function for App (the same way as `liftPieceRef`), for example `returnModelsRef.current(characterId)`. For each model of the character that nobody else claims: put a lifted model down, then move it to its tray place with its spawn turn (`modelSpawnPosition` without the stored pose), and store the new rest pose (`onModelRest`). Check that `applyPose` or the poses effect moves the body in this browser and in the other one.
2. `App.jsx`: `handleCharacterOffBoard(id)`: `handleDropCharacterTokens(id)` first (the live model position), then the ref function. The old `handleCharacterRemove` stays for the Delete key.
3. `TrayControls.jsx` and `TrayPopup.jsx`: **Remove** calls `handleCharacterOffBoard`, without the confirm. Disabled when the character is not on the board (`characterOnBoard`), with the title of decision 10.
4. Delete key: the tray card under the pointer (card 1 or 2) gives the character id, the same way as the other hover refs in `App.jsx`. Confirm, then `handleCharacterRemove`.
5. Docs: `docs/features/character-trays.md` (the Controls sketch and bullets, "Remove"), `docs/features/key-shortcuts.md` (Delete row).

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

User, after this phase:
1. Sandbox: move a character onto the mat, give it a held Asset. Press **Remove** on its tray. The Asset drops next to the model, then the model goes back onto its card. The tray stays, with its Damage, Power and tokens.
2. **Remove** on a character whose model is on its card: the button is disabled, and its title explains why.
3. Hulkbuster with Iron Man moved onto the mat: **Remove** puts both models back in their places.
4. Delete key over a tray card: the confirm names the character. Cancel: nothing changes. OK: the character, its models and its tray go, and the row closes the gap.
5. Multiplayer room, two browsers: Blue presses **Remove**. Red sees the model go back onto its card.

## Phase 3: Cleanup button

Work:
1. `App.jsx`: `cleanupBlockers` for the chip state (decision 2). `handleCleanupPhase()`: checks the blockers again, then one `table.transact` (decision 8): characters with `cleanupCharacter`, loose tokens with `cleanup: true` removed, crisis tokens with `cleanupCrisisTokens`, the round marker with `nextRoundSpot`. Then the HUD message (decision 9). A removed held token must also leave the holder's tray: check how the tray finds its held tokens (`heldBy`).
2. `Toolbar.jsx`: **Cleanup** chip in the **Phase** group, with the disabled state and the titles of decision 2.
3. Docs: `docs/features/character-trays.md` ("Players apply the rules", "How TTS does it", the `cleanup` note in the token data section), `docs/features/crisis.md` (Source bullet in "Extract: Source", "Phase steps" in "Not built yet"), and a short section "Cleanup Phase" that points to this plan.

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`.

User, after this phase:
1. Sandbox: two characters on the mat. Character 1 has Damage, Bleed, Stun, Activated, Dazed and Winging It. Character 2 has Poison, and no Activated. **Cleanup** is disabled, and its title names character 2.
2. Give character 2 Activated: **Cleanup** is enabled. Press it. Character 1: Injured, Damage 0, no tokens. Character 2: Poison stays, Activated goes. **Cleanup** is disabled again.
3. A character on its card (removed from the board) without Activated does not block **Cleanup**.
4. Put a Mystic Ward token on the table: it goes. A Mystic Ward pile stays.
5. Source card (for example Jailbreak): flip a Source to Exhausted, take two supply tokens, one onto a character, one onto the table. Press **Cleanup**: the Source is Unexhausted, both supply tokens are gone, the tray shows no held token.
6. The round marker moves from 1 to 2. On round 6, it stays. Drag it off the track: it does not move, and the message says so.
7. Multiplayer room, two browsers: Red presses **Cleanup**. Both browsers see the same result, and **Cleanup** is disabled in both. The round marker moves once.

## Result

Phase 1 done on 2026-10-11.

- `src/characters/cleanup.js`: `cleanupCharacter(ch, cleanupKeys)` (array or Set; returns the same object when nothing changes) and `cleanupBlockers(characters, poses)`.
- `src/crisis/cleanup.js`: `cleanupCrisisTokens(tokens, cardOf)`. Differs from the plan: the second argument is a lookup `cardOf(cardKey)` (App passes `getCard` from `cards.js`, which has `tokens` and `supply`), not the cards object. The module imports no JSON, so node tests can load it.
- `src/scoreboard/board.js`: `nextRoundSpot(position)`.
- Tests: `characters/cleanup.test.js`, `crisis/cleanup.test.js`, `scoreboard/board.test.js`.

Phase 2 done on 2026-10-11.

- `Scene.jsx`: `returnModels(characterId)` (filled into the new `returnModelsRef`), and `trayPlace(model)` split out of `modelSpawnPosition`. Per model: skip if no body or `claimModel` is false; cancel a lift; drop a pending turn; `applyPose` to the tray place; `onModelRest` with the same pose at once.
- y = 0: the card has no collider and the table top is y = 0, the same as the spawn (`trays.js`), so the sleeping body touches only the table.
- Rotation: the body gets the identity quaternion. The spawn turn (`model.rotation`) sits on the inner figure, not on the RigidBody, so identity gives the spawn turn.
- Lift: differs from the plan text "put down". `down()` animates and ends with a `setTranslation` back to the place before the lift, which would fight `applyPose`. `CharacterModel.jsx` has a new `cancel()` in the lift API that clears the lift state. `applyPose` makes the body dynamic.
- Other browser: the claim of this browser is open until the body sleeps (2 frames), and the pose is written before that. Pose first: the poses effect skips the claimed model, the end of the claim applies the pose. Pose after the claim end: the poses effect applies it. Sandbox: the body already stands at the pose, so nothing moves twice.
- `App.jsx`: `handleCharacterOffBoard`, `handleTrayCardDelete` (confirm, then `handleCharacterRemove`), Delete over a tray card is the last check, after terrain. `hoveredTrayCardRef` holds the character id. A selection of the models stays.
- Remove button: `aria-disabled` (not `disabled`, so the title shows) with `.chip[aria-disabled='true']` in `index.css`. `onBoard` goes Scene -> `CharacterTray` / `TrayPopup` -> `TrayControls`. One title for both states.

Phase 3 done on 2026-10-11.

- `App.jsx`: `handleCleanupPhase` (blockers checked again, then one `table.transact` with updater writes to characters, loose tokens, crisis tokens and the round marker), and the chip state (`cleanupDisabled`, `cleanupTitle`, computed in App). `tokens.js`: `CLEANUP_KEYS`.
- `Toolbar.jsx`: **Cleanup** chip in the Phase group, `aria-disabled`, props `onCleanupPhase`, `cleanupDisabled`, `cleanupTitle`.
- Held supply tokens leave the tray by themselves: the tray reads the held tokens from `tokens` (`heldBy`).
- HUD message: "Flipped" lists every Dazed character, also one that was already Injured. Shown 8 s, as the Power Phase. Marker off the track: "Cleanup Phase: the round marker is not on the round track, so it did not move."
- Docs: `character-trays.md` (new "Cleanup Phase" section and the notes), `crisis.md`.

User checks (2026-10-11): all checks of Phase 2 (5) and Phase 3 (7) pass.
