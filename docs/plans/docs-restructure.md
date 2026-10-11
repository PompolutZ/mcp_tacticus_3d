# Plan: Features and plans in their own folders

Requested by the user on 2026-10-11, before the first real test of the backend. Status: the user gave the OK on 2026-10-11. No step done yet.

One coder step and one commit for each step. Commit each step without a user review. The user reads the result after step 5. Each step writes its **Result** below when it is done.

## Goal

Two kinds of docs, each in its own folder:

- **Feature** (`docs/features/`): the app or one part of it in its desired form. It can change later. The feature is the authority.
- **Plan** (`docs/plans/`): the agreed steps toward a feature, or a split of the work into coder sessions. It is kept for reference. A plan can take shortcuts or make temporary trade-offs.

When a plan and a feature differ, the feature is right.

## Today

- Features are `docs/feature-*.md` and `docs/characters-hud.md`. Plans are `docs/plan-*.md`, `docs/plans/implement-backend.md` and `docs/plans/implement-backend/`.
- Features hold plan content:
  - `characters-hud.md` has Phases 1 to 8 with their results (lines 338 to 849). Its status says "plan. Not started", but it is built.
  - `feature-auth.md` and `feature-peer-to-peer.md` have "Phases" lists with step numbers.
  - `feature-roster.md` has "Steps". `feature-dice-rolling.md` has "Pitfalls to check" with results.
  - Status lines hold dates and the history of user checks.
- Plans hold feature content that no feature has. The rules and decisions of the Power and Cleanup buttons are only in `plan-power-phase.md` and `plan-cleanup-phase.md`, and `characters-hud.md` points there. The same is true, in part, for gems, immunities, token size, tactic tokens and the room fixes.
- Code comments point to plan decisions for lasting behavior, for example `App.jsx`: "docs/plan-cleanup-phase.md, decision 2".
- About 400 path references in docs, and about 90 in code, READMEs and `CLAUDE.md`.

## Rules for the two kinds

These rules go into `CLAUDE.md` in step 1, in short form.

A **feature** has: goal, terms, game rules, how TTS does it, the behavior, data and state, code layout, decisions with reasons, the facts and measurements behind them, out of scope, open questions, sources.

- The first line under the title is `Status:` in one line: built, partly built, or not started. When parts are missing, a short "Not built yet" list names them.
- No dates of builds or user checks. No plan step numbers.
- When the desired behavior changes, the feature changes in the same step.

A **plan** has: the request and its date, rules for coder sessions, phases or steps, decisions that fill gaps, results, user checks, history.

- A done plan does not change, except for paths.
- A new request gets a new plan. Its lasting decisions go into the feature in the same step.

A code comment points to the feature for lasting behavior. It points to a plan only for a shortcut, or for a fact that only the plan has (for example a measurement).

## Moves

Step 1 must not change this table.

| Old | New |
|---|---|
| `docs/feature-2d.md` | `docs/features/2d.md` |
| `docs/feature-auth.md` | `docs/features/auth.md` |
| `docs/feature-backend.md` | `docs/features/backend.md` |
| `docs/feature-crisis.md` | `docs/features/crisis.md` |
| `docs/feature-custom-models.md` | `docs/features/custom-models.md` |
| `docs/feature-dice-rolling.md` | `docs/features/dice-rolling.md` |
| `docs/feature-key-shortcuts.md` | `docs/features/key-shortcuts.md` |
| `docs/feature-library.md` | `docs/features/library.md` |
| `docs/feature-peer-to-peer.md` | `docs/features/peer-to-peer.md` |
| `docs/feature-rooms.md` | `docs/features/rooms.md` |
| `docs/feature-roster.md` | `docs/features/roster.md` |
| `docs/feature-setup-game.md` | `docs/features/setup-game.md` |
| `docs/feature-spectator-view.md` | `docs/features/spectator-view.md` |
| `docs/feature-team-tactic-cards.md` | `docs/features/team-tactic-cards.md` |
| `docs/characters-hud.md` | `docs/features/character-trays.md` |
| `docs/plan-cleanup-phase.md` | `docs/plans/cleanup-phase.md` |
| `docs/plan-dice-rolling.md` | `docs/plans/dice-rolling.md` |
| `docs/plan-infinity-gems.md` | `docs/plans/infinity-gems.md` |
| `docs/plan-jarvis-immunities.md` | `docs/plans/jarvis-immunities.md` |
| `docs/plan-power-phase.md` | `docs/plans/power-phase.md` |
| `docs/plan-room-fixes.md` | `docs/plans/room-fixes.md` |
| `docs/plan-roster.md` | `docs/plans/roster.md` |
| `docs/plan-tactic-tokens.md` | `docs/plans/tactic-tokens.md` |
| `docs/plan-token-size-stacking.md` | `docs/plans/token-size-stacking.md` |

