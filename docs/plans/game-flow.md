# Plan: Game flow

Requested by the user on 2026-10-12. Plan 4 of `docs/plans/playtest-1.md`. Status: OK by the user on 2026-10-12, in progress. Branch `game-flow`, from `setup-round-2` at `2c8f5d0`.

The branch starts from `setup-round-2`, not from main, because this plan needs its roll off, `setup.priority` and the side keys `host` / `guest`. `setup-round-2` merges into main first. Then this branch merges main.

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step: `pnpm format`, `pnpm lint`, `pnpm test`, `pnpm --filter web build`.

## Request

The answers of the user are in `docs/plans/playtest-1.md`, "Plan 4: Game flow". In short:

- **Priority marker** [7]. A marker shows who has Priority. The roll off sets it. In the Cleanup Phase it passes when the player who activated the last character has it (p12). A click changes it.
- **Drop of objective tokens** [32]. A Dazed or KO'd character drops its objective tokens. The other player places them within Range 2. S.H.I.E.L.D. Agents and The Black Widow: the controlling player places them. Trigger: the Dazed token, or **Remove**. A Range 2 tool snaps to the base, and the drag stays within Range 2. With **Remove**, the model stays until the token is placed. A HUD notice with **Show**, and a sound. The user tests how it feels before keeping it.
- **Log** [20]. A shared log in a panel that can collapse: dice, Power and Damage, tokens, Activated, phase buttons, setup steps.
- **Sounds** [17, 29]. Dice, ping, a token put on a character. Both players hear the token sound. Free license files.
- **Ping** [15]. Key **P**. A down arrow that bounces at the pointer for about 3 s, in the side color. Both players see and hear it.

## Facts

### Priority

- `setup.priority` is the roll-off winner and sets the colors for the whole game (`src/setup/setup.js`, `priorityOf`, `colorOf`). Decision 3 of `setup-round-2.md`: the Priority token of the game is a different field, because it moves in the Cleanup Phase and the colors must not move with it.
- Writers of `setup.priority`: `setPriority` (manual buttons, `handleSetupPriority` in `App.jsx`), `setRollOff` (the roll-off effect in `App.jsx`), `overrideTo` and `newSetup` clear it.
- `table.game` is a record with `GAME_FIELDS` (`src/net/doc.js`) and start values in `startTable` (`src/rooms/table.js`). No round number or phase is stored. The round is the place of `scoreMarkers.round`.
- Nothing records who activated last. The Activated token is `ch.tokens.activated`, set only by `handleCharacterTokenGive` in `App.jsx`.
- `handleCleanupPhase` in `App.jsx` does the whole Cleanup in one `table.transact`.
- TTS: the "Priority Token" is a `Custom_Model`, a coin mesh 1 × 0.1 × 1 at scale 1.25, so 1.25" wide and 0.125" thick. Mesh and texture are in the TTS cache:
  - mesh `Mods/Models/httpssteamusercontentaakamaihdnetugc1017195921940355346B89DC0907D04E4273E6C957FFA81E866A7EFCC0E.obj`
  - texture `Mods/Images/httpssteamusercontentaakamaihdnetugc4043916167639133074F25809C7A8DC1138EAC94EE8EE3B9273E82C0.png`, 1024 × 1024. The bottom half has two equal faces (a yellow star on blue). The top half is black.
- TTS script of the token: it starts on the scoring board (TTS (-21.92, 7.57)). Buttons move it to (-17, ±19), next to the mat corner on the side of the player who has it. TTS moves it in the Cleanup Phase to the player with fewer characters left to activate. The app follows the rule (p12) instead.
- Scoring board: `BOARD_X = -23.125`, z from -9 to 9, x from -27.1 to -19.1 (`src/scoreboard/board.js`). The board strip (Cleanup, Deploy Lock, mat turn) is at x -20.6 … -18.3, z ±12.6 … 18 (`boardStrip` in `src/tabletools/layout.js`). The VP markers are 1.2" round tiles (`ScoreBoard.jsx`, `scripts/migrate-scoreboard.mjs`).

