# Plan: Review fixes

Requested by the user on 2026-10-15. Status: done. The user tested it and gave the OK on 2026-10-15. Branch `review-fixes`, worktree `../mcp_assist_3d-review-fixes`, from main.

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step:

- `pnpm format`, `pnpm lint` (no more warnings than before the step), `pnpm test`, `pnpm --filter web build`.
- New pure logic is in a plain `.js` file with a `node:test` test next to it.

Line numbers are at `4698e42`. Find the code by name if they moved.

## Request

A code review found three problems:

1. **Team colors.** `DEFAULT_SIDE_COLORS` still has the keys `blue` / `red`. The code reads it by `host` / `guest`.
2. **Schema guard.** A table with another `game.schema` is always reset. An old tab can reset a newer room and sync the reset to the server and the peer.
3. **Bundle size.** The main JS file is about 7.18 MB (1.89 MB gzip). Most of it is raw Jarvis data, three.js and Rapier.

The user chose the bundle fix: static data built with the app, not a database. The raw Jarvis files leave `src/`, a script writes trimmed files with only the used fields, and the table route is code split.

Out of scope: one shared `TEAMS` list (now in 6 files). A later plan does it.

## Facts

### Team colors

- `src/sideColors.js:7`: `DEFAULT_SIDE_COLORS = { blue: 'blue', red: 'red' }`. The comment above it says `{ host, guest }`. Commit `5a945e3` renamed the sides and missed this line.
- Readers by side: `Lobby.jsx:32` (`lobby-seat--undefined`), `Lobby.jsx:179`, `JoinRoom.jsx:76`, `RosterField.jsx:69` (`chip--player-undefined`). The CSS has only `chip--player-blue` / `-red` and `lobby-seat--blue` / `--red`, so these show with no color.
- `App.jsx:158`: the cleanup of the color effect calls `setSideColors(DEFAULT_SIDE_COLORS)`, so after a table closes, the store has `{ host: undefined, guest: undefined }`.
- `RosterPopup.jsx:63-64, 80`: from the lobby, `useSideColor(team)` is undefined. The title is "undefined player roster" with the class `roster-popup-title--undefined`.
- `sideColors.js` imports only `react`. It loads in Node (checked).

### Schema

- `net/doc.js:9`: `SCHEMA = 2`. `tableSchema(table)` gives `game.schema` or null for an empty document.
- `Table.jsx:225-228`: `if (tableSchema(table) !== SCHEMA) fillTable(...)`. It does not check which side is newer. A multiplayer room applies the server bytes before this check (`Table.jsx:221`), so the check sees the merged document.
- On 2026-10-12, SCHEMA went from 1 to 2 and every saved table was reset (this is the rule of `05-yjs-state.md`, decision 11: before the first release, all data is test data).
- `net/peer.js:383`: `versionMismatch = message.data !== build`. The connection still runs. `hello` data is the build id as a plain string (`net/signaling.js:14`). The API allows any string up to 8 KB (`apps/api/src/routes/signal.ts:12, 34`).
- The server merges each table write into the stored table (`apps/api/src/routes/table.ts:53`). It does not read `game.schema`.
- `net/debugFlags.js` has dev-only URL flags, for example `?build=test` for the version warning.
- `docs/features/peer-to-peer.md:330` says `SCHEMA (1)`. Line 293 lists the `game` fields without `priority` and `lastActivated` (`doc.js:12-21` has them). Line 94 says `hello` data is the app version.
- `docs/features/rooms.md:114` shows `version: 2`; the code has `VERSION = 3` (`rooms/store.js:13`). Line 128 describes the schema reset.

### Stale single player rooms

- `rooms/store.js`: `listRooms()` (55-67) and `openRoom()` (132) skip a record whose `version` is not 3. So a record of version 1 or 2 is never listed, opened or deleted. Its key stays in `localStorage` (a version 1 record also holds its whole old `table`), and its IndexedDB database `mcp-assist-3d/room/<id>` stays.
- Every record since the monorepo start has a `version` field.
- Multiplayer copies are already cleaned: `Lobby.jsx:64-72` calls `deleteStaleDocs` and `deleteStaleSquads` (`rooms/localDocs.js`) after the server list loads.

### Bundle

- Raw Jarvis files in `src/`, all imported at module level:
  - `characters/jarvis-characters.json`: 3.4 MB, 251 rows. Imported by `characters/characters.js:1` and `rosters/cards.js:9`.
  - `tactics/jarvis-tactics-cards.json`: 250 KB, 525 rows. Imported by `tactics/cards.js:3` and `rosters/cards.js:5`.
  - `crisis/jarvis-crisis-cards.json`: 180 KB, 72 rows. Imported by `crisis/cards.js:6` and `rosters/cards.js:10`.
