# Plan: More maps from the TTS mod

Requested on 2026-10-13. The user asked to migrate every map whose files are in the TTS cache now.

## Facts

Checked on 2026-10-13 with `migrate-terrain --list` and the Terrain Database:

- The app has 4 maps: Vibranium Heist, Battle For Asgard, Hydra Vs Wakanda, Survival of the Fittest (the same placements as Hydra Vs Wakanda).
- 13 more maps in "Strict Maps" have every file in the cache. The card face of each map is in the cache. All of them have the same card back as the app maps.

| id | Map | Pieces | Mat rotation |
|---|---|---|---|
| 287 | Dimensional Assault | 9 OBJ | 180 |
| 291 | Dark Dimension on Mars Base | 9 OBJ | 90 |
| 301 | Will He get away with it | 17 OBJ, 1 bundle | 180 |
| 299 | Savageland Unleashed | 12 OBJ, 2 bundle | 180 |
| 296 | Old Town Road | 21 OBJ, 2 bundle | 90 |
| 279 | Hells Kitchen | 9 OBJ, 6 bundle | 270 |
| 281 | Pool Party at the Mansion | 14 OBJ, 5 bundle | 270 |
| 289 | Demons Downtown | 5 OBJ, 7 bundle | 270 |
| 293 | Cosmic Downtown | 6 OBJ, 8 bundle | 270 |
| 294 | Busy City Disturbed | 10 OBJ, 12 bundle | 180 |
| 282 | Savage Land Research Site | 3 OBJ, 11 bundle | 270 |
| 308 | Sunk Ship Sheltering Sinister Secrets | 2 OBJ, 8 bundle | 0 |
| 286 | Sinister Showdown | 15 OBJ, 2 bundle, 1 token | 270 |

- `Terrain.jsx` draws only OBJ pieces: one texture file per piece, colliders from the mesh or from one collider mesh. The script already converts bundle pieces (GLB with its own materials, `bundle: true`, `colliders` list). The app does not read them yet. See "What the app still needs" in `scripts/README.md`.
- The app does not read `matRotation`. `Mat` in `Scene.jsx` draws every mat as if its rotation were 180. 9 of the 13 maps have another rotation.
- The token piece in Sinister Showdown is a `Custom_Token`. The script skips it and prints its placement as a comment.
- No feature doc describes the maps. The facts are in `scripts/README.md`, `ASSETS.md` and comments in `src/terrain/`.

## Decisions

1. **Only the 13 "Strict Maps" above.** The older and "Relaxed" copies of the same maps are left out. Maps with pieces that are not in the cache are left out.
2. **Mat rotation.** `maps.js` gets `matRotation` for every map. The mat image turns by `-(matRotation - 180)` degrees around Y (README, "What the app still needs", item 3). Terrain placements do not change, because the script prints them relative to the mat center. The user checks the turn against the map card.
3. **Bundle pieces.** `Terrain.jsx` keeps the GLB materials of a piece with `bundle: true`. They get the same footprint shader (`projectFootprints`), shadows, outline and label as an OBJ piece.
4. **Tint on a bundle piece:** multiply each material color by the tint. This is how a TTS tint acts on a model. As for OBJ pieces, compare with the map card and leave out a tint that the card does not show.
5. **Bundle colliders:** one Rapier collider per `colliders` entry, in the same group as the mesh, so that `IMPORT_ROTATION` and the placement scale apply to it (README, item 2). No colliders from the visible mesh for a bundle piece.
6. **Feature doc `docs/features/maps.md`.** It describes the maps of the app, the mat rotation, OBJ and bundle pieces, and the map list. The rules that are only about the migration stay in `scripts/README.md`.
7. **A few maps per step**, so each step has a small asset commit (as for characters).
8. **`--download` in `migrate-terrain`**, the same option as in `migrate-characters` (`docs/plans/tts-cache-download.md`, decisions 2 to 5, 7 and 8). It downloads only the files of the chosen map that are not in the cache: mat, pieces, card face and back. One file at a time, then the conversion. With this option, maps with missing pieces need no spawn in TTS. Added on 2026-10-13 after the user agreed.

## Phase 1: Mat rotation, the two OBJ-only maps

