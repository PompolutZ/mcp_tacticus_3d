import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import { pieceMesh } from './files.js'

// A bundle has the mesh, its textures are in the secondary bundle. Without it the GLB has a plain DefaultMaterial
// (Barrel, Pipes, Building, NYC Bank; playtest 6). See scripts/README.md, "Other bundle details".
test('a bundle piece with a secondary bundle has a texture on every material', async () => {
  const manifest = JSON.parse(
    fs.readFileSync(new URL('../../scripts/terrain-manifest.json', import.meta.url), 'utf8'),
  )
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
  const withSecondary = Object.entries(manifest.pieces).filter(([, s]) => s.bundleSecondary)
  assert.ok(withSecondary.length >= 4, 'the manifest lists the pieces with a secondary bundle')
  for (const [key] of withSecondary) {
    const doc = await io.read(new URL(`../assets/${pieceMesh(key)}`, import.meta.url).pathname)
    const materials = doc.getRoot().listMaterials()
    assert.ok(materials.length > 0, `${key} has no material`)
    for (const material of materials)
      assert.ok(
        material.getBaseColorTexture(),
        `${key}: material ${material.getName()} has no texture`,
      )
  }
})
