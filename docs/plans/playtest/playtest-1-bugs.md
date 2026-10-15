# Plan: Bugs from the first playtest

Requested by the user on 2026-10-11. Plan 1 of `docs/plans/playtest/playtest-1.md`. Status: All parts done.

One coder step and one commit for each part. Each part writes its **Result** below when it is done.

## Requests

1. In a multiplayer room, a tool key over an enemy model (to measure the distance) selects the enemy model. It should not.
2. Cards and tokens look too bright and a bit washed out. It is all cards and all tokens. The user guesses that the material reflects too much light.

## Facts

### Tool key

- `handleToolKey` (keys 1–5, 7–9) and `handleAngleKey` (key 6) in `App.jsx`: with the pointer over a character or a crisis token, they select that piece (`selectPiece`) and spawn the tool with no point. The tool then snaps to the selected piece: `toolTarget` in `Scene.jsx` is `toolModel(selection.findLast(isToolPiece))`, passed to `RulerTool` as `target`.
- The Toward / Away tool already has a separate spawn target: `angleSpawn.target` in `App.jsx`, passed to `RulerTool` as `spawnTarget` (`Scene.jsx`). In `RulerTool.jsx`, `spawnTarget` defaults to `target`.
- **Place** moves the first selected character (`placeTarget` in `Scene.jsx`), on any side. So a selected enemy model can be moved by **Place** by mistake.
- `playedSides` in `App.jsx`: the sides this browser plays. Its own side in a multiplayer room, both sides in a single player room and in the Sandbox.

### Look

- Cards and tokens use `meshStandardMaterial` with roughness 1 and metalness 0: `CharacterTray.jsx`, `RosterCards.jsx`, `TacticCard.jsx`, `CrisisCard.jsx`, `CrisisToken.jsx`, `TokenSolid.jsx`.
- Light (`Scene.jsx`): ambient 0.85, directional 0.8, the HDR environment at intensity 0.3. The comment there says that a face that points up gets about 0.91 in total.
- Tone mapping: ACES Filmic. The `ToneMapping` pass of the composer does it (`SelectionOutlines.jsx`). When the composer is off, the renderer does it.
- Most color maps load through `useColorTexture`, which marks them sRGB before the upload. It fixed the "too light after a flip" bug. `CrisisCard.jsx` and the VP marker (`ScoreBoard.jsx`) use plain `useTexture`. Their map is on a material from the first render, so R3F marks it sRGB before the upload. So the upload bug is not the likely cause.
- A calculation on 2026-10-11, with the three.js r169 formulas and a light of 0.91: ACES keeps mid tones close to the texture color (sRGB 128 → 134). It makes dark colors darker (40 → 20) and white dimmer (245 → 220). So ACES alone does not wash out the colors.
- `meshStandardMaterial` always reflects some light (specular): about 4% when seen straight on, more at a flat angle. The HDR and the directional light then add a little white on top of the texture. The amount is the same for dark and light texels, so the dark parts get lighter the most. This matches "washed out" and the guess of the user. It is not measured.
- postprocessing 6.39.5 has the tone mapping modes `ACES_FILMIC`, `AGX` and `NEUTRAL`. Neutral (Khronos PBR Neutral) is made to show base colors as they are.
- Debug mode (dev server only) has `DebugPanel` with a render mode switch (`src/debug/DebugPanel.jsx`, `renderMode` in `App.jsx`).

## Decisions

1. **Tool key over a model of the other side.** When this browser does not play the side of the model under the pointer, the tool snaps to that model, and the selection does not change. Over an own model or a crisis token, the key works as now: it selects the piece and snaps the tool to it. The same applies to key 6. In a single player room and in the Sandbox, both sides are played, so nothing changes there.
   - Range and movement tools get a spawn target, the same way as the Toward / Away tool. A key sets it, and `Scene.jsx` passes it as `spawnTarget`. A toolbar button and a free spawn set no spawn target, so they work as now.
2. **Look: compare first, then choose.** The user compares options in debug mode and chooses by eye. The numbers above do not decide it. The options:
   - Tone mapping: ACES Filmic (now), Neutral, AgX.
   - Card and token surface:
     - Standard: as now.
     - Matte: `meshPhysicalMaterial` with `specularIntensity` 0, so no reflection. The rest of the light stays.
     - Unlit: `meshBasicMaterial` with `toneMapped` false. Shows the exact image colors, with no light and no shadow.
   - All card and token meshes use one shared material component, so that the switch reaches all of them. The component stays after the choice, so the look of all cards and tokens is set in one place.
3. **After the choice,** the chosen options become the default for everyone. All options and the two debug switches stay, so that the look can be compared again. The user may later move the switches to the settings, for every player. That is not part of this plan. The code comment at the light in `Scene.jsx` names the choice and points to this plan. (Changed by the user on 2026-10-11, after Part 2. The first version removed the options that were not chosen and the switches.)

## Part 1: Tool key over an enemy model

Work:
1. `App.jsx`: `handleToolKey` and `handleAngleKey`. Over a character of a side not in `playedSides`: no `selectPiece`. Keep the hovered piece as the spawn target of that tool kind (range, move, angle). Over an own piece: as now.
2. `Scene.jsx`: pass the spawn target to the range and the movement tools as `spawnTarget`, as `angleSpawn.target` is passed today. A spawn without a key has no spawn target, so `RulerTool` uses `target` as now.
3. Docs: `docs/features/key-shortcuts.md`, table "Keyboard: keys of the mod" and the line "The piece does not have to be selected first: the key selects it". Add the rule for the other side's models.

