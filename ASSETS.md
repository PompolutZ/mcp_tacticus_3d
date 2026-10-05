# MCP Assist 3D — Asset Inventory

Summary of all files available from the Tabletop Simulator MCP mod for building web tooling.

---

## Source locations on disk

| Path | Contents |
|---|---|
| `~/Library/Tabletop Simulator/Mods/Workshop/3036795456.json` | Full mod save file — all objects, scripts, URLs, positions |
| `~/Library/Tabletop Simulator/Mods/Models/` | Cached `.obj` 3D geometry files (330 total) |
| `~/Library/Tabletop Simulator/Mods/Images/` | Cached image files (3,033 total) |
| `~/Library/Tabletop Simulator/Mods/Assetbundles/` | Unity asset bundles (243 total). Terrain bundles can be converted with AssetRipper, see `scripts/README.md` |

TTS caches assets only after you load them in-game. Files not listed below exist in the mod JSON as URLs but are not on disk. The counts in this file are from 2026-09-27, and the cache has grown since then.

To migrate a map (mat and terrain), use `scripts/migrate-terrain.mjs`. `npm run migrate-terrain -- --list` shows which maps have all their files in the cache. See `scripts/README.md`.

---

## 3D Models (`.obj` files)

### Game tools — fully cached, named clearly

Movement tools (each bends in two halves — A/B — and has a separate physics collider):

| Tool | Files |
|---|---|
| Short movement | `SHORTMOVEMENTMESHA`, `SHORTMOVEMENTMESHB`, `SHORTMOVEMENTCOLLIDERA`, `SHORTMOVEMENTCOLLIDERB` |
| Medium movement | `MEDIUMMOVEMENT*` (same pattern) |
| Long movement | `LONGMOVEMENT*` (same pattern) |

Range rulers (straight rectangles, no bending, no collider variant):

| Tool | File |
|---|---|
| Range 2 | `RANGE2MESH` |
| Range 3 | `RANGE3MESH` |
| Range 4 | `RANGE4MESH` |
| Range 5 | `RANGE5MESH` |

All 12 tool files are at:
`~/Library/Tabletop Simulator/Mods/Models/httpsd37ev18qvj5a3mcloudfrontnetttstoolsXXX.obj`

### Terrain pieces — 61 cached

Files named `httpsd37ev18qvj5a3mcloudfrontnetttsterrainXXXXXXXXXXXX.obj`.
Hashes have no readable names — cross-reference against the mod JSON `CustomMesh.MeshURL` to identify which terrain piece each file belongs to.

The `Terrain Database` LuaScript has the names:
- `terrainDatabase.pieces` — one row per piece: `key`, `name`, mesh / diffuse / collider URLs, default scale.
- Map entries below it — `name`, `category`, and `placements` (piece `key`, position, rotation, scale, tint). The first placement is usually the mat tile (`tile-piece-*`).
- A map's mat is found by its image hash. The Wakanda mat `af7a7354a68e` is `tile-piece-57` (Vibranium Heist, Survival of the Fittest) and `tile-piece-167` (AMG Wakanda Blank Map).

The pieces of Vibranium Heist, Battle For Asgard and Hydra Vs Wakanda are copied to `src/assets/terrain/` with readable names. The pieces are described in `src/terrain/pieces.js`, and the placements are in `src/terrain/maps.js`. `src/terrain/files.js` has the file names.

The web files are converted from the cached originals, so they load faster. `scripts/migrate-terrain.mjs` does the conversion; `scripts/README.md` describes the settings. The Draco decoder is in `public/draco/` (copied from `three/examples/jsm/libs/draco/gltf/`).

TTS transform notes:
- TTS units are inches. The mat tile has scale 18, so it is 36" wide and centered at the origin. Its top is at y = 1.06.
- A placement position is the mesh origin.
- TTS is left-handed. TTS also mirrors X when it imports an OBJ. See `src/components/Terrain.jsx` for the conversion.

### Character and token models — ~25 cached (pastebin/gist hosted)

Files named `httppastebincomrawXXXXXX.obj` and `httpsgistgithub*.obj`.
These are the most recently spawned character minis. Exact character-to-file mapping requires reading the `Database` object's LuaScript in the mod JSON — character data and mesh URLs are embedded there.

The largest files (likely detailed character models):
- `httpsgistgithub...monochrome...gistfile1txt.obj` — 1 MB
- `httpspastebincomrawnsH48nus.obj` — 484 KB
- `httppastebincomrawAuCg1mFR.obj` — 446 KB

### What is NOT cached
- The die has no mesh of its own: it is the TTS built-in D8 shape (`Custom_Dice`, type 2) with one
  image. UGC ID `868485988860654056` is the retired "Click Roller Universal", not the die.
- Most character models (only recently-used ones are on disk)

---

## Images

### Character images — 380 cached

Named `httpsd37ev18qvj5a3mcloudfrontnetttscharactersXXXX.png/jpg`.

Two image types per character:
- `NAMEUI.png` — portrait used in the mod's UI/roster selector
- `NAMEhealthy.jpg` / `NAMEinjured.jpg` — character stat card (front and back, healthy/injured sides)

