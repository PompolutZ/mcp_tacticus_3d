// A new character on the table for `team`. ch: a row of CHARACTERS (characters/characters.js), or a grunt
// row. attached: MCT codes of the cards attached to it (Infinity Gems from the roster). No field when empty.
// host: the id of the host character, for a grunt (docs/features/character-trays.md, "Grunts"). No field
// for any other character.
export function newCharacter(ch, team, { attached = [], host = null } = {}) {
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
    ...(host && { host }),
  }
}

// The characters that a spawn of ch adds: the host first, then one character per grunt of ch, each with
// the id of the host (ch.grunts, rows of characters.js). Every spawn uses it: the Library, the roster
// popup and the squad reveal.
export function newCharacters(ch, team, options) {
  const host = newCharacter(ch, team, options)
  return [host, ...(ch.grunts ?? []).map((grunt) => newCharacter(grunt, team, { host: host.id }))]
}
