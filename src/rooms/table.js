// The table state that App starts with, from a saved room or new, and the form that a room saves.
// See docs/feature-rooms.md, "Storage". Plain module, the same as characters/trays.js.

import { MAPS } from '../terrain/maps.js'
import { START_MARKERS } from '../scoreboard/board.js'
import { DEFAULT_AFFILIATION } from '../scoreboard/affiliations.js'
import { NEW_SETUP } from '../setup/setup.js'

// Terrain pieces of a map, as tracked in App state: the placements of terrain/maps.js with an id and
// a lock. index: the place of the placement in the map data, which a room saves. Every piece starts
// locked, so a click on terrain does not select it and the Delete key does not remove it by mistake.
// L unlocks it (App.jsx, handleLockKey).
export function mapTerrain(mapId) {
  return MAPS[mapId].placements.map((placement, index) => ({ ...placement, index, id: crypto.randomUUID(), locked: true }))
}

// The terrain of a saved table: the saved pieces with the current map data. A piece that the map data
// no longer has is left out.
function savedTerrain(mapId, saved) {
  const placements = MAPS[mapId].placements
  return saved
    .filter(({ index }) => placements[index])
    .map(({ index, locked }) => ({ ...placements[index], index, id: crypto.randomUUID(), locked }))
}

// The state of App that a room saves, at the start of a table. saved: the table of a room record, or
// null for a new table.
export function startTable(mapId, saved) {
  return {
    matTurns: saved?.matTurns ?? 0,
    deployLine: saved?.deployLine ?? false,
    terrain: saved?.terrain ? savedTerrain(mapId, saved.terrain) : mapTerrain(mapId),
    characters: saved?.characters ?? [],
    crisis: saved?.crisis ?? { secure: null, extract: null },
    tokens: saved?.tokens ?? [],
    scoreMarkers: saved?.scoreMarkers ?? START_MARKERS,
    affiliations: saved?.affiliations ?? { blue: DEFAULT_AFFILIATION, red: DEFAULT_AFFILIATION },
    // The game setup (setup/setup.js). A room saved before the game setup starts with a new one. A field
    // that a saved setup does not have yet gets its start value.
    setup: { ...NEW_SETUP, ...saved?.setup },
    looseTokens: saved?.looseTokens ?? [],
    tokenPiles: saved?.tokenPiles ?? [],
    tacticCards: saved?.tacticCards ?? [],
    // Model id → pose, see poseOf. A model with a pose starts there, not on its tray (Scene.jsx).
    poses: saved?.poses ?? {},
  }
}

// The table of a room record. state: the fields of startTable, with the live terrain and poses.
export function savedTable(state) {
  return {
    ...state,
    terrain: state.terrain.map(({ index, locked }) => ({ index, locked })),
  }
}

// 0.1 mm is far below what a player sees. Rounded values stay the same while a model rests, so the
// save does not write the room again (rooms/store.js, saveRoom).
const round = v => Math.round(v * 1e4) / 1e4

// The saved pose of a body: position t { x, y, z } and rotation r { x, y, z, w }
export function poseOf(t, r) {
  return { x: round(t.x), y: round(t.y), z: round(t.z), qx: round(r.x), qy: round(r.y), qz: round(r.z), qw: round(r.w) }
}
