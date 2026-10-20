# mcp_assist_3d

## Work split

- The main model plans and talks with the user. It does not write code.
- The `coder` subagent writes the code: it edits files and runs the checks (format, lint, tests, build).
- Split the work into steps (phases, sections) that are small. Coder should finish one step within about 150k tokens of context.
- Give coder one step at a time. Name the files, the changes and the checks.
- Each finished step is one commit. Commit without asking, unless the user asked to review the step first.
- No push without asking.

## Worktrees

- By default the coder works in the main dir, on main.
- Use a worktree only in these cases:
  - The main dir has uncommitted changes. Then create the worktree without asking.
  - The work is a plan with more than one step. Then ask the user if a worktree should be created.
- A worktree is `../mcp_assist_3d-<plan>`, on branch `<plan>` from main. The coder then works only there, and the main dir is only for user tests.
- Work done: in the worktree, merge main into the branch. In the main dir, `git switch --detach <plan>`. The user tests. Fixes go in the worktree, then the main dir moves to the new head the same way.
- Create the worktree only when the user says to start the work. Making or showing a plan is not the start. Until then, the plan doc is in the main dir, not committed. At the start, move it into the worktree.
- Create a worktree with `scripts/new-worktree.sh <plan>`. It copies the `.env` files, so the user can also run the app from the worktree folder.
- After the OK: fast-forward main, then `scripts/remove-worktree.sh <plan>` (removes the worktree, deletes the branch).
- At most 2 plan branches are open at a time. A change across many files (a rename) runs when no other branch is open.

## TTS assets

To migrate a map (mat and terrain) from the TTS mod, read `apps/web/scripts/README.md` first. It describes `apps/web/scripts/migrate-terrain.mjs`, the AssetRipper steps, and the TTS rules that were measured. `ASSETS.md` lists what the TTS cache has.

## Verifying changes

Do not open the app in a browser (playwright-cli, dev server, screenshots) to check a change unless I ask for it in that message. `pnpm --filter web build` to catch errors is fine. I check the result in the browser myself.

## Lint and format

After a code change, run `pnpm format` and `pnpm lint`. Both are safe to run at any time.

## Tests

Test rules that must stay true (no overlap, inside the table, order). Do not assert a copy of a constant's value.

## Paths in docs

In `docs/`, the paths `src/`, `public/`, `scripts/` and `tools/` are under `apps/web/`.

## Docs

Two kinds of docs, each in its own folder.

- Feature (`docs/features/`): the app or one part of it in its desired form. The feature is the authority when it differs from a plan.
  - First line under the title: `Status:` in one line, built, partly built or not started.
  - No dates and no plan step numbers.
  - When the behavior changes, the feature changes in the same step.
  - A feature gives the intent and the reasons. It does not repeat numbers that are constants in the code; it names the file instead.
- Plan (`docs/plans/`): the request, the steps and their results. A done plan does not change, except for paths.
  - A new request gets a new plan. Its lasting decisions go into the feature in the same step.
- Plans made from a user test are in `docs/plans/playtest/`. Other plans stay in `docs/plans/`.
- A code comment points to the feature for lasting behavior. It points to a plan only for a shortcut, or for a fact that only the plan has.
