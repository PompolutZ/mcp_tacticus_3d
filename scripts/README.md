# TTS terrain migration

`migrate-terrain.mjs` copies the mat and terrain of one map from the TTS mod to `src/assets`. It converts the files for the web in the same way as the Vibranium Heist pieces. Then it prints the entries to add to `src/terrain/pieces.js` and `src/terrain/maps.js`.

A "map" is a card in the mod's Terrain Database. It has an id, a name, and a list of placements (piece key, position, rotation, scale, tint). The first `Custom_Tile` placement is the mat.

The app data has no file paths. `src/terrain/files.js` names each file after the piece key or the mat name, and the script writes the files with the same functions:

- `pieces.js`: one entry per set of files, with `name`, `convex` and `collider`.
- `maps.js`: one entry per map, with `name`, `mat` and `placements`.

The script prints `name` as the mod piece name without the Size, for example "Panther Statue" for "Size 3 Panther Statue". The name is only shown in the app, so you can change it in `pieces.js`.

The script prints the game Size on each placement (`size`). It reads the Size from the name of the mod piece, for example "Size 3 Panther Statue" or "Crystals: Size 1". A piece name without "Size" gets no `size`. The Size is on the placement and not on the piece: two mod pieces with the same files get one app piece, and their Sizes can be different.

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
3. Copy the printed entries into `src/terrain/pieces.js` and `src/terrain/maps.js`. The script also saves them in `$TMPDIR/mcp-assist-3d-terrain/<map>.snippet.js`.
4. Compare tints with the map card image. For example, the mod tints the Vibranium Heist truck black, but the card shows it olive, so `maps.js` leaves that tint out.
5. Commit the new files in `src/assets` and `scripts/terrain-manifest.json` together.

