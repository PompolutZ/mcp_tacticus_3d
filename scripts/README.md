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

- **Model:** the same steps as a terrain bundle: the prefab GLB with the root rotation and scale, textures as WebP of at most 1024 × 1024, then `compressMesh` with Draco. The result is like `src/assets/angel.glb`, but with a smaller texture. The colliders of the prefab are not copied, because `CharacterModel.jsx` makes a cylinder for the base.
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

# TTS crisis cards

`migrate-crisis.mjs` copies the crisis cards of the TTS mod to `src/assets/crisis/`. It converts the face of each card, one back for the Secure cards and one for the Extract cards, and the tokens that the mod puts on the mat for each card. It writes the app data to `src/crisis/cards.json` and `src/crisis/tokens.json`, and the source URLs to `scripts/crisis-manifest.json`. `src/crisis/files.js` names the files after the keys, so the JSON files have no paths.

Requirements: ImageMagick, and the images in the TTS cache. TTS downloads a card image only when the card is out of its bag, so take a card out of the "Secure Crisis Cards" or "Extract Crisis Cards" bag once before you migrate it. The token images are in the cache after "Setup Crisis" of the "Automatic Crisis Deployment" object places them.

## Usage

```bash
npm run migrate-crisis -- --list          # crisis cards of the mod and their status
npm run migrate-crisis                    # migrate every card that has its files in the TTS cache
npm run migrate-crisis -- --out /tmp/try  # trial run: nothing is written to the repo
npm run migrate-crisis -- --force         # convert files again that the manifest already lists
```

The script always migrates all cards, because all files together are only about 2 MB. A card gets an entry in `cards.json` when its face and its token images are in the TTS cache or already migrated. On 2026-09-29, the cache had the 24 cards of the 2026 Challenger pool (12 Secure, 12 Extract). The images of the other 21 cards are missing. Commit `src/assets/crisis/`, `src/crisis/cards.json`, `src/crisis/tokens.json` and `scripts/crisis-manifest.json` together.

## Output

