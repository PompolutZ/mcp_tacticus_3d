# Step 5: Shared state in Yjs

Detailed plan of step 5 in `docs/plans/implement-backend.md`. The design is in `docs/feature-peer-to-peer.md` ("State", "Yjs document", "Save and load a game", "Phases" 1) and `docs/feature-rooms.md` ("Storage", "Relation to peer-to-peer").

## Goal

The table state of `App.jsx` moves from `useState` into one Yjs document per table. A room stores its document in IndexedDB. **Save game** and **Load game** write and read the document as a file. There is no network yet. The app works as before.

Step 8 syncs this document between two browsers. So from this step on, every change of the table is a change of the document, and the code of one player and of two players is the same. This step also measures the size of a full game. That answers the auth doc's open question 5 (the 1 MB limit and the write interval of step 7).

## Scope

In the step:
- `apps/web/src/net/`: the document layout, the list and record stores, React hooks, tests.
- `App.jsx`: the table state comes from the document. The handlers keep their code. Only the setters change.
- Model poses: written to the document when a body falls asleep. The 2-second save poll goes away.
- Rooms: the document is stored in IndexedDB (`y-indexeddb`). The room record keeps only the setup and the dates.
- **Save game** and **Load game** in the toolbar.
- A script that measures the snapshot size of a full game.
- Docs: rooms, peer-to-peer, auth, and the backend plan.

Left for later steps:
- The tools (range, move, Toward/Away) stay in React state and in `RulerTool.jsx`. They move into the document in step 9 (decision 1).
- Dice and roll history: step 10.
- `y-protocols`, awareness, sync: step 8.
- Undo.

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 5"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server. The user checks the app.
- Do not commit and do not push. Leave all changes in the working tree.
- Temporary files go in the session's scratchpad directory.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Code: plain JavaScript, as in `apps/web`. Plain, short comments that say why. Match the style of the code around you.
- After a code change: `pnpm format` and `pnpm lint`.
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| New web dependencies | `yjs` 13, `y-indexeddb` 9 |
| Web test script | `"test": "node --test \"src/**/*.test.js\""` (decision 14) |
| Size script | `apps/web/scripts/yjs-size.mjs`, web script `yjs-size` |
| IndexedDB name of a room | `mcp-assist-3d/room/<code>`, the same prefix as the `localStorage` keys |
| Doc schema | `SCHEMA = 1`, stored in `game.schema` |
| Room record | `version: 2`: `id`, `owner`, `createdAt`, `updatedAt`, `mapId`, `rosters`. No `table` |
| Game file | The bytes of `Y.encodeStateAsUpdate(doc)`. Name `game-<room code or sandbox>-<yyyy-mm-dd>.yjs` |

The document:

| Doc name | Kind | App state | Content |
|---|---|---|---|
| `game` | record, depth 1 | `mapId`, `matTurns`, `deployLine`, `crisis`, `scoreMarkers`, `affiliations` | these fields, plus `schema` |
| `rosters` | record | `rosters` | `blue`, `red`: `null` or `{ code }` |
| `setup` | record, depth 1 | `setup` | the fields of `NEW_SETUP` (`setup/setup.js`) |
| `terrain` | list, fields `index`, `locked` | `terrain` | the pieces on the mat |
| `characters` | list | `characters` | the fields of `newCharacter` (`App.jsx`) |
| `poses` | record | none (decision 8) | model id → `{ x, y, z, qx, qy, qz, qw }` |
| `tokens` | list | `tokens` | crisis tokens |
| `tactics` | list | `tacticCards` | Team Tactic cards on the table |
| `looseTokens` | list | `looseTokens` | character tokens on the table |
| `tokenPiles` | list | `tokenPiles` | token piles on the table |

Each name is a top-level `Y.Map` of the doc (`doc.getMap(name)`).

Files:

```
apps/web/
  package.json                  + yjs, y-indexeddb; scripts test, yjs-size
  scripts/yjs-size.mjs          snapshot size of a full game
  src/
    Root.jsx                    renders Table for a room and the Sandbox
    Table.jsx                   opens the doc of a room or the Sandbox, then mounts App. Load game
    App.jsx                     table state from the doc
    net/
      collections.js            list and record stores over a Y.Map. No React
      collections.test.js
      doc.js                    the table doc: layout, SCHEMA, createTable, fillTable, game file. No React
      doc.test.js
      useY.js                   useYList, useYRecord, useYField
    rooms/
      tableDoc.js               IndexedDB of a room: open with a timeout, delete
      table.js                  startTable(mapId), withPlacements, poseOf. No saved form
      store.js                  record version 2, saveRoomRecord, deleteRoom also deletes the doc
    components/
      Scene.jsx                 startPose(id) and onModelRest(id, pose) instead of startPoses and modelPosesRef
      CharacterModel.jsx        onRest: RigidBody onSleep
      Toolbar.jsx               Save game, Load game
```

