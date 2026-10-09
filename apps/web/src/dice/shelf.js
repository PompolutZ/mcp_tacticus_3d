// Shelf layout: sort order, the flat face-up rotation, and the slot move (design, "Roll flow"
// step 5). Plain module, no React and no src/assets/index.js import, so scripts/dice-sim.mjs
// could use it in Node too. DiceTray.jsx owns the state (which die is on the shelf, its slot);
// this module only computes numbers from what it is given.

import { Quaternion, Vector3 } from 'three'
import { FACES, SYMBOLS } from './faces.js'

const UP = new Vector3(0, 1, 0)

// How long a die takes to slide (and turn) to its shelf slot (design, "Roll flow").
export const SHELF_MOVE_TIME = 0.3

// The rotation that lays `faceNumber`'s face flat, normal up, in the die's own (local) space.
// Quaternion.setFromUnitVectors always picks the same, shortest turn for a given pair of
// vectors, so every die that shows the same face ends up in the exact same pose on the shelf —
// the "one fixed turn around up for all dice" the design asks for, so the symbols line up.
export function flatRotation(faceNumber) {
  const normal = new Vector3(...FACES[faceNumber - 1].normal)
  const q = new Quaternion().setFromUnitVectors(normal, UP)
  return { x: q.x, y: q.y, z: q.z, w: q.w }
}

// The face to show for a symbol picked without a real throw (the `change` action). Hit and Blank
// are each on two faces; this always picks the lower face number, so the result is fixed too.
export function defaultFaceForSymbol(symbol) {
  return FACES.find((face) => face.symbol === symbol).number
}

// Shelf order (design, "Roll flow"): by symbol, in SYMBOLS order, then by id, so dice with the
// same symbol keep the order they reached the shelf instead of swapping places on every re-sort.
// entries: anything with { id, symbol }.
export function sortShelfEntries(entries) {
  return [...entries].sort((a, b) => {
    const bySymbol = SYMBOLS.indexOf(a.symbol) - SYMBOLS.indexOf(b.symbol)
    return bySymbol !== 0 ? bySymbol : a.id - b.id
  })
}

const scratchPos = new Vector3()
const scratchFromQuat = new Quaternion()
const scratchToQuat = new Quaternion()

// The die's pose partway (t: 0..1) through a shelf move, straight line for the position and the
// short way around for the rotation. `from`/`to`: { position: {x,y,z}, rotation: {x,y,z,w} },
// both world space. Returns plain objects, the shape Rapier's setNextKinematicTranslation /
// setNextKinematicRotation expect.
export function shelfMovePose(from, to, t) {
  scratchPos.copy(from.position).lerp(to.position, t)
  scratchFromQuat.copy(from.rotation)
  scratchToQuat.copy(to.rotation)
  scratchFromQuat.slerp(scratchToQuat, t)
  return {
    position: { x: scratchPos.x, y: scratchPos.y, z: scratchPos.z },
    rotation: {
      x: scratchFromQuat.x,
      y: scratchFromQuat.y,
      z: scratchFromQuat.z,
      w: scratchFromQuat.w,
    },
  }
}
