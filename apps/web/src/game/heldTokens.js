// The crisis tokens each character holds: Map of character id → tokens, in the order it took them. Used
// by the spectator view (Scene.jsx, SpectatorColumns.jsx). tokens: every crisis token (App.jsx).
export function heldTokensByCharacter(tokens) {
  const held = new Map()
  for (const tok of tokens) {
    if (tok.heldBy) held.set(tok.heldBy, [...(held.get(tok.heldBy) ?? []), tok])
  }
  return held
}