## Decisions that fill gaps in the design

1. **Tools later.** The tools move into the document in step 9, not in this step. The user decided this on 2026-10-09. Reasons: a room does not save the tools today. Their pose, bend and snap target are inside `RulerTool.jsx`. Step 9 defines how tools sync (player bodies with a pose stream). With one player, the move has no visible effect and cannot be tested for its purpose.
2. **IndexedDB now.** A room stores its document in IndexedDB with `y-indexeddb` from this step on, not from step 11. The user decided this on 2026-10-09. Reasons: it is the final storage, so there is no temporary format. It stores each change at once, so the 2-second save poll goes away. Step 11 then adds only reconnect.
3. **Doc layout.** See "Names". Differences from the design ("Yjs document"):
   - `terrain`, `setup`, `looseTokens`, `tokenPiles` and `poses` are new names. The room record saves them today, so the document must have them.
   - `scoreMarkers` and `affiliations` are fields of `game`.
   - The design has `pose` on each character. A character with a second form has two models (`characters/models.js`), so `poses` is a record by model id.
   - `tools` and `dice` come in steps 9 and 10.
4. **Lists.** A list is a `Y.Map` from id to a nested `Y.Map` of the entity's fields. Each field value is a plain JSON value. A field that is an object (`heldAt`, `tokens` of a character, `transform`) is replaced as a whole. Reasons: two players who change different fields of the same entity at the same time both keep their change. A position never mixes the `x` of one player with the `z` of the other.
5. **Order.** Each entity of a list has a hidden `order` number. The store sorts by `order`, then by id, and does not show `order` to App. A write keeps the order of the new array: it walks the array and gives a new `order` (the last one + 1) only to an entity whose stored `order` is not above the one before it. So an entity that moves to the end of the array gets a new number, and the others keep theirs. Reason: the order matters for the tray row (`characters`) and the stack of tactic cards (`tactics`). `Y.Map` has no order, and the iteration order differs between browsers. With equal numbers from two players, the id decides, the same in both browsers.
6. **Records.** A record is a `Y.Map` of fields. With depth 1, a field whose value is a plain object is a nested `Y.Map` of that object's fields, and their values are plain JSON. `game` and `setup` have depth 1. `rosters` and `poses` have depth 0. Reasons: in `setup`, each player changes their own squad and Ready (`setup.squads.blue`, `setup.ready.red`), so these must merge. A score marker position (`game.scoreMarkers.blue`) stays one value.
7. **Setters write by diff.** Each store has `set(next | (prev) => next)`, the same form as a React setter. The store compares the new value with the document, and writes only the fields that changed. Fields that are gone are deleted. Equal values are not written. So the call sites in `App.jsx` stay as they are: `setTokens((prev) => prev.map(...))`. Reasons: one write path, which the tests cover. The handlers keep their tested logic.
   - `prev` comes from the document at the time of the call, not from the last render. So two setter calls in one handler see each other's change. This also works inside a transaction, where Yjs has not run the observers yet.
   - The updater runs once. React can run an updater twice, so today the random ids are made outside the updaters. That code can stay.
   - A handler that writes more than one name runs in one `doc.transact`. Then the document has one update, and React renders once.
