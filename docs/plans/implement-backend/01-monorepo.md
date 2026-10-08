# Step 1: Monorepo

Detailed plan of step 1 in `docs/plans/implement-backend.md`. The design is in `docs/feature-backend.md` ("Repo layout", "pnpm", "Deploy" → "Netlify").

## Goal

The repo becomes a pnpm workspace, and today's app moves to `apps/web/`. Steps 2 and 3 add `apps/api/` and `infra/` next to it. The move comes first, because every later step adds files into this layout. The app does not change: the same dependency versions, the same build output, the same Netlify site.

## Scope

In the step:
- npm → pnpm, with the same versions.
- The move of the web app to `apps/web/`, and the root files of the workspace.
- `netlify.toml`.
- New paths and commands in the docs that describe how to run things today.

Left for later steps:
- `apps/api`, `tsconfig.base.json`, the root scripts `test` and `typecheck`, the Vite proxy (step 2).
- `infra/`, and `esbuild` in the root `package.json` (step 3, see decision 3).
- `.env.local` in `.gitignore` (step 6).

## Rules for every phase

- Read `CLAUDE.md`, `docs/plans/implement-backend.md` ("Rules for every step", "Step 1"), this plan, and the design sections named above.
- Do not open the app in a browser. Do not start the dev server.
- Do not commit and do not push. `git mv` stages the moves. Leave all changes in the working tree.
- Temporary files go in the scratchpad: `/private/tmp/claude-501/-Users-olehlutsenko--dev-mcp-assist-3d/c73ce97d-fff7-40d5-acb9-917780e055b1/scratchpad/`.
- Keep tool output small (`head`, `grep`, `tail`, summaries).
- Docs: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- If a check fails and the fix is not in this plan, stop and report. Do not change the plan's decisions on your own.

## Names

| Thing | Value |
|---|---|
| Web package | `apps/web/`, name `web` |
| pnpm | `"packageManager": "pnpm@12.10.0"` (latest pnpm 12 on 2026-10-08). Local pnpm is 11.13.0. It downloads 12.10.0 when it reads the field |
| Node | `.node-version`: `24`. Local Node is 24.15.0 |
| Root scripts | `"dev": "pnpm --filter web dev"`, `"build": "pnpm --filter web build"` |
| Web build | `pnpm --filter web build`, output in `apps/web/dist/` |
| A web script with arguments | `pnpm --filter web migrate-terrain --list` |
| Baseline files | `baseline-dist.txt`, `baseline-dice-sim.txt`, `baseline-versions.txt` in the scratchpad |

## Decisions that fill gaps in the design

1. **pnpm version first.** Add `packageManager` to today's `package.json` before any other pnpm command. So `pnpm import` and every later command run on 12.10.0, the same as Netlify.
2. **Lockfile before the move.** Run `pnpm import` at the root while `package.json` and `package-lock.json` are still there. It creates the importer `.`. After the move, rename the importer `.` to `apps/web` in `pnpm-lock.yaml`, then run `pnpm install`. It adds the root importer and keeps the resolved versions. Reason: `pnpm import` reads the npm lockfile of the root package. After the move, the root package is a new package, and the web package has no npm lockfile. The version check in phase 1 decides if the result is correct.
3. **Root `esbuild` waits until step 3.** Nothing uses it before the CDK bundling. Step 3 can check where CDK finds it (root or `infra`). `allowBuilds: { esbuild: true }` comes now, because Vite's `esbuild` has an install script. Phase 2 changes the overview plan to match. This differs from the overview plan. The user confirmed it on 2026-10-08.
4. **Root scripts.** Only `dev` and `build` now. Both call the web package. Step 2 changes `dev` to start web and api together. The migration scripts stay in `apps/web/package.json`.
5. **Arguments of web scripts.** Docs write `pnpm --filter web <script> <args>`, with no `--`. pnpm 12.10.0 passes a `--` to the script, and `parseArgs` then reads the flags as positional arguments (measured in phase 1: `No map "--list"`). pnpm 11.13.0 removed the `--`. pnpm runs a script in its package folder. Therefore a relative path argument is relative to `apps/web/`. `apps/web/scripts/README.md` says this once. Changed on 2026-10-08 after phase 1, confirmed by the user.
6. **Paths in docs.** Root docs (`CLAUDE.md`, `README.md`, `ASSETS.md`) get full paths from the repo root (`apps/web/scripts/...`). `apps/web/scripts/README.md` keeps paths relative to `apps/web/`, and says so in its first lines. Feature docs keep short paths like `src/dice/throw.js`. `CLAUDE.md` gets one rule: in `docs/`, the paths `src/`, `public/`, `scripts/` and `tools/` are under `apps/web/`. Reason: the feature docs have about 120 such paths, and the rule is one line. The old plans (`docs/plan-*.md`, `docs/characters-hud.md`) are history and stay as they are.
7. **Commands in feature docs.** The commands that still apply change to pnpm: `docs/feature-custom-models.md`, `docs/feature-dice-rolling.md`, `docs/feature-roster.md`. Step 0 left them for this step.
8. **`.gitignore`.** Keep `dist` without a folder, so it matches `apps/web/dist` and later `dist` folders. `/tools/` becomes `/apps/web/tools/`. Add `.env` and `cdk.out`. `.playwright-cli` and `playwright-cli` stay at the root: the playwright-cli skill writes them in the working directory.
9. **Rapier path in `dice-sim.mjs`.** `createRequire(import.meta.resolve('@react-three/rapier')).resolve('@dimforge/rapier3d-compat/rapier.es.js')`. `@dimforge/rapier3d-compat` has no `exports` field, so the subpath resolves. This finds 0.14, the copy that `@react-three/rapier` uses. The other copy (0.12) comes from `@types/three` through `drei` → `maath`, and must not be used.
10. **Old output.** Delete the root `dist/` and `node_modules/`. Git ignores both.

