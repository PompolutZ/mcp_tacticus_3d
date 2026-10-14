// The start state of a table, and the terrain as App shows it. The table itself is a Yjs document (net/doc.js).
// See docs/features/rooms.md, "Storage". Plain module, the same as characters/trays.js.

import { MAPS } from '../terrain/maps/index.js'
import { START_MARKERS } from '../scoreboard/board.js'
import { DEFAULT_AFFILIATION } from '../scoreboard/affiliations.js'
import { newSetup } from '../setup/setup.js'

// Terrain pieces of a map, as tracked in App state (the id is fixed per piece, so two browsers that fill the
// same map write the same keys and the pieces merge, docs/features/rooms.md, "Room"): the placements of terrain/maps/<id>.json with an id and
// a lock. index: the place of the placement in the map data, which the document stores. Every piece starts
// locked, so a click on terrain does not select it and the Delete key does not remove it by mistake.
// L unlocks it (pieces/useTablePieces.js, handleLockKey).
export function mapTerrain(mapId) {
  return MAPS[mapId].placements.map((placement, index) => ({
    ...placement,
    index,
    id: `${mapId}:${index}`,
    locked: true,
  }))
}

// Stored piece { id, index, locked, y? } → the piece with its placement. y: the height of the piece after
// what stood under it was deleted (droppedY); without it the piece stands at the height of the map. The document stores only the index
// (net/doc.js), so a fix of the map data reaches old tables. The snapshot of the document keeps an unchanged
// piece as the same object, so the cache gives it the same placed object, and Terrain.jsx does not place
// its body again.
const placed = new WeakMap()

// The terrain of the document with the placements of the map. A piece whose index the map data no longer
// has is left out. A piece with `y` gets it as the height of its position.
export function withPlacements(mapId, terrain) {
  const placements = MAPS[mapId].placements
  return terrain
    .filter(({ index }) => placements[index])
    .map((piece) => {
      if (!placed.has(piece)) {
        const { y, ...rest } = piece
        const placement = placements[piece.index]
        const position =
          y === undefined ? placement.position : [placement.position[0], y, placement.position[2]]
        placed.set(piece, { ...placement, ...rest, position })
      }
      return placed.get(piece)
    })
}

// The stored height `y` of a piece (TTS position y, as in the map data) after it falls by `delta` inches
// from its current position `position`
export function droppedY(position, delta) {
  return Math.round((position[1] - delta) * 1e3) / 1e3
}

// The state of a new table on the map mapId: the fields of fillTable in net/doc.js, without the rosters.
// mapId null: a random multiplayer room, the map comes when the guest joins. No map, no terrain.
export function startTable(mapId) {
  return {
    mapId,
    matTurns: 0,
    deployLine: false,
    crisis: { secure: null, extract: null },
    scoreMarkers: START_MARKERS,
    affiliations: { host: DEFAULT_AFFILIATION, guest: DEFAULT_AFFILIATION },
    // The Priority marker side and the side that got the Activated token last (game/priority.js)
    priority: null,
    lastActivated: null,
    setup: newSetup(),
    terrain: mapId == null ? [] : mapTerrain(mapId),
    characters: [],
    tokens: [],
    tactics: [],
    looseTokens: [],
    tokenPiles: [],
    tools: {},
    dice: {},
    rolls: [],
    log: [],
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
