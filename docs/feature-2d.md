# Feature: 2D top-down image of the map

Status: idea. Not started. See open questions at the end.

## Goal

Render the map (mat and terrain) from straight above and save the result as a PNG.

## Approach

- Use an **orthographic camera** pointed straight down. This camera has no perspective, so tall pieces (trees, street lights) do not lean outward from the center. The result looks like a floor plan: every inch on the mat is the same number of pixels, anywhere in the image.
- Fit the camera to the mat (36" × 36") or to the whole table (48" × 48").
- Render once at a high resolution, for example 4096 × 4096. For the mat this is about 114 px per inch.
- Hide the stars, characters and tools during that render. The background can be transparent.

Because the scale is exact, pixel positions convert directly to table positions. For the mat at 4096 px: `px = (x + 18) * 4096 / 36`. The same formula works for `z`. This is useful if we later want to put 2D things on top of the image.

## Implementation sketch

- Add a component inside `<Canvas>` in `src/App.jsx`, for example `TopViewExport`. It gets `gl` and `scene` from `useThree`.
- Add an "Export top view" button to `src/components/Toolbar.jsx` that triggers it.
- Steps in the component:
  1. Create an `OrthographicCamera` with left/right/top/bottom = ±18 (mat) or ±24 (table). Place it at `(0, 50, 0)` and point it at the origin. Set `camera.up` so the top of the image always matches the same side of the table.
  2. Hide stars, characters, tools and the background.
  3. Resize the renderer to 4096 × 4096 and render with this camera.
  4. Call `gl.domElement.toBlob()` right after the render, in the same task, and download the PNG.
  5. Restore the renderer size and everything that was hidden.

### Pitfalls to check

- **Colors.** In three r169, a render into a `WebGLRenderTarget` does not apply the output color space or tone mapping. Therefore the image would look darker than the app. Rendering into the main canvas at a temporary size avoids this.
- **Canvas is cleared.** The canvas does not use `preserveDrawingBuffer`. So `toBlob()` must run right after `gl.render()`, before the browser draws the next frame.
- **Shadow area.** The shadow camera covers ±20 (`src/components/Scene.jsx:61`). This covers the mat (±18) but not the full table (±24). For a full-table image, make the shadow camera bigger or turn shadows off.
- **Maximum size.** Most GPUs support 8192 px or more, but check `gl.capabilities.maxTextureSize` before choosing a bigger size.

## Things to decide

- **Shadows.** The light is at `(10, 30, 10)` (`src/components/Scene.jsx:56`), so shadows fall at an angle and will be part of the image. For a cleaner map, turn shadows off or move the light straight above the mat for this render.
- **Hidden ground.** The image only shows what is visible from directly above. For example, a tree's crown hides the ground and the trunk under it.
- **Height map (optional).** The same camera can render a second image where brightness shows height (white is high, black is the mat). Use `scene.overrideMaterial = new MeshDepthMaterial()` for that render. With an orthographic camera, depth changes linearly with height, so brightness converts directly to inches. This can help with 2D line-of-sight or elevation checks later.

## Open questions

- What is the image for? For example: print, a 2D planner, sharing, or input for game logic such as line of sight.
- Mat only or full table?
- Shadows: keep, remove, or light from straight above?
- Which resolution?
- Include characters and tools, or terrain only?
- Is a height map needed?
- One map or all maps? Today there is only `vibranium-heist` in `src/terrain/maps.js`.
- A button in the app, or a script that creates the images ahead of time?