## Phase 1: pnpm and the move

Read: backend doc "Repo layout", "pnpm". `apps/web/scripts/dice-sim.mjs` lines 20–30 (today `scripts/dice-sim.mjs`).

Baseline, before any change:
1. `npx vite build`. Save the sorted list of files in `dist/` with their sizes to `baseline-dist.txt`.
2. `node scripts/dice-sim.mjs --quick`. Save the output to `baseline-dice-sim.txt`.
3. Save the sorted `name@version` list of `package-lock.json` (the `packages` entries) to `baseline-versions.txt`.

Work:
1. Add `"packageManager": "pnpm@12.10.0"` to `package.json`. `pnpm -v` prints 12.10.0.
2. `pnpm import`. Keep `package-lock.json` until the version check passes.
3. `git mv` of `src`, `public`, `scripts`, `index.html`, `vite.config.js` and `package.json` to `apps/web/`. `mv tools apps/web/tools`.
4. `apps/web/package.json`: name `web`. Remove `packageManager` from it. Keep the rest.
5. Root files:
   - `package.json`: `name` `mcp-assist-3d`, `private`, `type: module`, `packageManager`, the root scripts (see "Names").
   - `pnpm-workspace.yaml`: `packages: [apps/*, packages/*]`, `allowBuilds: { esbuild: true }`.
   - `.node-version`: `24`.
   - `.gitignore`: decision 8.
6. `pnpm-lock.yaml`: rename the importer `.` to `apps/web` (decision 2). Delete `package-lock.json`, the root `node_modules/` and the root `dist/`. `pnpm install`.
7. `apps/web/scripts/dice-sim.mjs`: decision 9. Keep the comment about 0.14 and 0.12.

Checks:
- `pnpm install` prints no warning about build scripts. Copy any peer dependency warnings into the **Result**.
- The `name@version` list of `pnpm-lock.yaml` equals `baseline-versions.txt`. A scratchpad script compares them. Put any difference in the **Result**.
- `pnpm --filter web build` passes. The file list of `apps/web/dist/` equals `baseline-dist.txt`. The file names have content hashes, so equal names mean equal output. If they differ, find out why and report.
- `node apps/web/scripts/dice-sim.mjs --quick` from the root gives the same results as `baseline-dice-sim.txt`. Timing lines can differ.
- `pnpm --filter web migrate-terrain -- --list` runs and lists the maps. This checks decision 5 on pnpm 12.10.0.
- `git status` shows the moved files as renames.

### Result

Status: work done. The decision 5 check failed. The plan was changed and the user confirmed it.

Files changed:
- Moved with `git mv` to `apps/web/`: `src`, `public`, `scripts`, `index.html`, `vite.config.js`, `package.json`. `tools/` moved by hand.
- New: `package.json`, `pnpm-workspace.yaml`, `.node-version`, `pnpm-lock.yaml`.
- Changed: `.gitignore`, `apps/web/package.json` (name `web`), `apps/web/scripts/dice-sim.mjs` (Rapier path).
- Deleted: `package-lock.json`, root `node_modules/`, root `dist/`.

Facts:
- `pnpm-lock.yaml` has two YAML documents. The first is the env lockfile for `packageManager` (importer `.`, pnpm 12.10.0). Only the importer `.` of the second document was renamed to `apps/web`.
- `pnpm install` prints no warning about build scripts, and no peer dependency warning. It only prints a deprecation warning: `three-mesh-bvh@0.7.8` (from `pnpm import`).
- The root package has no dependencies, so `pnpm install` added no root importer to the second document.

Checks:
- Versions: 295 in `pnpm-lock.yaml`, 296 in the baseline. One difference: `three@0.170.0` is gone. In the npm lockfile `stats-gl@2.4.2` had its own `three@0.170.0`. In pnpm, `stats-gl` has only a peer dependency on `three`, so it uses `three@0.169.0`. All other `name@version` entries are equal. Not fixed, needs the user's decision.
- `pnpm --filter web build`: pass. The file list and sizes of `apps/web/dist/` equal `baseline-dist.txt` (644 files).
- `node apps/web/scripts/dice-sim.mjs --quick`: pass. Equal to the baseline except the timing line (0.266 vs 0.259 ms/step).
- `git status`: moved files are renames.
- **FAIL:** `pnpm --filter web migrate-terrain -- --list`. pnpm 12.10.0 does not remove the `--`. The script gets `-- --list` and throws `No map "--list"`. Without the `--`, `pnpm --filter web migrate-terrain --list` works. So decision 5 is wrong for pnpm 12.10.0 (it was measured on 11.13.0). The docs in phase 2 must not write `--`.