Read: this plan, `scripts/README.md` (terrain part), `src/terrain/maps.js`, `src/terrain/files.js`, `src/components/Scene.jsx` (`Mat`, mat turns), `docs/features/rooms.md`.

Work:
1. `Scene.jsx`: `Mat` turns the image by decision 2. The user turn of the mat (`matTurns`) still applies on top.
2. `maps.js`: `matRotation` on every map, also Vibranium Heist (180). Update the comments.
3. Migrate 287 and 291 (README, "How to add a map to the app", all steps). Compare tints with the card images.
4. `docs/features/maps.md` (decision 6), `Status: built`. Move the lasting facts there from `maps.js` comments where a pointer is enough. README item 3 of "What the app still needs" is done: remove it.

Checks: `pnpm format`, `pnpm lint`, the tests of `apps/web`, `pnpm --filter web build`.

## Phase 2: Bundle pieces, two small bundle maps

Read: this plan, `docs/features/maps.md`, `scripts/README.md` (terrain part, "Colliders of a bundle"), `src/components/Terrain.jsx`, `src/components/Preload.jsx`, `src/terrain/pieces.js`, `src/terrain/files.js`.

Work:
1. `Terrain.jsx`: bundle pieces by decisions 3 to 5. `pieceUrls` gives no texture for a bundle piece and the list of collider mesh URLs (`bundleCollider`). `Preload.jsx` loads the same.
2. Migrate 301 and 299. Compare tints with the card images.
3. `pieces.js` comment: the `bundle` and `colliders` fields. `docs/features/maps.md`: bundle pieces. README: remove items 1 and 2 of "What the app still needs".

Checks: as in Phase 1. In the user check, look at Debug → Colliders: the colliders must not be turned twice.

## Phase 3: Old Town Road, Hells Kitchen, Pool Party at the Mansion

Migrate 296, 279, 281 (README steps, tints). Add them to the map list in `docs/features/maps.md`. Checks as in Phase 1.

## Phase 4: Demons Downtown, Cosmic Downtown, Busy City Disturbed

Migrate 289, 293, 294. As Phase 3.

## Phase 5: Savage Land Research Site, Sunk Ship Sheltering Sinister Secrets, Sinister Showdown

Migrate 282, 308, 286. As Phase 3. The token in Sinister Showdown stays out; say so in the map list.

## Phase 6: `--download` in `migrate-terrain`

Read: this plan, `docs/plans/tts-cache-download.md`, `scripts/lib/tts.mjs` (`downloadToCache`, `cachedFile`), `scripts/lib/cli.mjs`, `scripts/migrate-terrain.mjs`, `scripts/README.md` (terrain part).

Work:
1. `scripts/lib/cli.mjs`: allow `--download` for `migrate-terrain`.
2. `migrate-terrain.mjs`: decision 8. Download before the mat, card and piece conversion. Print each file as it downloads. `--list` without `--download` works as today.
3. Usage text and `scripts/README.md`: the option. In "How to add a map to the app", step 1: `--download` is the other way to fill the cache.

Checks: `pnpm format`, `pnpm lint`, the tests of `apps/web`. One real run: Oscorp Chemical (280), 1 missing file. Commit its assets with the step, and add it to `maps.js` and `docs/features/maps.md` as in Phase 3.

## Phase 7: A Hulk Cornered

Migrate 298 with `--download` (13 missing pieces). As Phase 3.

## Result

Phase 1 (done):
- `Mat` turns the image by `-(matRotation - 180)` degrees around Y, inside a group. `matTurns` still applies on top.
- `matRotation` on all maps. Vibranium Heist 180.
- Migrated 287 (matRotation printed as -180, stored as 180, same angle) and 291 (90). No warnings. 4 new pieces for 287 and 4 for 291. The other pieces were already migrated.
- Tints: none left out. Crystals (magenta) match the pink bits on the 287 card. Teal, brown and red containers in 291 match the card.
- `docs/features/maps.md` written. README item 3 removed.
- Not checked in the browser: the mat turn of 291 against its card.