- `tactics/jarvis-tactics-text.json` (226 KB) is already trimmed by `fetch-jarvis-tactics.mjs` and loads with `import()` (`tactics/faceData.js:16`). It stays as it is.
- Fields the runtime reads:
  - Characters (`characters.js` `rosterEntry` and the row filters, `rosters/cards.js:17-24`): `slug`, `name`, `exportCode`, `isAlternateSculpt`, `isGrunt`, `baseSize`, `threatLevel`, `affiliations[].{slug, isLeader, isLeaderWithTeamTactics}`, `alterEgo`, `tags` (only `peerless`, `rogueAgent`), `secondFormSlug`, `bearableGemsWithName[].{exportCode, threatLevel}`, and from `statCard`: the two staminas, `cardSizes(statCard)`, `sharedImmunities(jch)`, `dropPlacer(..., jch)` for both sides, `sharedPowerBonus(jch)`. The last three parse the power text with regexes.
  - Tactics: `exportCode`, `name`, `slug`, `isInfinityGem`. All rows: `tacticSlugs` (`rosters/cards.js:211`) reads every row with a code.
  - Crisis: `exportCode`, `name`, `slug`, `type`, `threatLevel`, only rows with `replacedBy === null` (51 rows). `crisis/cards.js:13` and `rosters/cards.js:115` test `replacedBy === null` / `!== null`.
- Trimmed size, measured with a scratch script: characters 162 KB (19 KB gzip), tactics 46 KB, crisis 8 KB.
- `characters/{immunity,power,size,dropPlacer}.js` have no imports, so a Node script can use them. `power.js` (`powerAfterPhase`), `immunity.js` (`SPECIAL_CONDITIONS`) and `size.js` (`sideSize`) are still used at runtime.
- Scripts that write or read the raw files: `fetch-jarvis-characters.mjs:24`, `fetch-jarvis-crisis-cards.mjs:8`, `fetch-jarvis-tactics.mjs:10-11`, `migrate-crisis.mjs:27-28` (Jarvis name warnings). The migrate scripts also import `src/characters/files.js`, `src/crisis/files.js`, `src/tactics/files.js`, `src/dice/faces.js`, `src/terrain/pieces.js`, and share `scripts/lib/files.mjs` (`readJson`, `writeJson`).
- Tests that read the raw characters file: `scoreboard/affiliations.test.js:3` (import with `type: 'json'`), `characters/power.test.js:12`, `immunity.test.js:7`, `dropPlacer.test.js:6`, `size.test.js:6` (`readFileSync`).
- Docs that name the raw files: `roster.md:66-68`, `crisis.md:178`, `setup-game.md:256`, `character-trays.md:298, 306`, `round-phases.md:68, 176`, `scripts/README.md` (269, 392, 406, 414, 470).
- three.js reaches the lobby chunk in three ways: `Root.jsx:2` imports `Table.jsx` statically; `Root.jsx:5, 169` use `LoadingOverlay`, which imports `useProgress` from drei; `main.jsx:13` calls `useGLTF.setDecoderPath`.
- Vite 5.4. `vite.config.js` has no `build` options.

## Decisions

1. **Side colors default to `{ host: 'blue', guest: 'red' }`.** That is the color before the roll off (`setup-game.md`, "Colors").
2. **What opens a table, by its schema:**
   - null (empty document): fill the start table.
   - equal to `SCHEMA`: open.
   - newer: do not open and do not write. Close the document and open the lobby with "This table was saved by a newer version of the app. Reload the page to update." The local copy stays.
   - older: run `migrate(table, from)`. If a step is missing, fill the start table, as today (test data rule). Before the first release, the migration chain is empty, so a schema 1 table still resets.
