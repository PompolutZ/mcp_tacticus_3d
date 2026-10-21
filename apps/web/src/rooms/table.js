// The start state of a table, and the terrain as App shows it. The table itself is a Yjs document (net/doc.js).
// See docs/features/rooms.md, "Storage". Plain module, the same as characters/trays.js.

import { MAPS } from '../terrain/maps/index.js'
import { START_MARKERS } from '../scoreboard/board.js'
import { DEFAULT_AFFILIATION } from '../scoreboard/affiliations.js'
import { newSetup } from '../setup/setup.js'
import { boardPieces, newIdSuffix } from '../terrain/builder.js'
import { isCustomPiece } from '../terrain/storedPiece.js'
import { TERRAIN_PIECES } from '../terrain/pieces.js'

// The board record of the table (game.board, docs/features/map-builder.md, "Name and id"): the name field, the
// author and the id of the board in the Build panel, so a Build toggle or a reload keeps them.
// key: which board the table shows, for the Undo of the log (log/log.js, canUndo): a map id, 'custom', or a random
// id for a built or imported board. id: the fixed id of a loaded map or an imported file, else null (made from the
// name and suffix, builder.js, boardIdFromName). suffix: made once for the record.
export function newBoard(key, { name = '', author = '', id = null } = {}) {
  return { key, name, author, id: id || null, suffix: newIdSuffix() }
}

const mapBoard = (mapId) =>
  newBoard(mapId, { name: MAPS[mapId].name, author: MAPS[mapId].author, id: mapId })

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

// Stored piece → the piece with its placement. y: the height of the piece after what stood under it was
// deleted (droppedY); without it the piece stands at the height of the map. A map piece stores only the index
// (net/doc.js), so a fix of the map data reaches old tables. The snapshot of the document keeps an unchanged
// piece as the same object, so the cache gives it the same placed object, and Terrain.jsx does not place
// its body again.
const placed = new WeakMap()

// The terrain of the document with the placements. A map piece whose index the map data no longer has, or
// that has no map (mapId null), is left out. So is a custom piece whose key TERRAIN_PIECES does not have (a peer
// on another build, or bad data): every reader of the terrain looks the key up. A piece with `y` gets it as the
// height of its position.
export function withPlacements(mapId, terrain) {
  const placements = MAPS[mapId]?.placements
  return terrain
    .filter((piece) =>
      isCustomPiece(piece)
        ? Object.hasOwn(TERRAIN_PIECES, piece.piece)
        : Boolean(placements?.[piece.index]),
    )
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
    table.game.setField('board', mapBoard(mapId))
    table.terrain.set(mapTerrain(mapId))
  })
}

// The name field. A table from before the record has none: the first name writes it, on the key of the table.
export function renameBoard(table, name) {
  const board = table.game.get('board') ?? newBoard(table.game.get('mapId') ?? crypto.randomUUID())
  table.game.setField('board', { ...board, name })
}

// info: { name, author, id } of the import (a file or the account), else an unnamed board
export function applyBoard(table, mat, terrain, info) {
  table.transact(() => {
    table.game.setField('mapId', null)
    table.game.setField('mat', { name: mat.name, rotation: mat.rotation })
    table.game.setField('board', newBoard(crypto.randomUUID(), info))
    table.terrain.set(terrain)
  })
}

export function applyEmptyMat(table, mat) {
  applyBoard(table, mat, [])
}

// A room on the saved board of its host has this mapId (docs/features/map-builder.md, "Board in a new room").
// MAPS has no such key, so a reader of mapId checks it first (isPlayableMap). It is also the Map select value of
// a table with pieces and no map (mapChoice): both are a board of the user, and mapChoice passes a room's mapId
// through, so the two must be one value.
export const CUSTOM_MAP_ID = 'custom'
// A map the app can open: a key in MAPS, or the board copied into the room
export const isPlayableMap = (mapId) => mapId === CUSTOM_MAP_ID || Boolean(MAPS[mapId])
export const MAT_PREFIX = 'mat:'
// The value of the Map select for the table: the map id, CUSTOM_MAP_ID (no map, but pieces: a built or imported
// board), 'mat:<name>' (an empty mat) or '' (nothing).
export function mapChoice(mapId, mat, pieceCount) {
  if (mapId != null) return mapId
  if (pieceCount > 0) return CUSTOM_MAP_ID
  return mat ? `${MAT_PREFIX}${mat.name}` : ''
}

// The map fill of a random multiplayer room (docs/features/rooms.md, "Room"): when the table has no map
// and the room has one, writes game.mapId and the terrain of that map in one change. Returns true when it
// wrote. The terrain ids are fixed, so two browsers that fill the same map merge into one set of pieces.
export function fillMap(table, mapId) {
  if (table.game.get('mapId') != null || !mapId || !MAPS[mapId]) return false
  table.transact(() => {
    table.game.setField('mapId', mapId)
    table.game.setField('board', mapBoard(mapId))
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
    // null: no map yet (a random room, fillMap writes it) or no saved board
    board: board
      ? newBoard(CUSTOM_MAP_ID, board)
      : mapId == null || mapId === CUSTOM_MAP_ID
        ? null
        : mapBoard(mapId),
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
