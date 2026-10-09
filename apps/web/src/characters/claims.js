// Rules for the claims on models (docs/plans/implement-backend/09-moving-objects.md, decisions 5 and 8).
// Plain module: no three.js and no import.meta.env, so node --test can load it.

// A model claim lasts at least this long (s). So an action that wakes the body in the next frame (Q / E,
// Place) keeps its claim.
export const MODEL_CLAIM_MIN = 0.2

// The piece key of a model
export const modelKey = (modelId) => `character:${modelId}`

// The model id of a piece key, or null for a key of another kind
export function modelIdOfKey(key) {
  return key.startsWith('character:') ? key.slice('character:'.length) : null
}

// What to do with an own claim on a model, each frame.
// age: seconds since the last claim call. dynamic, asleep: the body. busy: a drag, lift, slide or turn of
// the model is going on. gone: the model or its body is gone.
// 'release': drop the claim. 'rest': write the rest pose, then release. 'keep': nothing yet.
export function claimCheck({ age, dynamic, asleep, busy, gone }) {
  if (gone) return 'release'
  if (age >= MODEL_CLAIM_MIN && dynamic && asleep && !busy) return 'rest'
  return 'keep'
}

// The change of the set of keys that the other player claims.
// prev, next: Sets of keys. present: the other player is still here.
// started: keys that entered. ended: keys that left while the other player is here (the claim ended).
// gone: keys that left while the other player is not here.
export function claimChanges(prev, next, present) {
  const started = [...next].filter((key) => !prev.has(key))
  const left = [...prev].filter((key) => !next.has(key))
  return { started, ended: present ? left : [], gone: present ? [] : left }
}
