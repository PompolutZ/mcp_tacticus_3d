# Step 10: Dice

Detailed plan of step 10 in `docs/plans/implement-backend.md`. Peer-to-peer phase 4. The design is in `docs/feature-peer-to-peer.md` ("Yjs document", "Moving objects (physics)", "Bodies moved by the other browser", "Pose message", "Dice", "What each player controls") and `docs/feature-dice-rolling.md`. Decisions 1, 3, 4 and 7 change parts of the design.

## Goal

Each player rolls in their own tray. The other player sees the dice fly, bounce and land, and sees the same face on each die. The shelf and the counts on the tray are the same on both screens. The results on the shelf stay after a reload or a lost connection. Both players see one roll history.

After step 9:
- Dice are React state and refs in `DiceTray.jsx`. They are not in the Yjs document, so the other player does not see them, and a room does not keep them.
- Each browser has its own dice. The number keys add dice to the Blue tray only (`PLAYER_TEAM` in `Scene.jsx`).
- Known bug: Bob (Red) holds the pointer over his tray and presses a number key. A range tool spawns, not dice.
- There is no roll history. The HUD panel with the history was removed on 2026-10-02.

The step comes after step 9, because it uses the live channel of step 9.

## Scope

In the step:
- Dice in the Yjs document, per side. The room keeps the shelf. Dice in the well and in the air are not restored (decisions 1 to 3).
- The roll history in the document, in a panel like the Library (decision 4).
- The own tray and the other player's tray. The other tray shows the dice and the counts, and its keys do nothing (decisions 5, 6).
- Dice in flight on the live channel (decision 7).
- The number keys over any own tray. This fixes the known bug.
- Docs.

Left for later:
- A logging feature. The user plans it. It defines what the game logs, and can replace or extend the roll history.
- Picking up and dragging dice (`docs/feature-dice-rolling.md`, "Out of scope").
- A dropped network, "Reconnecting": step 11.

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 10"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server. The user checks the app.
- Do not run `aws`, `cdk deploy` or `put-secrets`. `apps/api` and `infra/` do not change in this step.
- Do not commit and do not push. The main model commits each finished phase.
- Temporary files go in the session's scratchpad directory.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: plain JavaScript in `apps/web`. Plain, short comments that say why. Match the style of the code around you.
- Web tests run with `node --test`. A module under test must not import modules that read `import.meta.env` or load three.js scenes. Put the rules in plain modules.
- Never log an SDP, a token or a live packet.
- After a code change: `pnpm format` and `pnpm lint`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| `dice` in the document | Record, depth 2. `dice.<side>` is `{ critsUsed, dice: { <die id>: die entry } }`. `side` is `blue` or `red` |
| Die entry | `{ order, place, face?, pose? }`. `order`: a number, the order in which the dice were added. `place`: `air`, `well` or `shelf` (decision 2). `face`: 1 to 8, only on the shelf. `pose`: `{ x, y, z, qx, qy, qz, qw }`, only in `air` and `well`. Positions have 3 decimals, rotations 4 |
| Die id | 8 hex characters of `crypto.randomUUID()`. A new one if the tray has it already |
| `rolls` in the document | List (`createList`). One entry per event of decision 4, oldest first |
| Roll entry | `{ side, at, kind, ... }`. `at`: `Date.now()` of the roller. `kind: 'throw'` with `roll`, `crits` and `reroll`. `kind: 'change'` with `from` and `to`. `kind: 'clear'`. Counts are `{ <symbol>: n }` with only the symbols above 0. `reroll` is `[[from, to], …]` of symbols |
| Rolls panel | `components/RollsPanel.jsx`, opened by the **Rolls** button of the toolbar |
| Live key of a die | `die:<die id>`. Numbers like a model: `[x, y, z, qx, qy, qz, qw]` |
| Own tray | In a multiplayer room, the tray of the own seat. In a single player room and the Sandbox, both trays |
| Other tray | In a multiplayer room, the tray of the other seat |
| `OTHER_DICE_GROUPS` | `physics.js`. The collision groups of the other player's dice: a group that is not 1, and a filter that leaves out group 1 (the models, `MODEL_GROUPS`) |