### Log

- The dice history is the Yjs list `rolls` (`src/dice/history.js`, entries `{ id, side, at, kind, … }`, text from `entryText`). `RollsPanel.jsx` shows it in the right column (`.rolls`, right 12px, top 56px), opened by the toolbar chip **Rolls** and closed by Escape. The list has no length limit.
- The roll-off reader in `App.jsx` reads new `throw` entries of `rolls`.
- No single place writes character state. Each handler in `App.jsx` calls `setCharacters` itself: `handleCharacterDamage`, `handleCharacterPower`, `handleCharacterFlip`, `handleCharacterTokenGive`, `handleCharacterTokenRemove`, `handlePowerPhase`, `handleCleanupPhase`, `handleCharacterOffBoard`, `handleCharacterRemove`. Objective tokens: `handleTokenHold`, `handleSupplyTake`, `handleTokenMove`, `handleDropCharacterTokens`.
- Setup handlers: `handleSetupPriority`, `handleSetupDeck`, `handleSetupPick`, `handleSetupThreat`, `handleSetupEdge`, `handleSquadReady`, `handleSetupAffiliation`, `handleSetupRestart`, `handleSetupOverride`. Effects that run in both browsers: the roll-off read, the squad reveal, Deploy Lock on.
- A new Yjs list needs no schema change: an old document has an empty map. Three edits: `src/net/doc.js`, `fillTable`, `startTable`.
- Names: `playerName`, `possessive`, `says` in `src/setup/names.js`, with `ctx = { mySide, players, peer, colors }` (built by `useNames` in `GameSetup.jsx`). "You" depends on the viewer, so an entry stores sides, and the text is made when it shows.

### Sounds and ping

- The app has no audio code and no sound files.
- Free sound files with the CC0 license (no credit needed), by Kenney:
  - Casino Audio: `https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip`. Has `dice-throw-1..3`, `dice-shake-1..3`, `chip-lay-1..3`, `chips-stack-1..6` and others (`.ogg`).
  - Interface Sounds: `https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip`. Has `bong_001`, `question_001..004`, `confirmation_001..004` and others.
  - `ffmpeg` is installed (`/opt/homebrew/bin/ffmpeg`).
- Dice: a local throw starts in `roll()` of `DiceTray.jsx`. A remote throw starts when `OtherDiceTray.jsx` (`applyEntry`) sees a die go to `air`.
- Settings: localStorage key `mcp-assist-3d/settings`, `defaultSettings` and `normalize` in `src/settings/settings.js`, UI in `SettingsPopup.jsx`.
- Key **P** is free. TTS uses it for the camera mode. Keys are in `handleKeyDown` of `App.jsx`. The key list of the settings is `KEY_ROWS` in `src/settings/controls.js`.
- The table point under the pointer: `toolPointRef.current.atPointer()` (`ToolPoint.jsx`) returns `{ x, z }` and drops `y`. `tablePoint` in `src/drag/tablePoint.js` has `y` (terrain).
- Network: awareness (`src/net/presence.js`) is reliable and ordered and has fields such as `mark`. The `live` channel (cursor) drops packets. Sandbox and single player rooms have no network: `createPresence({})` does nothing.

### Drop of objective tokens

