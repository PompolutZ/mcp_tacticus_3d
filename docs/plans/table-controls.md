# Plan: Table controls

Requested by the user on 2026-10-11. Plan 5 of `docs/plans/playtest-1.md`. Status: plan written and confirmed by the user on 2026-10-11. Branch `table-controls`, from `playtest-1-test`, because it builds on the table tools (Place, drag).

There is no new feature doc. Each step changes the feature docs of its area: `docs/features/key-shortcuts.md`, `docs/features/character-trays.md`, `docs/features/dice-rolling.md`, `README.md` and `apps/web/scripts/README.md`. Each step makes one commit and writes its **Result** below.

## Request

Notes from the first game: 2, 16, 18, 19, 24, 25, 26, 27, 28, 31 (see `docs/plans/playtest-1.md`).

Answers of the user, from `docs/plans/playtest-1.md`, plan 5:

- **Drag** [18]. A drag moves a piece without selecting it first, and the drag selects it. For all pieces. The user tries it first.
- **Alt** [2]. Hold Alt over a card to show it large. Release Alt to close it. The click popup stays.
- **Place** [27]. Turning on Place on tool B turns it off on tool A, and the character snaps to tool B.
- **Give click** [28]. A click on a Give source below a tray gives 1 of that token to that character.
- **Model facing** [16]. When a model spawns on its card, its front faces the opponent, toward the mat. The data does not say which way each model's front points, so the plan starts with a check of the spawn turns.
- **Labels** [26]. On at start. When they are off, a terrain piece under the pointer shows its label. The label shows the lock state: "Tree - Size 2 - (L)ocked" / "Tree - Size 2 - Un(L)ocked".
- **Footprint** [25]. A neutral color (light grey) instead of blue. Green (touching) and red (overlapping) stay.
- **Hover highlight**. Any 3D piece under the pointer that the player can use shows a highlight: a model, a die, an unlocked terrain piece, and so on.
- **Dice tray** [19, 31]. A number key over a tray clears it first, as in TTS. A click on a face plate puts one die of that face back in the well. A click on a die on the shelf opens the change menu.
- **Delete over a dice tray** [24]. Not decided. Not in this plan.

## Facts in the app

Read on 2026-10-11.

