# Model viewer

Status: built.

A dev page that shows one 3D model at a time, with the stats of the model. It answers: does a model look right on the base, and is it too heavy? The models are the ones of the game and the candidates that are not in the game yet, for example scans from `photos-to-glb` (`docs/features/custom-models.md`).

## How to use

- Dev only, at `#models` (`src/debug/ModelsPage.jsx`). The production build does not have it, and the lobby has no link to it.
- The list on the left has candidates and game models in one order: by GLB file size, largest first, so the models to replace show at the top. Textures are inside the GLB, so file size is asset size. Each row has its size (`Name · 1,234 KB`). Sizes come from HEAD requests (Content-Length) when the page opens. Until they arrive the list is in name order and the size shows "...". A file with no known size goes last. The first row is selected when the page opens. The field above the list filters by name, upper or lower case does not matter. The list code is `src/debug/modelList.js`.
- A click on a row shows the model. The camera moves so that the whole model shows. Mouse buttons are the same as at the table. No keys, no physics, no drag of the model.
- The scene has the table, the backdrop and the lights of the game (`src/scene/SceneShared.jsx`), so the model looks as it does in a room. The page uses the tone mapping of the table, so a model looks as bright as in the game.
- The base (the material `defaultMat`) has one fixed side color. The code that sets it is the one of the figures at the table (`styleFigure` in `src/characters/useFigureMaterials.jsx`). The model is a copy, so the models of the game are not changed.

## Game models

Every GLB in `src/assets/characters/`. A row has the character name. A file that is not the first model has its kind after the name: second model, transform, construct (a construct is a terrain feature, not a character).

## Candidates

- Put `*.glb` files in `apps/web/model-candidates/`. The folder is in `.gitignore`, so a candidate is never committed by accident.
- A new file shows in the list without a restart of the dev server. A missing folder is an empty list, and the build works without it.
- `photos-to-glb` writes here by default (`--out` is optional).
- The row has the file name without `.glb`, and the tag "[candidate]".

## Stats

The panel is at the top right of the scene.

- **Triangles:** the sum over all meshes of the file. Heavy models show here at once.
- **Size:** width × depth × height of the bounding box, in mm. One unit of the scene is one inch (25.4 mm), so this is the size on the table, with the model as it is in the file.
- **File:** the size of the GLB file in KB, the same value as on the row.
- **Textures:** the width × height in px of each texture that the materials use.
