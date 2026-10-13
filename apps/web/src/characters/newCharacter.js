// A new character on the table for `team`. ch: a row of CHARACTERS (characters/characters.js).
// attached: MCT codes of the cards attached to it (Infinity Gems from the roster). No field when empty.
export function newCharacter(ch, team, { attached = [] } = {}) {
  return {
    id: crypto.randomUUID(),
    key: ch.slug,
    figure: ch.figure,
    base: ch.base,
    rotation: ch.rotation,
    // Second form, or null: a second model, and maybe a second card on the tray (see
    // characters/models.js and docs/features/character-trays.md, "Second forms").
    transform: ch.transform,
    // Number of construct models, 0 for none (characters/models.js, "Constructs" in the feature doc)
    constructs: ch.constructs ?? 0,
    team,
    // Card side that faces up, and the simple limits players apply by hand (see
    // docs/features/character-trays.md, "Players apply the rules").
    side: 'healthy',
    damage: 0,
    power: 0,
    // Token key (tokens.json) -> count, see handleCharacterTokenGive.
    tokens: {},
    ...(attached.length > 0 && { attached }),
  }
}