Files:

```
apps/web/src/
  dice/stored.js                new: die id, die entry, rounding, tray counts (plain, tested)
  dice/history.js               new: roll entries and their text (plain, tested)
  dice/shelf.js                 sortShelfEntries by order
  net/doc.js                    + dice, rolls
  rooms/table.js                + dice and rolls in startTable
  net/live.js                   + die layout
  net/livePose.js               + die kind
  physics.js                    + OTHER_DICE_GROUPS
  components/DiceTray.jsx       the own tray: from the document, writes, history entries, live poses
  components/OtherDiceTray.jsx  new: the other player's tray
  components/DiceKeys.jsx       + disabled
  components/RollsPanel.jsx     new: the roll history
  components/Toolbar.jsx        + Rolls button
  components/LiveSync.jsx       + die keys
  components/Scene.jsx          own and other trays, PLAYER_TEAM goes away
  App.jsx                       the dice and rolls stores, the Rolls panel, number keys to the own tray under the pointer
```

## Decisions that fill gaps in the design

1. **Dice in the document, per side.** The design has `dice: Y.Map<trayKey, Y.Map>` with dice, a history and `critsUsed`.
   - `dice` is a record of depth 2. `dice.<side>` holds `critsUsed` and `dice`, the die entries by id. Each die entry is plain JSON and is replaced as a whole.
   - Only the tray's player writes a side. So the two players never write the same entry.
   - The tray's state in memory (`DiceTray.jsx`) is the truth. Each write makes the document side equal to it: changed entries are written, missing ones are deleted. So an old entry that came from somewhere else goes away at the next write.
   - Writes happen only when a die changes its place or its face, never on each frame.
   - The shelf is sorted by symbol, then by `order`. Today it is sorted by symbol, then by the numeric id. Both browsers compute the same shelf slots from the document, so the shelf needs no poses.
   - The ids are short, because each live packet of a flight carries them.
   - The history is a separate list, `rolls` (decision 4).
2. **Three places.**
   - `air`: the die moves. A new die and a rerolled die are `air` from the moment they appear above the well until they rest. A roll makes every die that is not on the shelf `air`. `pose` is where the move started.
   - `well`: the die rests and has no result. A new or rerolled die that rests writes `well` with its rest pose. It uses the settle rule of a thrown die (`stillTime`, `SETTLE_TIME`, `SETTLE_TIMEOUT`), with no face read and no new throw.
   - `shelf`: the die has a result. At the end of a throw, every die of the throw writes `shelf` and its `face`, in one change.
   - Change one to writes the new `face`. Reroll one writes `air` with the new start point. `−` deletes the entry. Clear deletes all entries and sets `critsUsed` to false. `+N Crits` adds `air` entries and sets `critsUsed` to true.
   - Several dice that change at the same moment go in one change.
3. **The room keeps the results, not the physics.** The user decided this on 2026-10-10. A result stays on the shelf until the die is rolled again or removed from the tray. So it must survive a lost connection or a reload. Dice in the well and in the air are temporary.
   - At mount, the own tray builds only its shelf dice from the document, kinematic at their slots, and `critsUsed`. Then it writes its side. So the `well` and `air` entries go away, on both screens.
   - A reload during a throw gives no result for that throw. Its dice are gone, and the player adds dice again.
   - While a player is away, the other screen shows that player's tray as the document has it, also dice in the well or in the air. They go away when the player opens the room again.
   - IndexedDB and the server snapshot keep the dice like the rest of the table. The Sandbox has no IndexedDB, so its trays are empty after a reload, as today.