`docs/plans/implement-backend.md` and `docs/plans/implement-backend/` stay where they are.

New files: `docs/plans/character-trays.md` (step 2) and `docs/features/round-phases.md` (step 3).

## Decisions

1. The folder tells the kind, so file names drop `feature-` and `plan-`. Titles keep "Feature:" and "Plan:".
2. `characters-hud.md` becomes `character-trays.md`, the same as its title.
3. A plan that has no own name gets the slug of its feature: `dice-rolling`, `roster`, `character-trays`.
4. The Power and Cleanup buttons get one new feature, `round-phases.md`. They change characters, tokens, Sources and the round marker, not only the trays.
5. Done plans keep their content. Their goal and decisions stay as a record, also when the feature now has the same text.
6. The plans in `implement-backend/` change only paths. The docs phase of each step already wrote its design changes into the features. Code comments that cite their decisions stay.
7. `2d.md` is an idea, not started, and has no plan. It keeps its approach and pitfalls.
8. No index file. `ls docs/features` and `ls docs/plans` are the index.

## Rules for every step

- Read `CLAUDE.md`, this plan, and the docs that the step names.
- Move text. Do not rewrite it, except history (dates of builds and checks, step numbers) and text that is wrong. Text is wrong when it contradicts another feature or the code that you read anyway. Do not check every feature against the code.
- Docs use plain writing: short sentences, common words, one fact per sentence. Never the word "comprehensive".
- Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web build` when code comments changed, and the grep of the step.
- Do not commit. The main model reads the diff and commits.
- Write a short **Result** under the step: files, what moved where, open issues.

## Step 1: Move files, fix paths, rules in CLAUDE.md

- `git mv` each file of [Moves](#moves).
- Replace every old path in the repo with the new path: docs, code comments, `README.md`, `infra/README.md`, `apps/web/scripts/README.md`, `CLAUDE.md`. Also the bare names, for example `` `feature-crisis.md` `` in `plans/cleanup-phase.md`.
- `CLAUDE.md`: a new section "Docs" with the rules of [Rules for the two kinds](#rules-for-the-two-kinds), in a few lines.
- Check: `grep -rnE "docs/(feature|plan)-|characters-hud|(^|[^a-z/-])(feature|plan)-[a-z0-9-]+\.md" --exclude-dir=node_modules --exclude-dir=.git .` finds only this plan.
- The main model updates the memory files that name old paths.

**Result**

- Moved with `git mv`: 24 files (14 features plus `characters-hud.md` to `features/character-trays.md`, 9 plans). Table unchanged.
- Path edits: 104 files (docs, code comments, READMEs, `ASSETS.md`, `CLAUDE.md`, scripts). Bare names lost the prefix. `features/roster.md`, `plans/roster.md`, `features/dice-rolling.md`, `plans/dice-rolling.md` keep the folder. Relative forms became `../features/x.md` and `../plans/x.md`. Globs `docs/feature-*.md` and `docs/plan-*.md` in `implement-backend` plans became `docs/features/*.md` and `docs/plans/*.md`.
- `CLAUDE.md`: section "Docs" added.
- Grep check: finds only this plan (`apps/web/dist` build output excluded, it has no matches).
- `pnpm format`: ok. `pnpm lint`: warnings only (existing ones in `Root.jsx`). `pnpm --filter web build`: ok.
- Open issues: none. Memory files still name old paths (main model).

## Step 2: Character trays

Files: `features/character-trays.md`, `features/crisis.md`, new `plans/character-trays.md`, `plans/infinity-gems.md`, `plans/jarvis-immunities.md`, `plans/token-size-stacking.md`.

- Move "Phases" of the feature to the new `plans/character-trays.md`: "Rules for every phase", Phase 1 to 8, "Fixes after Phase 7", "Real-size tokens and one tray row", with their results. The plan names the feature at the top.
- Status line: built. "Not built yet" lists what the feature wants later and the app does not have.
- Lasting decisions of the three plans go into the feature sections "Attached cards", "Immunities", "Real-size tokens" and "Tokens on top of tokens", and into "Tokens on top of a crisis token" of `crisis.md`.
- Code comments that cite these three plans for lasting behavior point to the feature sections. Find them with `grep -rn "plans/\(infinity-gems\|jarvis-immunities\|token-size-stacking\)" apps`.

## Step 3: Round phases

Files: new `features/round-phases.md`, `features/character-trays.md`, `features/crisis.md`, `plans/power-phase.md`, `plans/cleanup-phase.md`.

- `round-phases.md` takes from the two plans: goal, rules, how TTS does it, facts (Jarvis, app), lasting decisions, not in scope, "Later: variable Power". The decisions get new numbers.
- `character-trays.md`: "Players apply the rules", "Power Phase", "Cleanup Phase" and the **Remove** bullet of "Attached cards" point to `round-phases.md`, not to the plans.
- `crisis.md` (Source, cleanup decision 6) points to `round-phases.md`.
- Code comments that cite `plans/power-phase.md` or `plans/cleanup-phase.md` point to `round-phases.md` with the new decision numbers. Today: `App.jsx`, `characters/cleanup.js`, `crisis/cleanup.js`, `TrayControls.jsx`, `Scene.jsx`, `scoreboard/board.js`.

## Step 4: Backend features

Files: `features/auth.md`, `features/peer-to-peer.md`, `features/backend.md`, `features/rooms.md`, `plans/implement-backend.md`, `plans/room-fixes.md`.

- Status lines: short, no step numbers, no dates.
- The "Phases" lists of `auth.md` and `peer-to-peer.md` move to `plans/implement-backend.md`, in a new section "Phases of the features", as they are.
- History in the text becomes the current state. Examples: "went away in step 8", "Before 2026-10-09 it was called an offline room", the parts of "Relation to other features" in `auth.md` that list edits to other docs.
- Part 1 of `plans/room-fixes.md` (no crisis dropdowns and no mat turn buttons in a multiplayer room) goes into `rooms.md`, if it is not there yet.
- References to `implement-backend/03-infra.md` "First deploy commands" stay. They point to commands, not to design.

## Step 5: Other features

Files: `features/roster.md`, `features/setup-game.md`, `features/dice-rolling.md`, `features/team-tactic-cards.md`, `features/crisis.md`, `features/library.md`, `features/key-shortcuts.md`, `features/spectator-view.md`, `features/custom-models.md`, `plans/roster.md`, `plans/dice-rolling.md`, `plans/tactic-tokens.md`, `plans/room-fixes.md`.

- Status lines: short, no dates.
- `roster.md`: "Steps" move to `plans/roster.md`.
- `setup-game.md`: the requirements in "Notes from the user" go into the sections they describe, without dates, and the section goes away. Parts 2 and 3 of `plans/room-fixes.md` (threat counts the gems, the affiliation step) go into the feature, if they are not there yet.
- `dice-rolling.md`: "Pitfalls to check" and the note about the removed HUD panel move to `plans/dice-rolling.md`. "Implementation sketch" becomes "Code".
- `team-tactic-cards.md`: lasting decisions of `plans/tactic-tokens.md` go into "Token piles". Code comments that cite the plan (`tactics/layout.js`, `scripts/migrate-tokens.mjs`) point to the feature.

## Done when

- The grep of step 1 finds only this plan.
- No feature says that its rules or decisions are in a plan.
- Every feature starts with a one-line status.
