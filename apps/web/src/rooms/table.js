// The start state of a table, and the terrain as App shows it. The table itself is a Yjs document (net/doc.js).
// See docs/feature-rooms.md, "Storage". Plain module, the same as characters/trays.js.

import { MAPS } from '../terrain/maps.js'
import { START_MARKERS } from '../scoreboard/board.js'
import { DEFAULT_AFFILIATION } from '../scoreboard/affiliations.js'
import { NEW_SETUP } from '../setup/setup.js'

// Terrain pieces of a map, as tracked in App state: the placements of terrain/maps.js with an id and
// a lock. index: the place of the placement in the map data, which the document stores. Every piece starts
// locked, so a click on terrain does not select it and the Delete key does not remove it by mistake.
// L unlocks it (App.jsx, handleLockKey).
export function mapTerrain(mapId) {
  return MAPS[mapId].placements.map((placement, index) => ({
    ...placement,
    index,
    id: crypto.randomUUID(),
    locked: true,
  }))
}

// Stored piece { id, index, locked } → the piece with its placement. The document stores only the index
// (net/doc.js), so a fix of the map data reaches old tables. The snapshot of the document keeps an unchanged
// piece as the same object, so the cache gives it the same placed object, and Terrain.jsx does not place
// its body again.
const placed = new WeakMap()

// The terrain of the document with the placements of the map. A piece whose index the map data no longer
// has is left out.
export function withPlacements(mapId, terrain) {
  const placements = MAPS[mapId].placements
  return terrain
    .filter(({ index }) => placements[index])
    .map((piece) => {
      if (!placed.has(piece)) placed.set(piece, { ...placements[piece.index], ...piece })
      return placed.get(piece)
    })
}

// The state of a new table on the map mapId: the fields of fillTable in net/doc.js, without the rosters
export function startTable(mapId) {
  return {
    mapId,
    matTurns: 0,
    deployLine: false,
    crisis: { secure: null, extract: null },
    scoreMarkers: START_MARKERS,
    affiliations: { blue: DEFAULT_AFFILIATION, red: DEFAULT_AFFILIATION },
    setup: NEW_SETUP,
    terrain: mapTerrain(mapId),
    characters: [],
    tokens: [],
    tactics: [],
    looseTokens: [],
    tokenPiles: [],
  }
}

// 0.1 mm is far below what a player sees. Rounded values stay the same while a model rests, so a pose
// that did not change is not written again (net/collections.js writes only a change).
const round = (v) => Math.round(v * 1e4) / 1e4

// The stored pose of a body: position t { x, y, z } and rotation r { x, y, z, w }
export function poseOf(t, r) {
  return {
    x: round(t.x),
    y: round(t.y),
    z: round(t.z),
    qx: round(r.x),
    qy: round(r.y),
    qz: round(r.z),
    qw: round(r.w),
  }
}
