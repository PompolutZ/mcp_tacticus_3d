// Selected pieces: [{ kind: 'character' | 'token', id }]. At most one piece of each kind is
// selected, so a character and a token can be selected at the same time. Selecting another piece
// of a kind deselects the old one. The piece selected last is at the end: a tool snaps to it when
// it spawns, and measures against it (see Scene.jsx).

export const NO_PIECES = []

// Selected tools: { range, move, angle }, true when that tool is selected. There is at most one tool of
// each kind on the table, so all three tools can be selected at the same time.
export const NO_TOOLS = { range: false, move: false, angle: false }

function samePiece(a, b) {
  return a.kind === b.kind && a.id === b.id
}

// Selects piece. It deselects the selected piece of the same kind.
export function selectPiece(selection, piece) {
  return [...selection.filter(p => p.kind !== piece.kind), piece]
}

export function deselectPiece(selection, piece) {
  return selection.filter(p => !samePiece(p, piece))
}

// A click on a piece: selects it, or deselects it when it is already selected
export function toggleSelectPiece(selection, piece) {
  return selection.some(p => samePiece(p, piece)) ? deselectPiece(selection, piece) : selectPiece(selection, piece)
}

// Id of the selected piece of kind, or null
export function selectedId(selection, kind) {
  return selection.find(p => p.kind === kind)?.id ?? null
}
