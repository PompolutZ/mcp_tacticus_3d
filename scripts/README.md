# TTS terrain migration

`migrate-terrain.mjs` copies the mat and terrain of one map from the TTS mod to `src/assets`. It converts the files for the web in the same way as the Vibranium Heist pieces. Then it prints the entries to add to `src/terrain/maps.js`.

A "map" is a card in the mod's Terrain Database. It has an id, a name, and a list of placements (piece key, position, rotation, scale, tint). The first `Custom_Tile` placement is the mat.

## Requirements

- Tabletop Simulator with mod 3036795456. TTS downloads a file to its cache only when an object uses it, so spawn a map once in TTS before you migrate it.
- `tools/AssetRipper.GUI.Free` and `tools/libcapstone.dylib` (macOS arm64). `tools/` is in `.gitignore`. Get them from the [AssetRipper releases](https://github.com/AssetRipper/AssetRipper/releases). The script was tested with the build from 2026-08-24 (`tools/compile_time.txt`).
- ImageMagick (`magick`).
- `npm install`. The conversion libraries are dev dependencies.

## Usage

```bash
npm run migrate-terrain -- --list                      # maps whose mat is in the TTS cache, and which pieces are missing
npm run migrate-terrain -- 282                         # migrate map 282 (a name also works, if it is unique)
npm run migrate-terrain -- 282 --out /tmp/terrain-try  # trial run: nothing is written to the repo
npm run migrate-terrain -- 282 --force                 # convert pieces again that the manifest already lists
```

`--list` reads the TTS cache each time. The cache grows when a map is spawned in TTS, so run `--list` again after that.

Several maps have the same name, for example three "Cosmic Downtown" cards. Maps in the "Strict Maps" category are the official versions.

## How to add a map to the app

1. Run `--list` and choose a map id. If the map has "missing" pieces, spawn the map once in TTS and run `--list` again.
2. Run the script with the id. Read the warnings in the report.
3. Copy the printed entries into `src/terrain/maps.js`. The script also saves them in `$TMPDIR/mcp-assist-3d-terrain/<map>.snippet.js`.
4. Compare tints with the map card image. For example, the mod tints the Vibranium Heist truck black, but the card shows it olive, so `maps.js` leaves that tint out.
5. Commit the new files in `src/assets` and `scripts/terrain-manifest.json` together.

The app does not use all the printed data yet. See [What the app still needs](#what-the-app-still-needs).

## Output

| Output | Content |
|---|---|
| `src/assets/<map>-mat.webp` | Mat image |
| `src/assets/terrain/<key>.glb` | Piece mesh |
| `src/assets/terrain/<key>.webp` | Texture of an OBJ piece |
| `src/assets/terrain/<key>-collider.glb` | Collider mesh of an OBJ piece, when it is not the visible mesh |
| `src/assets/terrain/<key>-collider-<n>.glb` | Custom collider mesh of a bundle piece |
| `scripts/terrain-manifest.json` | TTS source URLs of every migrated piece and mat |
| `$TMPDIR/mcp-assist-3d-terrain/<key>/` | AssetRipper exports of a bundle piece (`primary/`, `project/`), kept for inspection |

`<key>` is the piece key in the mod, for example `cargo-size-2`. The manifest stores the source URLs of each piece (`mesh`, `diffuse`, `collider`, or `bundle`). A piece with the same source URLs as a migrated piece gets that piece's key. For example, `size-2-wakanda-tree` in Hydra Vs Wakanda is `wakanda-tree` from Vibranium Heist. As a result, a piece is converted only once. The first 9 entries of the manifest were written by hand for the Vibranium Heist pieces.

## Piece types

| TTS type | Source | Result |
|---|---|---|
| `Custom_Model` | OBJ mesh and texture image | GLB with one material, texture as a separate WebP, `convex` flag. Also `collider` if the piece has its own collider mesh. |
| `Custom_Assetbundle` | Unity asset bundle | GLB with its own materials and WebP textures, and `colliders` from the prefab |
| `Custom_Tile` (the first one) | Image | The mat |
| `Custom_Token`, other tiles | Image | Skipped. The placement is printed as a comment. |

## Conversion settings

- **OBJ to GLB:** obj2gltf. It flips V to the glTF convention, so `Terrain.jsx` sets `flipY = false` on the separate texture.
- **Mesh:** `dequantize`, `flatten`, `dedup`, `join`, `prune({ keepAttributes: true })`, `draco({ quantizeTexcoord: 14 })`. `dedup` runs before `join` because bundles have many copies of the same material. Without `keepAttributes`, prune deletes the UVs of a material that has no texture. A mesh without normals gets `unweld` and `normals` first (flat normals, as OBJLoader makes them). Tangents, second UV sets and vertex colors are removed, because only the color texture is used.
- **Textures:** `magick <in> -resize '2048x2048>' -strip -quality 85 <out>.webp`. Bundle textures stay inside the GLB as WebP (`EXT_texture_webp`, which three.js reads). Normal maps are not used.
- **Mat:** the same, with at most 4096 × 4096. The Wakanda mat is 2592 × 2592, as in the source.

## TTS rules that the script depends on

These rules were found by measuring the mod data on 2026-09-28.

### Units and axes

- TTS units are inches. At the tile scale of 18, the mat is 36" wide.
- TTS (Unity) is left-handed. `Terrain.jsx` mirrors Z to convert a placement to Three.js.
- TTS mirrors X when it imports an OBJ. AssetRipper also mirrors X when it converts Unity to glTF. Therefore, both kinds of GLB need the same 180° turn around Y (`IMPORT_ROTATION` in `Terrain.jsx`). Proof for AssetRipper: in the container bundle, a child has localPosition x = -0.05 in the Unity YAML and x = 0.05 in the GLB.
- A placement position is the piece origin. The mat is not always at (0, 0): in Savage Land Research Site it is at (0.32, -0.26). Therefore, the printed positions are relative to the mat center.
- The mat rotation around Y is not the same in every map. It is 180 in Vibranium Heist, and 90 or -90 in most other maps. The script prints it as `matRotation`.

### Root of a bundle prefab

The GLB from AssetRipper leaves out the transform of the prefab root. TTS keeps the root rotation and scale, and ignores the root position. The script puts the root rotation and scale into the GLB. Evidence:

- The Daily Bugle root has scale 100. Without the root scale, the Bugle is 0.03" tall. With it, the Bugle is 3" tall, which is plausible for a Size 3 piece.
- The root of `size-2-car` is at (-144, 814, 1558). If TTS kept the position, the car would be far away from the mat.
- Placement heights match: the concrete barrier (root scale 0.5) should be at y = 1.60, and the database has 1.599. The bus stop (root turned 180° around X) should be at 1.99, and the database has 1.993.

### Colliders of a bundle

The GLB has no colliders. Colliders are components in the prefab, so the script reads them from AssetRipper's Unity project export (`lib/unity-prefab.mjs`). Kinds found in the maps so far:

- `MeshCollider` with Unity's built-in cube or cylinder mesh, scaled. This is the most common kind. The script converts it to a box or a cylinder.
- `BoxCollider`: vehicles and the Daily Bugle.
- `MeshCollider` with a custom mesh: the bench, the bus stop, the barrel, and the character statues. A statue collider covers only the base, the same as the Angel figure.

The script copies the colliders as TTS has them, even when they look wrong. For example, `crates-size-2` has two boxes at the same place, and one corner of the mesh has no collider.

The script was checked on the 22 bundle pieces in Demons Downtown, Savage Land Research Site, Sinister Showdown and Old Town Road. For every piece, the box around all its colliders is in the same place as the box around its mesh. The mesh bottom is at y = 0, or it matches the placement height. The only colliders that cover much less than the mesh are the statue bases and the crates.

Format of `colliders`: GLB space, relative to the piece origin, before `IMPORT_ROTATION` and the placement scale. Quaternions are `[x, y, z, w]`.

```js
{ shape: 'box', position, quaternion, halfExtents }
{ shape: 'cylinder', position, quaternion, radius, halfHeight }   // axis is local Y
{ shape: 'capsule', position, quaternion, radius, halfHeight }    // halfHeight is the straight part, without the round ends
{ shape: 'sphere', position, radius }
{ shape: 'mesh', convex, position, quaternion, scale, mesh }      // mesh: collider GLB; convex: use the convex hull
```

### Other bundle details

- Each bundle has a manifest at `primary/Assets/AssetBundle/*.json`. Its `m_Container` has the prefab path in lower case, for example `assets/examples/prefabs/container_orange.prefab`. The prefab GLB is at the same path, with the original upper and lower case. `primary/Assets/Mesh/` has every mesh as its own GLB; the script uses it for custom collider meshes. The other folders (Sprite, Shader, and built-in meshes as JSON) are Unity default content.
- Some bundles depend on another bundle. For example, `barrel-size-1` gets its material from `industrial_01_mat_asset`. TTS does not load that bundle, so the barrel has no texture in TTS either. The script prints a warning.
- Vehicles have many materials. After `dedup` they have up to 9 materials and 9 primitives.
- The script does not remove inactive objects or LOD levels from the GLB. No problem was seen, but no bundle was checked for this.

## AssetRipper without the browser

The AssetRipper UI is a front end for a local HTTP server. `lib/assetripper.mjs` starts the server and posts to the same routes that the UI uses.

- Start: `AssetRipper.GUI.Free --headless --log=false`. Without `--port`, AssetRipper chooses a free port and prints `Now listening on: http://127.0.0.1:<port>`. `--log false` (with a space) fails with "Too many arguments". Without `--log=false`, AssetRipper writes a log file next to the binary.
- Routes: `POST /Reset`, `POST /LoadFile` (`Path=<file>`), `POST /LoadFolder`, `POST /Export/PrimaryContent` (`Path=<dir>`), `POST /Export/UnityProject` (`Path=<dir>`). The body is form-encoded. Each route answers with a redirect after the work is finished.
- `GET /openapi.json` lists all routes. The export settings are at `/Settings/Edit`; the script uses the defaults.

## Where the data comes from

- **Terrain Database:** the `Terrain Database` object in `~/Library/Tabletop Simulator/Mods/Workshop/3036795456.json`. Its Lua script has `terrainDatabase = { pieces = {...}, cards = {...} }`. `lib/lua-table.mjs` reads the table, so Lua is not needed.
- **TTS cache:** `~/Library/Tabletop Simulator/Mods/{Models,Images,Assetbundles}`. A cached file is named after its URL, with every character except letters and digits removed, plus the extension. For example, `https://d37ev18qvj5a3m.cloudfront.net/tts/terrain/ab12.obj` becomes `httpsd37ev18qvj5a3mcloudfrontnetttsterrainab12obj.obj`.

## What the app still needs

`Terrain.jsx` supports only OBJ pieces with `mesh`, `texture` and `convex`, and `Scene.jsx` always shows Vibranium Heist. A new map needs these changes:

1. **Bundle pieces:** use the materials in the GLB, because these pieces have no `texture`. Keep `IMPORT_ROTATION`. Decide how to apply `tint` to materials that have their own colors.
2. **`colliders`:** create one Rapier collider per entry, inside the same group as the mesh, so that `IMPORT_ROTATION` and the placement scale apply to it. Box → `CuboidCollider`, cylinder → `CylinderCollider`, capsule → `CapsuleCollider`, sphere → `BallCollider`, mesh → hull or trimesh of the collider GLB, with its `scale`. Check in the Debug → Colliders view that the colliders are not turned twice (see the note in `Terrain.jsx`).
3. **`collider` on OBJ pieces:** build the collider from that GLB, not from the visible mesh.
4. **`matRotation`:** turn the mat image. The Vibranium Heist mat has 180 and needs no turn. TTS Y rotation `r` is `-r` in Three.js, so the extra turn is probably `-(matRotation - 180)` degrees. This is not checked in the browser yet.
5. **Map choice:** `Scene.jsx` uses `MAPS['vibranium-heist']`.
