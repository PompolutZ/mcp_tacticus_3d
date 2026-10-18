// Reads the prefab of a Unity bundle that AssetRipper exported (exportBundle in assetripper.mjs).

import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { readGlb } from './convert.mjs'
import { unityPrimitive } from './unity-primitives.mjs'
import { findAssetByGuid, readMaterial, readPrefab, walk } from './unity-prefab.mjs'

// outDir: the directory that exportBundle wrote. hasSecondary: the export included the secondary bundle.
// Returns the prefab as a glTF document with the prefab root rotation and scale applied, the prefab colliders,
// and the two export directories: primary (GLB files) and project (Unity YAML).
export async function readBundlePrefab(outDir, { hasSecondary = false } = {}) {
  const primary = path.join(outDir, 'primary')
  const project = path.join(outDir, 'project/ExportedProject')
  const warnings = []

  // The bundle's manifest names its prefab, for example assets/examples/prefabs/container_orange.prefab
  const bundleManifests = [...walk(path.join(primary, 'Assets/AssetBundle'))]
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
  const keys = bundleManifests.flatMap((m) => Object.keys(m.m_Container))
  let prefabs = keys.filter((p) => p.endsWith('.prefab'))
  // The bundles of the TLOU pieces (ship wreck, jellyfish) name the prefab with its original model file:
  // the key is assets/assetbundles/tlou/jellyfish2.obj, and the prefab is Jellyfish2.prefab next to it.
  if (!prefabs.length)
    prefabs = [
      ...new Set(keys.filter((p) => p.endsWith('.obj')).map((p) => p.replace(/\.obj$/, '.prefab'))),
    ]
  if (!prefabs.length) throw new Error('No prefab in the bundle')
  // Bastion's bundle has a second prefab, prefabs/baston.prefab, whose figure has no mesh. TTS shows the figure,
  // so it uses the first prefab of m_Container. Not checked for other bundles.
  if (prefabs.length > 1)
    warnings.push(
      `has ${prefabs.length} prefabs, using the first: ${prefabs[0]} (others: ${prefabs.slice(1).join(', ')})`,
    )
  const dependencies = bundleManifests.flatMap((m) => m.m_Dependencies ?? [])
  if (dependencies.length && !hasSecondary)
    warnings.push(
      `depends on other bundles (${dependencies.join(', ')}). the piece has no secondary bundle (bundleSecondary), so materials from them have no texture.`,
    )

  const prefab = readPrefab(fs.readFileSync(findByLowerCasePath(project, prefabs[0]), 'utf8'))
  warnings.push(...prefab.warnings)
  const doc = await readGlb(findByLowerCasePath(primary, prefabs[0].replace(/\.prefab$/, '.glb')))
  applyRoot(doc, prefab.root)
  warnings.push(...addUnityMeshes(doc, prefab.meshes, project))
  warnings.push(...applyMaterials(doc, project))
  const colliders = collidersOfVisiblePiece(doc, prefab.colliders)
  if (colliders.length < prefab.colliders.length)
    warnings.push(`has no mesh, so its ${prefab.colliders.length} colliders are dropped`)
  return { doc, colliders, primary, project, warnings }
}

// A piece with nothing visible (smoke, fire, sea weed) has no collider: an invisible collider stops a Throw
// (playtest 6). Pure: the colliders as they are, or none when the document has no vertex.
export function collidersOfVisiblePiece(doc, colliders) {
  const vertices = doc
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, prim) => sum + (prim.getAttribute('POSITION')?.getCount() ?? 0), 0)
  return vertices > 0 ? colliders : []
}

