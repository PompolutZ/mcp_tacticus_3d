// Selected pieces: [{ kind: 'character' | 'token' | 'terrain', id }]. At most one piece of each kind
// is selected, so a character, a token and a terrain piece can be selected at the same time.
// Selecting another piece of a kind deselects the old one. The piece selected last is at the end.
// A tool snaps to the character or token selected last when it spawns, and measures against it (see
// Scene.jsx). Only an unlocked terrain piece can be selected (see Terrain.jsx).

export const NO_PIECES = []

// A piece that the tools snap to and measure against, and that F flips: a character or a token.
// Terrain is not one of them.
export function isToolPiece(piece) {
  return piece.kind === 'character' || piece.kind === 'token'
}

// Selected tools: { range, move, angle }, true when that tool is selected. There is at most one tool of
// each kind on the table, so all three tools can be selected at the same time.
export const NO_TOOLS = { range: false, move: false, angle: false }

function samePiece(a, b) {
  return a.kind === b.kind && a.id === b.id
}

// Selects piece. It deselects the selected piece of the same kind.
export function selectPiece(selection, piece) {
  return [...selection.filter((p) => p.kind !== piece.kind), piece]
}

export function deselectPiece(selection, piece) {
  return selection.filter((p) => !samePiece(p, piece))
}

// A click on a piece: selects it, or deselects it when it is already selected
export function toggleSelectPiece(selection, piece) {
  return selection.some((p) => samePiece(p, piece))
    ? deselectPiece(selection, piece)
    : selectPiece(selection, piece)
}

// Id of the selected piece of kind, or null
export function selectedId(selection, kind) {
  return selection.find((p) => p.kind === kind)?.id ?? null
}
