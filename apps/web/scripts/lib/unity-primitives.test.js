import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Document } from '@gltf-transform/core'
import { getBounds } from '@gltf-transform/functions'
import { addUnityMeshes, collidersOfVisiblePiece } from './bundle.mjs'
import { readPrefab } from './unity-prefab.mjs'
import { UNITY_PRIMITIVES, unityPrimitive } from './unity-primitives.mjs'

// Size of each Unity built-in mesh at scale 1: [x, y, z]
const SIZE = {
  cube: [1, 1, 1],
  cylinder: [1, 2, 1],
  capsule: [1, 2, 1],
  sphere: [1, 1, 1],
  plane: [10, 0, 10],
  quad: [1, 1, 0],
}

test('every Unity primitive has vertices, triangles and the Unity size', () => {
  assert.deepEqual(UNITY_PRIMITIVES.toSorted(), Object.keys(SIZE).toSorted())
  for (const kind of UNITY_PRIMITIVES) {
    const g = unityPrimitive(kind)
    assert.ok(g.positions.length > 0 && g.positions.length % 3 === 0, kind)
    assert.ok(g.indices.length > 0 && g.indices.length % 3 === 0, kind)
    for (let axis = 0; axis < 3; axis++) {
      const values = g.positions.filter((_, i) => i % 3 === axis)
      const size = Math.max(...values) - Math.min(...values)
      assert.ok(Math.abs(size - SIZE[kind][axis]) < 1e-4, `${kind} axis ${axis}: ${size}`)
    }
  }
})

test('plane faces up and quad faces -Z, as in Unity', () => {
  assert.deepEqual(
    Array.from(unityPrimitive('plane').normals.slice(0, 3), (v) => Math.round(v) + 0),
    [0, 1, 0],
  )
  assert.deepEqual(
    Array.from(unityPrimitive('quad').normals.slice(0, 3), (v) => Math.round(v) + 0),
    [0, 0, -1],
  )
})

const PREFAB = (mesh, material) => `%YAML 1.1
--- !u!1 &1
GameObject:
  m_Name: Root
  m_IsActive: 1
--- !u!1 &2
GameObject:
  m_Name: Part
  m_IsActive: 1
--- !u!4 &10
Transform:
  m_GameObject: {fileID: 1}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 0, y: 0, z: 0}
  m_LocalScale: {x: 1, y: 1, z: 1}
  m_Father: {fileID: 0}
--- !u!4 &20
Transform:
  m_GameObject: {fileID: 2}
  m_LocalRotation: {x: 0, y: 0, z: 0, w: 1}
  m_LocalPosition: {x: 1, y: 2, z: 3}
  m_LocalScale: {x: 2, y: 4, z: 2}
  m_Father: {fileID: 10}
--- !u!33 &30
MeshFilter:
  m_GameObject: {fileID: 2}
  m_Mesh: {fileID: ${mesh}, guid: 0000000000000000e000000000000000, type: 0}
--- !u!23 &40
MeshRenderer:
  m_GameObject: {fileID: 2}
  m_Enabled: 1
  m_Materials:
  - {fileID: 2100000, guid: ${material}, type: 2}
  m_StaticBatchInfo:
`

test('a built-in mesh with a bundle material becomes a mesh with the prefab transform', () => {
  const { meshes } = readPrefab(PREFAB(10206, '269b3e95a78f2194987b80a4a89ca806'))
  assert.equal(meshes.length, 1)
  assert.equal(meshes[0].primitive, 'cylinder')
  assert.equal(meshes[0].name, 'Part')
  assert.equal(meshes[0].materialGuid, '269b3e95a78f2194987b80a4a89ca806')

  const doc = new Document()
  doc.createScene()
  // No project: the material is not found, which is a warning and not an error
  const warnings = addUnityMeshes(doc, meshes, null)
  assert.equal(warnings.length, 1)
  const bounds = getBounds(doc.getRoot().listScenes()[0])
  // Unity x 1 is GLB x -1 (X mirror); cylinder 1 × 2 × 1 scaled 2, 4, 2
  assert.ok(Math.abs(bounds.min[0] - (-1 - 1)) < 1e-4 && Math.abs(bounds.max[0] - (-1 + 1)) < 1e-4)
  assert.ok(Math.abs(bounds.max[1] - (2 + 4)) < 1e-4 && Math.abs(bounds.min[1] - (2 - 4)) < 1e-4)
  // The guard: a piece with a generated mesh keeps its prefab colliders (Campus Light)
  assert.deepEqual(collidersOfVisiblePiece(doc, [{ shape: 'box' }]), [{ shape: 'box' }])
})

test('a renderer with Unity default material (placeholder, as in Smoke) is not generated', () => {
  const { meshes } = readPrefab(PREFAB(10202, '0000000000000000f000000000000000'))
  assert.deepEqual(meshes, [])
})