4. **The roll history.** The user decided this on 2026-10-10. It is a panel like the Library, and a later logging feature can extend it.
   - It is the list `rolls` in the document, one list for both sides. So the room keeps it, and both players see the same entries in the same order. Only the roller's browser writes an entry. Clear does not delete the history. A new table starts with an empty one.
   - Events, as in the design before 2026-10-02 (`docs/plan-dice-rolling.md`, `history.js`):
     - `throw`: when a throw ends. The results of the thrown dice, by where they came from: `roll` (new dice), `crits` (`+N Crits` dice), `reroll` (from → to). One throw can have all three.
     - `change`: Change one to, from → to.
     - `clear`: Clear, as a line between two rolls.
   - The entry stores data, not text. `dice/history.js` makes the text, so a later change of the look needs no change of the data.
   - The panel: a **Rolls** button in the toolbar opens it, the same way as **Library**. It is on the right side of the screen, below the toolbar. Newest entry first. Each entry has the side color, the time (hours and minutes), and the face icons with counts. Escape closes it, the same as the Library.
5. **Own trays and the number keys.** `PLAYER_TEAM` goes away.
   - A multiplayer room has one own tray: the tray of the own seat. A single player room and the Sandbox have two, because one player plays both sides there.
   - A number key adds dice to the own tray under the pointer. So Red's number keys work, and in a single player room the Red tray takes number keys too.
   - Over the other tray, a number key acts as over the table: it spawns a tool.
6. **The other tray.**
   - It draws the entries of the other side. Each die is a kinematic body. A `well` die stands at its pose. A `shelf` die slides to its slot in `SHELF_MOVE_TIME`, the same way as on the roller's screen (`shelfMovePose`), when its slot or face changes. A die that is on the shelf at mount stands at its slot with no slide. An `air` die stands at its pose until its live poses come (decision 7).
   - Its keys show the counts of the document (`trayCounts`). They are turned off: no button works, a face plate opens no menu.
   - It is a separate component, `OtherDiceTray`. The tray body, the keys and the look of a die are shared with `DiceTray`. `DiceTray.jsx` has 525 lines and the roll flow, which the other tray does not need.
7. **Dice in flight on the live channel.**
   - The roller's tray gives LiveSync the poses of its dice that are not on the shelf, with the key `die:<id>`. LiveSync sends them in the same packets as the other pieces, at most every 33 ms, and only the numbers that changed.
   - On the other screen, a live pose of a die counts only while its entry is `air`, and only when the pose arrived after the entry became `air`. The live channel is unordered. So a late packet of the last flight must not move a die that rests or stands on the shelf.
   - The die follows its latest pose the same way as a model: `followPart`, and a slerp the short way for the rotation (`sameSideQuat`).
   - Dice need no claims, because only the tray's player moves them. LiveSync keeps `die:` keys like `tool:` keys: they do not depend on the claims.
8. **The other player's dice do not touch models.** The design says they stay kinematic and act as fixed obstacles for this browser's dice. A kinematic body also pushes a model with no limit on the force. So the other dice get `OTHER_DICE_GROUPS`: they pass through models, and own dice still bounce off them. On the roller's screen, models do not move either, because models are dominant (dominance groups).
9. **No new `SCHEMA`.** An old document has no `dice` and no `rolls`, which is a valid state: empty trays and an empty history.

## Phase 1: Dice in the document

Read: decisions 1 to 3 and 9. `components/DiceTray.jsx`, `dice/shelf.js`, `dice/tray.js` (`freeDropPoint`), `dice/throw.js` (the settle rule), `net/doc.js`, `net/collections.js` (`createRecord`), `net/useY.js`, `rooms/table.js`, `components/storedTool.js` (how a tool entry is rounded and compared), `components/Scene.jsx` (where `DiceTray` is drawn), `App.jsx` (the props of Scene).

