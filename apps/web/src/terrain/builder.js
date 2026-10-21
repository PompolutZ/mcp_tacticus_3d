import { MATS, PIECES_BY_SIZE } from './catalog.js'
import { exportMapText, mapToState } from './exportMap.js'
import { movedPosition, restY, turnedRotation } from './placementMove.js'

// The edit actions of the map builder (docs/features/map-builder.md). Pure functions on a plain list of
// placements, [{ id, piece, size, position, rotation, scale, tint, locked }] in TTS coords relative to the mat
// center. Each returns a new list and does not touch the old one. No React, no Three scene: the page keeps
// the list in its state, the Sandbox keeps it in the table document.

export const SIZE_GROUPS = [
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

export function addPlacement(list, placement) {
  return [...list, placement]
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

export function removePlacement(list, id) {
  return list.filter((p) => p.id !== id)
}

export function clearPlacements() {
  return []
}

// A map of MAPS -> the board state { id, name, mat, matRotation, placements, ttsMap, note, skipped }
export function loadMapState(map, newId) {
  return mapToState(map, newId)
}

// The board state -> the map JSON text (terrain/exportMap.js)
export function exportBoardText(state) {
  return exportMapText(state)
}