259 total characters in the mod roster (see character list below).

### Crisis card images — 48 cached

Named `httpsd37ev18qvj5a3mcloudfrontnetttscrisisXXXX.png`.
Both `face` and `back` images per crisis card. These are the 24 cards of the 2026 Challenger pool.

The crisis cards and their tokens are copied to `src/assets/crisis/`, and the data is in `src/crisis/`. `scripts/migrate-crisis.mjs` does this, and `scripts/fetch-jarvis-crisis-cards.mjs` downloads the card text from Jarvis. See `scripts/README.md`.

### Tactic card images (TTC)

Named `httpsd37ev18qvj5a3mcloudfrontnetttsttcXXXX.png/jpg`. The `cardDatabase` of the `Database` object has 389 released tactic cards, each with a face (rules text) and a back (name on full-colour art). On 2026-10-05, the cache had both images of 69 cards. The cache also has older faces without `_sat` in the name, which are lighter versions of the current faces.

The cards are copied to `src/assets/tactics/` by `scripts/migrate-tactics.mjs`; see `scripts/README.md`.

### Crisis token images

Named `httpsd37ev18qvj5a3mcloudfrontnetttstokenobjectiveXXXX.png`, 300 × 300. The cache has all objective tokens that the mod places for the current cards.

### Character token images — 310 cached (full `tokenDatabase`)

Named `httpsd37ev18qvj5a3mcloudfrontnetttstokenXXXX.png`, under `token/condition/`, `token/dice/`, `token/character/`, `token/tactic/` and `token/misc/`. 225 to 375 px. 88 of them (conditions, Activated/Dazed, personal tokens, Team Tactic tokens and "1 Power") are copied to `src/assets/tokens/` by `scripts/migrate-tokens.mjs`; see `scripts/README.md`.

### Scoring board and affiliation tokens — cached

The "Tracker" board (mesh and texture), the "Round Tracker" mesh, and all 34 affiliation token images (`token/affiliation/*_AFFILIATION_TOKEN.png`, 225 × 225) are copied to `src/assets/scoreboard/` and `src/assets/affiliations/` by `scripts/migrate-scoreboard.mjs`; see `scripts/README.md`.

### Game mat / map textures — 4 unique cached (of 188 total)

Only maps played recently are on disk (run `npm run migrate-terrain -- --list` for the current list):
- `014caf473322` — NYC construction site mat (community-made, FORGE watermark). Sinister Showdown.
- `af7a7354a68e` — Wakanda official AMG mat (Black Panther emblem, objective markers printed). Vibranium Heist.
- `702601a131f7` — Hydra Vs Wakanda.
- `9c562202bd3b` — Old Town Road.

The remaining 184 mat URLs follow the pattern:
`https://d37ev18qvj5a3m.cloudfront.net/tts/terrain/<hash>.png`
All 188 URLs are in the mod JSON and can be fetched at runtime.

### Table texture — cached

`httpssteamusercontentaakamaihdnetugc12772041129510749627418A085405EB3B5A5D94C89CA4C9FC881378A413.jpg`

The mod's `TableURL` (`Table` is `Table_Custom`). Dark wood planks, 4000×2667 (3:2, the same as the TTS table).
`src/assets/table.webp` is this image, converted with the same settings as other textures:
`magick <file> -resize '2048x2048>' -strip -quality 85 table.webp`.

### Dice texture — 1 cached

`httpssteamusercontentaakamaihdnetugc783003963486280633F22C6421...png`

A 2048×2048 sprite sheet showing 6 symbols on a red background: spiral (Wild), starburst ×2 (Hit),
shield with a starburst (Block), burst with "!" (Crit), skull (Failure, shown as "Skull" in the app).
2 of the 8 faces are blank. See `docs/feature-dice-rolling.md`, "The die", for the full face table.

### Infinity Gem images — cached

Soul gem (face + back). Other gems likely cached too.

---

## Asset Bundles

Unity binary format. A browser cannot load them, but AssetRipper (in `tools/`, not committed) converts them to GLB. `scripts/migrate-terrain.mjs` does this for terrain pieces and also reads their colliders; see `scripts/README.md`. The Angel model was converted the same way, by hand in the AssetRipper UI. `scripts/migrate-characters.mjs` converts the other character models, cards and portraits to `src/assets/characters/`; see `scripts/README.md`.

Bundles include:
- Red/Blue Tray Spawner
- Red/Blue Tool Tray
- Red/Blue Tactic Tray
- Terrain pieces (about 800 of the 3,036 pieces in the Terrain Database), for example vehicles, containers, the Daily Bugle
- Character models

---

## Mod JSON structure

File: `3036795456.json`

Key objects at top level:

| Object | Type | Note |
|---|---|---|
| `Database` | `Custom_Model` | ~597 KB LuaScript — embeds all character mesh URLs and spawn logic |
| `Terrain Database` | `Custom_Model` | ~4 MB LuaScript — embeds all terrain/mat spawn logic |
| `Character Cards` | `Custom_Model_Bag` | 262 character card objects |
| `Tactic Cards` | `Custom_Model_Bag` | 394 tactic card objects |
| `Extract Crisis Cards` | `Custom_Model_Bag` | 23 cards |
| `Secure Crisis Cards` | `Custom_Model_Bag` | 24 cards |
| `Affiliation Roster` | `Custom_Model_Bag` | 18 faction buttons |
| `One Shots` | `Custom_Model_Bag` | 466 scenario/map cards |
| `Core Set` | `Custom_Model_Bag` | Top-level container |