- A crisis token in the Yjs list `tokens` has `canHold`, `heldBy` (character id) and `heldAt`. Only Extract tokens that can move (Asset, Civilian) and Source supply tokens can be held.
- `handleTokenDrop` puts a token next to the model (base radius + `DROP_GAP`, along +x). `handleDropCharacterTokens` drops all held tokens of a character in a row. **Remove** (`handleCharacterOffBoard`) calls it, then `returnModels` (`Scene.jsx`) puts the models back on the tray.
- Every way to give Dazed goes through `handleCharacterTokenGive`.
- Deploy Lock clamps a model drag in `constrainDrag` (`Scene.jsx`, called by `CharacterModel.jsx`). A crisis token drag has no clamp hook: `CrisisToken.jsx` writes the pointer point into its pose.
- Either player can drag any model or token today (`docs/features/peer-to-peer.md`). Only tools are per side.
- `placeTool('range', 2, { kind: 'character', id }, null)` in `App.jsx` spawns the own Range 2 tool snapped to a model. Only the own side's tools can be written (`setOwnTool`).
- Range 2 tool: `RANGE_TIP[2] = 1.501` (half length, `src/tabletools/toolTips.js`). The reach from the base edge comes from the snap pose (`snapPose`, `RulerTool.jsx`).
- `showHudMessage` shows text only, with `pointer-events: none`. No component moves the camera to a point. `resetCamera` in `App.jsx` and `panOnTable` in `src/camera.js` are the closest.
- Jarvis text (`statCard.<side>.superPowers[i].body`):
  - S.H.I.E.L.D. Agents (`shield-agents-grunts`), "Buy You Time": "When this character drops an objective token, its controlling player Places it on the battlefield instead of their opponent."
  - The Black Widow (MCT `01430109`), both sides, "All that Matters is the Mission": "When this character would drop an objective token, its controlling player chooses where to Place the token instead of their opponent."
  - Only these two characters have "instead of their opponent".
  - The app cannot spawn either today: S.H.I.E.L.D. Agents has no `exportCode`, The Black Widow has no model. So only unit tests check the exception.

## Decisions

1. **Two Priority fields.** `setup.priority` stays the roll-off winner and sets the colors. New `game.priority: null | side` is the marker. The roll off and the manual buttons set both. **Restart setup** and **Override** to the roll off clear both. After that, only the Cleanup and a click change `game.priority`.
2. **Last activator.** New `game.lastActivated: null | side`. Giving the Activated token writes the side of the character (not of the browser), in the same transaction. Cleanup: if `lastActivated` equals `priority`, Priority passes to the other side. Then `lastActivated` is cleared. Taking an Activated token away does not change it. Players fix a wrong marker with a click.
3. **Marker place.** Two spots, one for each side, next to the end of the scoring board nearer that side. The marker slides to its spot when Priority changes, in both browsers. Before the roll off (`game.priority` null) there is no marker. Old documents: `game.priority` missing → `priorityOf(setup)`.
4. **Marker click.** Any player, also in a multiplayer room, because cards such as All According to Plan change Priority. A click gives Priority to the other side. No confirm. Title: "Nelly has Priority. Click to give it to you." Hover outline, as other pieces.
5. **The Log replaces the Rolls panel.** One panel in the right column. It shows `rolls` (dice) and the new list `log` (the rest), merged by time, newest first. The dice code and the roll-off reader do not change.
6. **Collapse.** Collapsed: a one-line bar at the top of the right column with the newest entry. Expanded: the whole list. A click on the bar, or the toolbar chip **Log** (was **Rolls**), expands it. Escape and a button collapse it. The state is per browser (localStorage).
7. **Entry data, not text.** An entry stores `{ id, at, by, kind, … }`: `by` is the side of the browser that wrote it (null in the Sandbox and a single player room), plus sides, character id and character name. The text comes from the names when it shows, so "You" is right in each browser.
8. **One entry for many clicks.** Damage and Power clicks on one character by one player within 10 s change the last entry ("Hulk Damage 2 → 5"). Back to the start value removes the entry.
9. **No double entries.** Effects that run in both browsers write an entry with a fixed id (for example the roll off: setup id and throw id), so two writes make one entry.
10. **Length.** `log` keeps the newest 300 entries. A write that goes over removes the oldest in the same transaction. `rolls` does not change.
11. **Sound files.** Kenney CC0, converted to `.mp3` (Safari decodes it, it is not sure for Ogg). In `src/assets/sounds/`, with a `README.md` that names the source and the license.
12. **Which sounds.**
    - Dice throw: `dice-throw-1..3`, a random one, at the start of a throw, local and remote.
    - Token put on a character: `chip-lay-1..3`.
    - Activated put on a character: `chips-stack-1..3`, different from other tokens, so the other player knows that a character was activated.
    - Ping: `bong_001`.
    - Drop notice for the placing player: `question_001`.
    The user listens and asks for other files if needed.
