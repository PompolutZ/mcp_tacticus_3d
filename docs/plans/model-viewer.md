# Plan: Model viewer

Requested on 2026-10-17. The user wants a dev page that lists all models of the game and shows the selected one with an orbit camera. The page also lists new candidate models, for example scans from `photos-to-glb`. Candidates go in a gitignored folder in the app, so the user does not have to find them in a temp folder.

## Facts

- `Root.jsx` selects the page by URL hash. `#terrain` and `#tactic-faces` are dev-only pages in `src/debug/`, loaded with `lazy()` only when `import.meta.env.DEV` is set. The build leaves them out.
- `TerrainPage.jsx` has its own small Canvas with OrbitControls and the shared parts of `scene/SceneShared.jsx`.
- The game models are in `src/assets/characters/<key>/`: `model.glb`, `model-2.glb`, `transform.glb`, `construct-<n>.glb` (names in `src/characters/files.js`). `assets/index.js` has the URLs of all files in `src/assets`.
- `useFigureMaterials.jsx` gives the side color to the material `defaultMat` (the base). It reads the side color from the table store.
- 5 of 230 character models have more than 200k triangles (for example Adam Warlock 757k, Moondragon 938k). The median is 30k.
- `photos-to-glb` needs `--out`. The scan of Adam Warlock is in the session scratchpad now.

## Decisions

1. **Dev-only page `#models`.** Same pattern as `#terrain`: `src/debug/ModelsPage.jsx`, lazy, only in dev. No link from the Lobby.
2. **Candidates folder.** `apps/web/model-candidates/`, in `.gitignore`. The page lists every `*.glb` in it with `import.meta.glob`. Vite updates the glob when a file is added, so a new candidate shows without a restart of the dev server.
3. **List.** Two groups: "Candidates" first, then "Game models". A game model row shows the character name (from `characters.json`) and the file kind when it is not `model.glb` (second model, transform, construct). A filter field filters by name. The first row is selected when the page opens.
4. **Scene.** One model at a time, on the table surface, with the lights of the game. OrbitControls around the model. The camera frames the model when the selection changes. No physics, no drag.
5. **Base color.** `defaultMat` gets one fixed side color, so the base looks as in the game. The code that sets the color is shared with `useFigureMaterials`, not copied.
6. **Stats.** A small panel: triangles, size in mm (width × depth × height), file size in KB, texture size in px. This shows heavy models such as Adam Warlock at once.
7. **Default output of `photos-to-glb`.** `--out` becomes optional. Without it, the script writes `model-candidates/<photos folder name>.glb`, with the name in kebab case (`Adam Warlock` → `adam-warlock.glb`).

## Steps

### Step 1: Models page

- `ModelsPage.jsx`, the `#models` hash in `Root.jsx`, the candidates folder in `.gitignore` (decisions 1–6).
- Feature doc: new `docs/features/model-viewer.md`. Add the row `#models` (dev only) to the Pages table in `docs/features/rooms.md`.
- Test: the list function puts candidates first, has every character GLB once, and a filter keeps only matching names.
- Checks: format, lint, test, build.

### Step 2: Default output of photos-to-glb

- Decision 7 in `scripts/photos-to-glb.mjs`. Update `docs/features/custom-models.md` (option table, usage, output, link to the viewer).
- Move the Adam Warlock scan from the scratchpad to `model-candidates/`.
- Checks: format, lint, build. `--help` prints the new text.

## Out of scope

- Two models side by side.
- Turning the model and printing the degrees (for a later `--turn` option).
- Promoting a candidate into `src/assets/characters/` from the page.
- Reducing the 5 heavy TTS models.
