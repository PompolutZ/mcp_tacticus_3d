# mcp_assist_3d

## Work split

- The main model plans and talks with the user. It does not write code.
- The `coder` subagent writes the code: it edits files and runs the checks (format, lint, tests, build).
- Split the work into steps (phases, sections) that are small. Coder should finish one step within about 150k tokens of context.
- Give coder one step at a time. Name the files, the changes and the checks.
- Each finished step is one commit. Commit without asking, unless the user asked to review the step first.
- No push without asking.

## TTS assets

To migrate a map (mat and terrain) from the TTS mod, read `apps/web/scripts/README.md` first. It describes `apps/web/scripts/migrate-terrain.mjs`, the AssetRipper steps, and the TTS rules that were measured. `ASSETS.md` lists what the TTS cache has.

## Verifying changes

Do not open the app in a browser (playwright-cli, dev server, screenshots) to check a change unless I ask for it in that message. `pnpm --filter web build` to catch errors is fine. I check the result in the browser myself.

## Lint and format

After a code change, run `pnpm format` and `pnpm lint`. Both are safe to run at any time.

## Paths in docs

In `docs/`, the paths `src/`, `public/`, `scripts/` and `tools/` are under `apps/web/`.