**Result:** Done. `App.jsx`: new state `toolSpawn` ({ range, move }), set by `handleToolKey` over a piece and cleared by the toolbar buttons and the free spawn. `keySelects` skips `selectPiece` over a model of a side not in `playedSides`, in `handleToolKey` and `handleAngleKey`. `Scene.jsx`: prop `toolSpawn`, passed as `spawnTarget` to `RangeRuler` and `MovementRuler`; `undefined` without a spawn target, so `RulerTool` falls back to `target`. Doc: `docs/features/key-shortcuts.md`.

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, the web tests.

User, after this part:
1. Multiplayer room, two browsers. Red holds the pointer over a Blue model and presses 3. The R3 tool snaps to the Blue model. The Blue model is not selected on either screen.
2. The same with 7 (movement tool) and 6 (Toward / Away).
3. Red presses 3 over an own model: the model is selected and the tool snaps, as before.
4. Red selects an own model, then presses 3 over a Blue model. The own model stays selected. **Place** on the tool moves the own model, not the Blue model.
5. Sandbox: 3 over a Red model selects it and snaps the tool, as before.

## Part 2: Look options in debug mode

Work:
1. A shared material component for the face of a card or a token (map, side, alphaTest, transparent). Use it in `CharacterTray.jsx`, `RosterCards.jsx`, `TacticCard.jsx`, `CrisisCard.jsx`, `CrisisToken.jsx` and `TokenSolid.jsx`. Edges and plain colors keep their materials.
2. Two debug switches in `DebugPanel`: tone mapping (ACES Filmic, Neutral, AgX) and surface (Standard, Matte, Unlit). The default is ACES Filmic and Standard, so the normal app does not change.
3. The tone mapping switch sets the mode of the `ToneMapping` pass (`SelectionOutlines.jsx`), and of the renderer when the composer is off.

**Result:** Built. New `scene/look.js` (module store `{ toneMapping, surface }`, default `aces` + `standard`, read with `useLook`; React context does not cross the R3F v8 `<Canvas>`) and `scene/FaceMaterial.jsx` (standard, matte or unlit face material). `FaceMaterial` replaces the face materials in `CharacterTray.jsx`, `RosterCards.jsx`, `TacticCard.jsx`, `CrisisCard.jsx`, `CrisisToken.jsx` and `TokenSolid.jsx`. `App.jsx` holds the two switches and writes them to the store (the default when debug is off). `DebugPanel.jsx` has the two button groups. `SelectionOutlines.jsx` sets `mode` on the `ToneMapping` effect through a ref (passes are not rebuilt), and `gl.toneMapping` when the composer is off. Unlit sets `toneMapped={false}`, but with the composer on the scene goes to a render target and the `ToneMapping` pass maps the whole image, so the flag has no effect. Unlit skips tone mapping only in the "No composer" render mode.

The choice of the user: tone mapping **Neutral**, surface **Unlit**. The switches stay in debug mode (Decision 3).

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, the web tests.

User, after this part:
1. Dev server, debug mode on. Switch the tone mapping and the surface. Look at the character cards, a roster card, a Team Tactic card, a crisis card, crisis tokens and character tokens. Compare with the image files and with TTS.
2. Choose one tone mapping and one surface. Write the choice in the **Result** of this part.

## Part 3: Apply the chosen look

Facts (a calculation with the three.js r169 formulas, not measured):
- three.js ACES Filmic multiplies the color by 1 / 0.6 before the curve. Neutral does not. So Neutral shows lit surfaces darker. At a light of 0.91 (a face that points up), a mid tone (sRGB 128) shows as about 110 with Neutral, and about 134 with ACES. This applies to the models, terrain, the mat, the dice and the dice trays.
- An Unlit card or token under Neutral: sRGB 128 shows as about 116, and white as about 240.

Work:
1. `look.js`: `DEFAULT_LOOK` becomes Neutral and Unlit. All options and the two debug switches stay. In debug mode, the switches start at the new default.
2. `SelectionOutlines.jsx`: the `ToneMapping` pass starts with the mode of `DEFAULT_LOOK`, not with ACES Filmic, so the first frame already has the right tone mapping.
3. Comments in `look.js`, `FaceMaterial.jsx` and `SelectionOutlines.jsx`: the switches are no longer temporary. Name the default and point to this plan.
4. The comment at the light in `Scene.jsx`: the tone mapping is Neutral, and the cards and tokens are Unlit, so the light does not change them. The light numbers now apply to the models, terrain, the mat and the dice. Point to this plan.

**Result:** Done. `look.js`: `DEFAULT_LOOK` is `neutral` + `unlit`; the debug switches start there. `SelectionOutlines.jsx`: the `ToneMapping` pass starts with the mode of `DEFAULT_LOOK`; null guard in the mode effect. Comments in `look.js`, `FaceMaterial.jsx`, `SelectionOutlines.jsx` and at the light in `Scene.jsx` name the default.

Checks: `pnpm --filter web build`, `pnpm format`, `pnpm lint`, the web tests.

User, after this part:
1. Without debug mode, cards and tokens look the same as Neutral and Unlit in Part 2.
2. In debug mode, the switches start at Neutral and Unlit. The other options still work.
3. Dice, dice trays, terrain, the mat and the models still look right. They are a bit darker than before (see Facts). If they are too dark, a brighter light is a new request.