13. **Token sounds come from the log.** Each browser plays a sound for each new `log` entry of a token put on a character, local or remote. Entries that exist when the table opens, and entries older than 5 s, play nothing. So both players hear the same sound from one source.
14. **Volume.** A **Sound** slider in the settings menu, 0 to 100, default 60. 0 is off. Stored in the browser.
15. **Browsers block sound until the first click or key.** The app makes its audio context at the first `pointerdown` or `keydown`. Sounds before that are skipped.
16. **Ping on the network.** The awareness field `ping: { id, at: [x, y, z], t }`, reliable, the same way as `mark`. A browser shows a ping when its id is new and it is younger than 3 s. A new ping replaces the player's last one. In the Sandbox and a single player room the ping shows only locally. With the pointer off the table: no ping.
17. **Who places a dropped token.** The opponent of the character's side. The controlling player when the superpower text of the side that faces up has "instead of their opponent" (new module `src/characters/dropPlacer.js`, the same way as `immunity.js`).
18. **A token that waits for its place.** Two new token fields: `placeBy: null | side` and `placeFrom: { characterId, x, z, radius, offBoard }` (the base centre and radius when it dropped). While `placeBy` is set:
    - Only a browser that plays `placeBy` can drag it.
    - A release never holds it, it lies on the table.
    - A release, or **Done** in the notice, clears `placeBy`. The token is placed.
19. **Triggers.** The Dazed token on a character that holds tokens, and **Remove** on a character that holds tokens. Both drop the tokens in the same transaction as the Dazed token or the Remove. Dragging a held token off a card stays as today (no wait, no clamp).
20. **Remove waits.** With held tokens, **Remove** leaves the models on the board and sets `placeFrom.offBoard`. When the last waiting token of that character is placed, the browser that placed it puts the models back on their cards (as **Remove** today). While it waits, **Remove** is disabled, with the title "Waiting for Nelly to place Hulk's Asset".
21. **Notice.** A HUD notice that takes clicks, one line per character, while tokens wait:
    - For the placing player: "Place Hulk's Asset within Range 2" with **Show** and **Done**, and the notice sound once.
    - For the other player: "Waiting for Nelly to place Hulk's Asset" with **Show**.
    - **Show** moves the camera target to the token, smooth, and keeps the camera angle and distance.
22. **Range 2.** When a waiting token appears for a side this browser plays, its own Range 2 tool snaps to the model once. The drag of the token is clamped so that some part of the token stays within Range 2 of the base edge: centre distance at most base radius + Range 2 + token radius. Range 2 is the reach of the snapped Range 2 tool, not a new number.

## Step 1: Priority marker

Work:

1. Asset: `scripts/migrate-scoreboard.mjs` also writes `src/assets/scoreboard/priority.webp`, one face cropped from the TTS texture (see Facts). The marker is a cylinder 1.25" wide and 0.125" thick, drawn like the VP markers. No GLB is needed.
2. `src/net/doc.js` `GAME_FIELDS` and `src/rooms/table.js` `startTable`: `priority: null`, `lastActivated: null`.
3. New plain module `src/game/priority.js`: `gamePriority(game, setup)` (decision 3, old documents), `priorityAfterCleanup(priority, lastActivated)`. Tests.
4. `App.jsx`:
   - The roll-off effect and `handleSetupPriority` also set `game.priority`, in the same transaction.
   - `restartSetup` and an Override to `rollOff` set `game.priority` and `game.lastActivated` to null.
   - `handleCharacterTokenGive` with `activated` sets `game.lastActivated` to the character's side, in one transaction with the token.
   - `handleCleanupPhase` passes Priority (decision 2) and clears `lastActivated`. The HUD message adds "Priority passes to Nelly." or "Nelly keeps Priority.", with names.
   - `handlePriorityClick`: gives Priority to the other side.