3. **Migration chain.** `MIGRATIONS` in `net/doc.js` maps a schema `n` to a function that changes a table from `n` to `n + 1`. `migrate` runs the steps and sets `game.schema` in one transaction. `OLDEST_MIGRATED = 2`: older schemas reset. A test asserts a step for every `n` from `OLDEST_MIGRATED` to `SCHEMA - 1`. So a SCHEMA bump without a step fails the tests.
4. **A migration step must give the same result when two browsers run it on their own copies and Yjs merges them.** It sets values by key. It does not add list entries with new random ids. The comment above `MIGRATIONS` says this.
5. **`hello` carries the schema.** Data is `JSON.stringify({ build, schema })`. A plain string (an older build) reads as `{ build: data, schema: null }`. When the schemas differ (null counts as different), the guest does not offer and the host does not answer. The other browser shows: "Your opponent uses a different version of the table data. The table does not sync. Both players should reload the page." This warning has no Close button, because the table does not sync while it shows. It replaces the build warning when both apply.
6. **`?schema=<n>`** is a new dev-only flag. It changes only the schema in `hello`, not the open check. So the user can test the warning with one browser pair and no table reset.
7. **Stale single player rooms are deleted** when the lobby mounts. Reasons: the app can never list, open or delete them; a version 1 record holds a whole table in `localStorage` (5 MB limit). The rule:
   - A record with no `version` or a `version` below `VERSION`: delete the record and its IndexedDB database (`deleteRoom`).
   - A record with a newer `version` (from a newer build in another tab) stays.
   - An IndexedDB database `mcp-assist-3d/room/<id>` with no record is deleted. `createRoom` writes the record before any table opens, and `deleteRoom` removes both, so a database without a record is never in use.
8. **Raw Jarvis files move to `apps/web/scripts/jarvis/`**, next to the other script data (`scripts/*-manifest.json`). Nothing in `src/` can import them.
9. **Trimmed files** are `src/characters/jarvis-rows.json`, `src/tactics/jarvis-rows.json`, `src/crisis/jarvis-rows.json`. Copied fields keep their Jarvis names. Derived fields get the runtime names: `staminaHealthy`, `staminaInjured`, `sizes`, `immune`, `dropPlacer`, `powerBonus`, `peerless`, `rogue`. All character and tactic rows stay (the runtime filters them). Crisis keeps only current printings, with their `replacedBy: null`, so the runtime checks stay true and do not change.
10. **One trim library, one trim script.** `scripts/lib/jarvis-trim.mjs` has `trimCharacters`, `trimTactics`, `trimCrisis`. `scripts/trim-jarvis.mjs` (`pnpm --filter web trim-jarvis`) writes all three from the raw files, with no network. Each fetch script calls the same function after it writes its raw file. Run `trim-jarvis` after a change to `immunity.js`, `power.js`, `size.js` or `dropPlacer.js`; a test catches a missed run (step 5).
11. **The game data is its own chunk through `manualChunks`, not `import()`.** The request named `import()` like `faceData.js`. `manualChunks` gives the same cached file, which changes only when the data changes. It is better here because:
    - The lobby needs the data at once (roster fields, roster popups, the join page). With `import()`, the data request starts only after the main chunk runs. A static import gets a `modulepreload` link, so both download in parallel.
    - `characters.js`, `rosters/cards.js`, `tactics/cards.js`, `crisis/cards.js` and `Library.jsx` build maps and lists at module level, and about 30 modules call them synchronously. `import()` needs a ready gate and an init function in each module. `manualChunks` needs no code change.
    - There is no loading state and no StrictMode case to handle.
    The chunk `game-data` holds the three `jarvis-rows.json` files and `characters/characters.json`, `tactics/cards.json`, `crisis/cards.json`.
12. **The table route loads with `lazy()`.** `Root.jsx` has one `loadTable = () => import('./Table.jsx')`, used by `lazy` and by a prefetch after the first render of `Root`. So opening a room does not wait for the chunk in most cases. The Suspense fallback is a new `LoadingScreen` with the look of `LoadingOverlay` and no drei. `LoadingOverlay` renders `LoadingScreen` with the file count.
13. **`useGLTF.setDecoderPath('/draco/')` moves** from `main.jsx` to module scope of `App.jsx`, which is in the table chunk and runs before any model loads.
14. **Equal output.** Step 6 dumps the runtime rows before and after the switch with a Vite SSR build of an uncommitted dump file, and diffs them. The dump file is not committed.
15. **The user tests at the end**, with the "User" lists of the steps. The user can also test after any step.

## Risks

