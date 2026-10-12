import { isToolPiece } from './selection.js'

// Which hovered thing a key acts on. h: the hovers now, from useHovered().current().

// Delete: the first of these that is under the pointer, or null: a table token, a held token, a pile,
// a tactic card, a terrain piece, a tray card. Returns { kind, id }. Truthy ids only, as the hover refs are.
export function deleteTarget(h) {
  if (h.loose) return { kind: 'loose', id: h.loose }
  if (h.held) return { kind: 'held', id: h.held }
  if (h.pile) return { kind: 'pile', id: h.pile }
  if (h.tactic) return { kind: 'tactic', id: h.tactic }
  if (h.terrain) return { kind: 'terrain', id: h.terrain }
  if (h.trayCard) return { kind: 'trayCard', id: h.trayCard }
  return null
}

// F: the piece under the pointer, else the token or character selected last. A piece, a token (also
// one that a character holds), a character (its tray card), a tactic card, or undefined.
// ?? skips only null and undefined, so a falsy id that is not null stops the chain (as before).
export function flipTarget(h, selection) {
  return (
    h.piece ??
    (h.held && { kind: 'token', id: h.held }) ??
    (h.trayCard && { kind: 'character', id: h.trayCard }) ??
    (h.tactic && { kind: 'tactic', id: h.tactic }) ??
    selection.findLast(isToolPiece)
  )
}
