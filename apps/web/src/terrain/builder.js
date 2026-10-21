import { MATS, PIECES_BY_SIZE } from './catalog.js'
import { TERRAIN_PIECES } from './pieces.js'
import { toCustomPiece } from '../rooms/table.js'
import { exportMap, exportMapText } from './exportMap.js'
import { movedPosition, restY, turnedRotation } from './placementMove.js'

// The edit actions of the map builder (docs/features/map-builder.md). Pure functions on a plain list of
// placements, [{ id, piece, size, position, rotation, scale, tint, locked }] in TTS coords relative to the mat
// center. Each returns a new list and does not touch the old one. No React, no Three scene: the page keeps
// the list in its state, the Sandbox keeps it in the table document.

const SIZE_GROUPS = [
  { key: '1', title: 'Size 1' },
  { key: '2', title: 'Size 2' },
  { key: '3', title: 'Size 3' },
  { key: '4', title: 'Size 4' },
  { key: '5', title: 'Size 5' },
  { key: 'none', title: 'No size' },
]

export const SORTED_MATS = [...MATS].sort((a, b) => a.name.localeCompare(b.name))

// The piece list by size for a name filter (case-insensitive, trimmed). Groups with no piece are left out.
export function pieceGroups(filter) {
  const needle = filter.trim().toLowerCase()
  return SIZE_GROUPS.map((g) => ({
    ...g,
    pieces: PIECES_BY_SIZE[g.key].filter((p) => p.name.toLowerCase().includes(needle)),
  })).filter((g) => g.pieces.length > 0)
}

// A new placement of catalog piece `piece` ({ key, size, scale, tint }) at the mat center, turned 0°, with the
// bottom of its mesh on the mat top. box: the mesh Box3 (terrain/pieceBox.js).
export function newPlacement(piece, id, box) {
  const placement = {
    id,
    piece: piece.key,
    size: piece.size,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: piece.scale,
    tint: piece.tint,
    locked: false,
  }
  placement.position[1] = restY(box, placement)
  return placement
}

function change(list, id, fn) {
  return list.map((p) => (p.id === id ? { ...fn(p), rev: (p.rev ?? 0) + 1 } : p))
}

// Moves by (dx, dz) in Three coords on the mat. The height stays. rev changes so the piece mounts again.
export function movePlacement(list, id, dx, dz) {
  return change(list, id, (p) => ({ ...p, position: movedPosition(p.position, dx, dz) }))
}

// Q (dir 1) or E (dir -1): a 15° turn around Y
export function turnPlacement(list, id, dir) {
  return change(list, id, (p) => ({ ...p, rotation: turnedRotation(p.rotation, dir) }))
}

// The board state -> the map object (the JSON of the export file, also what is saved to the account)
export function exportBoard(state) {
  return exportMap(state)
}

// The board state -> the map JSON text (terrain/exportMap.js)
export function exportBoardText(state) {
  return exportMapText(state)
}

// --- The Sandbox: the board in the table document (docs/features/map-builder.md, "Build mode") ---

// A placement as the document stores a custom piece: only the stored fields, no undefined. A piece added in
// Build mode is locked: Build mode shows every piece unlocked (unlockedView), and the lock is back after it.
export function storedCustom(placement, locked = true) {
  const { id, piece, position, rotation, scale, size, tint, rev } = placement
  const out = { id, piece, position, rotation, scale, locked }
  if (size !== undefined) out.size = size
  if (tint !== undefined) out.tint = tint
  if (rev !== undefined) out.rev = rev
  return out
}

// The stored list after fn(list, id) changed the piece `id` (move, turn: the functions above). A map piece
// becomes a custom piece first (toCustomPiece), and so does a custom piece with a fallen height `y`, which
// goes into its position. The id stays, so are the lock and the rest of the list. fn gets a one-piece list.
export function editStoredPiece(mapId, stored, id, fn) {
  return stored.map((piece) => {
    if (piece.id !== id) return piece
    const custom = toCustomPiece(mapId, piece)
    if (!custom) return piece
    const { y, ...rest } = custom
    const base =
      y === undefined ? rest : { ...rest, position: [rest.position[0], y, rest.position[2]] }
    return storedCustom(fn([base], id)[0], base.locked)
  })
}

// Build mode shows every piece unlocked, with no write to the document. A locked piece gets an unlocked copy;
// the copy is kept per piece object, so an unchanged piece keeps the same placed object (Terrain does not
// place its body again, rooms/table.js, withPlacements).
const unlocked = new WeakMap()
export function unlockedView(placements) {
  return placements.map((p) => {
    if (!p.locked) return p
    if (!unlocked.has(p)) unlocked.set(p, { ...p, locked: false })
    return unlocked.get(p)
  })
}

const MAX_PLACEMENTS = 300
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum)

// The check of an imported map file (the map JSON format, docs/features/maps.md). data: the parsed JSON.
// Returns { board: { id, name, mat, matRotation, placements } } with the placements cleaned to the stored fields
// (no id yet), or { error } in words for the player. Pure, so a bad file is refused before anything changes.
export function validateBoard(data) {
  const fail = (error) => ({ error })
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return fail('The file is not a map.')
  const mat = MATS.find((m) => m.name === data.mat)
  if (typeof data.mat !== 'string') return fail('The file has no mat.')
  if (!mat) return fail(`Unknown mat: ${data.mat}.`)
  if (data.matRotation !== undefined && !isNum(data.matRotation))
    return fail('The mat rotation is not a number.')
  if (!Array.isArray(data.placements)) return fail('The file has no list of placements.')
  if (data.placements.length > MAX_PLACEMENTS) return fail(`More than ${MAX_PLACEMENTS} pieces.`)
  const placements = []
  for (const [i, p] of data.placements.entries()) {
    const at = `Piece ${i + 1}`
    if (!p || typeof p !== 'object') return fail(`${at} is not an object.`)
    if (typeof p.piece !== 'string' || !Object.hasOwn(TERRAIN_PIECES, p.piece))
      return fail(`${at}: unknown piece ${JSON.stringify(p.piece)}.`)
    if (!isVec3(p.position)) return fail(`${at}: bad position.`)
    if (!isVec3(p.rotation)) return fail(`${at}: bad rotation.`)
    if (!isNum(p.scale) && !isVec3(p.scale)) return fail(`${at}: bad scale.`)
    if (p.size !== undefined && ![1, 2, 3, 4, 5].includes(p.size)) return fail(`${at}: bad size.`)
    if (p.tint !== undefined && !isVec3(p.tint)) return fail(`${at}: bad tint.`)
    const out = { piece: p.piece, position: p.position, rotation: p.rotation, scale: p.scale }
    if (p.size !== undefined) out.size = p.size
    if (p.tint !== undefined) out.tint = p.tint
    placements.push(out)
  }
  return {
    board: {
      id: typeof data.id === 'string' ? data.id : '',
      name: typeof data.name === 'string' ? data.name : '',
      mat: mat.name,
      matRotation: data.matRotation ?? mat.rotation,
      placements,
    },
  }
}

// The stored custom pieces of a checked board, each with a new id (newId()), locked
export function boardPieces(board, newId) {
  return board.placements.map((p) => storedCustom({ ...p, id: newId() }))
}
