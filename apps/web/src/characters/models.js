// The models of a spawned character on the table: one, or two for a character with a second form
// (see docs/features/character-trays.md, "Second forms"). Plain module, the same as trays.js.

import { MAT_SIZE } from '../table.js'
import {
  characterModel,
  characterStandee,
  trayCardFile,
  transformModel,
  transformStandee,
} from './files.js'

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
  return [
    first,
    {
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
    },
  ]
}

// The card file of a model (an entry of characterModels), the side of its character that faces up. A second
// model with its own card shows that card. A spare model (card null) shows the first card.
export function modelCardFile(model) {
  const { key, side } = model.character
  return trayCardFile(key, side, model.card === 2 ? 2 : 1)
}

const DEG = Math.PI / 180

// Y rotation in degrees of the character tray of each side after the Tray Spawner snaps it (the mod's
// Red seat is the app's host side, see scoreboard/board.js). A tray is 0 or 180, never between.
const TRAY_ROTATION = { host: 180, guest: 0 }

// Body turn (radians around Y) of a model that spawns on its card: it faces the mat, as in TTS. The TTS
// tray turns a model by tray rotation + 180 (+ cModelRot, see modelFigureYaw). A TTS Y rotation r is
// -r in Three.js (Terrain.jsx, toThreeTransform). Used for a standee too, which has no model part.
// See docs/features/character-trays.md, "Models face the mat".
export function modelSpawnYaw(team) {
  return -(((TRAY_ROTATION[team] + 180) % 360) * DEG) + 0
}

// Turn of the figure on its body (radians around Y), the model part of the TTS spawn turn: cModelRot
// (model.rotation) as -r, and the 180 deg import turn of a mod GLB (Terrain.jsx, IMPORT_ROTATION; the
// character GLBs come from the same AssetRipper bundles). A standee has none.
export function modelFigureYaw(model) {
  return model.figure === 'standee' ? 0 : Math.PI - model.rotation * DEG
}

// Quaternion { x, y, z, w } of a turn around Y by `yaw` radians
export function yawQuaternion(yaw) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }
}

// True when a model of ch stands on the mat. poses: model id -> { x, z, ... } (the table poses). A model
// with no pose has not moved from its tray card, so it is off the mat. The same check as the TTS
// charOnBoard (|x| and |z| at most half the mat), see docs/features/round-phases.md, decision 4. The mat turns
// only by 90 degrees and is centered at 0,0, so the check does not depend on the turn.
export function characterOnBoard(ch, poses) {
  const half = MAT_SIZE / 2
  return characterModels(ch).some((model) => {
    const pose = poses?.[model.id]
    return pose != null && Math.abs(pose.x) <= half && Math.abs(pose.z) <= half
  })
}