Work:
1. `dice/stored.js`, new plain module: the die id (decision 1), the die entry from a die in memory, the rounding of a pose, and `trayCounts(entries, critsUsed)`, which gives `{ well, shelf, critsAvailable }` in the form that `DiceKeys` reads. Tests in `dice/stored.test.js`.
2. `dice/shelf.js`: `sortShelfEntries` sorts by symbol, then by `order`.
3. `net/doc.js`: `dice: createRecord(doc.getMap('dice'), { depth: 2 })`. `fillTable` writes `state.dice ?? {}`. `rooms/table.js`: `dice: {}` in `startTable`. Test in `net/doc.test.js` that the two sides merge.
4. `DiceTray.jsx`:
   - Gets its side of the document and a write function.
   - At mount, builds its shelf dice and `critsUsed` from the document, then writes its side (decision 3). `Die` takes the body type of its start.
   - The ids are die ids, and each die gets an `order`: one above the highest `order` in the tray.
   - Each die in memory keeps its die entry, and changes it only when its place or face changes. A write builds the side from these entries. So a write does not change the `pose` of an `air` die that is still in the same move.
   - Writes on each change of place or face (decision 2). A new or rerolled die settles to `well`. When it does not rest by `SETTLE_TIMEOUT`, it writes `well` with its pose at that moment. A pose that is not finite is not written.
   - The keys still read the state in memory. They show the same numbers as `trayCounts` of the document.
5. `Scene.jsx`, `App.jsx`: the `dice` store goes to each `DiceTray`. `PLAYER_TEAM` stays in this phase.
6. Docs: `docs/feature-rooms.md` ("Not saved", and the saved room list: the room keeps the shelf). `README.md` (the single player room: the shelf is saved). `docs/feature-dice-rolling.md` (the state of a tray is in the document). `docs/feature-peer-to-peer.md` ("State" table, "Yjs document": the `dice` layout).

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 1 to 4.

### Result

Done. Web tests 249 pass, 0 fail. Build passes. Lint: no new warnings.

- `dice/stored.js` (new, tested in `stored.test.js`): `dieId(taken)`, `roundPose(t, r)` (null when not finite), `dieEntry(order, place, { face, pose })`, `nextOrder(entries)`, `trayCounts(entries, critsUsed)`.
- `dice/shelf.js`: `sortShelfEntries` sorts by symbol, then `order`.
- `net/doc.js`: `dice` record, depth 2. `fillTable` writes `state.dice ?? {}`. `rooms/table.js`: `dice: {}`. `doc.test.js`: start value, merge of two sides, delete of missing dice.
- `Scene.jsx`: prop `diceStore`, passed to each `DiceTray` as `store`. `App.jsx`: `diceStore={table.dice}`.
- `DiceTray.jsx`:
  - `shelfFromDocument` builds the shelf dice at mount (kinematic at their slot, `slot` set; `Die` reads its body type once). A mount effect calls `commit()`.
  - Each in-memory die has `id`, `order`, `doc` (the die entry), `settling`. `commit()` writes the whole side: `store.setField(trayKey, { critsUsed, dice: { id: entry.doc } })`. It writes at once in the actions (add, remove, roll, clear, crits, reroll, change). The frame sets `dirtyRef` (settle, end of throw) and writes once at its end.
  - New and rerolled dice: `air` with start pose, `settling`. The frame uses the settle rule and then writes `well` with the rest pose (also on `SETTLE_TIMEOUT`). A pose that is not finite is not written, and the die stops settling.
  - Roll makes non-air, non-shelf dice `air` with their pose now. End of throw writes `shelf` + `face`.
- Docs: `feature-rooms.md`, `README.md`, `feature-dice-rolling.md`, `feature-peer-to-peer.md`.

For next phases:
- Phase 2 adds a `rolls` entry in the same change: wrap `commit()` and the `rolls` write in `table.transact(...)`. `DiceTray` has only the `dice` store now, so it needs the `rolls` store or `table.transact` as a prop. The end of a throw is in `finalizeThrow` (frame), `change` and `clear` are actions.
- Both `DiceTray`s are still drawn in every browser (`PLAYER_TEAM` stays), so each browser writes both sides at mount until Phase 3.
- The mount reads the document once. `Table.jsx` loads the document (IndexedDB, then the server table) before it creates the table and draws the scene, so the document is loaded at mount.