| Output | Content |
|---|---|
| `src/assets/crisis/cards/<key>.webp` | Face of a card: the text and the setup map |
| `src/assets/crisis/cards/secure-back.webp`, `extract-back.webp` | Back of every card of the type |
| `src/assets/crisis/tokens/<token>.webp` | One side of a token |
| `src/assets/crisis/markers/damage.webp` | The damage marker (the mod's "1 Damage" token) |
| `src/crisis/cards.json` | One entry per card |
| `src/crisis/tokens.json` | One entry per token image: `name` in the mod, `shape` (`circle` or `square`), `size` (diameter in inches) |

`<key>` is the card name as a slug, without apostrophes and dots, for example `mkraan-crystal-gets-heroes-home`. The names come from the mod, with its spelling, for example "Strike Team Secures Sheild Relay!". Jarvis has the official names (see [Jarvis crisis cards](#jarvis-crisis-cards)). `<token>` is the token name in the mod as a slug, for example `extract-asset`.

Entry in `cards.json`:

```js
"jailbreak-leads-to-mass-mutant-escape": {
  "id": "20230301",        // MCT code, the same id as in Jarvis
  "name": "Jailbreak Leads to Mass Mutant Escape!",
  "type": "extract",       // secure or extract
  "threat": 20,
  "tokens": [              // one entry per token on the mat
    {
      "token": "extract-unexhausted-source",  // key in tokens.json: the side that faces up
      "back": "extract-exhausted-source",     // the other side, only when it has another image
      "position": [8, 8],                     // TTS x and z in inches, from the mat center
      "flipOnly": true
    },
    // ...
  ],
  "supply": "extract-source-civilian"          // token next to the card. Players take copies of it during the game.
}
```

Other token fields:

- `rotation`: TTS Y rotation in degrees. Without it, the mod turns the token by 180. Only the Zone tokens of X-Men Infiltrate Secret Weapons Facility have it.
- `locked: true`: players cannot move or flip the token (TTS `lock`). For example, the Secure tokens.
- `flipOnly: true`: players can flip the token, but when they drop it, it goes back to its position (TTS `flipLock`). The Source tokens.
- Neither: players can pick up the token. For example, the Extract tokens.

## TTS rules that the script depends on

These rules were found on 2026-09-29 in the scripts of the "Database" and "Automatic Crisis Deployment" objects.

- The cards are the rows of `cardDatabase` with `type = tCri`. `tags` is Secure or Extract. The script leaves out the rows with `released = false` (the 7 cards of the Infinity OP kits, for example True Power and Mojo Ball) and the test rows "Test Snapping" and "Test Zones".
- The "Setup Crisis" button finds a card in `crisisDatabase` by its name. It looks for a Secure card in the rows up to "SECURE - Drop Objectives at Every Location without Rotations", and for an Extract card in the rows after it. `crisisMap` is the name of a map in `crisisMaps`. The map has one position per token (`tokenPos`), the side that faces up (`tokenSide`), and for some maps a turn per token (`tokenRot`).
- `crisisToken` and `lock` are one value for every token, or a list with one value per token. A token without its own list item gets the first item.
- `frontName` and `backName` choose the images of the two sides. Without them, both sides show the `crisisToken` image. A token with `tokenSide` back has the `backName` image on top. Only two kinds of cards have two images: Mystic Wakandan Herbs (Herb and Vessel) and the four Source cards (Unexhausted and Exhausted Source).
- A token is a `Custom_Tile` with scale `tSize`. A tile with scale 1 is 2" wide, so `tSize` 0.5 is a 1" token. The mod script uses the same size (`objectiveSize = tSize * 2`), and Jarvis also uses 1". The mod gives a token with `tSize` 2.5 another tile type, and the script does not support that.
- For the current cards, the mod uses generic tokens such as "Secure Point of Interest" and "Extract Asset", not the named tokens of the card text (Cell, Prisoner). `tokenDatabase` has images of the named tokens, but `crisisDatabase` does not use them.
- The mod puts the `token` of a `cardDatabase` row next to the card. The script migrates it as `supply` only when it is an objective token (shape Circle or Square). The condition tokens (shape "Other") are character tokens, so the script leaves them out. These are Poison (Terrigen Canisters, Terrigen Clouds), Stun (Mayor Fisk) and Incinerate (Demons Downtown). The script migrates the "1 Damage" row on its own, as the crisis damage marker (Lockdown uses it on a Prison Block).
- The current cards have two back images, one per type. In the mod, Lockdown (Secure) has the Extract back, and Jailbreak (Extract) has the Secure back. The script uses the image that most cards of the type have, and prints a warning for the other cards.
- The token positions are the same as the setup maps of Jarvis: TTS (x, z) = (x − 18, 18 − y), where x and y are the Jarvis inches from the top-left corner (`mcp_tacticus/src/data/setups.json`). This was checked for all 27 setup maps on 2026-09-29. The script does not check it.

## What the app still needs

The app now has crisis card and token display (see `docs/feature-crisis.md`). Still missing:

1. Card text, legality and contest ranges from Jarvis. For example, the Prison Blocks of Lockdown are contested at Range 2.
2. Hold and drop for the Asset and Civilian tokens.

# Jarvis crisis cards

`fetch-jarvis-crisis-cards.mjs` downloads every crisis card from [Jarvis Protocol](https://www.jarvis-protocol.com) to `src/crisis/jarvis-crisis-cards.json`. The file is the response of `GET /api/crisis_cards`, sorted by slug.

```bash
npm run fetch-jarvis-crisis-cards
```

- One request returns all cards with their text, so the script downloads everything each time. The headers are the same as for the characters.
- The response has every printing of a card. The current printing has `replacedBy: null`. On 2026-09-29, there were 72 printings of 51 cards.
- `exportCode` is the MCT code, the `id` in `cards.json`. All 24 migrated cards have a current Jarvis card with the same id, type and threat. `migrate-crisis.mjs` prints a warning when this is not true. 6 old Extended cards have no `exportCode` and are not in the TTS mod.
- `setup` is the letter of the setup map. `challengerStatus` and `timelines` give the legality. The text has the same markup as the character text, and also `|<slug>Label|` (token with an icon), `|$A-Map A|` (link to a setup map) and `|=...=|` (a note by Jarvis, not card text).
- `mcp_tacticus` uses this data in `src/data/crisisCards.json`, after `scripts/fetch-crisis-cards.mjs` removes the markup.

# TTS dice migration

`migrate-dice.mjs` writes the dice tray assets to `src/assets/dice/`: the die mesh and texture, the tray mesh and texture, and the 6 result icons. See `docs/feature-dice-rolling.md` for the design and `docs/plan-dice-rolling.md` for the face table and the tray numbers.

```bash
npm run migrate-dice
```

Requirements: ImageMagick, and the tray mesh, tray texture, die texture and icons in the TTS cache (spawn a "Blue Dice Tray" or "Red Dice Tray" once in TTS, and roll it once so the die image downloads).

## Output

| Output | Content |
|---|---|
| `src/assets/dice/d8.glb` | The die: the app's own regular octahedron (`src/dice/faces.js`), not a TTS mesh. 24 vertices (flat faces), no texture inside, no Draco. |
| `src/assets/dice/d8.webp` | The die texture, at most 1024×1024 |
| `src/assets/dice/tray.glb`, `tray.webp` | The tray mesh and texture, converted like a terrain OBJ piece |
| `src/assets/dice/icons/<symbol>.webp` | The 6 result icons, at most 256×256 |

The die is not converted from a TTS mesh: in TTS the die is the built-in D8 shape (`Custom_Dice`, type 2) with one image, and the mod has no mesh for it. The app builds its own regular octahedron so every face has the same chance. `d8.glb` gets a UV triangle per face, so the TTS die texture fits without changes. The UV triangles are a constant in the script (`FACE_UVS`), not re-measured on every run. They were measured once from `D8_1885.obj` (the TTS D8 mesh, exported by AssetRipper from the TTS game files, not from the mod) and its UVs: for each face, fit the affine map from the face plane to UV using the flat (unbevelled) triangle of the OBJ mesh with the same normal as the ideal face, then evaluate that map at the corners of the app's own octahedron. See `docs/plan-dice-rolling.md`, Phase 1 Result, for the full method and the face table (face number, symbol, normal).

The tray and die source URLs come from the "Blue Dice Tray" object in the mod save (both trays use the same mesh, texture and die image). The tray mesh and texture URLs are its `CustomMesh.MeshURL` and `DiffuseURL`. The die image URL is read out of its Lua script text (the `image = "..."` line that `addDice()` passes to `setCustomObject`), because it is not a mod asset field. The icon URLs follow the fixed pattern `https://d37ev18qvj5a3m.cloudfront.net/tts/token/ui/D{CRIT,WILD,HIT,BLOCK,BLANK,FAIL}_UI.png` (FAIL is the skull).

# Dice sim

`dice-sim.mjs` builds the tray's Rapier world in Node, with no browser: the same gravity and time step as `Scene.jsx`, the table and its edge walls from `src/table.js`, the tray trimesh from `tray.glb` through `src/dice/tray.js`, and the throw, settle and read-face rules from `src/dice/throw.js`. It throws a die many times and prints a short report: fairness (chi-squared, see `docs/feature-dice-rolling.md`, "Fairness"), how often a die rests tilted, how often it leaves the well, how long 10 dice take to rest, and the cost per physics step with 42 dice.

```bash
npm run dice-sim                              # seed 1, 8000 single-die throws, 2000 multi-die throws
npm run dice-sim -- --seed 2                   # a different seed, to check a chi-squared failure is real
npm run dice-sim -- --quick                    # 300 throws each, for fast iteration while tuning
npm run dice-sim -- --throws 500 --multi-throws 500
```

It uses the nested Rapier build under `@react-three/rapier` (0.14.0), not the top-level one (0.12.0, wrong version for this app) — see `docs/plan-dice-rolling.md`, Phase 3 Result, for why.

See the Phase 3 Result in `docs/plan-dice-rolling.md` for the tuned values (`THROW_SPIN_MAX`, `DIE_SOLVER_ITERATIONS` in `throw.js`) and the measured numbers, and `docs/feature-dice-rolling.md`, "Measurements", for a short version.

`scripts/tts-dice-measure.lua` is the TTS side of the same measurement (see the design, "Measurements", "In TTS"). It is a TTS object script, not a Node script, and it has not been run — there is no TTS install here. Its header says how to run it. It only adds a button to the object it is pasted into, and spawns and deletes its own dice.
