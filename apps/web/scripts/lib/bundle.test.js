import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Document } from '@gltf-transform/core'
import { collidersOfVisiblePiece } from './bundle.mjs'

const colliders = [{ shape: 'box' }]

function docWithVertices(count) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const prim = doc.createPrimitive().setAttribute(
    'POSITION',
    doc
      .createAccessor()
      .setType('VEC3')
      .setArray(new Float32Array(count * 3))
      .setBuffer(buffer),
  )
  doc.createMesh().addPrimitive(prim)
  return doc
}

test('a piece without a mesh gets no colliders', () => {
  assert.deepEqual(collidersOfVisiblePiece(new Document(), colliders), [])
  assert.deepEqual(collidersOfVisiblePiece(docWithVertices(0), colliders), [])
})

test('a piece with a mesh keeps its colliders', () => {
  assert.equal(collidersOfVisiblePiece(docWithVertices(3), colliders), colliders)
})