Phase 2 (done):
- `Terrain.jsx`: `ObjPiece` and `BundlePiece` share `PieceBody`. A bundle piece clones the GLB materials per placement, multiplies each color by the tint and gets `projectFootprints`. `pieceUrls` gives `texture: null` and `colliders` (collider mesh URLs) for a bundle piece. `rooms/preload.js` loads the same.
- Colliders: @react-three/rapier 1.5 scales the args of an explicit collider by its world scale, and scales its position by the parent scale a second time (it expects the scale on the RigidBody). So box, cylinder, capsule and sphere sit directly under the RigidBody with the scale already in size and position (`terrain/bundleColliders.js`, tested). Mesh entries sit in the scaled group, under `IMPORT_ROTATION` and the entry transform.
- Migrated 301 and 299. Warning: `car-size-2-14` has a secondary bundle, which the script ignores (known, as for Bastion). 301 has one bundle piece (`fire-effect-small`, one box), 299 two (`car-size-2-14`, `car-size-2-15`, one mesh collider each).
- Tints: kept the orange tint of the 4 fire effects in 301 (the card does not show them). 299 has no tints.
- Not checked in the browser: Debug → Colliders for the fire box and the two cars, the mat turn.

Phase 3 (done):
- Migrated 296 (matRotation 90), 279 and 281 (printed as -90, stored as 270, same angle).
- Tints: none left out. Cacti green, Logan red, Sabretooth black (statues are too small to see on the card), Gunners Den grey 0.5, Fountain 0.8: the card does not contradict them.
- Warnings, 279: `barrel-size-1` and `building-size-5-4` depend on other bundles (materials missing in TTS as well), have a `DefaultMaterial` with no Unity material (glTF defaults, metallic 1) and a secondary bundle, which the script ignores. 281: `tree-size-3` and `bush-size-1` use a non-Standard shader (metallic 0, roughness 1). 296: none.
- Colliders: mesh entries with a non-identity transform: `gunners-den-size-3` (3 meshes, turned, entry scale 14.3, placement 0.25) and `fountain-size-3` (3 meshes, turned 90 degrees around X, placement 1.65). Primitives on turned shapes with a non-uniform placement scale: none (`convenience-store-size-3` has scale [9.056, 8.05, 7.044], but its boxes are not turned, so exact).
- Fix: collider meshes no longer use `MeshCollider` in the scaled group. In the lib, the child position gets the parent scale a second time, and the args get the world scale of the group twice. `ColliderMesh` in `Terrain.jsx` now bakes the GLB node transform and `transformVertices` (`bundleColliders.js`, tested) into the vertices and puts a `TrimeshCollider` or `ConvexHullCollider` directly under the RigidBody. The OBJ piece collider meshes (`collider: true`) use the same path, so they were changed too (they had the scaled group before, for example Asgard Ruins at scale 4.2).
- Not checked in the browser: Debug → Colliders for Gunners Den, Fountain, the OBJ collider pieces (Asgard Ruins, Dimetrodon, Bus Stop, Forklift, Blackbird, Motorcycle), the mat turn of the 3 maps.

Phase 4 (done):
- Migrated 289 (printed -90, stored 270), 293 (printed -90, stored 270) and 294 (printed -180, stored 180).
- Tints: none left out. The cards show only the bare mat, with no pieces, so they cannot contradict a tint. Kept: grey 0.8 and 0.59 on buildings, vehicles and bins, 0.04 on the campus lights (294), 0.38 on the traffic light and 0.59 on the bus stop (289), 0.87/0.83/0.86 on the 8 bundle pieces of 293.
- Warnings, 289, 293: none. 294: `dumpster-size-2` has a metallic map, which is not converted. `tree-size-2-7` uses a non-Standard shader (metallic 0, roughness 1). `total-access-games-size-5` has 75 colliders whose mesh has 0 vertices (AssetRipper exports them as JSON, not GLB), so they are left out. There is nothing to collide with, so this is correct.
- `total-access-games-size-5` has 395 mesh colliders, each its own GLB (1.6 MB in all). It is the largest piece so far.
- Colliders: no new case. Mesh entries with a non-uniform placement scale (`total-access-games-size-5`, `dumpster-size-2`, `carpet-barn-size-4`) are exact since Phase 3. Primitives on turned shapes with a non-uniform placement scale: none (the boxes of `convenience-store-size-3` are not turned). No code change.
- Not checked in the browser: Debug → Colliders for Total Access Games (395 meshes, load time), Dumpster, Carpet Barn, the Dumpling Restaurant (scale 0.04), the mat turn of the 3 maps.

Phases 5 to 7: not started.