1. **Tests that read the raw JSON.** Five tests read `jarvis-characters.json` by path (Facts). Step 6 moves the file, so the same step changes their paths. Node cannot load a module that imports `.json` without `with { type: 'json' }`, so the trim library reads files with `fs`, and no test imports `characters.js` or `rosters/cards.js`.
2. **Shared code of scripts and `src/`.** The migrate scripts import `src/*/files.js` and other plain `src/` files. The trim library adds `src/characters/{immunity,power,size,dropPlacer}.js`. These files must keep no Vite imports, no `import.meta`, no JSON imports. Step 6 moves files only inside `src/` paths that no script imports, except the raw files, whose script paths it changes.
3. **Stale trimmed data.** A change to the raw data or to a parser without `trim-jarvis` gives old values at runtime. The test of step 5 compares the committed trimmed files with a fresh trim.
4. **A field that the trim misses.** The dump diff of step 6 shows it. A build grep for `statCard` and `frontSide` (raw-only names) must give 0.
5. **P2P peers on different builds.**
   - Builds deployed before step 3 send a plain string in `hello`. The new build reads schema null and does not connect. The old build shows the build warning. Both players reload.
   - Builds deployed before step 2 still reset a newer table on open, and an open tab of such a build still writes its table to the server, which merges it. This plan cannot change deployed code. After the deploy of this plan, players reload once.
   - An open tab of a new build with an older schema keeps writing to the server after another browser migrated the table. Decision 4 keeps the merge safe. A server check of `game.schema` is out of scope; a later plan can add it.
6. **Two browsers migrate at once.** Decision 4.
7. **StrictMode** runs effects twice in dev:
   - The table open effect: the first run is cancelled before its document opens. The newer-schema exit runs only when `cancelled` is false, the same as the other exits.
   - The lobby cleanup of stale rooms runs twice. Both runs delete the same keys; a second delete finds nothing.
   - The table prefetch calls `import()` twice; the browser loads the module once.
8. **A lobby module that imports three.js by accident** puts it back in the main chunk. Step 7 checks the built entry chunk with a grep.
9. **The guest seat in a room with `side: null`** is not touched by any step.

## Step 1: Team colors

Work:

1. `src/sideColors.js:7`: `DEFAULT_SIDE_COLORS = { host: 'blue', guest: 'red' }`.
2. New `src/sideColors.test.js`: the keys are `host` and `guest`, the values `blue` and `red`; each side of `TEAMS` (`setup/setup.js`) has a color in `COLOR_NAME` and `COLOR_HEX`.

No feature doc change: `setup-game.md:57` already describes this.

User: the lobby tile chips and the seat names show Blue and Red colors; the join page roster chip; the roster fields of the new room dialog; a roster popup from the lobby says "Blue player roster" in blue; close a table, back in the lobby the same.

### Result

`DEFAULT_SIDE_COLORS` is now `{ host: 'blue', guest: 'red' }`. New `sideColors.test.js` with 2 tests (default keys and values; each `TEAMS` side has a name and a hex). Web tests: 808 pass, 0 fail. Lint: 58 warning lines before and after. Build passes. Facts matched the code, no deviation. One run of the `apps/api` tests failed once in a message list test and passed on another run; it is flaky and unrelated.

## Step 2: Schema check on open

Work:

1. `src/net/doc.js`:
   - `openAction(schema, current = SCHEMA)` → `'fill' | 'open' | 'migrate' | 'newer'` (decision 2).
   - `MIGRATIONS = {}`, `OLDEST_MIGRATED = 2`, the comment of decision 4.
   - `migrate(table, from, { steps = MIGRATIONS, to = SCHEMA } = {})`: true after it ran the steps `from` … `to - 1` and set `game.schema` to `to`, in one `table.transact`. False, with no change, when `from < OLDEST_MIGRATED` or a step is missing.
   - Update the comment at 7-8.
2. `src/Table.jsx:224-228`: switch on `openAction(tableSchema(table))`. `newer`: `close()`, `exit.current(<message of decision 2>)`, return; no `deleteDoc`. `migrate`: `if (!migrate(table, from)) fillTable(...)`.
3. `src/net/doc.test.js`: the four results of `openAction`; `migrate` with fake steps `{ 2: fn }` to 3 writes the field, sets schema 3 and gives one update; a missing step returns false and the document is unchanged; a schema below `OLDEST_MIGRATED` returns false; `MIGRATIONS` has a step for each `n` from `OLDEST_MIGRATED` to `SCHEMA - 1`.
4. Docs:
   - `peer-to-peer.md:293`: add `priority`, `lastActivated` to `game`.
   - `peer-to-peer.md:330`: the rule of decisions 2 to 4, `SCHEMA` (2).
   - `rooms.md:114`: `version: 3`. `rooms.md:128`: the open rule. A new decision in `rooms.md` for decision 2.

User: a single player room, a multiplayer room and the Sandbox open with their table, and keep it after a reload; a new room starts with the start table.

### Result

