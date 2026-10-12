// Label text of a terrain piece: the name, the game Size if it has one, and the lock state with the
// L key letter in brackets, as in TTS. Used by the label of every piece and by the hover label.
export function terrainLabel(name, size, locked) {
  const lock = locked ? '(L)ocked' : 'Un(L)ocked'
  return size ? `${name} - Size ${size} - ${lock}` : `${name} - ${lock}`
}
