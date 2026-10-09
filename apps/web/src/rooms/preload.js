// The files to load before a table shows: the map and the models. See docs/feature-rooms.md, "Loading".
// Each file comes from the helper of the component that loads it, so Preload.jsx loads the same input
// and the component then gets the file from the cache.

import { matUrl } from '../components/Scene.jsx'
import { pieceUrls } from '../components/Terrain.jsx'
import { modelUrls } from '../components/CharacterModel.jsx'
import { characterModels } from '../characters/models.js'
import { characterByCode } from '../characters/characters.js'
import { parseRosterText } from '../rosters/cards.js'

// The characters of a roster that have a model, in the form of a character on the table (App.jsx,
// handleSpawn), so characterModels gives their models. The code is the id: only the files matter here.
function rosterCharacters(roster) {
  if (!roster) return []
  return parseRosterText(roster.code)
    .characters.map(({ code }) => characterByCode(code))
    .filter((ch) => ch?.available)
    .map((ch) => ({
      id: ch.mctCode,
      key: ch.slug,
      figure: ch.figure,
      base: ch.base,
      rotation: ch.rotation,
      transform: ch.transform,
    }))
}

// { gltf: [url], textures: [url | [url]] } for Preload.jsx. A list of URLs is one input: a standee
// loads its 2 images together, and the loader caches them under that list.
// terrain and characters: the App state at the start of the table. rosters: { blue, red }.
export function tableFiles({ mapId, terrain, characters, rosters }) {
  const gltf = new Set()
  const textures = new Map()
  const addTexture = (input) => textures.set(JSON.stringify(input), input)
  addTexture(matUrl(mapId))
  for (const key of new Set(terrain.map((p) => p.piece))) {
    const urls = pieceUrls(key)
    gltf.add(urls.mesh)
    addTexture(urls.texture)
    if (urls.collider) gltf.add(urls.collider)
  }
  const all = [...characters, ...rosterCharacters(rosters.blue), ...rosterCharacters(rosters.red)]
  for (const model of all.flatMap(characterModels)) {
    const urls = modelUrls(model)
    if (urls.gltf) gltf.add(urls.gltf)
    else addTexture(urls.standee)
  }
  return { gltf: [...gltf], textures: [...textures.values()] }
}
