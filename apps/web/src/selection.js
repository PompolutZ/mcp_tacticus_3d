// Selected pieces: [{ kind: 'character' | 'token' | 'loose' | 'terrain', id }]. At most one piece of each kind
// is selected, so a character, a token and a terrain piece can be selected at the same time.
// Selecting another piece of a kind deselects the old one. The piece selected last is at the end.
// A token is a crisis token, a loose token is a character token that lies on the table (their ids are
// separate, so they have separate kinds). A tool snaps to the character, token or loose token selected last when it spawns, and measures against it (see
// Scene.jsx). Only an unlocked terrain piece can be selected (see Terrain.jsx).

import { modelCharacterId } from './characters/models.js'

export const NO_PIECES = []

// A piece that the tools snap to and measure against, and that F flips: a character, a crisis token or a loose token.
// Terrain is not one of them.
export function isToolPiece(piece) {
  return piece.kind === 'character' || piece.kind === 'token' || piece.kind === 'loose'
}

// Whether a tool key or a tool snap selects the piece. It does not select a model of a side that this
// browser does not play (the other side in a multiplayer room), else Place could move it. A token,
// a loose token and every other piece is selected. A second model (transform) counts for its character. See
// docs/features/peer-to-peer.md.
export function toolSelects(piece, characters, playedSides) {
  if (piece.kind !== 'character') return true
  const side = characters.find((c) => c.id === modelCharacterId(piece.id))?.team
  return playedSides.includes(side)
}

// Selected tools: { range, move, angle, los }, true when that tool is selected. There is at most one tool of
// each kind on the table, so all four tools can be selected at the same time.
export const NO_TOOLS = { range: false, move: false, angle: false, los: false }

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

// The piece keys of the selected character and token, in the order of the selection (the last one is the
// tool target), for the other player (net/presence.js). Terrain is left out: only unlocked terrain can be
// selected, to edit it. A character is a model id, a token a crisis token id.
export function presenceSelection(selection) {
  return selection.filter(isToolPiece).map((p) => `${p.kind}:${p.id}`)
}

// The kinds of the selected tools, in a fixed order
export function presenceTools(tools) {
  return ['range', 'move', 'angle', 'los'].filter((kind) => tools[kind])
}