## Phase 2: The roll history

Read: decision 4. The **Result** of Phase 1. `components/DiceTray.jsx` (`finalizeThrow`, `addCrits`, `reroll`, `change`, `clear`), `net/doc.js`, `net/collections.js` (`createList`), `components/Library.jsx`, `components/Toolbar.jsx`, `App.jsx` (`libraryOpen`, Escape), `index.css` (`.library`). In git: `src/dice/history.js` and `src/components/DicePanel.jsx` before commit `c965bf4`, for the old text and look.

Work:
1. `dice/history.js`, new plain module: the roll entry of a throw, a change and a clear, and the text of an entry. Tests in `dice/history.test.js`.
2. `net/doc.js`: `rolls: createList(doc.getMap('rolls'))`. `fillTable` writes `state.rolls ?? []`. `rooms/table.js`: `rolls: []`.
3. `DiceTray.jsx`: each die remembers where it came from (new, Crits, reroll with its old symbol) until the end of its throw. At the end of a throw, at a change and at a clear, the tray adds an entry to `rolls`, in the same change as the dice.
4. `components/RollsPanel.jsx`: decision 4. `Toolbar.jsx`: the **Rolls** button. `App.jsx`: `rollsOpen`, Escape closes it, the same as the Library.
5. Docs: `docs/feature-dice-rolling.md` (a short "History" section: what is stored, where it shows). `docs/feature-peer-to-peer.md` ("Yjs document": `rolls`. "Dice": the roller writes the history entry). `README.md` (the Rolls panel).

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 5 to 7.

### Result

Done. Web tests 254 pass, 0 fail. Build passes. Lint: no new warnings.

- `dice/history.js` (new, tested in `history.test.js`): `throwEntry(side, at, { roll, crits, reroll })` (null when empty), `changeEntry`, `clearEntry`, `countSymbols`, `countsText`, `entryText`. Each entry has a short random `id`.
- `net/doc.js`: `rolls` list. `fillTable` writes `state.rolls ?? []`. `rooms/table.js`: `rolls: []`.
- `DiceTray.jsx`: new props `rolls` (the list store) and `transact`. Each die has `source` (`roll`, `crits`, `reroll`) and `was` (old symbol of a reroll), cleared at the end of its throw. `finalizeThrow`, `change` and `clear` push an entry to `pendingRolls`. `commit()` writes the side and appends the pending entries in one `transact`. Clear on an empty tray adds no entry.
- `Scene.jsx`: props `rollsStore`, `transact`, passed to each `DiceTray` as `rolls`, `transact`. `App.jsx`: `table.rolls`, `table.transact`; `rollsOpen`; Escape closes the panel after the Library.
- `RollsPanel.jsx` (new), **Rolls** button in `Toolbar.jsx`, styles `.rolls*` in `index.css`.
- Docs: `feature-dice-rolling.md` ("History"), `feature-peer-to-peer.md`, `README.md`.

For next phases:
- `DiceTray` props now: `trayKey, store, rolls, transact, openMenuSymbol, onMenuToggle, onMenuClose, onHover, addRef`.
- Every `commit()` goes through `transact`, so a second tray component must not write `rolls`.
- Both `DiceTray`s are still drawn in every browser until Phase 3, so history entries come from the tray of the side that rolled.

## Phase 3: The other player's tray

Read: decisions 5, 6 and 8. The **Result** of Phases 1 and 2. `components/DiceTray.jsx`, `components/DiceKeys.jsx`, `components/Scene.jsx` (`PLAYER_TEAM`, the trays, `ownSide`), `App.jsx` (`diceTrayHoveredRef`, `addDiceRef`, the number keys, `diceMenu`), `physics.js`, `components/CharacterModel.jsx` (only to see how a remote model turns off its contact forces).