Changes from the plan: none.

Open issues:
- Decision 5: the docs use the form without `--` (done in phase 2).
- `three@0.170.0` is gone from the lockfile (see Checks). The app does not use `stats-gl` (no `StatsGl` in `apps/web/src`), and the build output is the same. Accepted by the user on 2026-10-08.

## Phase 2: Netlify and docs

Read: backend doc "Deploy" → "Netlify", "Relation to other features" (the last item).

Work:
1. `netlify.toml` at the root, exactly as in the backend doc ("Netlify").
2. `CLAUDE.md`: the path of `apps/web/scripts/README.md` and `migrate-terrain.mjs`. `pnpm --filter web build` instead of `vite build`. The path rule of decision 6.
3. `README.md`: setup with Node 24 and pnpm (`pnpm install`, `pnpm dev`), and full paths.
4. `ASSETS.md`: full paths and pnpm commands.
5. `apps/web/scripts/README.md`: pnpm commands. The first lines say that paths are relative to `apps/web/`, and that relative path arguments are too (decision 5).
6. Feature docs: decision 7.
7. `docs/plans/implement-backend.md`: step 1 without root `esbuild`. Step 3 adds it (decision 3).
8. Add a short **Result** under step 1 in `docs/plans/implement-backend.md`.

Checks:
- `grep -rn "npm run\|npm install\|npx vite\|vite build" CLAUDE.md README.md ASSETS.md apps/web/scripts/README.md docs/feature-*.md` finds only text that explains the change (backend doc).
- `grep -rn "scripts/\|tools/" CLAUDE.md README.md ASSETS.md` finds only `apps/web/...` paths.
- `pnpm --filter web build` passes.

### Result

Files changed:
- New: `netlify.toml`, as in the backend doc.
- `CLAUDE.md`: full paths, `pnpm --filter web build`, and one rule that `src/`, `public/`, `scripts/` and `tools/` in `docs/` are under `apps/web/`.
- `README.md`: Node 24, `pnpm install`, `pnpm dev`, a note that the project tree is under `apps/web/`, the build command.
- `ASSETS.md`: full paths and the pnpm command.
- `apps/web/scripts/README.md`: pnpm commands without `--`, and a note at the top about relative paths.
- `docs/feature-custom-models.md`, `docs/feature-dice-rolling.md`, `docs/feature-roster.md`: pnpm commands.
- `docs/plans/implement-backend.md`: step 1 without root `esbuild`, and its **Result**.

Checks:
- The `grep` for `npm run`, `npm install`, `npx vite` and `vite build`: only `pnpm install` (a substring match) and text in `docs/feature-backend.md` that explains the change.
- The `grep` for `scripts/` and `tools/` in `CLAUDE.md`, `README.md` and `ASSETS.md`: only `apps/web/...` paths, plus the path rule in `CLAUDE.md` and the `scripts/` line in the project tree of `README.md`. The tree sits under the note that it is under `apps/web/`.
- `pnpm --filter web build`: pass.

Changes from the plan: none.

Open issues: none.

## User

After phase 2:
1. `pnpm dev`. The app looks and works the same.
2. Commit, push the branch, and open a pull request. The Netlify deploy preview builds. The build log shows pnpm 12.10.0 and Node 24.
3. Netlify UI: clear the old build command (`npm run build`) and publish directory (`dist`) after the merge.
4. Netlify UI: rename the site to `mcptacticus3d`.

## Done when

- `pnpm install` shows no build script warnings.
- The dependency versions, the build file list and the dice-sim results equal the baseline.
- `pnpm --filter web build` works, and `node apps/web/scripts/dice-sim.mjs` runs.
- The Netlify deploy preview of the branch builds, and the app looks the same (the user checks).

## Risks and open questions

1. **Netlify `ignore` on the first preview build.** If `CACHED_COMMIT_REF` equals `COMMIT_REF`, `git diff --quiet` exits 0, and Netlify skips the build. If the preview is skipped, the log says so. Then run "Clear cache and deploy site" on the preview, or remove `ignore` for this one build.
2. **pnpm 12 on Netlify.** Netlify reads `packageManager`. If the build image cannot get pnpm 12.10.0, the install fails early, and the log shows it. Then pin the latest pnpm 11 instead.
3. **pnpm peer dependency rules.** pnpm resolves peers more strictly than npm. Warnings go into the **Result**. The version check shows if pnpm picked other versions.
4. **Build output differs.** If a hash changes with equal versions, the cause is likely a path in the bundle (for example a source path in a comment). Report it. The user then checks the app in the browser.