8. **Poses.** A model writes its pose to `poses` when its body falls asleep (`onSleep` of `RigidBody`). A lifted model (R) writes the place under the lift, the same as `modelPoses` does today. App does not read `poses` into React state, because a pose is needed only when a model mounts. Scene gets `startPose(modelId)`, which reads the document. So a pose write renders nothing. A removed character deletes the poses of its models. A model that moves when the page closes keeps its last rest pose. The design accepts this ("rest pose").
9. **Terrain.** `terrain` stores only `index` and `locked`, the same as the room record today. App adds the placement of the map with `withPlacements(mapId, terrain)`. So a fix of the map data reaches old rooms. A piece whose index the map no longer has is left out.
10. **Snapshot.** A store keeps the last snapshot that it gave to React. After a change, it builds the new snapshot and reuses each old entity or field that is equal by value. So an entity that did not change keeps its object, and components and effects that depend on it do not run again. Today the functional setters keep unchanged objects in the same way.
11. **Schema.** `game.schema` is `SCHEMA`. A stored document with another schema is deleted, and the table starts new. A game file with another schema is not loaded. Reason: before the first release, all data is test data (`docs/plans/implement-backend.md`, "Rules for every step").
12. **Room record.** Version 2 has no `table`. The record keeps `mapId` and `rosters` for the lobby tile, as a copy of the document. Table.jsx writes the record at most every 2 seconds after a change of the document, and when the table unmounts. `updatedAt` changes only then, not when a room only opens. `deleteRoom` also deletes the IndexedDB database. A record of version 1 opens with a new table, with its map and rosters. Its old `table` is not read (no migration, same reason as decision 11).
13. **Open a room.** Table.jsx creates the doc and `IndexeddbPersistence`, and waits for `whenSynced`. A new document gets the start table (`startTable(mapId)` with the rosters of the record). Then App mounts. While it waits, Table.jsx shows `LoadingOverlay`. If IndexedDB does not load within 5 seconds, or fails, Table.jsx closes it and opens the table in memory, with the HUD message "Room not saved: browser storage is not available". In dev, React StrictMode runs the effect twice, so the effect cleans up the doc and the persistence, and ignores a result after cleanup.
14. **Tests.** `node --test` in `apps/web`, with `node:assert`. The modules under test import only `yjs` and plain modules. Reason: Vitest 5 needs Vite 6 or newer, and the web app has Vite 5 (step 2 Result). `node --test` needs no new package. Root `pnpm test` then also runs the web tests.
15. **Sandbox.** The Sandbox has the same doc and the same code, without IndexedDB. Nothing is saved, as today.
16. **Game file.** **Save game** downloads `Y.encodeStateAsUpdate(doc)` as the file. So the file size is the snapshot size of step 7. **Load game**:
    - reads the file into a new doc, and checks `game.schema` and that the app has the map. Otherwise the HUD shows "This file is not a saved game of this app" and nothing changes.
    - asks with a browser confirm: "Replace the table with the saved game? The table of this room is lost." (In the Sandbox: "... The table is lost.")
    - replaces the whole table, also the map and the rosters. In a room, Table.jsx deletes the IndexedDB database and stores the new doc. The room record gets the map and the rosters of the file.
    - App mounts again with the new doc, so nothing stays from the old table.
    - Load works in a room and in the Sandbox. In step 8, it works only before a game is hosted (design).
17. **Two tabs of one room.** Both tabs store their changes in the same IndexedDB database. They do not see each other's changes while open. The next open of the room has both. Today the last write wins.

## Phase 1: Doc and stores

Read: peer-to-peer doc "State", "Yjs document". Yjs docs for `Y.Map`, `observeDeep`, `transact`, `encodeStateAsUpdate`, `applyUpdate`.

Work:
1. `pnpm --filter web add yjs y-indexeddb`. Web script `test` (see "Names").
2. `net/collections.js`:
   - `createList(ymap, { fields })`: `read()`, `set(next | fn)`, `subscribe(listener)`, `getSnapshot()`. `fields`: when set, only these fields are stored (decision 9).
   - `createRecord(ymap, { depth })`: the same, plus `get(key)` and `setField(key, next | fn)`.
   - The diff (decisions 4 to 7), the order (decision 5), the snapshot reuse (decision 10). `undefined` counts as a missing field.
3. `net/doc.js`:
   - `SCHEMA`, `createTable(doc)`: the stores of "Names", plus `doc` and `transact(fn)`.
   - `fillTable(table, state)`: writes a start table in one transaction, with `game.schema`.
   - `tableSchema(table)`: the stored schema, or `null` for an empty doc.
   - `encodeGame(table)`, `readGame(bytes)`: the table of a file, or `null` when the bytes are not a Yjs update or the schema is not `SCHEMA`.
4. Tests:
   - `collections.test.js`: a list adds, changes only the changed fields, deletes, keeps the order, and moves an entity to the end with one new `order`. A record with depth 1 makes nested maps and replaces a nested map with `null` and back. Equal values write nothing (`doc.on('update')` counts). The snapshot keeps unchanged entities. Two setter calls in one transaction see each other. `fields` stores only those fields.
   - Two docs that exchange updates: different fields of one character merge. `setup.ready.blue` and `setup.ready.red` merge. Two entities with the same `order` sort the same in both docs.
   - `doc.test.js`: `fillTable`, `tableSchema`, `encodeGame` and `readGame` round trip, `readGame` of random bytes is `null`.

