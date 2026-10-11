# Feature: Custom models from photos

Status: the script works. The app does not load custom models yet: you put the GLB where you need it.

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
pnpm --filter web photos-to-glb ~/Pictures/hulk --out /tmp/hulk.glb --base large                 # a figure on a large base
pnpm --filter web photos-to-glb ~/Pictures/hulk --out /tmp/hulk.glb --base large --texture 1024  # texture size of the migrated characters
pnpm --filter web photos-to-glb ~/Pictures/crate --out /tmp/crate.glb --height 38                # not a figure: 38 mm tall
```

| Option | Default | Meaning |
|---|---|---|
| `--out <file.glb>` | required | Output file |
| `--base <size>` | none | `small`, `medium` or `large`: the object is a figure on a game base (35, 50 or 65 mm, `BASE_DIAMETER` in `src/characters/files.js`). Use the same size as `base` of the character in `characters.json`. See [Base](#base). |
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

## How to take the photos

These rules come from Apple's Object Capture guide.

- Take 20–200 photos. The limit of Object Capture is 1500.
- Walk around the object and take a photo every 10–15°. Do this at 2–3 heights. Each photo must overlap the one before by about 70 %.
- The object must fill most of the photo. More pixels on the object give more detail and a bigger texture.
- Use even, soft light without hard shadows and without flash. The light of the photos is copied into the texture, so a shadow in the photos is a shadow on the model.
- Use a plain background. Object Capture removes the background (object masking is on).
- Shiny, transparent and very thin parts do not work well.

## Output

| Output | Content |
|---|---|
| `<out>.glb` | Mesh with the material of the scan and its WebP color texture inside (`EXT_texture_webp`), Draco. With `--base`, also the base cylinder with the material `defaultMat`. |
| `$TMPDIR/mcp-assist-3d-photogrammetry/<name>/` | OBJ, MTL, PNG and USDA from Object Capture, kept for inspection. `<name>` is the file name of `--out` without `.glb`. The script deletes this folder at the start of each run. |

The model is Y up, with the bottom at y = 0. Object Capture cannot know the front of the object, so the model can be turned around the vertical axis. In the test, it was turned by about 90°.

The materials are the same as in the migrated models: metallic 0, roughness 1. The scan material has a white base color with the texture. Normal, roughness and occlusion maps are not made, because the app uses only the color texture.

## Test

On 2026-10-08, the script was tested with 96 photos rendered by Blender from `src/assets/angel.glb` (4 heights × 24 angles, 1600 × 1200, grey background). Angel has a medium base.

| Run | Result |
|---|---|
| `--height 89.7` | 47 s, 12,928 triangles, a 1024 texture, 139 KB, 68.8 × 54.4 × 89.7 mm. The scanned base center was 9 mm from the origin. |
| `--base medium` | 12,961 triangles, 142 KB, 70.4 × 55.4 × 90.7 mm. The base cylinder is centered at the origin, 50 mm wide. |

Rendered next to the original, the shape and colors were correct, and the model was turned by about 90°. The colors were a little darker, because the texture has the light of the rendered photos. In a render with a red `defaultMat`, the base was red from y = 0 to 3 mm, with a straight line to the scanned rim above it.

## Out of scope

- **Loading the model in the app.** The script writes a GLB file only. It does not add a character to `characters.json` or a piece to `pieces.js`.
- **Choosing the front.** A `--turn <degrees>` option could turn the model so its front faces the right way. It is not built yet.
- **Base height.** The team color covers 3 mm for every base. A `--base-height` option could cover the whole rim of a thicker real base. It is not built yet.

## Decisions

- **No Blender.** An earlier plan used Blender to import a USDZ file, reduce the mesh, recenter it and export a GLB. The script does not need it. When the output is a folder (not a `.usdz` file), Object Capture writes an OBJ. Its `.custom` detail level reduces the mesh and the texture to the given limits. The repo already converts OBJ files to GLB for the TTS pieces. So the pipeline has one tool less.
- **One generic GLB.** The script does not write into `src/assets/characters/` or `src/assets/terrain/`. A scan can be a figure, a terrain piece or something else, so you choose where the file goes.
- **A new base instead of a recolored scanned base.** The other option was to give `defaultMat` to the scan triangles below about 2.5 mm. That keeps the scanned shape. But the line of the team color would be jagged, and the base size would be about 3 % off the game size. The new cylinder has the exact game size, so it matches the base collider.
- **`imageToWebp` uses a temp file.** It gave image bytes to `magick` through stdin before. On 2026-10-08, this hung in 2 of 30 runs with the 1.3 MB texture of a scan: `magick` waited for the rest of stdin, and Node did not write it. With a temp file, 60 of 60 runs finished. The TTS migration scripts use the same function.
