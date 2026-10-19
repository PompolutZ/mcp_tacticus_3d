// Finds out if the shadow map must be drawn again. Plain JS, no three.js import, so node --test can
// run it. Lasting behavior: docs/features/rendering.md.

const MATRIX_SIZE = 16

// Adds every visible shadow caster under root to list. Visible: the object and all its parents.
// list is reused by the caller, so a frame allocates nothing.
export function collectCasters(root, list) {
  list.length = 0
  visit(root, list)
  return list
}

function visit(object, list) {
  if (!object.visible) return
  if (object.castShadow && object.geometry) list.push(object)
  const children = object.children
  for (let i = 0; i < children.length; i++) visit(children[i], list)
}

// Remembers the casters of the last frame. update(casters) returns true when the shadow map is out of
// date: a caster was added, removed (or hidden), or has another geometry, material or world matrix.
// The matrix numbers are copied: three.js changes matrixWorld in place, so a reference would always
// look the same.
export function createShadowTracker() {
  const known = new Map()
  let frame = 0
  return {
    update(casters) {
      frame++
      let changed = false
      for (let i = 0; i < casters.length; i++) {
        const object = casters[i]
        const elements = object.matrixWorld.elements
        let record = known.get(object)
        if (!record) {
          record = {
            geometry: object.geometry,
            material: object.material,
            matrix: Array.from({ length: MATRIX_SIZE }, () => 0),
            frame,
          }
          for (let k = 0; k < MATRIX_SIZE; k++) record.matrix[k] = elements[k]
          known.set(object, record)
          changed = true
          continue
        }
        record.frame = frame
        if (record.geometry !== object.geometry || record.material !== object.material) {
          record.geometry = object.geometry
          record.material = object.material
          changed = true
        }
        for (let k = 0; k < MATRIX_SIZE; k++) {
          if (record.matrix[k] !== elements[k]) {
            record.matrix[k] = elements[k]
            changed = true
          }
        }
      }
      // Casters that were not seen this frame are gone or hidden
      if (known.size !== casters.length) {
        for (const [object, record] of known) {
          if (record.frame !== frame) known.delete(object)
        }
        changed = true
      }
      return changed
    },
  }
}
