# Plan: scanned terrain pieces

## Request

Make the first terrain pieces from photos, and add them to the terrain pieces. Then they show on the `#terrain` page, and their colliders can be tested.

| Piece | Photos | Ruler | Scale by |
|---|---|---|---|
| Traffic Light | `_HERO_3D_TRAFFIC_LIGHT_RED` | 36 × 36 × 86 mm | base width 36 mm. The height may come out higher, which is OK. |
| Taxi Cab | `_HERO_3D_TAXI_CAB_YELLOW` | 50 mm high to the top of the roof sign. The roof is 46–47 mm. | height 50 mm |

This is the first part of a bigger request: a map designer in the Sandbox (a mat without terrain, place, drag and turn pieces, save one custom board per user in Mongo). The designer gets its own plan later.

## Facts found

- `photos-to-glb` already works for terrain with `--height` and no `--base`.
- Traffic light, `--height 87`: 30k triangles, 362 KB, 32.8 × 32.8 × 87 mm. Object Capture skipped at least 18 of 53 photos. In those photos the piece is small in the frame, and the red box and the fish mat are in the background. Scaled to 86 mm high, the base square is 32.2–32.4 mm wide instead of 36 mm. Scaled to a 36 mm base, the piece is about 95 mm high. Object Capture scales all axes by one number, so the shape itself is off. The user accepts the extra height.
- Taxi, `--height 50 --texture 1024 --tone medium --triangles 60000`: 0 of 67 photos skipped, 60k triangles, 399 KB, 80.7 × 138.6 × 50 mm. The roof ends at 45–46 mm, so the scan matches the ruler within about 2 %. The photos fill the frame and have only the dark sheet behind the car.
- `src/terrain/pieces.js` has two kinds of pieces. An OBJ piece has a GLB mesh, a separate WebP texture and a collider from its mesh (`convex: true` gives a hull). A bundle piece keeps its GLB materials, but gets colliders only from its `colliders` list. A scan GLB has its texture inside. Therefore it needs the bundle drawing and the OBJ hull collider.
- `src/terrain/catalog.js` builds the `#terrain` piece list only from the map placements. A piece that no map uses does not show.
- App units are inches, and TTS units are the same. Therefore a scan made with `--height` or `--width` has placement scale 1.

## Decisions

1. **Scan piece kind:** `scan: true` in `pieces.js`, for example `'traffic-light': { name: 'Traffic Light', scan: true, size: 1 }`. Terrain.jsx draws it with the bundle code (GLB materials, tint, footprints). Its collider is the convex hull of the visible mesh (`autoColliders: 'hull'`). There is no collider file and no `colliders` list.
2. **Size from the scan command:** `photos-to-glb --size <1-5>` marks a terrain scan. It needs `--height` or `--width`, and it does not go with `--base` or `--stand`. The script prints the `pieces.js` line with the size. `size` on the piece is the default Size of a new placement. A placement can still have its own `size`, as today. Traffic Light: Size 1. Taxi Cab: Size 2, the same as the cars of the mod (Police Car, Pink Car).
3. **Catalog:** a piece with `size` and no placement in any map goes into its size group, with scale 1 and no tint.
4. **Record:** the files go to `src/assets/terrain/<key>.glb`. Their commands go to `src/characters/custom-models.json` under the piece key, as for a character. The coder checks that the code that reads this list (`isScanFile`, the `#models` page, `migrate-characters.mjs`) still works with a key that is not a character. If one of them breaks, the terrain scans get their own top-level group in the file.
5. **Scale by width:** `photos-to-glb --width <mm>` scales the scan so that its widest side (bounding box, x or z) gets this width. A scan can come out with a wrong ratio of height to width, and the user prefers a correct footprint and a height that is a bit off. `--width` and `--height` do not go together.
6. **Scan settings:** terrain scans use the figure settings: `--texture 1024 --tone medium --triangles 60000`. The user takes the photos in the same light as for the figures.
7. **Front:** not handled now. `turn-model` with a file path works when needed. Map placements set the turn of each piece anyway.

## Steps

### Step 1: scan terrain pieces

Files:

- `scripts/photos-to-glb.mjs`: the options `--size` and `--width` (decisions 2 and 5), their checks, the printed `pieces.js` line, the usage text.
- `src/terrain/pieces.js`: `scan` and `size` in the header comment. The entries `traffic-light` and `taxi-cab`.
- `src/terrain/Terrain.jsx`: the scan kind (decision 1). `src/terrain/urls.js`: no texture and no collider file for a scan.
- `src/terrain/catalog.js`: decision 3.
- `src/assets/terrain/traffic-light.glb`, made with:
  `pnpm --filter web photos-to-glb ~/Downloads/_HERO_3D_TRAFFIC_LIGHT_RED --width 36 --size 1 --texture 1024 --tone medium --triangles 60000 --out src/assets/terrain/traffic-light.glb`
- `src/assets/terrain/taxi-cab.glb`, made with:
  `pnpm --filter web photos-to-glb ~/Downloads/_HERO_3D_TAXI_CAB_YELLOW --height 50 --size 2 --texture 1024 --tone medium --triangles 60000 --out src/assets/terrain/taxi-cab.glb`
- Run each scan in the foreground (a background run fails), 3–4 min each.
- `src/characters/custom-models.json`: decision 4. The photo folders as `<Traffic Light photos>` and `<Taxi Cab photos>`, as for the characters.
- Docs: `docs/features/custom-models.md` ("Terrain pieces": what is now built; `--size` and `--width` in the options table; the two pieces). `docs/features/maps.md` ("Pieces": the scan kind; "Terrain page": pieces without placements).

Tests:

- catalog: a piece with `size` and no placement is in its group. Each piece is in the group of its size.
- photos-to-glb argument checks, if the script has functions that can be tested. Otherwise none.
- The existing tests stay green (`noMeshCollider.test.js`, `exportMap.test.js`).

Checks: `pnpm format`, `pnpm lint` (no new warnings), `pnpm test`, `pnpm --filter web build`.

User checks in `#terrain`:

- The Traffic Light is in group 1, and the Taxi Cab is in group 2.
- Both stand on the mat, at the size of the real pieces.
- A model or a die dropped on each piece does not fall through.

## Later (designer plan)

- Full placements in the table doc, instead of indices into the map JSON.
- Edit mode in the Sandbox: "No terrain", the piece list, drag and Q/E turn, from `#terrain`.
- Save: JSON export first, Mongo `customBoards` (one per user) later.
- A custom board in the new room dialog: later.
- Remove `#terrain` when the Sandbox covers it.