`net/doc.js` has `openAction`, `MIGRATIONS` (empty), `OLDEST_MIGRATED` and `migrate`. `Table.jsx` switches on `openAction`: a newer table closes and exits to the lobby with the reload message, no `deleteDoc`, no write; an older one is migrated, or reset when a step is missing. `migrate` sets the schema with `game.setField`, so other game fields stay. 5 new tests in `doc.test.js`. Docs: `peer-to-peer.md` (game fields, schema rule), `rooms.md` (`version: 3`, open rule, decision 18). Web tests: 813 pass, 0 fail. Lint: 58 warnings, same as before. Build passes. Facts matched the code, no deviation. The `apps/api` tests did not fail this time.

## Step 3: Schema in hello

Needs step 2.

Work:

1. `src/net/peer.js`:
   - New argument `schema`.
   - Pure `helloData({ build, schema })` and `readHello(data)` (decision 5). Export them.
   - `handle` (383): `versionMismatch` from `readHello(...).build`, new `schemaMismatch`. The guest does not call `makeOffer` and the host ignores an offer when the hello of its `from` has another schema.
   - `onState` gets `schemaMismatch`; the `emit` key includes it.
   - `postHello` and `reconnectHello` send `helloData(...)`.
2. `src/net/signaling.js:14`: rename the argument of `hello` to `data`. Update `signaling.test.js` if it names it.
3. `src/net/debugFlags.js`: `schemaOverride()` for `?schema=<n>`, dev only, a number or null.
4. `src/Table.jsx:260-266`: pass `schema: schemaOverride() ?? SCHEMA`.
5. `src/components/HudWarnings.jsx`: new prop `schemaMismatch`, the text of decision 5, no Close button, shown instead of the build warning. `App.jsx` passes `connection?.schemaMismatch`.
6. `src/net/peer.test.js`: `readHello` of JSON and of a plain string; same schema and build connects as before; another schema: the guest makes no offer, the host does not answer, `onState` has `schemaMismatch: true`; another build with the same schema still connects with `versionMismatch: true`.
7. Docs, `peer-to-peer.md`: line 94 (`hello` data), the paragraph at 170, the flag table at 499 (`?schema=<n>`), a new decision.

User: two browsers on the same build connect as before; `?build=test` in one shows the build warning and still connects; `?schema=3` in one shows the new warning in the other, with no Close button, and the moves do not sync; reload without the flag, they connect.

### Result

`hello` data is now `helloData({ build, schema })` (JSON); `readHello` reads it, and a plain string gives schema null. `connectRoom` takes `schema`, sets `schemaMismatch`; the guest makes no offer and the host answers no offer of a peer with another schema. `onState` and the `emit` key carry `schemaMismatch`. `signaling.hello` argument renamed `data`. New `schemaOverride()` (`?schema=<n>`, dev only), passed by `Table.jsx`. `HudWarnings` shows the schema warning with no Close button, instead of the version warning; `App.jsx` passes it. `peer.test.js`: raw hellos and `player` use JSON now; 6 new tests. `peer-to-peer.md`: `hello` data, schema paragraph (it has no decision list, so the reasons are in the paragraph), `?schema=<n>` flag. Deviation: no decision list in that doc.

## Step 4: Delete stale single player rooms

Work:

1. `src/rooms/localDocs.js`, pure:
   - `staleRoomIds(records, version)`: ids of records with no `version` or a lower one (decision 7).
   - `orphanRoomDocNames(names, ids)`: database names with the prefix `mcp-assist-3d/room/` whose id is not in `ids`.
   - `deleteStaleRooms()`: reads all room keys of `localStorage` (a raw read, not `listRooms`), deletes the stale ones with `deleteRoom`, then the orphan databases (with `indexedDB.databases()`, skipped when the browser does not have it).
2. `src/rooms/store.js`: export what item 1 needs (`VERSION`, a raw list of room records) without changing `listRooms` or `openRoom`.
3. `src/components/Lobby.jsx`: call `deleteStaleRooms()` in a mount effect. It does not need a login.
4. `src/rooms/localDocs.test.js`: version 1, 2, missing and 3 records; a newer version stays; an orphan name is found; a multiplayer name and another prefix are never found.
5. `docs/features/rooms.md`, "Storage": the cleanup rule, and a decision with the reasons of decision 7.

User: the lobby lists the same rooms as before; in DevTools, Application, the `localStorage` keys `mcp-assist-3d/room/*` with `version` 1 or 2 are gone after the lobby shows, with their IndexedDB databases.

### Result

`localDocs.js` has `staleRoomIds`, `orphanRoomDocNames` and `deleteStaleRooms`; `store.js` exports `VERSION` and `listRawRoomRecords` (`listRooms` uses it, same output). `Lobby.jsx` calls `deleteStaleRooms()` in a mount effect, with no login needed. 2 new tests. Docs: `rooms.md` has the cleanup rule, decision 19, the `localDocs.js` code row. Decision 14 now says version 3, `host` / `guest`; the stale "version 1 opens with a new table" line is gone. Web tests: 821 pass, 0 fail. Lint: 58 warnings, same. Build passes. Facts matched the code. The `apps/api` `signal.test.ts` failed once and passed on rerun (flaky).

