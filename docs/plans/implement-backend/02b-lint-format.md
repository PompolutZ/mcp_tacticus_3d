# Step 2b: Lint and format

Detailed plan of step 2b in `docs/plans/implement-backend.md`. The user asked for it on 2026-10-09, after phase 1 of step 3.

## Goal

The whole repo gets one linter (oxlint) and one formatter (oxfmt). Both are written in Rust and check the repo in well under a second, so they can run on every change and in CI. The step comes before phase 2 of step 3, so the infra code is linted and formatted from its first line. Step 4 adds both to CI.

## Scope

In the step:
- Root dev dependencies `oxlint` and `oxfmt`, root config files, root scripts.
- Fixes of the 5 findings of the default rules. Nothing else in the code changes behavior.
- One format of all code, in its own commit. `.git-blame-ignore-revs` lists that commit.
- Docs: `README.md`, `CLAUDE.md`, the overview plan (step 4 runs both), the backend doc (CI list).

Left for later steps:
- The 44 React warnings in the web app (see decision 3). A later step fixes them, and the user checks each change in the browser.
- Type-aware lint rules (`oxlint --type-aware`). `tsc` checks types in `api` and `infra`.
- CI (step 4).

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step"), and this plan.
- Do not open the app in a browser. Do not start the web dev server or the API process.
- Do not commit and do not push. The lead agent commits after each phase (see "Commits").
- Temporary files go in the scratchpad: `/private/tmp/claude-501/-Users-olehlutsenko--dev-mcp-assist-3d/c73ce97d-fff7-40d5-acb9-917780e055b1/scratchpad/`.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| Tools | `oxlint` 1 (1.87.0 on 2026-10-09), `oxfmt` 0.x (0.72.0). Root dev dependencies. Neither has an install script |
| Config files | `.oxlintrc.json`, `.oxfmtrc.json` at the root |
| Root scripts | `lint`: `oxlint`. `format`: `oxfmt`. `format:check`: `oxfmt --check` |
| Format options | `semi: false`, `singleQuote: true`, `printWidth: 100`. The rest stays at the defaults (2 spaces, trailing commas) |
| Blame file | `.git-blame-ignore-revs` |

## Decisions that fill gaps in the design

1. **One config at the root.** Both tools run once for the whole repo from the root scripts. The packages get no own lint or format scripts. Reason: both tools are fast, and one config cannot drift between packages.
2. **Format style.** The style of today's code: no semicolons, single quotes. Width 100 (the user's choice). A trial on a copy of the repo changed about 95 code files (+4354 / −1333 lines).
3. **Lint rules.**
   - Plugins: the defaults (`eslint`, `typescript`, `unicorn`, `oxc`), plus `react`, `import` and `vitest`. The `plugins` field replaces the default list, so it names all of them.
   - Category `correctness`: `error`.
   - These rules are `warn`: `react/immutability`, `react-hooks/exhaustive-deps`, `react/set-state-in-effect`, `react/refs`. On 2026-10-09 they found 44 places in the web app (20, 19, 4, 1). React Three Fiber code changes three.js objects on purpose, and the app does not use the React Compiler. A fix of `exhaustive-deps` can change when an effect runs. Therefore the user decided: warnings now, fixes later.
   - `pnpm lint` fails on errors, not on warnings. `--deny-warnings` comes when the warnings are fixed.
   - Environments: `browser` for `apps/web/src`, `node` for `apps/api`, `infra`, `apps/web/scripts` and config files. Only if the rules need it.
   - If the `import` or `vitest` plugin finds anything that is not in this plan, stop and report the counts.
4. **Ignored files** (both tools): `**/dist/**`, `**/cdk.out/**`, `apps/web/public/**` (vendored Draco and other copied files), `apps/web/tools/**`, `pnpm-lock.yaml`, `**/*.md`. Also the JSON files in `apps/web/src/` that the scripts write (for example `jarvis-tactics-cards.json`). The migrate and fetch scripts write them again on each run. Formatting them would add about 10,000 changed lines, and the next script run would undo it. Check in `apps/web/scripts/` which JSON files the scripts write, and ignore exactly those (a glob is fine if all JSON files in a folder come from scripts). Markdown: the docs are written by hand, and a formatter would realign every table.
5. **The 5 findings of the default rules** are fixed in phase 1. Each fix keeps the behavior:
   - `apps/web/src/App.jsx`: the unused `setAffiliations`.
   - `apps/web/scripts/lib/unity-prefab.mjs`: the unused `GAME_OBJECT`.
   - `apps/web/src/components/footprintProjection.js`: two `new Array(n)`. Keep the same array contents and the same speed (this code may run per frame). Explain the change in the **Result**.
   - `apps/api/test/config.test.ts`: a fifth finding, `vitest/no-conditional-expect`. It was found after this plan was written, in the code of step 3. The test "names the missing parameter and shows no value" had an `expect` in a `catch`. The try/catch goes. The first check becomes `toThrow(new Error('Missing SSM parameter /mcptacticus/prod/mongodb-uri'))`. An `Error` instance makes vitest compare the whole message, so the message cannot contain the value `topsecret`. The rule stays at `error`.