// Parts that use a Unity built-in mesh (cube, cylinder, ...) are not in AssetRipper's GLB. They are added here as
// generated geometry (unity-primitives.mjs), each on a top-level node with its matrix, which already has the
// prefab root. The material is the MeshRenderer's: found by its guid, and named as the Unity material, so
// applyMaterials gives it the Unity values. Returns warnings.
export function addUnityMeshes(doc, meshes, project) {
  const warnings = []
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer()
  const materials = new Map()
  const materialOf = (guid) => {
    if (!materials.has(guid)) {
      const file = guid && project ? findAssetByGuid(project, guid) : null
      if (!file) {
        warnings.push(`built-in mesh material ${guid} not found, using a default material`)
        materials.set(guid, doc.createMaterial('default'))
      } else {
        const name = readMaterial(fs.readFileSync(file, 'utf8')).name
        materials.set(
          guid,
          doc
            .getRoot()
            .listMaterials()
            .find((m) => m.getName() === name) ?? doc.createMaterial(name),
        )
      }
    }
    return materials.get(guid)
  }
  const accessor = (array, type) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer)
  for (const part of meshes) {
    const g = unityPrimitive(part.primitive)
    const primitive = doc
      .createPrimitive()
      .setAttribute('POSITION', accessor(g.positions, 'VEC3'))
      .setAttribute('NORMAL', accessor(g.normals, 'VEC3'))
      .setAttribute('TEXCOORD_0', accessor(g.uvs, 'VEC2'))
      .setIndices(accessor(g.indices, 'SCALAR'))
      .setMaterial(materialOf(part.materialGuid))
    const mesh = doc.createMesh(part.name).addPrimitive(primitive)
    scene.addChild(doc.createNode(part.name).setMesh(mesh).setMatrix(part.matrix))
  }
  return warnings
}

// AssetRipper leaves out the prefab root transform. A new top node gets the root rotation and scale,
// and flatten() in compressMesh bakes it into the meshes.
function applyRoot(doc, { rotation, scale }) {
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const top = doc.createNode('prefab-root').setRotation(rotation).setScale(scale)
  for (const child of scene.listChildren()) {
    scene.removeChild(child)
    top.addChild(child)
  }
  scene.addChild(top)
}

// AssetRipper's GLB export keeps the color texture of a material, but not its values. Every material gets the
// glTF defaults: metallic 1, roughness 1 and a white color. A figure that is plastic in TTS (Standard shader,
// Metallic 0) is then full metal, and gets almost no light from the ambient and directional lights.
// So the values come from the Unity materials of the project export, matched by name. Returns warnings.
function applyMaterials(doc, project) {
  const unity = new Map()
  for (const file of walk(project)) {
    if (!file.endsWith('.mat')) continue
    const material = readMaterial(fs.readFileSync(file, 'utf8'))
    unity.set(material.name, [...(unity.get(material.name) ?? []), material])
  }
  const warnings = []
  for (const material of doc.getRoot().listMaterials()) {
    const name = material.getName()
    const found = unity.get(name) ?? []
    const values = new Set(found.map((m) => JSON.stringify(m)))
    if (values.size !== 1) {
      warnings.push(
        `material ${name}: ${found.length ? `${found.length} Unity materials with different values` : 'no Unity material'} with this name. It keeps the glTF defaults (metallic 1).`,
      )
      continue
    }
    const m = found[0]
    if (m.standard) {
      // Unity's own defaults for the Standard shader, if the material does not store a value
      material.setMetallicFactor(m.metallic ?? 0)
      // Unity smoothness and glTF roughness are both perceptual values, so roughness = 1 - smoothness
      material.setRoughnessFactor(1 - (m.glossiness ?? 0.5))
      if (m.metallicGlossMap)
        warnings.push(
          `material ${name}: has a metallic map, which is not converted. It uses _Metallic and _Glossiness.`,
        )
      if (m.smoothnessFromAlbedo)
        warnings.push(
          `material ${name}: takes smoothness from the color texture alpha, which is not converted. It uses _Glossiness.`,
        )
    } else {
      material.setMetallicFactor(0).setRoughnessFactor(1)
      warnings.push(
        `material ${name}: the shader is not Unity's Standard shader. It gets metallic 0 and roughness 1.`,
      )
    }
    if (m.color) {
      // Unity stores the color in sRGB. glTF baseColorFactor is linear.
      const linear = new THREE.Color().setRGB(
        m.color[0],
        m.color[1],
        m.color[2],
        THREE.SRGBColorSpace,
      )
      material.setBaseColorFactor([linear.r, linear.g, linear.b, m.color[3]])
    }
  }
  return warnings
}

// AssetRipper writes the files with the original upper and lower case; bundle manifests use lower case
function findByLowerCasePath(dir, lowerPath) {
  for (const file of walk(dir))
    if (path.relative(dir, file).toLowerCase() === lowerPath) return file
  throw new Error(`No ${lowerPath} in ${dir}`)
}
