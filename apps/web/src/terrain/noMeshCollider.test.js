import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import { TERRAIN_PIECES } from './pieces.js'
import { pieceMesh } from './files.js'

// An invisible collider stopped a Throw on Oscorp Chemical (Smoke, playtest 6). A bundle piece whose GLB has
// no vertex has no collider (docs/features/maps.md, "Bundle pieces").
test('a bundle piece with an empty mesh GLB has no colliders', async () => {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
  const empty = []
  for (const [key, piece] of Object.entries(TERRAIN_PIECES)) {
    if (!piece.bundle) continue
    const doc = await io.read(new URL(`../assets/${pieceMesh(key)}`, import.meta.url).pathname)
    const vertices = doc
      .getRoot()
      .listMeshes()
      .flatMap((mesh) => mesh.listPrimitives())
      .reduce((sum, prim) => sum + (prim.getAttribute('POSITION')?.getCount() ?? 0), 0)
    if (vertices > 0) continue
    empty.push(key)
    assert.deepEqual(piece.colliders, [], `${key} (${piece.name}) has no mesh but has colliders`)
  }
  assert.ok(empty.includes('assetbundle-piece-2'), 'Smoke is an empty piece')
  // Unity built-in meshes are generated (scripts/lib/unity-primitives.mjs), so these have a mesh and colliders
  for (const key of ['campus-light-size-1', 'street-light-size-1-20'])
    assert.ok(!empty.includes(key), `${key} must not be empty`)
  assert.ok(TERRAIN_PIECES['campus-light-size-1'].colliders.length > 0, 'Campus Light is solid')
})
