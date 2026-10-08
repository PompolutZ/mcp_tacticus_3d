// The models of a spawned character on the table: one, or two for a character with a second form
// (see docs/characters-hud.md, "Second forms"). Plain module, the same as trays.js.

import { characterModel, characterStandee, transformModel, transformStandee } from './files.js'

// The first model has the character's own id, so code that knows only the character (hold and
// drop, the tray card) finds that model. The second model's id adds this suffix.
const SECOND = ':2'

// Character id of a model id
export function modelCharacterId(modelId) {
  return modelId.endsWith(SECOND) ? modelId.slice(0, -SECOND.length) : modelId
}

// Id of the second model of a character
export function secondModelId(characterId) {
  return characterId + SECOND
}

// Number of cards on the character's tray: 2 when the second form has its own card (the mod's
// twoCards, for example Ant-Man; files.js, transformCard), else 1. A second form without its own card is the Injured side of
// the first card (the mod's oneCard, for example Hulkbuster).
export function trayCards(ch) {
  return ch.transform?.card ? 2 : 1
}

// The models of character ch (an entry of `characters` in App.jsx), in spawn order:
// [{ id, character, figure: 'model' | 'standee', base, rotation, file, standeeFiles, card }].
// file: the GLB of a 'model'. standeeFiles: [front, back] images of a 'standee'. Both are relative
// to src/assets (files.js). card: the tray card the model spawns on, or null for a spare model that
// spawns on the table past the Give sources (trays.js, traySpareModelPosition).
export function characterModels(ch) {
  const first = {
    id: ch.id,
    character: ch,
    figure: ch.figure,
    base: ch.base,
    rotation: ch.rotation,
    file: characterModel(ch.key),
    standeeFiles: [characterStandee(ch.key, 'front'), characterStandee(ch.key, 'back')],
    card: 1,
  }
  const form = ch.transform
  if (!form) return [first]
  return [first, {
    id: secondModelId(ch.id),
    character: ch,
    figure: form.figure,
    base: form.base ?? ch.base,
    // TTS makes the second model as a clone of the first and swaps its bundle, so it has the first
    // model's turn. No mod script reads cTModelRot (form.rotation).
    rotation: ch.rotation,
    file: transformModel(ch.key),
    standeeFiles: [transformStandee(ch.key, 'front'), transformStandee(ch.key, 'back')],
    card: form.card ? 2 : null,
  }]
}
