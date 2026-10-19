# Plan: turn a scanned model so its front faces the board

Requested by the user on 2026-10-19. Status: Not started.

Two coder steps, one commit each. Branch `scan-front`, worktree `../mcp_assist_3d-scan-front`.

## Request

Object Capture does not know the front of a figure, so a scan comes out turned by a random angle. On the table, the figure then faces the wrong way, not toward the board. The user cannot see how a scan is turned until the model stands on the table.

1. A way to see which way a model faces, as it will face on the table.
2. A way to turn a model file that already exists, without a new scan.

`photos-to-glb --turn` is not needed: run `turn-model` after `photos-to-glb`.

## Facts

- `docs/features/custom-models.md`: the model is Y up, the base center is at the origin (with `--base`). "Choosing the front" and `--turn` are listed as not built.
- `scripts/custom-models.json`: character key → { file: command that made it }. `migrate-characters.mjs` never overwrites a listed file.
- `scripts/lib/convert.mjs`: GLB read and write, `compressMesh` (Draco), used by `photos-to-glb.mjs`.
- `#models` page: `src/debug/ModelsPage.jsx`, `src/debug/modelList.js`, doc `docs/features/model-viewer.md`. It shows game models and candidates (`model-candidates/`).
- `setup/setup.js`: host sits at +z, guest at -z. `sideYaw` is 0 for host, 180° for guest.
- Not known yet: the yaw a figure gets when it spawns on its tray card, and which local direction is the front of a TTS model. Step 1 finds both.

## Decisions

1. The turn goes into the GLB file. The game code does not change.
2. The turn is around the vertical line through the origin (the base center), so the base stays where the collider is.
3. Angle in degrees. Positive is counterclockwise, seen from above. The script saves the sum of all turns of a file in `custom-models.json`, so the record says how the file was made.
4. The `#models` page shows the front as the table shows it. It does not save files: a dev page that writes into `src/` is more risk than one command.

## Steps

### Step 1: `turn-model` script

- Find in the code the spawn yaw of a figure for each team, and the local direction that faces the board after spawn ("front"). Write both in the feature doc, with the file that sets them. If guest figures face away from the board, report it; do not fix it in this plan.
- New `scripts/turn-model.mjs`, `pnpm --filter web turn-model <target> <degrees>`:
  - `<target>`: a character key in `custom-models.json` (turns its file in `src/assets/characters/`), or a path to a `.glb` (for a candidate).
  - A character key that is not in `custom-models.json` is an error. A TTS model would be overwritten by the next migration.
  - Reads the GLB, turns the root nodes around Y by the angle, writes it back with the same compression as `photos-to-glb`. Prints the angle and the new width × depth.
  - For a character key: updates the command in `custom-models.json`. It adds `&& pnpm --filter web turn-model <key> <sum>`, or changes the sum of an earlier turn. The sum is in -180..180.
- Shared code in `scripts/lib/`. Tests: a turn by 360 gives the same positions. 90 then -90 gives the same positions. The base center stays at the origin. The sum stays in -180..180.
- Docs: `custom-models.md` gets a "Front" section (the convention, the command). Remove `--turn` from "Out of scope" and from the terrain list. Add `turn-model` to "Use for a character".
- Checks: `pnpm format`, `pnpm lint`, tests, `pnpm --filter web build`.

### Step 2: front arrow and turn buttons on `#models`

- An arrow on the table from the base center toward the front (from step 1), with the label "board".
- Buttons "⟲ 45°" and "⟳ 45°" turn the shown model. A reset button sets the turn back to 0. Each model starts at 0.
- The stats panel shows the turn and the command to apply it, for example `pnpm --filter web turn-model gamora 90`. A candidate shows its path instead of a key. The command is not shown at 0°.
- The turn applies to the copy on the page only, as the base color does now.
- Docs: `model-viewer.md`, "How to use".
- Checks: `pnpm format`, `pnpm lint`, tests, `pnpm --filter web build`.

### After the steps

The user checks every scanned model on `#models` and gives the angles. The main model runs `turn-model` for each one, then commits the files and `custom-models.json`.

## Results

(empty)