## Step 5: Trimmed Jarvis files

No runtime change. The raw files stay in `src/` in this step.

Work:

1. Measure the build first: `pnpm --filter web build`. Copy the Vite chunk table (size and gzip of each JS file) into the Result as "before".
2. New `scripts/lib/jarvis-trim.mjs`: `trimCharacters(rows)`, `trimTactics(rows)`, `trimCrisis(rows)` with the fields of Facts and decision 9. It imports `src/characters/{immunity,power,size,dropPlacer}.js`.
3. New `scripts/trim-jarvis.mjs` and the `trim-jarvis` script in `apps/web/package.json`. It reads the three raw files and writes the three `jarvis-rows.json` with `writeJson` (`scripts/lib/files.mjs`).
4. `fetch-jarvis-characters.mjs`, `fetch-jarvis-crisis-cards.mjs`, `fetch-jarvis-tactics.mjs`: write the trimmed file after the raw file.
5. Run `pnpm --filter web trim-jarvis`. Commit the three new files.
6. New `scripts/lib/jarvis-trim.test.js`: a fresh trim of each raw file deep-equals the committed trimmed file; Multiple Man (`stamina` `"?"`) gives 0; a grunt gives `staminaInjured` 0; an alternate sculpt row is kept with its flag; a crisis row with `replacedBy` set is left out, and a kept row has `replacedBy: null`.
7. `scripts/README.md`: a section on the trimmed files, the trim script and when to run it.

User: nothing to test.

### Result

Build before (JS): `index` 7,180.95 kB (gzip 1,895.32 kB); `jarvis-tactics-text` 199.40 kB (gzip 42.44 kB).

Added `scripts/lib/jarvis-trim.mjs`, `scripts/trim-jarvis.mjs` (`pnpm --filter web trim-jarvis`), the three `jarvis-rows.json` files (rows: 251, 525, 51; 235 KB, 68 KB, 11 KB on disk, pretty-printed; characters 13 KB gzip). The three fetch scripts write their trimmed file after the raw file. `scripts/README.md` has a section on it. New `jarvis-trim.test.js` with 5 tests. Web tests: 826 pass, 0 fail. Lint: 58 warnings, same. Build passes, bundle unchanged (nothing imports the new files yet). `apps/api` tests passed.

Deviations from the facts:

- No raw character row has stamina `"?"` now (Multiple Man has 6 and 7). The test checks the `"?"` rule with a synthetic row.
- The raw tactics file is already trimmed by `fetch-jarvis-tactics.mjs` (11 fields), so `trimTactics` cuts it to 4 more.
- The trimmed characters file is larger than the 162 KB measured: `writeJson` indents it.

## Step 6: Runtime reads the trimmed files

Needs step 5.

Work:

1. Before any edit: write an uncommitted `apps/web/dump-rows.js` that imports `characters.js`, `rosters/cards.js`, `tactics/cards.js`, `crisis/cards.js` and prints JSON of: `CHARACTERS` (with grunts), `rosterCard(code)` for every `exportCode` of the three raw files, `CRISIS_THREATS`, `TACTICS`, `cardsOfType('secure')`, `cardsOfType('extract')`, and for every slug: `characterImmune`, `characterDropPlacer`, `characterPowerBonus`, `characterStamina`, `characterSize` for both sides. Build it with `pnpm --filter web exec vite build --ssr dump-rows.js --outDir <scratchpad>/dump-old`, run it with `node`, save `old.json` in the scratchpad.
2. `src/characters/characters.js`: import `./jarvis-rows.json`. `rosterEntry` reads the derived fields. Remove the imports of `immunity.js`, `power.js`, `dropPlacer.js` and `cardSizes`; keep `sideSize`.
3. `src/rosters/cards.js`, `src/tactics/cards.js`, `src/crisis/cards.js`: import the trimmed files. The `replacedBy` checks stay (decision 9).
4. `git mv` the three raw files to `scripts/jarvis/` (decision 8). Change the paths in the fetch scripts, `migrate-crisis.mjs`, `trim-jarvis.mjs`, `jarvis-trim.test.js` and the five tests of Risk 1. Fix the comment at `immunity.js:6`.
5. Build `dump-rows.js` again into `dump-new`, run it, and diff with `old.json`. The diff must be empty. Delete `dump-rows.js`.
6. `pnpm --filter web build`: list the chunks in the Result as "after step 6". `grep -c "frontSide\|statCard" dist/assets/*.js` gives 0.
7. Docs: the paths in `roster.md:66-68`, `crisis.md:178`, `setup-game.md:256`, `character-trays.md:298, 306`, `round-phases.md:68, 176`, `scripts/README.md`.