The app does not use all the printed data yet. See [What the app still needs](#what-the-app-still-needs).

## Output

| Output | Content |
|---|---|
| `src/assets/<mat>-mat.webp` | Mat image |
| `src/assets/terrain/<key>.glb` | Piece mesh |
| `src/assets/terrain/<key>.webp` | Texture of an OBJ piece. The entry has `texture: false` when the mod piece has no texture. |
| `src/assets/terrain/<key>-collider.glb` | Collider mesh of an OBJ piece with `collider: true` |
| `src/assets/terrain/<key>-collider-<n>.glb` | Custom collider mesh `n` of a bundle piece |
| `scripts/terrain-manifest.json` | TTS source URLs of every migrated piece and mat |
| `$TMPDIR/mcp-assist-3d-terrain/<key>/` | AssetRipper exports of a bundle piece (`primary/`, `project/`), kept for inspection |

`<key>` is the piece key in the mod, for example `cargo-size-2`. `<mat>` is the map name in lower case, for example `battle-for-asgard`. The manifest stores the source URLs of each piece (`mesh`, `diffuse`, `collider`, or `bundle`) and the image URL of each mat. A piece with the same source URLs as a migrated piece gets that piece's key. For example, `size-2-wakanda-tree` in Hydra Vs Wakanda is `wakanda-tree` from Vibranium Heist. As a result, a piece is converted only once. The first 9 entries of the manifest were written by hand for the Vibranium Heist pieces.

## Piece types

| TTS type | Source | Result |
|---|---|---|
| `Custom_Model` | OBJ mesh and texture image | GLB with one material, texture as a separate WebP, `convex` flag. Also `collider: true` if the piece has its own collider mesh. |
| `Custom_Assetbundle` | Unity asset bundle | GLB with its own materials and WebP textures (`bundle: true`), and `colliders` from the prefab |
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
{ shape: 'mesh', convex, position, quaternion, scale, mesh }      // mesh: number n of the collider GLB (<key>-collider-<n>.glb); convex: use the convex hull
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

`Terrain.jsx` supports OBJ pieces with a texture, with `convex` and `collider`. The map list in the toolbar shows every entry in `MAPS`. A map with other pieces or another mat rotation needs these changes:

1. **Bundle pieces (`bundle: true`):** use the materials in the GLB, because these pieces have no texture file. Keep `IMPORT_ROTATION`. Decide how to apply `tint` to materials that have their own colors.
2. **`colliders`:** create one Rapier collider per entry, inside the same group as the mesh, so that `IMPORT_ROTATION` and the placement scale apply to it. Box → `CuboidCollider`, cylinder → `CylinderCollider`, capsule → `CapsuleCollider`, sphere → `BallCollider`, mesh → hull or trimesh of the collider GLB, with its `scale`. Check in the Debug → Colliders view that the colliders are not turned twice (see the note in `Terrain.jsx`).
3. **`matRotation`:** turn the mat image. The app reads no `matRotation` yet, and it draws every mat as if it had 180. Vibranium Heist, Battle For Asgard and Hydra Vs Wakanda have 180 (the script prints -180 for Hydra Vs Wakanda, which is the same angle). TTS Y rotation `r` is `-r` in Three.js, so the extra turn is probably `-(matRotation - 180)` degrees. This is not checked in the browser yet.

# TTS character migration

`migrate-characters.mjs` copies characters from the TTS mod to `src/assets/characters/<key>/`. For each character, it converts the 3D model (or the standee images, if the mod has no model), the stat cards and the roster portrait. It writes the app data to `src/characters/characters.json` and the source URLs to `scripts/character-manifest.json`.

The key is the character name as a slug, for example `heimdall-the-all-seeing`. `src/characters/files.js` names the files after the key, so `characters.json` has no paths.

The requirements are the same as for the terrain migration: spawn the characters once in TTS, AssetRipper in `tools/`, ImageMagick.

## Usage

```bash
npm run migrate-characters -- --list                   # characters with files in the TTS cache, and their status
npm run migrate-characters -- --list asgard            # every character of one affiliation
npm run migrate-characters -- asgard                   # migrate every character of an affiliation that has its files in the cache
npm run migrate-characters -- 00280101 "Lady Sif"      # migrate by MCT id, name or key
npm run migrate-characters -- asgard --out /tmp/try    # trial run: nothing is written to the repo
npm run migrate-characters -- asgard --force           # convert files again that the manifest already lists
```

An affiliation is a key of `allAffiliations` in the mod's Database script, for example `asgard`, `wakanda`, `cabal` or `hydra`. A name matches with or without punctuation: "Loki, Prince of Lies" and "Loki (Prince of Lies)" are the same.

The script converts a file only when the manifest does not have it with the same URL. Therefore, a second run converts only new or changed files. Commit `src/assets/characters/<key>/`, `src/characters/characters.json` and `scripts/character-manifest.json` together.

## Output

| File in `src/assets/characters/<key>/` | Source in the mod row | Required |
|---|---|---|
| `model.glb` | `cModel` | yes, if the mod has a model |
| `standee-front.webp`, `standee-back.webp` | `cFigA`, `cFigB` | yes, if the mod has no model |
| `card-healthy.webp`, `card-injured.webp` | `cCard.face`, `cCard.back` | yes |
| `portrait.webp` | `UIurl` | no |
| `model-2.glb`, `card-2-healthy.webp`, ... | list items 2, 3, ... of `cModel` and `cCard` | no |
| `transform.glb` or `transform-standee-*.webp` | `cTModel`, or `cTFigA` and `cTFigB` | no |
| `transform-portrait.webp` | `TUIurl` | no |

When a file that is not required is missing in the TTS cache, the script leaves it out and prints a warning. For example, Apocalypse has a second version of his card on Steam, which TTS has not downloaded.

Entry in `characters.json`:

```js
"heimdall-the-all-seeing": {
  "id": "01020101",        // MCT code, the same id as in Jarvis and Cerebro
  "name": "Heimdall, The All-Seeing",
  "base": "small",         // small, medium or large: BASE_DIAMETER in src/characters/files.js
  "figure": "model",       // model or standee
  "rotation": 330          // cModelRot, only for a model (see below)
}
```

Optional fields: `models` and `cards` (number of versions, when more than 1), `transform` (`figure`, `rotation`, and `name`, `base`, `portrait` when the mod has them), and `portrait: false` when the portrait is not in the cache.

`$TMPDIR/mcp-assist-3d-characters/<key>/` has the AssetRipper exports, for inspection.

## Conversion settings

- **Model:** the same steps as a terrain bundle: the prefab GLB with the root rotation and scale, textures as WebP of at most 2048 × 2048, then `compressMesh` with Draco. The result is like `src/assets/angel.glb`. The colliders of the prefab are not copied, because `CharacterModel.jsx` makes a cylinder for the base.
- **Base material:** the script renames the base material to `defaultMat`, because `CharacterModel.jsx` gives the material with that name the team color. The mod bundles use `defaultMat` or `Material`.
- **Images:** cards, standees and portraits are WebP, quality 85, at most 2048 × 2048. The cards stay at 1800 × 1200 (about 250 KB instead of 1.8 MB).

## TTS rules that the script depends on

These rules were found on 2026-09-28 in the mod scripts ("Red Tray Spawner" and Global) and in the 10 Asgard model bundles.

- In every model bundle, the base is the only material without a color texture. The base mesh is a disk from y = 0 to y = 0.12, and its radius is half of `cBase`: 0.69" for small, 0.98" for medium, 1.28" for large. The script checks this and prints a warning if a base does not fit.
- The tray spawns a model with Y rotation = tray rotation + 180 + `cModelRot`. `characters.json` stores `cModelRot` as `rotation`. The app shows `angel.glb` with no turn, and Angel has `cModelRot` 180, so the app turn is probably `rotation - 180`. This is not checked in the browser yet.
- No spawn script in this save reads `cTModelRot`, so the `rotation` of a transform model is not checked.
- The tray spawns a standee as a `Figurine_Custom` with `image = cFigA` and `image_secondary = cFigB`, turned by 180 without `cModelRot`. The figurine scale is 0.75 for a small base, 1.1 for medium and 1.4 for large. The mod spawns a standee only when `cFigA` is set; when `cFigB` is empty, it uses `cFigA` on both sides.
- When `cModel` is a list, the tray spawns the model with the same position in the list as the card face on the table (Mephisto, Crossbones, Merciless Merc).
- The script ignores `cModelAlt` (Captain Marvel, Vision), `twoModels` (Ms. Marvel) and `construct` (Magneto, Phoenix), and prints a warning for them. `cTCard` is not needed, because the same cards are also in the `cCard` lists.

## What the app still needs

1. `Scene.jsx` loads only `angel.glb`. It needs a way to choose characters from `characters.json`.
2. `CharacterModel.jsx` uses the base radius of Angel (medium) for every model. It needs the radius from `BASE_DIAMETER[base]`.
3. A standee component for `figure: 'standee'` (Valkyrie and Elendil): the two images on a thin card, on a base of the character's size.
4. The model turn from `rotation`, see the rule above.

# Jarvis character data

`fetch-jarvis-characters.mjs` downloads the stats and the stat card text of every character from [Jarvis Protocol](https://www.jarvis-protocol.com) to `src/characters/jarvis-characters.json`. The file is an array of the `/api/characters/<slug>` responses, sorted by slug.

```bash
npm run fetch-jarvis-characters             # download new and changed characters
npm run fetch-jarvis-characters -- --force  # download every character again
```

- `GET /api/characters` returns the list. Each entry has a `version` (a Unix timestamp), but no stat card. The script downloads `GET /api/characters/<slug>` only when the `version` in the list is different from the stored one. The script waits 3 s between requests, so a full download takes about 12 minutes.
- Jarvis returns 403 for an unusual User-Agent or a Referer from another site. The script sends a Chrome User-Agent and `Referer: https://www.jarvis-protocol.com/`. The API sends no CORS headers, so the app cannot call it directly.
- If a request fails, the script still writes the characters that it downloaded. Run it again to continue.
- `statCard.frontSide` is the healthy side and `statCard.backSide` is the injured side. `secondStatCard` is the card of a second form (for example Emma Frost and Diamond Form). Rules text has markup such as `|!power|` (icon), `|*Stun|` (bold) and `|§stun§Stun|` (special condition).
- `exportCode` is the MCT code. The TTS mod uses the same code as `ID` in its character database.
