import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { applyShade, shadeFor, withoutShades } from './shade.js'

test('overlap wins over selected, selected shades only without the composer', () => {
  assert.notEqual(shadeFor('overlap', true), null)
  assert.equal(shadeFor('overlap', false), shadeFor('overlap', true))
  assert.notEqual(shadeFor('selected', false), shadeFor('overlap', false))
  assert.equal(shadeFor('selected', true), null)
  for (const mode of ['hovered', 'inRange', 'otherBlue', null]) {
    assert.equal(shadeFor(mode, false), null)
  }
})

test('restore gives back the original materials, whatever the order of shades', () => {
  const lit = new MeshStandardMaterial()
  const unlit = new MeshBasicMaterial({ color: 0xffffff })
  const meshes = [new Mesh(new BoxGeometry(), lit), new Mesh(new BoxGeometry(), [unlit, lit])]
  const restore = applyShade(meshes, 0xaa1111)
  assert.notEqual(meshes[0].material, lit)
  assert.equal(meshes[0].material.emissive.getHex(), 0xaa1111)
  assert.notEqual(meshes[1].material[0].color.getHex(), 0xffffff)
  assert.equal(unlit.color.getHex(), 0xffffff)
  restore()
  assert.equal(meshes[0].material, lit)
  assert.deepEqual(meshes[1].material, [unlit, lit])
  assert.equal(lit.emissive.getHex(), 0x000000)
})

test('withoutShades draws with the original materials and puts the shades back, also after a throw', () => {
  const lit = new MeshStandardMaterial()
  const unlit = new MeshBasicMaterial()
  const mesh = new Mesh(new BoxGeometry(), lit)
  const other = new Mesh(new BoxGeometry(), [unlit, lit])
  const restore = applyShade([mesh], 0xaa1111)
  const restoreOther = applyShade([other], 0x9a6410)
  const shadedMesh = mesh.material
  const shadedOther = other.material
  const seen = withoutShades(() => [mesh.material, other.material])
  assert.deepEqual(seen, [lit, [unlit, lit]])
  assert.equal(mesh.material, shadedMesh)
  assert.equal(other.material, shadedOther)
  assert.throws(() =>
    withoutShades(() => {
      throw new Error('draw failed')
    }),
  )
  assert.equal(mesh.material, shadedMesh)
  restore()
  withoutShades(() => assert.equal(mesh.material, lit))
  assert.equal(mesh.material, lit)
  restoreOther()
  assert.deepEqual(other.material, [unlit, lit])
})