5. Spots: `priorityMarkerSpot(side)` in `src/tabletools/layout.js` or `src/scoreboard/board.js`. Tests: inside the table, mirror of the other side, no overlap with the board, the board strip, the VP marker start places and the setup panel.
6. New component `PriorityMarker.jsx`, used in `Scene.jsx`: hidden when Priority is null, slides to the spot in about 0.4 s when it changes, click (decision 4), hover outline, title with names.
7. Docs:
   - `round-phases.md`: Cleanup step 4 is built, a new section "Priority marker", remove the Priority token from "Not built yet" and "Out of scope", TTS difference.
   - `setup-game.md`: the roll off also sets the marker, remove "The Priority token on the scoring board" from "Not built yet", the two fields.
   - `key-shortcuts.md`: the marker in the hover list.

Checks: as in "Checks".

User, after this step:
- Roll off: the marker appears on the winner's side.
- Click on the marker: it moves to the other side, in both browsers.
- Activate a character of the player with Priority last, press **Cleanup**: Priority passes. Activate a character of the other player last: Priority stays.
- **Restart setup**: the marker goes away.

### Result

Built, as planned. Checks pass. No browser test was done.

- Asset: `scripts/migrate-scoreboard.mjs` writes `src/assets/scoreboard/priority.webp` (256 × 256), the left face of the TTS texture, cut at 512 × 512 from y 512. `PRIORITY_TEXTURE` is in `src/scoreboard/files.js`. The corners of the face are transparent, so `TokenSolid` finds a round outline.
- Fields: `priority` and `lastActivated` in `GAME_FIELDS` (`src/net/doc.js`), `startTable`, `doc.test.js` and `scripts/yjs-size.mjs`.
- `src/game/priority.js`: `gamePriority`, `priorityAfterCleanup`, and two text helpers, `priorityNote` (the Cleanup message) and `priorityTitle` (the hover title), both with names from `setup/names.js`. Tests in `priority.test.js`.
- Spots: `priorityMarkerSpot(side)` and `PRIORITY_MARKER_SIZE` in `src/scoreboard/board.js`. Host (+z) spot is x -18.7, z 10.8. Guest is x -18.7, z -10.8. The marker is 1.25" wide. Tests in `layout.test.js`: inside the table, mirror, by the board end, and no overlap with the board, the board strip, the setup panels, the VP marker start places, the supply piles, the crisis cards and the racks.
- `PriorityMarker.jsx` in `Scene.jsx`: hidden when Priority is null, slide of about 0.4 s, click, hover outline and pointer cursor. The edge has the color of the side that has Priority.
- `App.jsx`: the roll-off effect and `handleSetupPriority` write both fields in one transaction. `restartSetup` and an Override to `rollOff` clear both. `handleCharacterTokenGive` sets `lastActivated` to `character.team`. `handleCleanupPhase` passes Priority and adds the sentence to the HUD message. `handlePriorityClick`.
- Docs: `round-phases.md` (new section "Priority marker"), `setup-game.md`, `key-shortcuts.md`, `scripts/README.md`.

Deviations:

- The spot is not next to the end of the board itself: the crisis card and its supply pile lie there (z 9.5 … 12.25, x up to -19.4). The marker lies beside them, at the mat edge (x -18.7, 0.3" from the mat edge at -18). It is the free place nearest to the board end.
- The hover title is the native title of the canvas, set while the pointer is on the marker. A 3D piece has no DOM element for `title`.
- The migrate script was run with the current TTS cache, which has 36 affiliation tokens, not 34. The two new ones (Intelligencia, Thunderbolts) are not part of this step and were left out of the commit (`affiliations.json` and their images are unchanged).

## Step 2: Log panel, setup, phase and Priority entries

Work:

1. Yjs: `log: createList(doc.getMap('log'))` in `src/net/doc.js`, `fillTable`, `startTable`.
2. New plain module `src/log/log.js`: entry builders, `logText(entry, names)`, the 300 limit (decision 10), fixed ids (decision 9). Tests.
3. Move `useNames` from `GameSetup.jsx` to a shared place (for example `src/setup/useNames.js`), so the Log can use it.
4. New `components/LogPanel.jsx` replaces `RollsPanel.jsx`: `rolls` and `log` merged by `at`, newest first; dice entries keep `entryText` and the side color border; collapse (decision 6). Toolbar chip **Rolls** becomes **Log**. CSS in `index.css`.
5. Entries in `App.jsx`, each in the same `table.transact` as its change:
   - Setup: the roll-off result, manual Priority, deck, first card, second card, Maximum Threat, edge, squad ready, squads revealed, affiliation, deployment done, Override, Restart.
   - Power Phase: one entry per side with the gains ("Power Phase (Nelly): Hulk 4 → 7, Angela 2 → 4").
   - Cleanup: round, flipped characters, Priority.
   - Priority click.
6. Docs:
   - New `docs/features/game-log.md`: what is logged, entry data, collapse, limit, names.
   - `dice-rolling.md`: the history shows in the Log panel.
   - `peer-to-peer.md`: the `log` list in the table of the document.
   - `key-shortcuts.md`: Escape collapses the Log.

Checks: as in "Checks".

User, after this step:
- Two browsers: do the whole setup. Each step shows in the Log of both browsers, with "You" in one and the name in the other.
- Dice throws show in the Log as before.
- Collapse and expand the Log. Reload: the state stays.

### Result

(empty)

## Step 3: Character entries in the log

Work:

1. Entries in `App.jsx`, each in the same `table.transact` as its change. Handlers that call only `setCharacters` today get a transaction.
   - Damage and Power, with the merge of decision 8.
   - Card flip (Healthy / Injured).
   - A token put on and taken off a character: Activated, Dazed, special conditions, other tokens. With the count for counted tokens.
   - An objective token held, and dropped from the card.
   - **Remove** from the board, and a character deleted.
2. `src/log/log.js`: the merge rule and the new kinds. Tests for the merge (same character and stat within 10 s, another player, another stat, back to the start value).
3. Docs: `game-log.md`.

Checks: as in "Checks".

User, after this step:
- Click `+` on Damage 3 times: one entry "Hulk Damage 2 → 5". Click `−` back to 2: the entry goes.
- Give Activated, Dazed and a condition: one entry each, in both browsers.
- Pick up an Asset and press **Remove**: both show.

### Result

(empty)

## Step 4: Sounds

Work:

1. Download the two Kenney zips (Facts) into a new empty folder outside the repo. Convert the files of decision 12 to mono `.mp3` with `ffmpeg` into `src/assets/sounds/`. Add `src/assets/sounds/README.md` (source URLs, CC0, the `ffmpeg` command). Keep the files small (a few KB each).
2. New `src/sound.js`: one `AudioContext` made at the first `pointerdown` or `keydown` (decision 15); buffers fetched and decoded once; `playSound(name)` picks a random file of the group and uses the volume; the same group plays at most once per 80 ms.
3. Settings: `sound: { volume }` in `defaultSettings` and `normalize` (`src/settings/settings.js`), a **Sound** slider in `SettingsPopup.jsx`. Tests in `settings.test.js`.
4. Dice: `roll()` in `DiceTray.jsx` plays the throw sound. `OtherDiceTray.jsx` plays it once when a remote throw starts.
5. Tokens: a hook (for example `useLogSounds(log)`) plays decision 12 sounds for new token entries (decision 13). Activated has its own sound. A held objective token uses the token sound.
6. Docs: new `docs/features/sounds.md` (files, license, which event plays what, volume, the first-click rule). `ASSETS.md` if it lists asset folders.

Checks: as in "Checks".

User, after this step:
- Throw dice: a dice sound, in both browsers.
- Give a token: a chip sound in both browsers. Give Activated: another sound.
- The **Sound** slider changes the volume. 0 is silent.

### Result

(empty)

## Step 5: Ping

Work:

1. `ToolPoint.jsx`: a way to get the point under the pointer with `y` (terrain top).
2. Key **P** in `handleKeyDown` (`App.jsx`), not on repeat: a ping at that point, in the color of the own side (`ownSide`).
3. New `components/Ping.jsx`, used in `Scene.jsx`: a down arrow above the point that bounces, and a ring on the surface, for 3 s, then fades. Color from `useSideColor`. The ping sound plays at the start.
4. Network: the awareness field `ping` (decision 16) in `src/net/presence.js`, sent on P, shown by the other browser.
5. `src/settings/controls.js` `KEY_ROWS`: P.
6. Docs: new `docs/features/ping.md`. `key-shortcuts.md`: P row ("Ping", Same: No). `peer-to-peer.md`: the awareness field. `sounds.md`: the ping sound.

Checks: as in "Checks".

User, after this step:
- Press P over the mat and over terrain: an arrow in your color, about 3 s, with a sound.
- Two browsers: the other browser sees and hears it, at the same place.
- P with the pointer off the table: nothing.

### Result

(empty)

## Step 6: Drop of objective tokens: wait, notice, Remove

Work:

1. New plain module `src/characters/dropPlacer.js`: `dropPlacer(character, jarvisRow)` returns `'opponent'` or `'controller'` (decision 17). Tests: The Black Widow both sides, S.H.I.E.L.D. Agents, Hulk.
2. Token fields `placeBy` and `placeFrom` (decision 18). `handleDropCharacterTokens` takes the placing side and `offBoard`.
3. Triggers (decision 19) in `handleCharacterTokenGive` (Dazed) and `handleCharacterOffBoard` (**Remove**), each in one transaction with the drop.
4. `CrisisToken.jsx`: while `placeBy` is set, only a browser that plays `placeBy` can start a drag. A release lies on the table and clears `placeBy`.
5. **Remove** waits (decision 20): the models stay; when the last waiting token of the character is placed, the models go back to the tray (`returnModels`). The **Remove** button is disabled with the title.
6. New `components/HudNotice.jsx` (decision 21), in `App.jsx`. **Show** uses a new camera function in `src/camera.js` (target to a point, smooth, same angle and distance). **Done** clears `placeBy`.
7. Notice sound (decision 12) for the placing player, once per drop.
8. Log: "Hulk dropped the Asset. Nelly places it." and "Nelly placed Hulk's Asset."
9. Docs:
   - `character-trays.md`, "Hold and drop": the wait, who places, the notice, Remove.
   - `round-phases.md`, decision 16: **Remove** waits for the place.
   - `crisis.md`, the Drop row: the app does it.
   - `game-log.md`, `sounds.md`.

Checks: as in "Checks".

User, after this step:
- Two browsers. Hulk holds an Asset. Give Hulk the Dazed token: the Asset drops next to Hulk. The other player gets the notice and the sound, and only they can drag it. **Show** moves their camera to it. A release places it, and the notice goes.
- Hulk holds an Asset. Press **Remove**: Hulk stays. After the other player places the Asset, Hulk goes back to his card.
- **Done** places the token where it lies.

### Result

(empty)

## Step 7: Drop of objective tokens: Range 2 tool and drag limit

Work:

1. When a waiting token appears for a side this browser plays, its Range 2 tool snaps to the model, once per drop (`placeTool('range', 2, …)`).
2. A plain function, for example `clampToRange(point, centre, maxDistance)`, with tests. Find Range 2 from the tool constants and the snap pose (decision 22) and write the number in the Result.
3. `CrisisToken.jsx` gets a `constrainDrag` prop. `Scene.jsx` passes the clamp for a waiting token.
4. Docs: `character-trays.md`, "Hold and drop": the tool and the limit.

Checks: as in "Checks".

User, after this step:
- When the Asset drops, your Range 2 tool snaps to Hulk.
- Drag the Asset away: it stops at Range 2.
- After the Asset is placed, it drags freely again.

### Result

(empty)

## Open questions

None. The user accepted the decisions on 2026-10-12.
