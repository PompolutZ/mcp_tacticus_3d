import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh } from 'three'
import { RING_PAD, ringFootprint, yawOf } from './selectionRing.js'

// A box 4 wide (x), 1 high, 2 deep (z) in a group that stands at (10, 0.5, -3) and is turned by yaw
function piece(yaw) {
  const group = new Group()
  group.position.set(10, 0.5, -3)
  group.rotation.y = yaw
  const mesh = new Mesh(new BoxGeometry(4, 1, 2))
  group.add(mesh)
  return { group, mesh }
}

test('the ring size follows the piece, not the turn of the piece', () => {
  for (const yaw of [0, 0.7, Math.PI / 2, -2.4]) {
    const { group, mesh } = piece(yaw)
    const footprint = ringFootprint(group, [mesh])
    assert.ok(Math.abs(footprint.halfX - (2 + RING_PAD)) < 1e-6)
    assert.ok(Math.abs(footprint.halfZ - (1 + RING_PAD)) < 1e-6)
    assert.ok(Math.abs(footprint.y - 0) < 1e-6)
    assert.ok(Math.abs(yawOf(group) - yaw) < 1e-6)
  }
})

test('a mesh off the piece origin moves the ring center with it', () => {
  const { group, mesh } = piece(0.9)
  mesh.position.set(3, 0, 0)
  const footprint = ringFootprint(group, [mesh])
  assert.ok(Math.abs(footprint.x - 3) < 1e-6)
  assert.ok(Math.abs(footprint.z) < 1e-6)
})

test('no meshes: no ring', () => {
  assert.equal(ringFootprint(new Group(), []), null)
})