Checks: as in "Checks", plus `pnpm fallow` reports no new unused file or export.

User: Library lists and search; spawn a character and a grunt host; Damage limit; Give with an immunity; Power phase bonus; drop placer of a dazed character; roster popup with gem threats and the Breakdown with leaders; crisis and tactic cards in the setup; the new room dialog with an unknown code.

### Result

The app reads the three `jarvis-rows.json` files. Raw files moved with `git mv` to `scripts/jarvis/characters.json`, `tactics-cards.json`, `crisis-cards.json`. Paths changed in the three fetch scripts, `migrate-crisis.mjs`, `trim-jarvis.mjs`, `jarvis-trim.test.js`, and the five tests (the four character tests and `affiliations.test.js`). Comment at `immunity.js:6` fixed. Docs: `roster.md`, `crisis.md`, `setup-game.md`, `character-trays.md`, `round-phases.md`, `scripts/README.md`.

Dump diff: 604,445 bytes (237 `CHARACTERS`, 695 `rosterCard` codes, 400 `TACTICS`, 23 secure cards, 244 slugs with all per-side values); `cmp` of before and after is empty. `dump-rows.js` is not in the repo. `trim-jarvis` run again gives no change.

Build after step 6 (JS): `index` 4,931.64 kB (gzip 1,635.44 kB), was 7,180.95 kB (gzip 1,895.32 kB); `jarvis-tactics-text` 199.40 kB (gzip 42.44 kB), same. `grep -c "frontSide\|statCard"` gives 0 in both JS files.

Checks: web tests 826 pass, 0 fail. Lint 58 warnings, same. `pnpm fallow dead-code`: 27 unused exports, 1 unlisted dependency, same as before the step (no unused file added).

Deviations:

- Raw file names are short (`characters.json`, not `jarvis-characters.json`), since the folder says `jarvis`.
- `.oxfmtrc.json` and `.oxlintrc.json` ignore `apps/web/scripts/jarvis/*.json` (the old ignore was `apps/web/src/**/*.json`, so the moved raw files would be formatted).
- `trim-jarvis.mjs` now resolves all paths from `scripts/`.

## Step 7: Data chunk and table route split

Needs step 6.

Work:

1. `apps/web/vite.config.js`: `build.rollupOptions.output.manualChunks` puts the files of decision 11 into `game-data`.
2. New `src/components/LoadingScreen.jsx`: the markup of `LoadingOverlay` without `useProgress`. `LoadingOverlay` uses it.
3. `src/Root.jsx`: `loadTable`, `const Table = lazy(loadTable)`, `<Suspense fallback={<LoadingScreen />}>` around the three `Table` routes (153-158); line 169 uses `LoadingScreen`; a mount effect calls `loadTable()` (decision 12).
4. `src/main.jsx:13` → module scope of `src/App.jsx` (decision 13). `main.jsx` no longer imports drei.
5. `pnpm --filter web build`: list the chunks in the Result as "after step 7", with a before/after table of the entry chunk, the table chunk and `game-data`. Check: `grep -c "WebGLRenderer" <entry chunk>` gives 0 and the table chunk has it; the same for a Rapier string. If the entry chunk still has three.js, find the import and fix it.
6. `docs/features/rooms.md`, "Loading": the three chunks (lobby, table, game data), the prefetch and the fallback. A decision with the reasons of decisions 11 and 12.

User: a cold load of the lobby (DevTools, Network, "Disable cache") shows the lobby and loads `game-data` in parallel; opening a single player room, a multiplayer room, a join link and the Sandbox show the loading screen, then the table; models with Draco load; a reload inside a room opens it directly.

### Result

`game-data` is its own chunk (`manualChunks` in `vite.config.js`, the three `jarvis-rows.json` and the three `cards`/`characters.json` files). Table route loads with `lazy(loadTable)`; `Root` calls `loadTable()` in a mount effect. New `LoadingScreen.jsx` (props `done`, `count`, default 0); `LoadingOverlay` renders it; the Suspense fallback of the three Table routes and the wait page use it. `useGLTF.setDecoderPath` moved from `main.jsx` to module scope of `App.jsx`. `rooms.md` "Loading" describes the chunks, prefetch, fallback and reasons.