- **Drag.** `startPointerDrag` (`src/drag/pointerDrag.js`) has `canStart`. Four places hold a drag back until the piece is selected: `CharacterModel.jsx` (`canStart: () => selected`), `RulerTool.jsx` (the tool body, and the second `onPointerDown` near line 1006), `CrisisToken.jsx` (`selected && token.canMove`). Tokens, piles, tactic cards and score markers already move with no selection. A click calls `toggleSelectPiece` (`src/selection.js`). Scene has `toggleSelect`, `selectTool` and `selectModel`.
- **Popups.** `CardPopup.jsx` shows one image (`openCard`, `{ src, alt }`). A tray card opens `TrayPopup.jsx`, a roster card `RosterPopup.jsx`. Cards on the table: tray cards (`CharacterTray.jsx`), roster cards and the setup crisis rows (`RosterCard` in `RosterCards.jsx`), the crisis cards at the scoring board (`CrisisCard.jsx`), Team Tactic cards (`TacticCard.jsx`). `handleKeyDown` in `App.jsx` returns early when `e.altKey` is set, so Alt does nothing today.
- **Place.** Each tool keeps its own `placeSide` (`RulerTool.jsx`). While on, it sets `placeLimits.current.range` or `.move` in `Scene.jsx`, and the model drag runs every limit in `constrainDrag`. So with Place on two tools, both limits clamp the drag. Throw / Push uses the same `onPlaceLimit`.
- **Give sources.** `CharacterTray.jsx` `startGive(e, key)` calls `onTokenDragStart`. `App.jsx` `startTokenDrag` has `onClick: endTokenDrag`, so a click does nothing. A drop on a character calls `handleCharacterTokenGive(characterId, tokenKey)`.
- **Model turn.** `Scene.jsx` gives the figure `rotation: [0, model.rotation°, 0]` (`model.rotation` is `cModelRot`). The body starts with no turn, so the models of both sides face the same world direction. The TTS tray spawns a model with Y rotation = tray Y rotation + 180 + `cModelRot`, and a standee with tray Y rotation + 180 (`apps/web/scripts/README.md`, "TTS rules"). The character tray gets its rotation from `cRot` in the Tray Spawner script. TTS Y rotation `r` is `-r` in Three.js, and AssetRipper mirrors X, so a terrain GLB needs a 180° turn (`IMPORT_ROTATION` in `Terrain.jsx`). `cModelRot` values in `characters.json`: 180 (31 models), 0 (14), and 15 other values.
- **Labels.** `showLabels` starts `false` in `App.jsx`. The label is "Tree · Size 2" (`Terrain.jsx`). A locked piece has no pointer handlers, so a click on it is a click on the empty table. The L key finds the piece under the pointer with `terrainAtRef` (a raycast), so it works on locked pieces.
- **Footprint.** `FOOTPRINT_COLOR` `#3f7fd6` in `footprintProjection.js`, used by `DragFootprint.jsx`.
- **Hover outline.** The white `hovered` outline (`SelectionOutlines.jsx`) shows on models, tools, crisis tokens, unlocked terrain and Team Tactic cards. Tokens (`TokenFace.jsx`: the On row, Give sources, tokens on the table, piles), tray cards (outline only when selected), roster cards, crisis cards, score markers, supply piles, rack tools and dice have none.
- **Dice tray.** Over the own tray, a number key calls `addDice(n)` (`DiceTray.jsx`). A click on a face plate opens the "Reroll one / Change one to" menu (`DiceKeys.jsx`, `diceMenu` in `App.jsx`). `reroll(symbol)` moves one shelf die of that face back to the well. `change(symbol, to)` changes the first shelf die of that face. The dice have no pointer handlers.

## Decisions

Confirmed by the user on 2026-10-11. The user added Alt over a model (decision 2) and agreed that Throw counts as a Place (decision 3): a movement tool advances, pushes or throws a model, and a range tool places it.