Total nested objects: 5,610+

---

## Full character roster (259 characters)

Abomination, Adam Warlock, Agent Venom, Amazing Spider-Man, Ancient One, Angel, Angela, Ant-Man, Apocalypse, Archangel, Arnim Zola, Avalanche, Baron Helmut Zemo, Baron Mordo, Baron Strucker, Baron Zemo, Bastion, Beast, Beta Ray Bill, Bishop, Black Bolt, Black Cat, Black Dwarf, Black Panther, Black Panther (Chosen of Bast), Black Swan, Black Widow, Black Widow (Agent of S.H.I.E.L.D.), Blade, Blue Marvel, Bob (Agent of Hydra), Bullseye, Cable, Captain America (Sam Wilson), Captain America (Steve Rogers), Captain America (First Avenger), Captain Marvel, Captain Marvel (Cosmic Avenger), Carnage, Cassandra Nova, Clea, Colossus, Corvus Glaive, Cosmic Ghost Rider, Crimson Dynamo, Crossbones, Crossbones (Merciless Merc), Crystal, Cyclops, Daredevil, Darkstar, Deadpool, Doc Ock (Sinister Scientist), Doctor Octopus, Doctor Strange, Doctor Strange (Sorcerer Supreme), Doctor Voodoo, Domino, Dormammu, Dracula, Drax the Destroyer, Ebony Maw, Echo, Electro, Elektra, Elsa Bloodstone, Emma Frost, Enchantress, Erik Killmonger (Chosen of K'Liluna), Exodus, Frankenstein's Monster, Gambit, Gamora, Ghost Rider, Ghost-Spider, Gladiator, Gorgon, Green Goblin, Groot, Gwenom, Gwenpool, Hand Ninjas, Hawkeye, Heimdall, Hela, Honey Badger, Hood, Hulk, Hulkbuster, Hydra Troopers, Iceman, Invincible Iron Man, Iron Fist, Iron Lad, Iron Man, Iron Monger, Jean Grey, Jubilee, Juggernaut, Kang The Conqueror, Karnak, Killmonger, Killmonger (Usurper), King Black Bolt, King T'Challa, Kingpin, Klaw, Kraven the Hunter, Lady Mastermind, Lady Sif, Lizard, Lockjaw, Logan (The Wolverine), Loki (God of Mischief), Loki (Prince of Lies), Luke Cage, M'Baku, M.O.D.O.K., M.O.D.O.K. Scientist Supreme, Magik, Magneto, Magneto (Mutant Masterworks), Malekith the Accursed, Man-Spider, Man-Thing, Maverick, Maximus The Mad, Medusa, Mephisto, Mister Sinister, Moon Knight, Moondragon, Ms. Marvel, Mysterio, Mystique, N'Kantu, Namor, Nebula, Nick Fury, Nick Fury & The Howling Commandos, Nightcrawler, Nimrod, Nova, Okoye, Omega Red, Omega Sentinel, Onslaught, Phoenix, Prime Sentinel, Professor X, Prowler, Proxima Midnight, Psylocke, Punisher, Pyro, Quasar, Quicksilver, Red Guardian, Red Skull, Red Skull (Master of Hydra), Red Skull (Master of The World), Rescue, Rhino, Rocket Raccoon, Rogue, Ronan the Accuser, Ronin, S.H.I.E.L.D. Agents, Sabretooth, Sabretooth (Apex Predator), Sandman, Scarlet Spider, Scarlet Witch, Sentinel MK4, Sentinel Prime MK4, Shadow King, Shadowcat, Shadowland Daredevil, Shang-Chi, She-Hulk, Shocker, Shuri, Silk, Silver Sable, Sin, Skurge, Spectacular Spider-Man, Spectrum, Spider-Ham, Spider-Man (Miles Morales), Spider-Man (Peter Parker), Spider-Man 2099, Spider-Man Noir, Spider-Woman, Squirrel Girl, Star-Lord, Steve Rogers, Storm, Sunspot, Supergiant, Taskmaster, Thanos (Chosen of Death), Thanos (The Mad Titan), The Black Widow, The Blob, The Immortal Hulk, The Incredible Hulk, The Mighty Thor, The Original Human Torch, The Warriors Three, The Wrecking Crew, Thor (Hero of Midgard), Thor (Prince of Asgard), Tigra, Toad, Ulik, Ultimate Spider-Man, Ultron, Ultron Drones, Ultron (Master of Metal), Ultron (Metal Tyrant), Ursa Major, Valkyrie, Valkyrie and Elendil, Venom, Viper, Vision, Vulture, War Machine, Warlock, Wasp, Weapon X (Logan), Werewolf By Night, Winter Soldier, Winter Soldier (Operative), Wolverine, Wong, X-23, Yondu
