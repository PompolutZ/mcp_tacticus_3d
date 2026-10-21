// The start state of a table, and the terrain as App shows it. The table itself is a Yjs document (net/doc.js).
// See docs/features/rooms.md, "Storage". Plain module, the same as characters/trays.js.

import { MAPS } from '../terrain/maps/index.js'
import { START_MARKERS } from '../scoreboard/board.js'
import { DEFAULT_AFFILIATION } from '../scoreboard/affiliations.js'
import { newSetup } from '../setup/setup.js'
import { boardPieces } from '../terrain/builder.js'

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

// The two kinds of stored terrain piece (docs/features/map-builder.md, "Board in the document"):
// a map piece { id, index, locked, y? }, the place in the map data, and a custom piece
// { id, piece, position, rotation, scale, size?, tint?, locked, y? }, a full placement. A map piece that the
// builder moves or turns becomes a custom piece. The stored piece has `piece` only when it is custom.
export const isCustomPiece = (stored) => stored.piece !== undefined

// The custom piece of a stored map piece, with the same id, lock and placement (the `y` of a fallen piece
// is in the position). mapId: the map of the table. A custom piece comes back as it is. null when the map
// data has no such placement.
export function toCustomPiece(mapId, stored) {
  if (isCustomPiece(stored)) return stored
  const placement = MAPS[mapId]?.placements[stored.index]
  if (!placement) return null
  const position =
    stored.y === undefined
      ? placement.position
      : [placement.position[0], stored.y, placement.position[2]]
  return { ...placement, position: [...position], id: stored.id, locked: stored.locked }
}

// Stored piece → the piece with its placement. y: the height of the piece after what stood under it was
// deleted (droppedY); without it the piece stands at the height of the map. A map piece stores only the index
// (net/doc.js), so a fix of the map data reaches old tables. The snapshot of the document keeps an unchanged
// piece as the same object, so the cache gives it the same placed object, and Terrain.jsx does not place
// its body again.
const placed = new WeakMap()

// The terrain of the document with the placements. A map piece whose index the map data no longer has, or
// that has no map (mapId null), is left out. A piece with `y` gets it as the height of its position.
export function withPlacements(mapId, terrain) {
  const placements = MAPS[mapId]?.placements
  return terrain
    .filter((piece) => (isCustomPiece(piece) ? true : Boolean(placements?.[piece.index])))
    .map((piece) => {
      if (isCustomPiece(piece) && piece.y === undefined) return piece
      if (!placed.has(piece)) {
        const { y, ...rest } = piece
        const base = isCustomPiece(piece) ? piece : placements[piece.index]
        const position = y === undefined ? base.position : [base.position[0], y, base.position[2]]
        placed.set(piece, { ...base, ...rest, position })
      }
      return placed.get(piece)
    })
}

// The mat of a table, { name, rotation }, or null when it has none (no map, no mat). mat: game.mat,
// { name, rotation } or null. null means the mat of the map (docs/features/map-builder.md).
export function tableMat(mapId, mat) {
  if (mat) return mat
  const map = MAPS[mapId]
  return map ? { name: map.mat, rotation: map.matRotation } : null
}

// The Sandbox Map select (docs/features/map-builder.md, "Empty mat"): the writes of each choice, in one change.
// A map: its id and terrain, and the mat of the map (game.mat null). An empty mat: no map, game.mat from the
// catalog row { name, rotation }, no terrain. A board (the file import): no map, the given mat and pieces.
export function applyMap(table, mapId) {
  table.transact(() => {
    table.game.setField('mapId', mapId)
    table.game.setField('mat', null)
    table.terrain.set(mapTerrain(mapId))
  })
}

export function applyBoard(table, mat, terrain) {
  table.transact(() => {
    table.game.setField('mapId', null)
    table.game.setField('mat', { name: mat.name, rotation: mat.rotation })
    table.terrain.set(terrain)
  })
}

export function applyEmptyMat(table, mat) {
  applyBoard(table, mat, [])
}

// The value of the Map select for the table: the map id, 'custom' (no map, but pieces: a built or imported
// board), 'mat:<name>' (an empty mat) or '' (nothing).
export const CUSTOM_BOARD = 'custom'
// A room on the saved board of its host has this mapId (docs/features/map-builder.md, "Board in a new room").
// MAPS has no such key, so a reader of mapId checks it first (isPlayableMap).
export const CUSTOM_MAP_ID = CUSTOM_BOARD
// A map the app can open: a key in MAPS, or the board copied into the room
export const isPlayableMap = (mapId) => mapId === CUSTOM_MAP_ID || Boolean(MAPS[mapId])
export const MAT_PREFIX = 'mat:'
export function mapChoice(mapId, mat, pieceCount) {
  if (mapId != null) return mapId
  if (pieceCount > 0) return CUSTOM_BOARD
  return mat ? `${MAT_PREFIX}${mat.name}` : ''
}

// The map fill of a random multiplayer room (docs/features/rooms.md, "Room"): when the table has no map
// and the room has one, writes game.mapId and the terrain of that map in one change. Returns true when it
// wrote. The terrain ids are fixed, so two browsers that fill the same map merge into one set of pieces.
export function fillMap(table, mapId) {
  if (table.game.get('mapId') != null || !mapId || !MAPS[mapId]) return false
  table.transact(() => {
    table.game.setField('mapId', mapId)
    table.terrain.set(mapTerrain(mapId))
  })
  return true
}

// The stored height `y` of a piece (TTS position y, as in the map data) after it falls by `delta` inches
// from its current position `position`
export function droppedY(position, delta) {
  return Math.round((position[1] - delta) * 1e3) / 1e3
}

// Ids of the pieces of a board in a new room: fixed per index, as the ids of a map
function boardIds() {
  let n = 0
  return () => `${CUSTOM_MAP_ID}:${n++}`
}

// The state of a new table on the map mapId: the fields of fillTable in net/doc.js, without the rosters.
// mapId null: a random multiplayer room, the map comes when the guest joins. No map, no terrain.
// board: a checked board (terrain/builder.js, validateBoard) of a room on CUSTOM_MAP_ID. Its mat is game.mat and
// its placements are custom pieces, the same as applyBoard writes. Without the board, CUSTOM_MAP_ID has no terrain.
export function startTable(mapId, board = null) {
  return {
    mapId,
    // { name, rotation } or null: the mat of the map (tableMat)
    mat: board ? { name: board.mat, rotation: board.matRotation } : null,
    matTurns: 0,
    deployLine: false,
    crisis: { secure: null, extract: null },
    scoreMarkers: START_MARKERS,
    affiliations: { host: DEFAULT_AFFILIATION, guest: DEFAULT_AFFILIATION },
    // The Priority marker side and the side that got the Activated token last (game/priority.js)
    priority: null,
    lastActivated: null,
    setup: newSetup(),
    terrain: board
      ? boardPieces(board, boardIds())
      : mapId == null || mapId === CUSTOM_MAP_ID
        ? []
        : mapTerrain(mapId),
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
