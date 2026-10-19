import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectCasters, createShadowTracker } from './shadowChange.js'

function caster(x = 0) {
  const elements = Array.from({ length: 16 }, () => 0)
  elements[12] = x
  return {
    visible: true,
    castShadow: true,
    geometry: {},
    material: {},
    matrixWorld: { elements },
    children: [],
  }
}

function group(...children) {
  return { visible: true, castShadow: false, matrixWorld: { elements: [] }, children }
}

// One frame: collect from the root, then compare
function frame(tracker, root) {
  return tracker.update(collectCasters(root, []))
}

test('the first frame is a change, the same frame again is not', () => {
  const tracker = createShadowTracker()
  const root = group(caster())
  assert.equal(frame(tracker, root), true)
  assert.equal(frame(tracker, root), false)
  assert.equal(frame(tracker, root), false)
})

test('a moved caster is a change, once', () => {
  const tracker = createShadowTracker()
  const a = caster()
  const root = group(a)
  frame(tracker, root)
  // three.js changes the matrix in place
  a.matrixWorld.elements[12] = 3
  assert.equal(frame(tracker, root), true)
  assert.equal(frame(tracker, root), false)
})

test('an added and a removed caster are a change', () => {
  const tracker = createShadowTracker()
  const a = caster()
  const b = caster(1)
  const root = group(a)
  frame(tracker, root)
  root.children.push(b)
  assert.equal(frame(tracker, root), true)
  assert.equal(frame(tracker, root), false)
  root.children.pop()
  assert.equal(frame(tracker, root), true)
  assert.equal(frame(tracker, root), false)
})

test('a caster that is hidden, or has a hidden parent, is a change; shown again too', () => {
  const tracker = createShadowTracker()
  const a = caster()
  const b = caster(1)
  const parent = group(b)
  const root = group(a, parent)
  frame(tracker, root)
  a.visible = false
  assert.equal(frame(tracker, root), true)
  assert.equal(frame(tracker, root), false)
  parent.visible = false
  assert.equal(frame(tracker, root), true)
  parent.visible = true
  a.visible = true
  assert.equal(frame(tracker, root), true)
  assert.equal(frame(tracker, root), false)
})

test('a new geometry is a change', () => {
  const tracker = createShadowTracker()
  const a = caster()
  const root = group(a)
  frame(tracker, root)
  a.geometry = {}
  assert.equal(frame(tracker, root), true)
  assert.equal(frame(tracker, root), false)
})

test('meshes that cast no shadow are ignored', () => {
  const tracker = createShadowTracker()
  const a = caster()
  const token = { ...caster(5), castShadow: false }
  const root = group(a, token)
  frame(tracker, root)
  token.matrixWorld.elements[12] = 9
  root.children.pop()
  assert.equal(frame(tracker, root), false)
})
