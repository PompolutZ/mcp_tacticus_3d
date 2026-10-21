import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Document } from '@gltf-transform/core'
import { normalizeAngle, turnRoots, turnSumOf, withTurn } from './turn-model.mjs'

// A model with a mesh at the base ring and a root node that is already moved and turned
function makeDoc() {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const points = [0, 0, 0, 1, 0, 0, 0, 2, 1, -0.5, 1, 0.25, 0, 0, -1]
  const position = doc
    .createAccessor()
    .setType('VEC3')
    .setArray(new Float32Array(points))
    .setBuffer(buffer)
  const mesh = doc
    .createMesh()
    .addPrimitive(doc.createPrimitive().setAttribute('POSITION', position))
  const node = doc
    .createNode()
    .setMesh(mesh)
    .setTranslation([0.3, 0, -0.2])
    .setRotation([0, Math.sin(0.4), 0, Math.cos(0.4)])
  doc.createScene().addChild(node)
  return { doc, node }
}

// Every vertex in world space
function worldPoints({ doc, node }) {
  const m = node.getWorldMatrix()
  const a = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray()
  const out = []
  for (let i = 0; i < a.length; i += 3) {
    const [x, y, z] = [a[i], a[i + 1], a[i + 2]]
    out.push([
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ])
  }
  return out
}

function assertSame(a, b) {
  assert.equal(a.length, b.length)
  a.forEach((p, i) =>
    p.forEach((v, k) => assert.ok(Math.abs(v - b[i][k]) < 1e-5, `${p} vs ${b[i]}`)),
  )
}

test('a turn by 360 gives the same positions', () => {
  const model = makeDoc()
  const before = worldPoints(model)
  turnRoots(model.doc, 360)
  assertSame(worldPoints(model), before)
})

test('a turn by 90 and then by -90 gives the same positions', () => {
  const model = makeDoc()
  const before = worldPoints(model)
  turnRoots(model.doc, 90)
  turnRoots(model.doc, -90)
  assertSame(worldPoints(model), before)
})

test('a turn moves points around the vertical line and keeps their height', () => {
  const model = makeDoc()
  const before = worldPoints(model)
  turnRoots(model.doc, 37)
  worldPoints(model).forEach(([x, y, z], i) => {
    assert.ok(Math.abs(y - before[i][1]) < 1e-5)
    assert.ok(Math.abs(Math.hypot(x, z) - Math.hypot(before[i][0], before[i][2])) < 1e-5)
  })
})

test('positive is counterclockwise seen from above', () => {
  // Seen from above with +x to the right and +z down, counterclockwise takes +x toward -z
  const model = makeDoc()
  model.node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1])
  turnRoots(model.doc, 90)
  const [x, , z] = worldPoints(model)[1]
  assert.ok(Math.abs(x) < 1e-5 && z < -0.99)
})

test('the base center stays at the origin', () => {
  const model = makeDoc()
  // A ring around the origin: its center is the origin whatever the root turn is
  model.node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1])
  const ring = [1, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, -1]
  model.doc.getRoot().listAccessors()[0].setArray(new Float32Array(ring))
  turnRoots(model.doc, 123)
  const pts = worldPoints(model)
  const center = [0, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length)
  assert.ok(center.every((v) => Math.abs(v) < 1e-5))
})

test('the sum of the turns stays in -180..180', () => {
  for (const d of [0, 90, 180, 181, -181, 270, 360, 725, -540, 1e3]) {
    const n = normalizeAngle(d)
    assert.ok(n > -180 && n <= 180, `${d} gave ${n}`)
    assert.ok(Math.abs(Math.cos((n * Math.PI) / 180) - Math.cos((d * Math.PI) / 180)) < 1e-9)
  }
  let command = 'pnpm --filter web photos-to-glb "<x>" --base small'
  for (const d of [100, 100, 100]) command = withTurn(command, 'hero', d)
  assert.equal(turnSumOf(command, 'hero'), -60)
})

test('a turn is added once, then its sum changes', () => {
  const first = 'pnpm --filter web photos-to-glb "<x>" --base small'
  const once = withTurn(first, 'hero', 90)
  assert.equal(once.split('turn-model').length, 2)
  const twice = withTurn(once, 'hero', 45)
  assert.equal(twice.split('turn-model').length, 2)
  assert.equal(turnSumOf(twice, 'hero'), 135)
})

test('a sum of 0 removes the turn part', () => {
  const first = 'pnpm --filter web photos-to-glb "<x>" --base small'
  assert.equal(withTurn(withTurn(first, 'hero', 90), 'hero', -90), first)
  assert.equal(withTurn(first, 'hero', 360), first)
})