1. **Drag selects.** At the drag start, the piece is selected with `selectPiece` (not the toggle), so a selected piece stays selected. A click still toggles. A drag of a model of the other side in a multiplayer room selects it, the same as a click on it does today. The pointer shows `grab` on every piece that a drag can move.
2. **Alt shows the card under the pointer.** Held Alt shows the card image large, in the place of the card popup, with no backdrop and no pointer events, so the hover goes on. Moving the pointer to another card shows that card. Off every card, nothing shows. The image closes when Alt is released and when the window loses focus. Cards: the tray card (the side that faces up), a roster card with an image, a setup crisis card, a crisis card at the scoring board, a Team Tactic card (the side that faces up). Alt over a model shows the card of its character, the same image as Alt over its tray card. A second model with its own card (`twoCards`) shows that card. Alt does nothing while a popup is open. The Alt key press calls `preventDefault`, so that Windows does not move the focus to the browser menu.
3. **One Place at a time.** Turning on Place on a range or movement tool turns off Place on the other own tool. Throw / Push counts as a Place too, because it uses the same drag limit: turning on one of them turns off the other one on the other tool. Place 1 of the R1 tool does not stay on, so it turns nothing off.
4. **Give click.** A click (a press with no drag) on a Give source gives 1 of that token to the character of that tray, with the same limits as a drop on it. A Give source works on the same trays as today's drag.
5. **Model turn.** The side part of the turn (tray rotation + 180) goes to the start turn of the body, so Q / E, the stored pose and the live pose include it. The model part (`cModelRot`) stays on the figure. A model that goes back to its card (Remove) gets the same start turn. A stored pose keeps its turn. Standees get only the side part, as in TTS.
6. **Labels.** The text is "Tree - Size 2 - (L)ocked" or "Tree - Size 2 - Un(L)ocked". A piece without a Size: "Tree - (L)ocked". The same text for all labels and for the hover label. The hover label finds the piece with the raycast of the L key, so a locked piece still gets no pointer handlers.
7. **Footprint color** light grey `#c8c8c8`. The user checks the look.
8. **Hover highlight.** The white `hovered` outline on every 3D piece that this browser can use with the pointer. Added: tokens (`TokenFace.jsx`, so the On row, Give sources, tokens on the table and piles), tray cards, roster cards, crisis cards, score markers, supply piles, the tools of the own rack, and the shelf dice of the own tray. Not: locked terrain, the other player's rack and dice tray.
9. **Dice tray.**
   - A number key over the own tray does Clear, then adds that many dice. Over the other tray it spawns tools, as now.
   - A click on a face plate with dice moves one die of that face back to the well (today's `reroll`). The plate opens no menu.
   - A click on a die on the own shelf opens a menu at that die: "Change to" and the 5 other faces. It changes that die. The menu closes with a click outside it and with Escape, as now. Dice in the well and in the air get no click.

## Step 1: Model turn, check and spawn

Work:

1. The check. Read the Tray Spawner scripts in the mod file (`~/Library/Tabletop Simulator/Mods/Workshop/3036795456.json`, Red and Blue): the value of `cRot` for a character tray of each seat. Read how `migrate-characters` (or the script that wrote the model GLBs) handles the root rotation and the AssetRipper X mirror. Write the numbers and the formula into the Result.
2. `src/characters/models.js`: `modelSpawnYaw(teamColor)` (the side part, radians) and `modelFigureYaw(model)` (the `cModelRot` part, radians, 0 for a standee), from the TTS formula and the conversion of `Terrain.jsx`. The mod's Red seat is the app's blue side (`src/scoreboard/board.js`). Tests in `models.test.js`: blue and red are 180° apart, a standee has no model part.
3. `Scene.jsx`: a model with no stored pose spawns with the body turn `modelSpawnYaw`. The figure gets `modelFigureYaw`. A model that goes back to its card gets the same turn.
4. Docs: `docs/features/character-trays.md` (models face the mat at spawn), `apps/web/scripts/README.md` (the rule line of `cModelRot` and item 4 of "What the app still needs").

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. Sandbox, a blue and a red roster with Angel (180), Adam Warlock (0), Doctor Strange (105), Heimdall (330) and Valkyrie and Elendil (standee). Each model on its card faces the mat.
2. The same characters in TTS: each model faces the same way relative to its tray as in the app.
3. Q / E, Remove and a new open of the room keep the turn.

If a model faces another way in TTS too, its `cModelRot` does not give the front. Then the plan gets a list of such models before step 2.

### Result

Done.

- `cRot`: the script is on the tray itself and snaps its rotation at spawn. A tray with Y in 90..270 gets 180 and is the mod's Red seat (the app's blue side). Any other tray gets 0 and is Blue (the app's red side). So the model spawn turn `tray + 180 + cModelRot` is `cModelRot` (mod Red, app blue) and `180 + cModelRot` (mod Blue, app red).
- GLBs: `migrate-characters.mjs` uses the same bundle steps as terrain (`lib/bundle.mjs`: prefab root rotation and scale are baked, the AssetRipper X mirror is not undone). So a character GLB needs the 180 deg import turn like `IMPORT_ROTATION` in `Terrain.jsx`.
- Formula (radians, around Y): body start turn `modelSpawnYaw` = `-(tray + 180)`: blue 0, red pi. Figure turn `modelFigureYaw` = `pi - cModelRot` for a model, 0 for a standee. Total for a model: blue `pi - c`, red `-c`. Before, the figure turn was `+c` and the body had none.
- `src/characters/models.js`: `modelSpawnYaw`, `modelFigureYaw`, `yawQuaternion`. `models.test.js`: 4 new tests (blue and red 180 deg apart, standee has no model part, three `cModelRot` values, blue body 0 and red body a half turn).
- `Scene.jsx`: a model with no stored pose starts with `startQuaternion(teamColor)`. `returnModels` (Remove) stores the same turn. The figure `rotation` is `modelFigureYaw(model)`. A stored pose keeps its turn. Second models and spare models use the same rule (first model's `cModelRot`).
- Docs: `docs/features/character-trays.md` ("Models face the mat", spawn line), `apps/web/scripts/README.md` (the rule line, item 4 of "What the app still needs").
- Checks: build, format, lint (40 warning lines, same as before), test 376 pass (372 before).
- Differs from the plan: one TTS exception is not built. For `twoCards` with `newCard` (Ant-Man 175, Emma Frost 180; Captain Marvel Cosmic Avenger is in the mod only), the script turns the tray by -90 or +90 and sets both models to tray + 90, with no `cModelRot`: red-seat 0, blue-seat 180. Check Ant-Man and Emma Frost in TTS against the app in the user check 2. The import turn is derived from the GLB pipeline, not seen in the browser (project rule). A standee has front at +z in the app: blue standee at body turn 0 faces its owner. Not checked against TTS.

## Step 2: Drag without select, one Place

Work:

1. `CharacterModel.jsx`, `RulerTool.jsx` (both `onPointerDown` places), `CrisisToken.jsx`: `canStart` no longer needs `selected`. A crisis token still needs `token.canMove`, a tool still needs its body. `onStart` calls a new `onDragSelect`. The hover cursor is `grab`.
2. `Scene.jsx`: `onDragSelect` selects with `selectPiece` (decision 1) for a model and a crisis token, and with `selectTool` for a tool.
3. `src/drag/pointerDrag.js`: update the comment of `canStart` ("a piece that must be selected first").
4. Place (decision 3). `Scene.jsx` keeps which own tool has Place or Throw on (`'range' | 'move' | null`). `RulerTool.jsx`: turning Place or Throw on reports it. When another tool turns it on, this tool turns its Place and Throw off. The angle tool has neither.
5. Docs: `docs/features/key-shortcuts.md` (the row "Left drag on a piece", item 2 of "Differences to decide", removed), `README.md` ("Place", and any line that says a piece must be selected first).

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. Drag a model that is not selected: it moves, and after the drop it is selected. The same for a tool and a crisis token.
2. Drag a selected model: it stays selected. A click on it still deselects it.
3. A left drag on the empty table still turns the camera.
4. A model is snapped to R3 and to S. Place on R3: the model moves to R3. Place on S: Place on R3 turns off, and the model moves to S. A drag of the model now stays on S only.
5. Throw on S, then Place on R3: Throw turns off.
6. Multiplayer room: a drag of the other player's model moves it, as before.

### Result

Done.

- `CharacterModel.jsx`, `CrisisToken.jsx`: `canStart` no longer needs `selected` (the model has none, the token keeps `token.canMove`). `onStart` calls the new prop `onDragSelect`. The hover cursor is `grab` (the token: `grab` when it can move).
- `RulerTool.jsx`: `useDragTool` has one `startPointerDrag` (the plan named two places, the second is the hover cursor). `onPointerDown(e, onSelect, onDragSelect, plan)`, `canStart` only needs the body. The cursor is `grab`. The tool props `onDragSelect`, `limitTaken` and `onLimitOn` are new.
- `Scene.jsx`: `dragSelect(kind, id)` uses `selectPiece` for a model (no side check, as a click) and a token. A tool uses `selectTool`. State `limitTool` (`'range' | 'move' | null`) gives `limitTaken` and `onLimitOn` to the two tools. The angle tool has neither.
- Place: a tool calls `onLimitOn` from an effect when `placing || throwing` turns on. The other tool sees `limitTaken` and sets `placeSide` and `throwLock` to null. Its effects then clear its own slot in `placeLimits`. The slots `range` and `move` are separate, so the cleanup of A cannot clear the limit of B. Place 1 does not set `placeSide`, so it takes nothing.
- `pointerDrag.js`: the `canStart` comment. No logic change, so no new tests.
- Docs: `key-shortcuts.md` (row "Left drag on a piece" is now Yes, item 2 of "Differences to decide" removed, the rest renumbered), `README.md` ("Selection", "Place"). Items 4 and 6 in steps 3 and 5 of this plan are now items 3 and 5.
- Checks: build, format, lint (40 warning lines, as before), test 376 pass (no new tests).
- Differs from the plan: `limitTool` is not cleared when Place turns off. It does not need to be: the next tool that turns Place on sets it. Not run in a browser (project rule).

## Step 3: Alt over a card, Give click

Work:

1. `App.jsx`: `hoveredCardRef` (`{ src, alt }` or null) and `peekCard` state. A card component reports its hover with `onCardHover(card, over)`: `CharacterTray.jsx` (the card that faces up, each card of a two-card tray), `RosterCard` (only with an image; this covers the setup crisis rows), `CrisisCard.jsx`, `TacticCard.jsx` (the side that faces up). A model (`CharacterModel.jsx`, through the model hover in `Scene.jsx`) reports the card of decision 2.
2. `handleKeyDown`: `e.key === 'Alt'` before the `altKey` return: `preventDefault`, and with no popup open, `peekCard` is the hovered card. While Alt is held, a hover change sets `peekCard`. `keyup` of Alt and the window `blur` clear it.
3. `CardPopup.jsx`: a `peek` mode with no backdrop click and `pointer-events: none` (decision 2). App renders it from `peekCard`.
4. Give click. `CharacterTray.jsx` passes the character id with the Give drag. `startTokenDrag`: `onClick` with a character id gives 1 of the token with `handleCharacterTokenGive`, then `endTokenDrag`.
5. Docs: `docs/features/key-shortcuts.md` (Alt row, item 3 of "Differences to decide" after step 2), `docs/features/character-trays.md` ("Give tokens by drag and drop": the click).

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. Hold Alt over a tray card: its card shows large. Move the pointer to a roster card: that card shows. Release Alt: it closes.
2. The same over a crisis card (scoring board and setup rows) and a Team Tactic card. A flipped card shows its face-up side.
3. Alt over a model shows its character card. Over the second model of Ant-Man, the second card.
4. A click on a card still opens its popup. Alt does nothing while a popup is open.
5. Alt held, then switch to another window: the card closes.
6. Click a Give source (Activated) below a tray: that character gets 1 Activated. A drag from the source still works.
7. Click a Give source of a token at its limit: nothing changes, the same as a drop.

### Result

Done.

- `App.jsx`: `hoveredCardRef`, `altHeldRef`, `peekCard`, `handleCardHover(card, over)`. A card is `{ src, alt, by }`. `by` names who reports it, so the end of an old hover does not clear a newer one (a model lies on a tray card with the same image). The Alt key press runs before the `altKey` return, calls `preventDefault`, and shows the hovered card when no popup and no drag is open. The `keyup` of Alt and the window blur clear it, through the existing `useWindowKeys` handlers. While Alt is held, a hover change sets `peekCard`. The render guard hides the peek while a popup or a drag is open.
- Hover reporting: `CharacterTray.jsx` (`onCardImageHover`, per card of a two-card tray, follows a Flip), `RosterCard` (only with an image, so the setup crisis rows too, through `GameSetup.jsx`), `CrisisCard.jsx`, `TacticCard.jsx` (the side that faces up, follows a flip), and the model `onHover` in `Scene.jsx`.
- `characters/files.js` `trayCardFile`, `characters/models.js` `modelCardFile` pick the card file of a model. Tests: 2 new in `models.test.js` (first model, second model with its own card, spare model).
- `CardPopup.jsx` has `peek`: class `card-popup--peek`, no backdrop, `pointer-events: none`, no click.
- Give click: `CharacterTray.jsx` passes `character.id` as the 4th argument of `onTokenDragStart` (Scene passes it through). `handleTokenDragStart` stores it as `giveId`. `startTokenDrag` `onClick` gives 1 with `handleCharacterTokenGive`, then `endTokenDrag`. The claim and the spawn are set in `onStart`, after the threshold, so a click leaves no claim and no spawn. A press without `giveId` keeps the old click.
- Docs: `key-shortcuts.md` (Alt row is Yes, item 3 removed, items 4 and 5 are now 3 and 4), `character-trays.md` (the click, how a drag starts). The reference in Step 5 is now item 4.
- Checks: build, format, lint (44 warning lines, 4 more than before: the 4 hover effects have the `[hovered]` dependency list like the other hover effects), test 378 pass (376 before).
- Differs from the plan: the model card is not updated when its character is flipped while the pointer stays on the model, until the pointer leaves and returns. Not run in a browser (project rule).

## Step 4: Labels, footprint color

Work:

1. `App.jsx`: `showLabels` starts `true`.
2. `Terrain.jsx`: the label text of decision 6.
3. Hover label. `Scene.jsx` finds the terrain piece under the pointer with the raycast of `terrainAtRef`, on pointer move, and passes its id to `Terrain`. While labels are off, only that piece shows its label. A locked piece keeps no pointer handlers.
4. `footprintProjection.js`: `FOOTPRINT_COLOR` light grey (decision 7).
5. Docs: the docs that describe Labels and the drag footprint (`docs/features/key-shortcuts.md` for L, `README.md`).

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. A new table shows the labels: "Tree - Size 2 - (L)ocked". L over the piece: the label says "Un(L)ocked".
2. Labels off: the pointer over a piece shows its label, locked or not. Off the piece, the label goes.
3. A click on a locked piece still clears the selection, as a click on the empty table.
4. Drag a model: the footprint is light grey. Over another model it is red. A tool footprint is still green or red.

### Result

Not started.

## Step 5: Dice tray clicks and keys

Work:

1. `DiceTray.jsx`: a function for the number keys that does `clear`, then `addDice(n)`. `App.jsx` calls it over the own tray.
2. `DiceKeys.jsx`: a click on a plate with dice calls `reroll(symbol)`. The plate menu goes.
3. `DiceTray.jsx` `Die`: a click on a die on the shelf of the own tray opens the menu at that die (`diceMenu` in `App.jsx` becomes `{ trayKey, dieId }`). The menu is screen-space Html at the die, as the plate menu was. `change(dieId, toSymbol)` changes that die. A camera drag that starts on a die is not a click. The click does not reach the table.
4. Docs: `docs/features/dice-rolling.md` (the plates, the menu, the line "In TTS, a click on a face count rerolls one die"), `docs/features/key-shortcuts.md` (item 4 of "Differences to decide" after step 3).

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. Roll 5 dice. Press 3 over the own tray: the tray is empty, then 3 dice are in the well.
2. Click the Hit plate (with Hits on the shelf): one Hit die goes back to the well. **Roll** throws it.
3. Click a die on the shelf: a menu with the 5 other faces. Pick one: that die changes, the shelf sorts again.
4. Escape and a click outside close the menu.
5. Multiplayer room: the other player's tray has no clicks. The other browser sees the changes.

### Result

Not started.

## Step 6: Hover highlight

Work:

1. The white `hovered` outline (decision 8) on: `TokenFace.jsx`, the tray card (`CharacterTray.jsx`, hover and selected), `RosterCard`, `CrisisCard.jsx`, the score markers (`ScoreBoard.jsx`), `SupplyPile.jsx`, the own rack tools (`ToolRack.jsx`), the shelf dice of the own tray (`DiceTray.jsx`).
2. No outline for a piece with `interactive` false, the other player's rack and dice.
3. Docs: `docs/features/key-shortcuts.md` (a short "Hover" part), `README.md` if it lists the outlines.

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, `pnpm --filter web test`.

User, after this step:

1. The pointer over each of these shows a white outline: a model, a tool, a crisis token, an unlocked terrain piece, a Team Tactic card, a token in the On row, a Give source, a token on the table, a pile, a tray card, a roster card, a crisis card, a score marker, a supply pile, a rack tool, a die on the shelf.
2. No outline: locked terrain, the table, the mat. In a multiplayer room: the other rack and the other dice tray.
3. The frame rate stays the same (Debug → frame stats) with the pointer over many pieces.

### Result

Not started.

## Open questions

1. **Delete over a dice tray** [24]. Not decided. The user thinks about it.