6. **The format commit is separate.** It contains only the output of `pnpm format`. So `git blame` can skip it with `.git-blame-ignore-revs`. GitHub reads this file on its own. Local git needs `git config blame.ignoreRevsFile .git-blame-ignore-revs` once.
7. **Proof that the format changes no code.** The production build must give the same files before and after the format. The minifier removes whitespace and comments, so formatting cannot change the output. A different file means a real code change.
8. **Agents run both tools.** `CLAUDE.md` gets one rule: after a code change, run `pnpm format` and `pnpm lint`. Both are safe to run at any time.

## Phase 1: Tools, config, fixes, docs

Read: `apps/web/scripts/README.md` (which files the scripts write), the oxlint and oxfmt docs for the config files.

Work:
1. `pnpm add -Dw oxlint oxfmt`.
2. `.oxfmtrc.json` (decisions 2 and 4). `.oxlintrc.json` (decisions 3 and 4).
3. Root scripts (see "Names").
4. The fixes of decision 5.
5. `README.md`: a short part "Lint and format": `pnpm lint`, `pnpm format`, `pnpm format:check`, and that the Oxc extension adds both to VS Code. The blame setting of decision 6.
6. `CLAUDE.md`: decision 8.
7. `docs/plans/implement-backend.md`:
   - The row of step 2b in "Order", after step 2. Needs: 2. Detailed plan: `02b-lint-format.md`.
   - A short section "Step 2b: Lint and format" after step 2, with the **Result** later.
   - Step 4: CI runs `pnpm lint` and `pnpm format:check`.
8. `docs/feature-backend.md`, "GitHub Actions": `ci.yml` also runs `pnpm lint` and `pnpm format:check`. "pnpm": the root scripts `lint`, `format`, `format:check`.

Checks:
- `pnpm install`: no build script warning.
- `pnpm lint`: 0 errors. The warnings are only the 4 React rules of decision 3. Record their counts.
- `pnpm typecheck`, `pnpm test`, `pnpm --filter web build` pass.
- `git status`: only the files of this phase. `pnpm format` has not run yet.

### Result

Done on 2026-10-09. Not committed yet.

What changed:
- Root dev dependencies `oxlint` 1.87.0 and `oxfmt` 0.72.0. `pnpm install` shows no build script warning.
- `.oxlintrc.json`: plugins `eslint`, `typescript`, `unicorn`, `oxc`, `react`, `import`, `vitest`. `correctness` is `error`. The 4 React rules are `warn`. No `env` was needed.
- `.oxfmtrc.json`: `semi: false`, `singleQuote: true`, `printWidth: 100`.
- Root scripts `lint`, `format`, `format:check`.
- Docs: `README.md` (Lint and format), `CLAUDE.md` (decision 8), `docs/plans/implement-backend.md` (row and section of step 2b, CI in step 4), `docs/feature-backend.md` (CI list and root scripts).

Warnings, all in the web app (44 in total):
- `react/immutability`: 20
- `react-hooks/exhaustive-deps`: 19
- `react/set-state-in-effect`: 4
- `react/refs`: 1

Ignored JSON files (both tools), besides the plan's list:
- `apps/web/src/**/*.json`. All 9 files there are written by the migrate and fetch scripts: `characters.json`, `jarvis-characters.json`, `crisis/cards.json`, `crisis/tokens.json`, `jarvis-crisis-cards.json`, `tactics/cards.json`, `jarvis-tactics-cards.json`, `tokens/tokens.json`, `scoreboard/affiliations.json`. A format would be undone by the next script run.
- `apps/web/scripts/*-manifest.json`. The migrate scripts write all 4 manifests.

Fixes:
- `App.jsx`: `const [affiliations] = useState(...)`. The unused setter is gone.
- `unity-prefab.mjs`: removed the unused `GAME_OBJECT`.
- `footprintProjection.js`: `new Array(MAX_FOOTPRINTS).fill(x)` is now `Array.from({ length: MAX_FOOTPRINTS }, () => x)`, for `uFpKind` and `used`. The arrays have the same length (6) and the same values. They are built once, when the module loads. The code that runs per frame reads and writes the same arrays as before, so the speed is the same.
- `apps/api/test/config.test.ts`: the fifth finding, see decision 5. The `vitest` plugin found it in the code of step 3. The rule stays at `error`.

