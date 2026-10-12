# Plan: Fallow cleanup

Requested by the user on 2026-10-12. Status: done, waiting for the user's test. The user gave the OK on 2026-10-12. Branch `fallow-cleanup`, from main, after `setup-round-2` and `game-flow` merge into main. No other branch is open while this plan runs, because step 2 changes many files.

Each step makes one commit and writes its **Result** below. Feature docs change in the same step as the code.

Checks of every step: `pnpm format`, `pnpm lint`, `pnpm test`, `pnpm --filter web build`.

## Request

The user asked to check the repo with fallow (https://github.com/fallow-rs/fallow) and then to do all four proposals:

1. Remove the dead exports.
2. Add a fallow config, so that a run gives a clean baseline.
3. Move the shared code of the migrate scripts into `scripts/lib/`.
4. Split `App.jsx`. This is its own plan: `docs/plans/split-app.md`. It runs after this plan.

## Facts

From a run of fallow 3.33.1 at `895496b` (`game-flow`). Fallow is a Rust binary on npm. It finds unused files, exports and dependencies, copied code, and complex functions in JS and TS. A bare `fallow` run does all three analyses. Exit code 1 means findings.

### Unused code

- 5 exports are not used anywhere:
  - `searchCharacters` (`src/characters/characters.js`)
  - `STORED_FIELDS` (`src/components/storedTool.js`)
  - `worldToTrayRotation` (`src/dice/tray.js`)
  - `rosterRowInfo` (`src/rosters/layout.js`)
  - `AFFILIATIONS` (`src/scoreboard/affiliations.js`)
- 55 exports are used only in their own file. Most are constants in `src/tabletools/layout.js` (10), `src/dice/throw.js` (8) and `src/dice/tray.js` (7). A `git grep` of each name found no other use. Some names show up in comments of other files, for example "ROLL_HEIGHT_LIMIT in tray.js". Those comments stay correct.
- `src/settings/settings.js` exports `PLACES = ['table', 'hud']`, and nothing imports it. `src/components/SettingsPopup.jsx` has its own `PLACES` with the same two places and their labels.

### False findings

- Unused files `apps/api/src/lambda.ts` and `infra/bin/app.ts`. CDK reads them: `infra/lib/api-stack.ts` (`entry: .../lambda.ts`) and `infra/cdk.json` (`"app": "tsx bin/app.ts"`). Fallow does not read these two references.
- Unused dev dependency `esbuild` in the root `package.json`. CDK uses it to bundle the Lambda on the machine (`docs/features/backend.md`).
- Duplicate export `MAT_SIZE`. It is 4096 (texture pixels) in `scripts/lib/convert.mjs` and 36 (inches) in `src/table.js`. These are two different things with one name.
- Duplicate exports `createRoom`, `listRooms`, `deleteRoom` in `src/rooms/serverStore.js` and `src/rooms/store.js`. `store.js` keeps the local rooms and `serverStore.js` calls the API, so both have the same names on purpose.
- `public/draco/*.js` is vendor code. It fills the complexity report and is flagged as unused files, because the app loads it by URL.

### Copied code in `scripts/`

None of the shared jobs exists in `scripts/lib/` yet. The copies only use `cachedFile` (`lib/tts.mjs`) and `imageToWebp` (`lib/convert.mjs`).

| Job | Copies |
|---|---|
| `assetPath`, `readJson`, `writeJson` | `migrate-characters`, `-crisis`, `-tactics`, `-tokens`. `assetPath` also in `migrate-terrain.mjs:337` and `migrate-scoreboard.mjs:87`. Terrain has `saveManifest` (no key sort). The three `fetch-jarvis-*` scripts write JSON by hand |
| `slug` | 6 copies in 2 versions. Crisis, tactics, tokens and scoreboard first remove `'‘’.`. Characters and terrain keep them |
| `cardKeys` / `rowKeys`: row → `slug(name)`, throw on a duplicate | `migrate-crisis`, `-tactics` (`cardKeys`), `-tokens` (`rowKeys`) |
| `available`, `migrated`, `convert` of an image | `migrate-crisis`, `-tactics`, `-tokens`. Only the size differs: `TEXTURE_SIZE` 2048, `CARD_SIZE` 1040, `TOKEN_SIZE` 256 |
| `parseArgs` with `list`, `force`, `out`, `help`, usage and exit | `migrate-crisis`, `-tactics`, `-tokens` (same check), `migrate-characters`, `-terrain` (own check each) |
| Jarvis `HEADERS` and a fetch that throws when not ok | `fetch-jarvis-crisis-cards`, `-tactics`, `-characters` (`getJson`) |
| Create `diceCount` dice at free drop points | `dice-sim.mjs:273-286` and `:341-354`, identical |

Not worth sharing: the status text in `listCards` and the missing-file check in `migrate()` of crisis and tactics. The common part is 4–5 lines, and the code around it differs.

There are no tests for `scripts/`. The web test script runs `node --test "src/**/*.test.js"`.

## Decisions

1. **Fallow is a root dev dependency** with the exact version, and a root script `"fallow": "fallow"`. The user runs it by hand. It is not part of `pnpm lint`, a git hook or CI. The user chose this on 2026-10-12.
2. **The config is `.fallowrc.json` at the repo root**, with `$schema: ./node_modules/fallow/schema.json`. It ignores `apps/web/public/draco/**`, adds the two CDK entry points, and keeps `esbuild`. Fallow's cache folder `.fallow/` makes its own `.gitignore`. Add `.fallow` to the root `.gitignore` too, so the rule is visible.
3. **Rename `MAT_SIZE` in `scripts/lib/convert.mjs` to `MAT_TEXTURE_SIZE`.** This fixes the name clash instead of hiding it. The new name matches `TEXTURE_SIZE` and `CHARACTER_TEXTURE_SIZE` next to it.
4. **`createRoom`, `listRooms`, `deleteRoom` keep their names.** The config turns the duplicate-export rule off for `src/rooms/serverStore.js` (or a `fallow-ignore-file` comment, if the config cannot do it per file).
5. **Exports used only in their own file lose the `export` keyword.** The 5 dead ones are deleted. `SettingsPopup.jsx` keeps only the labels, keyed by place, and lists `PLACES` from `settings.js`, so the two lists cannot differ.
6. **`slug` keeps both versions** as one function with an option. Removing the punctuation in characters and terrain would change existing keys, for example `king-t-challa` → `king-tchalla`.
7. **Script tests run with the web tests.** The web test glob becomes `"{src,scripts}/**/*.test.js"`.
8. **A script refactor must not change its output.** Each changed migrate script runs again into a temp folder. Its manifest and file list must equal the committed ones.
9. **Complexity findings stay.** After this plan, `pnpm fallow` still exits 1 because of complex functions (most in `App.jsx`). The split plan reduces them. This plan does not set complexity thresholds.

## Step 1: Fallow setup

Work:

1. `pnpm add -Dw -E fallow` (the version at that time). If pnpm stops the install because of an install script, add `fallow` (or its platform package) to `allowBuilds` in `pnpm-workspace.yaml` with the reason in a comment, as for `esbuild`.
2. Root `package.json`: script `"fallow": "fallow"`.
3. `.fallowrc.json`, decisions 2 and 4. Read the keys with `pnpm fallow config-schema`. Check that the config is loaded with `pnpm fallow config`.
4. `.gitignore`: `.fallow`.
5. `scripts/lib/convert.mjs`: `MAT_SIZE` → `MAT_TEXTURE_SIZE`, also in every script that imports it.
6. `README.md`, "Lint and format": one short item. `pnpm fallow` finds unused files, exports and dependencies, copied code and complex functions. The config is `.fallowrc.json`. It exits 1 while complexity findings remain.

Checks: as in "Checks", plus `pnpm fallow dead-code`. Its only findings must be the 60 exports of step 2 (or the list at that time). No unused files, no unused dependencies, no duplicate exports.

User, after this step: run `pnpm fallow` once and read the output.

### Result

- `fallow` 3.33.1 added as exact root dev dependency. No `allowBuilds` entry was needed. Root script `"fallow": "fallow"`.
- `.fallowrc.json` keys: `$schema`, `entry` (the two CDK files), `ignorePatterns` (`apps/web/public/draco/**`), `ignoreDependencies` (`esbuild`), `ignoreExports` (`serverStore.js`: `createRoom`, `listRooms`, `deleteRoom`). `pnpm fallow config` loads it.
- `.gitignore`: `.fallow`. `MAT_SIZE` -> `MAT_TEXTURE_SIZE` in `convert.mjs` and `migrate-terrain.mjs`. README item added.
- `pnpm fallow dead-code`: 61 unused exports, 0 unused files, 0 unused dependencies, 0 duplicate exports. Plan said 60. List at this time, by file:
  - `scripts/lib/tts.mjs`: TTS_MODS
  - `auth/session.js`: AUTH_ON
  - `bumps.js`: REMOTE_DIE_BUMP_MIN, REMOTE_DIE_BUMP_MAX, REMOTE_GAP_MS
  - `characters/characters.js`: searchCharacters
  - `characters/overlap.js`: OVERLAP_MIN, HEIGHT_TOLERANCE, overlaps
  - `characters/trays.js`: TRAY_WIDTH, TRAY_CONTROLS_DEPTH, TRAY_DEPTH
  - `components/CharacterModel.jsx`: BASE_RADIUS
  - `components/OnTable.jsx`: BOARD_READ_ROTATION
  - `components/storedTool.js`: STORED_FIELDS, roundPoint, storedSnap
  - `crisis/cards.js`: CARDS
  - `dice/throw.js`: SETTLE_LINEAR, SETTLE_ANGULAR, TILT_LIMIT_DOT, THROW_UP_MIN, THROW_UP_MAX, THROW_SPIN_MIN, THROW_SPIN_MAX
  - `dice/tray.js`: WELL, SHELF, DROP_HEIGHT, DIE_FLAT_HEIGHT, worldToTray, worldToTrayRotation, ROLL_HEIGHT_LIMIT
  - `net/livePose.js`: FOLLOW_TIME, kindOf
  - `net/ownership.js`: sameSet; `net/peer.js`: GATHER_MS; `net/traffic.js`: minutesOf
  - `rooms/serverTable.js`: WRITE_DELAY, KEEPALIVE_LIMIT; `rooms/store.js`: userId
  - `rosters/breakdown.js`: SHARED_ALTER_EGOS; `rosters/cards.js`: cardKind, breakdownUnits; `rosters/layout.js`: rosterRowInfo
  - `scoreboard/affiliations.js`: AFFILIATIONS; `scoreboard/board.js`: SNAP_RADIUS
  - `settings/settings.js`: PLACES, TOOL_ITEMS
  - `setup/names.js`: FALLBACK_NAME, GONE_NAME; `setup/rollOff.js`: shelfCounts
  - `tabletools/layout.js`: RACK_HALF_WIDTH, RACK_Z_MIN, RACK_Z_MAX, POWER_GAP, POWER_WIDTH, POWER_DEPTH, EDGE_GAP, EDGE_WIDTH, SQUAD_PANEL_MARGIN, SQUAD_PANEL_WIDTH
- Differences: `ignoreExports` used for decision 4, because a per-file `overrides` rule does not work for inter-file `duplicate-exports`. Count is 61 (game-flow merged since the run); the 5 dead ones are all still there.

## Step 2: Dead exports

Work:

1. Get the current list: `pnpm fallow dead-code --format json`. It can differ from the list in "Facts", because `game-flow` merged after the run.
2. `pnpm fallow fix --dry-run` shows what fallow would change. Apply it if it only removes `export` keywords. Otherwise remove them by hand.
3. Delete the 5 exports that nothing uses (oxlint `no-unused-vars` shows them after item 2). Delete imports and helpers that become unused because of this.
4. `SettingsPopup.jsx`: decision 5.
5. Comments and docs that name a removed symbol: `git grep -n` each of the 5 names in `apps/` and `docs/features/`.

Checks: as in "Checks". `pnpm fallow dead-code` reports nothing.

User, after this step: open the Settings menu. The Table/HUD choice of each tool works as before.

### Result

- 61 findings at start. 55 lost the `export` keyword (by hand, a script; no fallow fix). 5 deleted: `searchCharacters`, `STORED_FIELDS`, `worldToTrayRotation`, `rosterRowInfo`, `AFFILIATIONS`. No helper or import became unused. 1 kept: `PLACES` in `settings.js` stays exported, as `SettingsPopup.jsx` now imports it (labels in `PLACE_LABELS`, decision 5).
- `docs/features/roster.md`: `rosterRowInfo` removed from the layout.js row. Other docs and comments name symbols that are now module-private (for example `TRAY_WIDTH`, `ROLL_HEIGHT_LIMIT`). They stay correct.
- `pnpm fallow dead-code` reports nothing.

## Step 3: Shared files, keys and Jarvis fetch in `scripts/lib/`

Work:

1. New `scripts/lib/files.mjs`:
   - `readJson(file, fallback = file)` returns the parsed object of the first file that exists, else `{}`.
   - `writeJson(file, data, { sortKeys = true } = {})` writes pretty JSON with a trailing newline. It sorts the keys of objects only, never of arrays.
   - `outputPath(root, file)` creates the folder and returns the full path.
2. New `scripts/lib/keys.mjs`:
   - `slug(text, { keepPunctuation = false } = {})`. Characters and terrain pass `keepPunctuation: true`.
   - `uniqueKeys(rows, { name = (r) => r.name, noun = 'cards' } = {})` returns a `Map` from row to key. It throws on a duplicate key, with the same message as today.
3. New `scripts/lib/jarvis.mjs`: `JARVIS_HEADERS` and `fetchJarvis(url)`. It returns the JSON and throws when the response is not ok.
4. Use them in `migrate-characters`, `-crisis`, `-tactics`, `-tokens`, `-terrain`, `-scoreboard` and the three `fetch-jarvis-*` scripts. Terrain's `saveManifest` and the fetch-jarvis writes use `sortKeys: false`. `characterKeys` (characters) and `sameName` (crisis) stay in their scripts.
5. Tests next to the new files:
   - `slug`: "M'Kraan" → `mkraan`, "S.W.O.R.D." → `sword`, "King T'Challa" → `king-t-challa` with `keepPunctuation`.
   - `uniqueKeys` throws on a duplicate.
   - `writeJson` sorts the keys, adds the newline and keeps arrays as arrays.
6. `apps/web/package.json`: test glob `"{src,scripts}/**/*.test.js"`.
7. `scripts/README.md`: one line per new lib file.

Checks: as in "Checks", plus:
- For each changed migrate script: run it with `--out` into a temp folder. Its manifest and file list must equal the committed ones. Run `--list` too.
- Run each `fetch-jarvis-*` script. `git diff` of its data file must be empty. If Jarvis changed its data, say so in the Result and restore the file with `git checkout`.

### Result

- New: `scripts/lib/files.mjs` (`readJson`, `writeJson`, `outputPath`), `lib/keys.mjs` (`slug`, `uniqueKeys`), `lib/jarvis.mjs` (`fetchJarvis`), tests `lib/files.test.js` and `lib/keys.test.js`. `writeJson` sorts the top level only, like the old copies.
- Changed: `migrate-characters`, `-crisis`, `-tactics`, `-tokens`, `-terrain`, `-scoreboard`, the three `fetch-jarvis-*` scripts, test glob, `scripts/README.md` ("Shared code").
- Terrain wraps `slug` as `mapSlug` (`keepPunctuation: true`). Scoreboard uses `writeJson` and the shared `slug`; its own duplicate-key check stays.
- Difference from plan: `JARVIS_HEADERS` is not exported (only `fetchJarvis` uses it; fallow reported it).
- Output equality, before vs after the refactor (AssetRipper linked from the main dir `tools/`, TTS cache present): `--list` text and `--out` runs of characters (`asgard`), crisis, tactics, tokens, terrain (map 282). Console output, manifest, data JSON and a sha of all 372 files equal. Scoreboard has no `--out`: ran in place, sha of `affiliations.json` and its assets equal before and after (the committed `affiliations.json` is behind the TTS cache by 2 affiliations, so the files were restored with `git checkout` / `git clean`).
- Fetch-jarvis: crisis cards, empty diff. Tactics (new cards, codes) and characters (8 changed) have new Jarvis data, with only content lines changed. Files restored with `git checkout`. Byte equality is shown only for crisis; for the other two the diff has no format-only lines.
- Not verified: `--help`/wrong-argument output (step 4). Terrain bundle path was run with map 282 only.
- `pnpm test`: the api test `signal.test.ts` failed once and passed on rerun (not related).

## Step 4: Image store, CLI arguments and dice-sim

Work:

1. New `scripts/lib/manifest.mjs`: `createImageStore({ assets, manifest, force, maxSize })` returns `{ available(f), migrated(f), convert(f) }`, where `f` is `{ file, url }`. It replaces the copies in `migrate-crisis`, `-tactics`, `-tokens`. The character check (`manifest[key].sources`) stays in its script.
2. New `scripts/lib/cli.mjs`: `parseMigrateArgs(usage, isValid = (opts, positionals) => !positionals.length)` returns `{ opts, positionals }`. It prints the usage and exits on `--help` or when `isValid` is false. Characters and terrain pass their own `isValid` (today's check, unchanged).
3. `dice-sim.mjs`: one function `spawnDice(RAPIER, world, random, diceCount)` in the same file replaces both copies.
4. `scripts/README.md`: the two new lib files.

Checks: as in "Checks", plus:
- The migrate checks of step 3 for crisis, tactics, tokens, characters and terrain.
- `--help` and a wrong argument count print the same usage text as before.
- `pnpm --filter web dice-sim` gives the same output as before this step (default `--seed 1`).

### Result

- New: `scripts/lib/manifest.mjs` (`createImageStore`), `lib/cli.mjs` (`parseMigrateArgs`), test `lib/cli.test.js`. README "Shared code" lists both.
- Changed: `migrate-crisis`, `-tactics`, `-tokens` use the image store (size stays in each script); `migrate-characters` and `-terrain` use `parseMigrateArgs` with their own `isValid` (same conditions as before); `dice-sim.mjs` has `spawnDice`, used by `runMulti` and `runPerf`.
- Tests: `cli.test.js` covers only the valid path (default `isValid`, and the arguments passed to `isValid`). The `--help` and invalid paths call `process.exit`, so they are checked by running the scripts.
- Output equality, before vs after (AssetRipper linked from the main dir `tools/`, removed after): `--list` and `--out` runs of crisis, tactics, tokens, characters (`asgard`), terrain (map 282). Console output (with the temp path normalized), manifests, data JSON and sha1 of all 372 output files equal.
- `--help` of the 5 scripts, and a wrong argument count (extra argument for crisis, tactics, tokens; `--list a b` and no argument for characters and terrain; `a b` for terrain): stdout, stderr and exit code equal.
- `dice-sim` (seed 1): full output equal except the wall-clock line `42 dice perf` (0.265 vs 0.260 ms/step).
- Not verified: `--force` path of the image store (not run); `-h` short flag.
- `apps/api` `signal.test.ts` ("returns only newer messages for x-after") failed in two of three runs, passed on another: flaky, not touched.

## Step 5: Final run

Work:

1. Run `pnpm fallow`. Write in the Result: unused code (expected: none), duplication (lines, groups left and why they stay), complexity (count of functions above the thresholds, the top 5).
2. Move the copied-code facts of this plan that stay true into `scripts/README.md`, if steps 3 and 4 did not.

Checks: as in "Checks".

### Result

`pnpm fallow` at the end (exit 1, complexity and duplication only):

- Unused code: none (`pnpm fallow dead-code` clean).
- Duplication: 7 clone groups, 163 lines (0.5%), 11 files. All left:
  - Popup frame in `NewRoomDialog`, `RosterPopup`, `SettingsPopup` (3 groups, 10-17 lines). Component copies, "Not in this plan".
  - `TokenDragPreview` / `ToolDragGhost` (17), `LooseToken` / `TokenPile` (10), `DragFootprint` / `RulerTool` (11). Same reason.
  - `migrate-crisis` / `migrate-tactics` (2 groups, 12 and 10 lines): status text and missing-file check in `migrate()`. Judged not worth sharing in "Facts".
- Complexity: 264 functions above thresholds (cyclomatic 20, cognitive 15, CRAP 30); 60 critical, 71 high, 133 moderate. Top 5 by cognitive: `Scene` in `Scene.jsx` (198), `App` in `App.jsx` (180), `Tool` in `RulerTool.jsx` (93), arrow function at `DiceTray.jsx:642` (68), `CharacterFigure` in `CharacterModel.jsx` (65). `App.jsx` also has `handleKeyDown` (52). The split plan reduces `App`.
- Item 2: `scripts/README.md` "Shared code" already lists every shared file. Nothing to move.

## Not in this plan

- The small copies in components: the popup frame in `NewRoomDialog`, `RosterPopup` and `SettingsPopup`; `TokenDragPreview` and `ToolDragGhost`; `LooseToken` and `TokenPile`; `DragFootprint` and `RulerTool`. They can be a later plan.
- Complexity: `docs/plans/split-app.md`.
- Flaky `apps/api` test `signal.test.ts` "returns only newer messages for x-after" (failed 2 of 3 runs in step 4).
- Jarvis has new data (new tactics cards, 8 changed characters, see Step 3 Result).
- `affiliations.json` lacks Intelligencia and Thunderbolts that the TTS cache has.

## Open questions

None.