Checks:
- `pnpm --filter web test` passes.
- `pnpm --filter web build` passes.
- `pnpm lint`: no new errors.
- `git diff --stat apps/web/src` shows only the new files of `net/`.

### Result

Status: done.

Files changed:
- New: `apps/web/src/net/collections.js`, `net/doc.js`, `net/collections.test.js` (13 tests), `net/doc.test.js` (5 tests).
- Changed: `apps/web/package.json` (dependencies, script `test`), `pnpm-lock.yaml`.

Facts:
- Installed: `yjs@13.6.33`, `y-indexeddb@9.0.12`. No new build script warning.
- `y-indexeddb` stores an update only after its database is open (`this.db`), and writes the doc's content before it applies the stored updates. So a doc that has content when the persistence starts (Load game) is stored. Its `whenSynced` never resolves when the database cannot open. Decision 13 covers this with the timeout.
- A deleted key of a `Y.Map` stays in its internal map as a deleted item. So the stores delete keys while they iterate `ymap.keys()`.
- Node 24 supports globs in `node --test`.

Checks:
- `pnpm --filter web test`: pass, 18 of 18.
- `pnpm --filter web build`: pass.
- `pnpm lint`: 0 errors, 44 warnings (the same as before).
- `git status`: only `apps/web/src/net/`, `apps/web/package.json`, `pnpm-lock.yaml` and this plan.

Changes from the plan: `readGame` also returns `null` for another schema, so the callers check only the map.

Open issues: none.

## Phase 2: App on the doc, rooms in IndexedDB

Read: rooms doc "Storage", "Loading". `App.jsx`, `Root.jsx`, `rooms/*.js`, `Scene.jsx` (poses), `CharacterModel.jsx` (settle and lift). `y-indexeddb` source: `IndexeddbPersistence`, `whenSynced`, `clearDocument`.

Work:
1. `net/useY.js`: `useYList(list)` and `useYRecord(record)` return `[snapshot, set]`. `useYField(record, key)` returns `[value, setValue]`. All use `useSyncExternalStore`.
2. `rooms/table.js`: `startTable(mapId)` without a saved table, `withPlacements(mapId, terrain)`. Remove `savedTable` and the saved form. `poseOf` stays.
3. `rooms/tableDoc.js`: `openRoomDoc(roomId)` (decision 13), `deleteRoomDoc(roomId)`.
4. `rooms/store.js`: record version 2, `saveRoomRecord(roomId, { mapId, rosters }, changed)`, `deleteRoom` also calls `deleteRoomDoc`. Remove `saveRoom` and the `table` code.
5. `Table.jsx`: opens the doc (decision 13), fills a new doc, mounts `<App key=… table=… room=… onExit onLoadGame />`, writes the room record (decision 12). `Root.jsx` renders it for a room and the Sandbox.
6. `App.jsx`:
   - Each table state of "Names" comes from `useYList`, `useYRecord` or `useYField`. The names of the setters stay.
   - Handlers that write more than one name use `table.transact` (decision 7). At least: `handleMapChange`, `handleCrisisChange`, `handleCharacterRemove`, `handleRosterLoad`, `handleRosterRemove`, `restartSetup`, `handleSetupEdge`, `putSquadsOnTable`, `handleTokenRelease`.
   - `handleCharacterRemove` also deletes the poses of its models.
   - Remove `saveTable`, the save timer, `lastPoses`, `saveFailed`, `modelPosesRef`. `handleLobby` saves nothing. The Sandbox still asks first.
   - `squadSelect`, the selection, the popups and the tools stay in React state.
7. `Scene.jsx`: `startPose(modelId)` replaces `startPoses`. `onModelRest(modelId, pose)` replaces `modelPosesRef`. The pose is the one of `modelPoses` today (decision 8).
8. `CharacterModel.jsx`: an `onRest` prop, passed to `RigidBody` as `onSleep`. The standee gets it too.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass. `pnpm lint`: no new errors.
- `grep -n "useState(start" apps/web/src/App.jsx` finds nothing.
- `grep -rn "saveRoom\b\|savedTable\|modelPosesRef\|startPoses" apps/web/src` finds nothing.
- Read every handler of `App.jsx` once more for code that depends on React's queued state (Risk 3). List what was found in the **Result**.

### Result

Not started.

## Phase 3: Save game and Load game

