# Feature: Custom models from photos

Status: partly built.

The script works. A custom model can replace the model of a character (see [Use for a character](#use-for-a-character)). Adam Warlock, Bastion, Blue Marvel, Gamora, Hawkeye, Lockjaw, Magneto, Moondragon, Nebula, Quasar, Rocket Raccoon, Star-Lord, Thor, Prince of Asgard and Valkyrie use one.

Not built yet:

- Loading a custom model for a piece that is not a character. The `#models` page shows the candidates, see [Model viewer](model-viewer.md).

## Goal

Make a 3D model for the app from photos of a real object, for example a painted figure or a terrain piece. The TTS mod does not have a model for every character, and a scan of your own figure shows your paint.

`pnpm --filter web photos-to-glb` does this on a Mac. It uses Apple Object Capture, the photogrammetry engine of macOS (RealityKit). Photogrammetry finds the same points in many photos and computes the shape and the texture of the object from them.

## How it works

There are two steps:

1. `scripts/object-capture.swift` runs Object Capture. It writes an OBJ, an MTL and one PNG color texture.
2. `scripts/photos-to-glb.mjs` converts the OBJ in the same way as the TTS pieces: obj2gltf, WebP texture, `compressMesh` (Draco), all from `scripts/lib/convert.mjs`. It also sets the size and puts the model on the table. For a figure, it replaces the scanned base with a base that gets the team color in the app.

## Requirements

- A Mac with Apple Silicon. Tested on an M1 Pro with macOS 26.6.
- Xcode or the Command Line Tools, for `swiftc`. The script compiles `object-capture.swift` to `tools/object-capture` on the first run, and again after the Swift file changes. `tools/` is in `.gitignore`.
- ImageMagick (`magick`) and `pnpm install`, as for the other scripts.

## Usage

```bash
pnpm --filter web photos-to-glb ~/Pictures/Hulk --base large                  # a figure on a large base, writes model-candidates/hulk.glb
pnpm --filter web photos-to-glb ~/Pictures/Hulk --base large --texture 1024   # texture size of the migrated characters
pnpm --filter web photos-to-glb ~/Pictures/crate --height 38                  # not a figure: 38 mm tall
pnpm --filter web photos-to-glb ~/Pictures/crate --height 38 --out /tmp/crate.glb  # other output file
```

The output goes to `model-candidates/`, where the `#models` page shows it. See [Model viewer](model-viewer.md).

| Option | Default | Meaning |
|---|---|---|
| `--out <file.glb>` | `model-candidates/<name>.glb` | Output file. `<name>` is the name of the photos folder in kebab case: lowercase, each run of other characters becomes `-` (`Adam Warlock` gives `adam-warlock`). The folder is `apps/web/model-candidates/`, whatever the current directory is. It is in `.gitignore`. |
| `--base <size>` | none | `small`, `medium` or `large`: the object is a figure on a game base (35, 50 or 65 mm, `BASE_DIAMETER` in `src/characters/files.js`). Use the same size as `base` of the character in `characters.json`. See [Base](#base). |
| `--stand` | off | The figure stands on a stand that is clearly wider than its base. The script cuts the stand off. Use it with `--base`. See [Stand](#stand). |
| `--tone <level>` | none | `light`, `medium` or `strong`: makes the color texture darker and more saturated. See [Tone](#tone). |
| `--height <mm>` | none | Height of the real object in mm. Measure the real object. The app uses inches (1 unit = 1"), so the script converts it. |
| `--triangles <n>` | 30000 | Maximum number of triangles. The migrated figures have about 30k. |
| `--texture <px>` | 2048 | Maximum texture size: 1024, 2048 or 4096. The migrated characters use 1024. |

The script sets the size in this order:

1. With `--height`: the model gets this height.
2. With `--base` and without `--height`: the scanned base gets the diameter of the game base. You do not need to measure the figure. In the test, the height came out 90.7 mm for a 89.7 mm figure (1 % too tall).
3. Without both: the script reads the Object Capture size as meters. That size is real only for photos with depth data (iPhone with LiDAR). For other photos, the size is not real: in the test, a 89.7 mm figure came out 11 mm tall.

Both limits are upper limits. Object Capture writes fewer triangles and a smaller texture when the photos have less detail. In the test below, it wrote 12,928 triangles with `--triangles 30000`, and a 1024 texture with `--texture 4096`. With `--triangles 5000`, it wrote exactly 5000.

The script prints the size of the model in mm (width × depth × height), the number of triangles and the file size. Compare the height with the real object. With `--base` and `--height`, it also prints the width of the scanned base, to compare with the game base. A run took about one minute for 96 photos of 1600 × 1200 on an M1 Pro. Bigger photos take longer.

RealityKit prints a line that starts with `E5RT encountered an STL exception` (the Neural Engine cannot compile one of its models). In the test, the run finished with a correct model after this line. RealityKit also writes many internal warnings to stderr. The script shows them only when the run fails.

## Base

`CharacterModel.jsx` gives the team color to the material named `defaultMat`. In the migrated models, this material is the base disk. A scan has one material for the whole object, so `--base` makes a new base:

1. It finds the scanned base: the widest band in the bottom 6 % of the scan. The very bottom of a scan is narrower than the base, because Object Capture rounds off the bottom edge. In the test, the scan was 38 mm wide at the bottom and 50 mm wide at 3.8 mm.
2. It moves the center of that band to the origin. The app puts the base collider at the origin. Without `--base`, the center of the bounding box goes to the origin. For a figure with wings or a weapon to one side, that is not the base center: in the test, it was 9 mm away.
3. It deletes the scan triangles below 3 mm. The corners of the scan triangles that cross 3 mm move up to 3 mm. As a result, the line between the team color and the scan is straight.
4. It adds a cylinder with the game diameter, from y = 0 to 3 mm, with the material `defaultMat`. 3 mm (0.118 app units) is the height of the base collider in `CharacterModel.jsx` (2 × `BASE_HALF_H`). The base disk of the TTS model bundles is also 3 mm high. The cylinder has 48 sides, as the standee base.

When the real base is thicker than 3 mm, the top part of its scanned rim stays above the team color, with the scanned paint. The migrated models look the same: the team color is the bottom disk, and the scenic base on top has its own texture.

## Stand

A figure can stand on a jar or a block when you take the photos, so the camera sees the whole figure. A flat dark sheet is better, see the photo rules. Object Capture keeps the stand in the scan. Without `--stand`, `--base` takes the top of the stand as the base: the stand gets the base size and the team color.

With `--stand`, the script cuts the stand off the raw scan, before the size and the base steps:

1. It cuts the scan height into bands and takes the width of each band (the mean of its x and z extent).
2. In the lower half of the scan, it finds the two bands next to each other where the width drops the most. That is the top of the stand.
3. It deletes every triangle with a corner below that height. The base of the figure is now the bottom of the scan, and the `--base` steps work on it as usual.
4. It prints the cut height as a part of the scan height, and the width of the figure base as a part of the stand width. Check that these are what you expect.

Limit: this works only when the stand is clearly wider than the figure base. If the biggest step is not narrow enough, the script stops with an error and writes nothing. A stand that is as wide as the figure base, or a figure that gets wider above its base, is not found. The constants are in `scripts/photos-to-glb.mjs`.

## Tone

The light of the photos goes into the texture. Photos taken in bright light give pale colors. `--tone` fixes this after the scan: it runs `magick` on the color texture (gamma and saturation) before the WebP step. The three levels are in `TONES` in `scripts/photos-to-glb.mjs`. They were tested on one scan made in too bright light, see [the plan](../plans/model-viewer.md).

The fix cannot restore parts that are already white in the photos. Better photos are the first choice. Use `--tone` when a new shoot is not possible. Without `--tone`, the texture does not change.

## How to take the photos

These rules come from Apple's Object Capture guide.

- Take 20–200 photos. The limit of Object Capture is 1500.
- Walk around the object and take a photo every 10–15°. Do this at 2–3 heights. Each photo must overlap the one before by about 70 %.
- The object must fill most of the photo. More pixels on the object give more detail and a bigger texture.
- Use even, soft light without hard shadows and without flash. The light of the photos is copied into the texture, so a shadow in the photos is a shadow on the model.
- Use a plain background. Object Capture removes the background (object masking is on).
- Keep the whole figure in every photo. Do not take close-ups of parts. In the test, close-ups added a background blob next to a thin part.
- Put the figure on a flat, dull, dark sheet. This worked better than a stand.
- A stand stays in the scan. `--stand` cuts it only when it is clearly wider than the base.
- Use soft light, not bright light. Bright light gives pale colors, see [Tone](#tone).
- Shiny, transparent and very thin parts do not work well.

## Output

| Output | Content |
|---|---|
| `<out>.glb` (default `apps/web/model-candidates/<name>.glb`) | Mesh with the material of the scan and its WebP color texture inside (`EXT_texture_webp`), Draco. With `--base`, also the base cylinder with the material `defaultMat`. |
| `$TMPDIR/mcp-assist-3d-photogrammetry/<name>/` | OBJ, MTL, PNG and USDA from Object Capture, kept for inspection. `<name>` is the file name of the output without `.glb`. The script deletes this folder at the start of each run. |

The model is Y up, with the bottom at y = 0. Object Capture cannot know the front of the object, so the model can be turned around the vertical axis. In the test, it was turned by about 90°. Fix it with `turn-model`, see [Front](#front).

The materials are the same as in the migrated models: metallic 0, roughness 1. The scan material has a white base color with the texture. Normal, roughness and occlusion maps are not made, because the app uses only the color texture.

## Test

The script was tested with 96 photos rendered by Blender from `src/assets/angel.glb` (4 heights × 24 angles, 1600 × 1200, grey background). Angel has a medium base.

| Run | Result |
|---|---|
| `--height 89.7` | 47 s, 12,928 triangles, a 1024 texture, 139 KB, 68.8 × 54.4 × 89.7 mm. The scanned base center was 9 mm from the origin. |
| `--base medium` | 12,961 triangles, 142 KB, 70.4 × 55.4 × 90.7 mm. The base cylinder is centered at the origin, 50 mm wide. |

Rendered next to the original, the shape and colors were correct, and the model was turned by about 90°. The colors were a little darker, because the texture has the light of the rendered photos. In a render with a red `defaultMat`, the base was red from y = 0 to 3 mm, with a straight line to the scanned rim above it.

## Front

Object Capture does not know the front of the object, so a scan comes out turned by a random angle (about 90° in the test). `scripts/turn-model.mjs` turns the file after the scan.

What the app does with a model, traced in the code:

- **Body turn at spawn.** A model that spawns on its tray card gets a body turn by team: host 0, guest 180°. `modelSpawnYaw` in `src/characters/models.js` sets it (`Scene.jsx` passes it as the start rotation). With it, both teams face the board: the host sits at +z and the guest at -z (`src/setup/setup.js`).
- **Figure turn of a TTS model.** The figure (the GLB) is also turned on its body by 180° minus `rotation` of the character in `src/characters/characters.json` (`modelFigureYaw`). This is the TTS `cModelRot`, which the TTS models need because each bundle has its own front.
- **Figure turn of a scan.** A scan skips `rotation`: `modelFigureYaw` gives it the fixed turn `SCAN_FIGURE_YAW`. `rotation` was set for the TTS mesh, and the turn of a scan is random, so one number per character would only repeat what `turn-model` does. A scan is a file listed in `scripts/custom-models.json` (`isScanFile`, the same list that the scripts read). The second model, transform and constructs of a character are TTS files and keep `rotation`.
- **Front of the model file.** For a scan the front is local +z of the GLB, for host and guest. A TTS model has the front (sin r, 0, cos r) in the x-z plane, with `rotation` r (degrees).

Turn the file so that local +z is the front of the figure. `turn-model` alone sets which way a scan faces. The `#models` page shows the front and the angle, see [Model viewer](model-viewer.md).

```bash
pnpm --filter web turn-model gamora 90                       # a character of scripts/custom-models.json
pnpm --filter web turn-model model-candidates/hulk.glb -45   # a candidate file
```

- The angle is in degrees. Positive is counterclockwise, seen from above.
- The turn is around the vertical line through the origin. With `--base`, that is the base center, so the base stays where the collider is.
- The script writes the file with Draco, as `photos-to-glb` does, and prints the angle and the new width × depth.
- A character key must be in `scripts/custom-models.json`. A TTS model would be overwritten by the next migration, so the script stops with an error.
- For a character, the script saves the sum of its turns in the command of the file in `scripts/custom-models.json`, as `&& pnpm --filter web turn-model <key> <sum>` at the end. A new turn changes the sum. The sum is in -180..180. A sum of 0 removes the part, because the file is then the same as the first command made it.
- Each turn writes the Draco mesh again, so many turns add a little rounding. Add the angles up and turn once when you can.

## Terrain pieces

The script also works for a terrain piece. Leave out `--base` and pass `--height <mm>` with the height of the real piece. The script scales the piece to that height and puts its bottom on the table. The output is the same format as the migrated pieces: one GLB with a WebP texture and Draco compression.

These parts are missing or different for terrain:

1. **A scanned piece cannot be added to a map yet.** `src/terrain/pieces.js` knows two kinds of pieces (see [Maps](maps.md#pieces)):
   - An OBJ piece is a mesh and a texture file, with a collider from the mesh. The script writes a GLB, so it does not fit this kind.
   - A bundle piece (`bundle: true`) is a GLB, so it fits. But a bundle piece gets no collider from its visible mesh. It needs a `colliders` list: shapes written by hand (box, cylinder and so on) or a separate collider GLB. Without colliders, models and dice fall through the piece.
2. **The front of the piece is random.** Object Capture does not know which side is the front, so the piece can be turned (about 90° in the test). For a figure this matters little. On a map, the placement must match the mat. `turn-model` turns the file, see [Front](#front).
3. **The center is the center of the bounding box.** This is correct for terrain, because the placements in `maps/<id>.json` are relative to the piece center.
4. **The camera cannot see some parts.** Undersides, overhangs, the inside of buildings and very thin parts (railings, antennas) come out bad or closed. Many terrain pieces have these parts, for example the Mech Hangar or the Apartments.
5. **Big pieces need more detail.** The defaults (30k triangles, 2048 texture) are set for a figure. A large building may need `--triangles 60000 --texture 4096`. The photo rules are the same, and the piece must still fill most of each photo.

To support scanned terrain, the app needs:

- colliders for the scan, for example one convex hull or mesh collider made from the scan
- an entry in `pieces.js` and a placement in a map JSON file

## Use for a character

To replace the model of a character:

1. Make the GLB with `photos-to-glb`, with `--base` of the character and `--texture 1024`.
2. Copy it to `src/assets/characters/<key>/model.glb`. The app already loads this file, so `characters.json` does not change.
3. Add the file to `scripts/custom-models.json`: character key, file relative to `src/assets`, and how it was made (command, photo set).
4. Turn the front to the board with `pnpm --filter web turn-model <key> <degrees>`, see [Front](#front). It adds the turn to the command in the list.

The list exists because `migrate-characters.mjs` would convert the TTS model again and overwrite the scan, for example with `--force` or after a new source URL. The script never converts or overwrites a listed file, also with `--force`. It prints a line when it skips one. The rest of the character still migrates, and the manifest keeps the source URL.

## Out of scope

- **Other pieces.** The script writes a GLB file only. It does not add a piece to `pieces.js`. A character gets its model by the copy above.
- **Base height.** The team color covers 3 mm for every base. A `--base-height` option could cover the whole rim of a thicker real base. It is not built yet.
- **More detail in the scan.** `--triangles` is only an upper limit. Object Capture writes fewer triangles when the photos show less detail, so a higher `--triangles` alone often changes nothing. Ideas to test on one model, to compare with the current scan:
  1. Better photos, no code change: full-size iPhone HEIC instead of 1600 × 1200, and more photos. The whole figure stays in every photo, as in [How to take the photos](#how-to-take-the-photos), because close-ups added a blob in the test.
  2. `featureSensitivity = .high` in `object-capture.swift`. Object Capture then looks harder for detail on smooth or plain surfaces, for example painted figures. Runs are slower.
  3. Ask Object Capture for its full-detail mesh, then reduce it to exactly `--triangles` with gltf-transform `simplify` (meshoptimizer). The count is then always the given one, and the script controls how the mesh is reduced.

  For a figure, the texture can change the look more than the triangles. Character models use `--texture 1024`, the limit in `scripts/lib/convert.mjs`.

## Decisions

- **No Blender.** An earlier plan used Blender to import a USDZ file, reduce the mesh, recenter it and export a GLB. The script does not need it. When the output is a folder (not a `.usdz` file), Object Capture writes an OBJ. Its `.custom` detail level reduces the mesh and the texture to the given limits. The repo already converts OBJ files to GLB for the TTS pieces. So the pipeline has one tool less.
- **One generic GLB.** The script does not write into `src/assets/characters/` or `src/assets/terrain/`. A scan can be a figure, a terrain piece or something else, so the script writes to the candidates folder, and you move the file where it belongs.
- **A new base instead of a recolored scanned base.** The other option was to give `defaultMat` to the scan triangles below about 2.5 mm. That keeps the scanned shape. But the line of the team color would be jagged, and the base size would be about 3 % off the game size. The new cylinder has the exact game size, so it matches the base collider.
- **`imageToWebp` uses a temp file.** Passing image bytes to `magick` through stdin hung in 2 of 30 runs with the 1.3 MB texture of a scan: `magick` waited for the rest of stdin, and Node did not write it. With a temp file, 60 of 60 runs finished. The TTS migration scripts use the same function.
