// The builder board state <-> the map JSON (docs/features/map-builder.md). Pure, no imports: the migrate
// script uses mapJsonText too, so there is one writer of the map files.

const round = (v, digits) => Number(v.toFixed(digits))
export const MAP_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

// The JSON file content of a map: 2 spaces, trailing newline.
export function mapJsonText(map) {
  return `${JSON.stringify(map, null, 2)}\n`
}

// A map of MAPS -> the page state. Placements get runtime ids (and `locked`, which Terrain reads).
// The values of the placements are not changed.
export function mapToState(map, newId) {
  return {
    id: map.id,
    name: map.name,
    author: map.author,
    mat: map.mat,
    matRotation: map.matRotation,
    // Kept for export, not edited on the page
    ttsMap: map.ttsMap,
    note: map.note,
    skipped: map.skipped,
    placements: map.placements.map((p) => ({ ...p, id: newId(), locked: false })),
  }
}

// The page state { id, name, author, ttsMap, note, mat, matRotation, placements, skipped } -> the map object, with the
// field order of the migrate script. Positions have 3 decimals, rotations 2. The page-only fields of a
// placement (id, rev, locked, index) are dropped.
export function exportMap(state) {
  const map = { id: state.id, name: state.name }
  if (state.author) map.author = state.author
  if (state.ttsMap != null) map.ttsMap = state.ttsMap
  if (state.note != null) map.note = state.note
  map.mat = state.mat
  map.matRotation = round(state.matRotation, 2)
  map.placements = state.placements.map(exportPlacement)
  if (state.skipped?.length) map.skipped = state.skipped
  return map
}

export function exportMapText(state) {
  return mapJsonText(exportMap(state))
}

// eslint-disable-next-line no-unused-vars
function exportPlacement({ id, rev, locked, index, ...p }) {
  return {
    ...p,
    position: p.position.map((v) => round(v, 3)),
    rotation: p.rotation.map((v) => round(v, 2)),
  }
}