Read: peer-to-peer doc "Save and load a game". Decision 16.

Work:
1. `Toolbar.jsx`: **Save game** and **Load game** in the first group, after the room code. Load opens a hidden file input (`accept=".yjs"`).
2. `App.jsx`: `handleSaveGame` downloads the file. `handleLoadGame(file)` reads, checks, confirms, and calls `onLoadGame(bytes)`.
3. `Table.jsx`: `onLoadGame` replaces the doc (decision 16). In a room it writes the record with `changed: true`.

Checks:
- `pnpm --filter web test`, `pnpm --filter web build` pass. `pnpm lint`: no new errors.
- A test in `doc.test.js`: a filled table, encoded and read again, has the same snapshot in every store.

### Result

Not started.

## Phase 4: Size and docs

Work:
1. `scripts/yjs-size.mjs`: builds a full game with the stores of `net/doc.js`, and prints the snapshot size. The game:
   - 30 terrain pieces, 2 rosters, 12 characters (6 per side), 10 tactic cards, 8 crisis tokens.
   - 6 rounds. Each round, each character: 2 moves with 2 pose writes each, 3 damage changes, 2 power changes, 1 token given. Also 10 crisis token moves or flips, 5 table tokens added and 3 removed, 2 tactic card flips.
   - Print: the size after setup, after each round, the size of the same table as JSON, and the average update size. Also the size with 3 times as many rounds, to show the growth.
2. Run it. Put the numbers in the **Result**.
3. Docs:
   - `docs/feature-rooms.md`: "Storage", "When the room saves", "Relation to peer-to-peer", "Code", a decision for this change.
   - `docs/feature-peer-to-peer.md`: "Yjs document" (the layout of "Names"), "Save and load a game" (the file), "Code layout", "Phases" 1, 3 and 5 (tools in phase 3, IndexedDB in phase 1).
   - `docs/feature-auth.md`: open question 5 answered, with the numbers.
   - `docs/plans/implement-backend.md`: a short **Result** under step 5. Step 9: the tools move into the doc. Step 11: IndexedDB is done in step 5. Decisions 6 and 7 (decisions 1 and 2 of this plan).
   - `README.md`: `pnpm test` also runs the web tests, if the README names the test command.

Checks:
- `pnpm test` at the root runs `api` and `web`, and passes.
- `pnpm --filter web yjs-size` runs.

### Result

Not started.

## User

After phase 2, in the browser:
1. The Sandbox works as before. **← Lobby** asks first.
2. Create a room. Move models, flip tokens, set damage and power, give tokens, load the Red roster, run the game setup. Reload the page: the table is the same, and the models stand where they rested.
3. Lift a model (R), wait, and reload: the model stands at the place under the lift.
4. The lobby shows the changed room first. **Delete** removes it, and DevTools (Application → IndexedDB) no longer shows `mcp-assist-3d/room/<code>`.
5. A room from before this step opens with a new table, with its map and rosters.

After phase 3:
6. **Save game** downloads a file. **Load game** of that file in the Sandbox shows the saved table. In a room it replaces the table, the map and the rosters, and a reload keeps them. The lobby tile shows the map of the file.
7. **Load game** of another file (for example an image) shows the message, and the table does not change.

After phase 4:
8. Optional: play a full game in a room, **Save game**, and give the file size. It goes into the **Result** next to the number of the script.

## Done when

- `pnpm test`, `pnpm --filter web build` pass. `pnpm lint` has no new errors.
- The user checks pass. The app works as before.
- The **Result** has the snapshot size of a full game.

## Risks and open questions

1. **Re-renders.** Each change of the document renders App, the same as each `setState` today. Pose writes render nothing (decision 8).
2. **Sleep.** A body that never sleeps writes no pose. `settle()` in `CharacterModel.jsx` puts a model to sleep after it rests, so this is only a model that moves when the page closes.
3. **Setter semantics.** The setters write at once and read the document, not React's queued state. The handlers in `App.jsx` use functional updaters, so this should not change their result. Phase 2 checks each handler.
4. **IndexedDB.** It can be turned off (blocked site data). Decision 13 opens the table in memory then. `y-indexeddb` 9.0.12 is from 2023. It is the official provider of the Yjs project.
5. **Game setup with two players.** Depth 1 of `setup` lets both players change their own squad and Ready at the same time. Who puts the squads on the table when both click Ready at the same time is a question for step 8.
6. **Doc growth.** Each pose write adds to the document. Phase 4 measures it.