Chunks after step 7 (JS, raw / gzip):

| Chunk | Before (after step 6) | After |
|---|---|---|
| `index` (entry) | 4,931.64 kB / 1,635.44 kB | 1,101.61 kB / 401.65 kB |
| `Table` | none | 3,569.16 kB / 1,196.46 kB |
| `game-data` | none | 259.24 kB / 38.29 kB |
| `jarvis-tactics-text` | 199.40 kB / 42.44 kB | 199.40 kB / 42.44 kB |

Greps: `WebGLRenderer` and `RigidBody|rapier` give 0 in `index` and `game-data`, and match in `Table`. `statCard` gives 0 in all JS. `index.html` has a `modulepreload` for `game-data`, and the entry imports it statically.

Checks: web tests 826 pass, 0 fail (api tests passed, no rerun needed). Lint 58 warnings, same. Format clean.

Deviations: none. `LoadingScreen` shows "0 / 0 files" while the table chunk loads (same markup as the overlay).

## Open questions

None.

## Step 8: Lobby without fixed colors

From the user test on 2026-10-15. The lobby, the join page and the New room dialog show `host` as Blue and `guest` as Red. After the roll off, Priority can swap the colors (`colorOf` in `setup/setup.js`). Then the room shows a player as Blue and the lobby shows the same player as Red.

Decisions (user, 2026-10-15):

1. Multiplayer: no colors before the table. A tile shows each seat as the player's name and a "roster" link that opens the roster popup: "James roster", "Alice roster". A free seat shows "Free seat" and no roster link. The join page shows "<host name> roster". The New room dialog of a multiplayer room asks for "Your roster".
2. Single player: the roster links show the real color of each side, read from the saved table of the room (`colorOf` with that table's setup). Before the roll off this gives the start colors. When the table cannot be read, the link has no color and says "Roster 1" / "Roster 2". The New room dialog of a single player room shows "Blue roster" / "Red roster" (the start colors; the table does not exist yet).
3. The roster popup from the lobby takes its title and color from the caller, not from the side color store (that store belongs to the open table).

Work:

1. Find how the lobby can read a single player room's saved table (IndexedDB doc `mcp-assist-3d/room/<id>`, `net/doc.js`, `rooms/`) without opening the whole table. A pure `sideColorsOf(setup)` (or the existing helper) with a test.
2. `Lobby.jsx`, `JoinRoom.jsx`, `RosterField.jsx`, `NewRoomDialog.jsx`, `RosterPopup.jsx`, `RoomRosterPopup.jsx`: as in the decisions. Remove the local `TEAM_NAMES = { host: 'Blue', guest: 'Red' }` copies that are no longer needed.
3. Feature docs: `rooms.md` (lobby tile, join page), `roster.md` if it describes the lobby popup.

User: a multiplayer tile shows the two names with roster links and no colors; the join page link says "<host> roster"; a single player room before the roll off shows Blue and Red links; after a roll off where Priority swaps colors, back in the lobby the links show the swapped colors.

## Step 9: Loading screen without a file count

From the user test on 2026-10-15. While the table code downloads, the loading screen says "0 / 0 files". When the count is 0, `LoadingScreen` shows no count, only the loading animation. The count shows once there are files.

User: a cold load of a room shows no "0 / 0", then the file count.

### Result (step 8)

- Single player colors: not read from the table in the lobby (opening each IndexedDB table there is heavy). Instead the room record got `colors` { host, guest }, a copy like `mapId` and `rosters`. `watchRoomRecord` writes it from the table (`sideColorsOf(setup)`, new in `setup/setup.js`, test added), `createRoom` writes the start colors. A record from before has none: the lobby shows "Roster 1" / "Roster 2" with no color until the room is opened once.
- `rosterLinks(item)` in `rooms/roomList.js` (tests) gives the lobby links: multiplayer "<name> roster" with no color, single "Blue roster" / "Red roster" or the numbered fallback.
- `RosterPopup` takes `title` and `color` from the caller (`RosterPopupHost` reads the side store, the lobby and join page pass their own). `RosterField` takes `label` and `color`. Join page: "<host name> roster" link, field "Your roster". New room: "Your roster" (multiplayer), "Blue roster" / "Red roster" (single). Seat color labels and their CSS removed.
- Docs: `rooms.md`, `roster.md`.
- Fix after the user test: roster is a text link in the seat line, not a chip.

### Result (step 9)

`LoadingScreen` shows the detail line only when `count > 0`. With count 0 it shows the title and the empty bar. `rooms.md` says so. No deviations.