Differences from the plan:
- 5 findings, not 4 (the test above). The `import` plugin found nothing.
- The scratchpad path was the one the user gave for this session, not the path in the plan.

Checks: `pnpm lint` has 0 errors and 44 warnings. `pnpm typecheck`, `pnpm test` (14 tests) and `pnpm --filter web build` pass. `pnpm format` has not run.

## Phase 2: Format

Starts after the commit of phase 1.

Work:
1. Before the format: `pnpm --filter web build`. Save the sorted list of `apps/web/dist` files with their SHA-256 to `dist-before.txt` in the scratchpad.
2. `pnpm format`.
3. `pnpm --filter web build` again. Save the same list to `dist-after.txt`.

Checks:
- `pnpm format:check` passes.
- `dist-before.txt` and `dist-after.txt` are the same (decision 7). If not, stop and report which files differ.
- `pnpm lint` (same counts as phase 1), `pnpm typecheck`, `pnpm test` pass.
- `node apps/web/scripts/dice-sim.mjs --quick` runs.
- `git diff --stat | tail -1`: record the numbers. `git status` shows only formatted files. No JSON file of decision 4 and no `.md` file changed.

### Result

Done on 2026-10-09. The Result is not in the format commit.

- `pnpm format` formatted 131 files. `git diff --stat`: 99 files changed, 4390 insertions(+), 1345 deletions(-).
- Besides code files, it changed `apps/web/index.html` (the inline CSS goes to one rule per line), `netlify.toml` (indent under `[build]`) and `package.json` (key order). These are expected.
- No JSON file of decision 4 changed. No `.md` file changed.
- Build proof: 644 files in `apps/web/dist` before and after. 643 have the same SHA-256. Only `dist/index.html` differs. The difference is whitespace in the inline `<style>` block: the same rules, split into lines. With all spaces and newlines removed, the two files are equal. So the format changed no code.
- `pnpm format:check` passes. `pnpm lint`: 0 errors, 44 warnings (same counts as phase 1). `pnpm typecheck` and `pnpm test` (14 tests) pass. `node apps/web/scripts/dice-sim.mjs --quick` runs (chi-squared 4.11 PASS, 0.255 ms/step).
- No difference from the plan, except the `index.html` whitespace above.

## Phase 3: Blame file

Starts after the commit of phase 2.

Work:
1. `.git-blame-ignore-revs`: one comment line, and the full hash of the format commit.
2. The **Result** under step 2b in `docs/plans/implement-backend.md`.

Checks:
- `git blame --ignore-revs-file .git-blame-ignore-revs apps/web/src/Root.jsx | head` shows commits older than the format commit.

### Result

Done on 2026-10-09.

- `.git-blame-ignore-revs` has one comment line and the hash of the format commit: `b9fce64e10197c9a9f53e959f09cf4687e7beaf1`.
- `git blame --ignore-revs-file .git-blame-ignore-revs apps/web/src/Root.jsx` shows older commits (`7189e90d`, 2026-10-07), not the format commit.
- No difference from the plan.

## Commits

The lead agent commits after the checks of each phase pass. It does not push.

1. Before phase 1: phase 1 of step 3 (done: `4e1c7d4`). Then the format of phase 2 does not mix with it.
2. After phase 1: "add oxlint and oxfmt".
3. After phase 2: only the output of `pnpm format` ("format with oxfmt"). The **Result** of phase 2 in this plan is not in this commit. It goes into the commit of phase 3.
4. After phase 3: the blame file and the plan results ("add git blame ignore file").

## User

1. After phase 2: test in the browser that the app works as before.
2. Optional: `git config blame.ignoreRevsFile .git-blame-ignore-revs`, and the Oxc extension in the editor.

## Done when

- `pnpm lint` has 0 errors. `pnpm format:check` passes.
- The web build output is the same before and after the format.
- `pnpm typecheck`, `pnpm test`, `pnpm --filter web build` pass.
- `git blame` skips the format commit.

## Risks and open questions

1. **oxfmt is before 1.0.** A new minor version can change the output. `^0.72.0` allows only 0.72.x. A later update runs `pnpm format` in its own commit.
2. **Which step fixes the 44 React warnings.** Step 5 changes the table state in the same components. It may be the right time. Decide when the plan of step 5 is written.
3. **Build output differs after the format.** Then the formatter changed code, or the build is not repeatable. Phase 2 stops and reports.