Work:
1. `Scene.jsx`: the own trays from `ownSide` and the room kind (decision 5). `PLAYER_TEAM` goes away. An own tray is a `DiceTray`, the other tray is an `OtherDiceTray`.
2. `App.jsx`: `diceTrayHoveredRef` holds the side of the own tray under the pointer, or null. `addDiceRef` holds the add function of each own tray. A number key adds dice to the tray under the pointer. The face menu opens only on an own tray.
3. Shared parts: the tray body with its keys, and the look of a die (the loaded die, its material), used by both trays.
4. `components/OtherDiceTray.jsx`: decision 6. The dice are kinematic bodies with `OTHER_DICE_GROUPS`.
5. `DiceKeys.jsx`: `disabled`. The buttons are disabled, a face plate is not a button, and no menu opens.
6. `physics.js`: `OTHER_DICE_GROUPS` (decision 8).
7. Docs: `docs/feature-dice-rolling.md` ("Controls: number keys": any own tray; the other player's tray). `docs/feature-key-shortcuts.md` (the number keys row). `docs/feature-peer-to-peer.md` ("What each player controls": the other tray shows its dice and counts, and its keys do nothing; the history is in the Rolls panel. "Bodies moved by the other browser", item 3: the other dice pass through models).

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 8 to 12.

### Result

Done. Web tests 254 pass, 0 fail. Build passes. Lint: no new errors. One new warning (`set-state-in-effect` in `OtherDiceTray`, see below).

- `components/DiceTrayParts.jsx` (new): `useDieLook()` (d8 geometry and material) and `TrayBody({ trayKey, keysProps, onHover })` (fixed body, trimesh, tinted visual, `DiceKeys`). `DiceTray.jsx` uses both and keeps the roll flow only.
- `components/OtherDiceTray.jsx` (new): props `trayKey`, `store`. No `commit`, no `rolls`. Reads its side with `useYField(store, trayKey)`.
- `components/DiceKeys.jsx`: `disabled` prop. Buttons disabled, a face plate is a `div.dice-face-key--static` (css in `index.css`), no menu.
- `physics.js`: `OTHER_DICE_GROUPS` (group 2, filter every group but 1).
- `Scene.jsx`: `PLAYER_TEAM` removed. New prop `ownTraySides` (default both). Own side: `DiceTray`, else `OtherDiceTray`. `onDiceTrayHover(side, over)`. `addDiceRef.current[side]` holds each own tray's add.
- `App.jsx`: `ownTraySides={room?.multiplayer ? [ownSide] : ['blue','red']}`. `diceTrayHoveredRef` is the side or null (out clears only the same side). `addDiceRef` is `{}` by side. Number key adds to the tray under the pointer.
- Docs: `feature-dice-rolling.md`, `feature-key-shortcuts.md`, `feature-peer-to-peer.md`.

For Phase 4:
- `OtherDiceTray` keeps `dice`, a `Map` made once in `useState` and changed in place (id -> `{ id, doc, body, spawn, slot, face, moving, moveFrom, moveTo, moveElapsed }`). `doc` is the stored die entry now, `body` the RigidBody (set by `OtherDie`'s ref). React state is only `ids`.
- `syncDice(map, side, trayKey)` runs in an effect when the stored side changes. It adds and removes dice and calls `applyEntry`: well or air die jumps to its pose (`setTranslation`), shelf die starts a slide (`moving`). A later live pose should go in the existing `useFrame` of `OtherDiceTray`, for dice with `doc.place === 'air'`. A later `applyEntry` jump to the stored pose would fight it: skip the jump for an air die that has a live pose newer than its entry.
- Props: `DiceTray` `trayKey, store, rolls, transact, openMenuSymbol, onMenuToggle, onMenuClose, onHover, addRef`. `OtherDiceTray` `trayKey, store`.
- The new warning: the effect calls `setIds` when dice were added or removed.


## Phase 4: Dice in flight

Read: decisions 7 and 8. The **Result** of Phases 1 to 3. `net/live.js` (+ test), `net/livePose.js` (+ test), `components/LiveSync.jsx`, `components/useLiveFollow.js` (the follow), `components/CharacterModel.jsx` (how a remote model follows a live pose), `components/Scene.jsx` (LiveSync, `toolLives`), `components/DiceTray.jsx`, `components/OtherDiceTray.jsx`.

Work:
1. `net/live.js`: the `die` layout (3 positions, 7 numbers). `net/livePose.js`: the `die` kind, the same numbers as `character`. Tests.
2. `DiceTray.jsx`: registers a getter in `diceLives` (a ref, side → getter, the same way as `toolLives`). The getter gives the key and the pose of each die that is not on the shelf.
3. `LiveSync.jsx`: sends the poses of `diceLives`. Keeps a received `die:` key without a claim, like a `tool:` key, and does not prune it when the claims change. `liveRef.current.die(key)` gives `{ numbers, time }` or null.
4. `OtherDiceTray.jsx`: an `air` die follows its live pose (decision 7). It notes the time when the entry became `air`, and uses only a pose that arrived after it.
5. Docs: `docs/feature-peer-to-peer.md` ("Pose message": the `die:` key. "Dice". "Phases": phase 4 done). `docs/feature-dice-rolling.md` ("Out of scope": multiplayer sync is done. "Pitfalls", "Rapier version": closed, because the dice are not replayed). `README.md` (the multiplayer part: the dice are shared). `docs/plans/implement-backend.md`: a short **Result** under step 10.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass.
- `pnpm format`, `pnpm lint`: no new errors.

User, after this phase: checks 13 to 18.

### Result

Done. Web tests 255 pass, 0 fail. Build passes. `pnpm test`, `pnpm typecheck`: pass. Lint: no new warnings.

- `net/live.js`: `die` layout (3 positions, 7 numbers). `net/livePose.js`: `die` kind, the numbers of `character`. Tests in `live.test.js`, `livePose.test.js`.
- `Scene.jsx`: `diceLives` ref (side to getter), passed to each `DiceTray` and to `LiveSync`. `liveRef` goes to `OtherDiceTray`.
- `DiceTray.jsx`: prop `diceLives`. An effect registers a getter with `die:<id>` and the pose of each die that is not on the shelf and has a body. It removes the getter on unmount.
- `LiveSync.jsx`: sends the `diceLives` poses through `add`. `die:` keys are kept without a claim and not pruned (`isClaimFree`). `liveRef.current.die(key)` gives `{ numbers, time }` or null. Comment updated.
- `OtherDiceTray.jsx`: prop `liveRef`. `applyEntry` sets `airSince` when an entry becomes `air` (new, from `well` or `shelf`, or a new pose), and ends the follow. The `useFrame` follows the live pose of an `air` die when `time > airSince`: `followPart`, `sameSideQuat` slerp, kinematic moves.
- Docs: `feature-peer-to-peer.md`, `feature-dice-rolling.md`, `README.md`, `plans/implement-backend.md`.

Bytes of the dice (check 18): the user fills this in.

## User

After Phase 1, in a single player room:
1. Both trays: `+`, `−`, Roll, Roll again while the dice fly, Reroll one, Change one to, `+N Crits`, Clear, and a number key over the Blue tray. All work as before.
2. Roll 6 dice. Add 2 more dice and let them fall into the well. Go **← Lobby**, then open the room. The shelf has the same 6 dice, in the same order, with the same counts. The 2 dice in the well are gone. If `+N Crits` was used, it is still off.
3. Roll 10 dice and reload the page while they fly. The 10 dice are gone. The shelf from before the throw is still there.
4. Sandbox: roll, reload. The trays are empty.

After Phase 2, in a single player room:
5. Open **Rolls** in the toolbar. Roll 5 dice: one entry with the results, in the Blue color. Reroll one die and roll: an entry with from → to. `+N Crits` and roll: an entry with the Crit dice. Change one die: an entry with from → to. Clear: a line. Newest first. Escape closes the panel.
6. Roll in the Red tray: the entry has the Red color.
7. Go **← Lobby**, then open the room. The history is the same.

After Phase 3, in one browser pair. Alice is on Blue, Bob on Red:
8. Bob holds the pointer over his tray and presses 3. Three dice fall into the Red tray. Over Alice's tray, the key spawns a range tool.
9. Alice adds 5 dice and rolls. On Bob's screen, the dice show in Alice's tray, then move to the shelf with the same faces and the same counts as on Alice's screen. The flight itself does not show yet. Both Rolls panels show the same entry.
10. On Bob's screen, Alice's keys do nothing, and a face plate opens no menu. The counts are the same as on Alice's screen.
11. Alice uses Reroll one, Change one to, `+N Crits` and Clear. Bob's screen shows the same shelf, counts and history after each.
12. Single player room: a number key over the Red tray adds dice to the Red tray.

After Phase 4. Checks 13 to 16 in each pair. Checks 17 and 18 once, in one pair:
13. Alice rolls 10 dice. Bob sees them fly, bounce and land. Each die shows the same face on both screens. The shelf is the same.
14. Alice presses Roll again while the dice fly. Then she rolls until a die leaves the well. Bob sees the same moves, and the same results.
15. Alice and Bob roll at the same moment, each in their own tray. Both screens show the same results for both trays, and the same history.
16. A die that hits a model base near a tray: the model does not move, on either screen.
17. Bob opens the room with `/?drop=30&delay=150#room=…`. Alice's dice fly rougher, and land on the same faces.
18. Alice rolls 10 dice 10 times. Then both go **← Lobby**. Put the bytes of the traffic line of each console in the **Result** of Phase 4, with a short game of step 9 to compare.

### User check results

2026-10-10: the user checked all and said "everything works". The bytes of check 18 are not in the Phase 4 **Result** yet.

Found in the checks:
1. Bug: on the guest's screen, the counts on the face plates of a tray are at a wrong place. Open: which tray, and how they are wrong.
2. Question: after a roll, a die sometimes jumps out of the tray, as if it is thrown again, and can knock other dice. Cause: the tilted-die rule (`docs/feature-dice-rolling.md`, "Tilted dice"). `throwDie` gives the die a new random rotation in place, so it can overlap the die or wall it leans on, and then a full throw. Options are with the user.

## Done when

- `pnpm test`, `pnpm typecheck`, `pnpm --filter web build` pass. `pnpm lint` has no new errors.
- The user checks pass, in the three browser pairs where the check says so.
- The **Result** of each phase is filled in. The **Result** of Phase 4 has the bytes of the dice.

## Risks and open questions

1. **Big packets.** 42 dice in flight make a packet of about 2.5 KB. The channel splits it into parts, and a lost part loses the whole packet. The follow hides a lost packet. If a roll of many dice looks rough, the tray can send part of its dice in each packet, in turns.
2. **A resting die that something pushes.** A model that a player drags over a tray, or a die that hits a resting one, moves a die in the roller's browser only. The other screen shows the old place until that die moves again. The results do not change: a result is read only in a throw, and the shelf slots come from the document.
3. **Old dice from the other browser.** A player who opens the room in a new browser builds the tray from the document at mount. If the sync with the other player then brings an older state of the own tray, those dice show on the other screen only, until the own player changes the tray (decision 1).
4. **The document grows with each roll.** Each roll writes each die about twice and adds one history entry of about 100 bytes. A long game of about 200 rolls of 10 dice adds an estimated 40 to 60 KB. The server limit of a table is 1 MB.
5. **The clock of the history.** `at` is the roller's clock. Two machines can differ by some seconds. The order of the entries comes from the list, not from `at`, so it is the same on both screens.
