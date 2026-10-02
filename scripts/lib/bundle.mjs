// Reads the prefab of a Unity bundle that AssetRipper exported (exportBundle in assetripper.mjs).

import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { readGlb } from './convert.mjs'
import { readMaterial, readPrefab, walk } from './unity-prefab.mjs'

// outDir: the directory that exportBundle wrote.
// Returns the prefab as a glTF document with the prefab root rotation and scale applied, the prefab colliders,
// and the two export directories: primary (GLB files) and project (Unity YAML).
export async function readBundlePrefab(outDir) {
  const primary = path.join(outDir, 'primary')
  const project = path.join(outDir, 'project/ExportedProject')
  const warnings = []

  // The bundle's manifest names its prefab, for example assets/examples/prefabs/container_orange.prefab
  const bundleManifests = [...walk(path.join(primary, 'Assets/AssetBundle'))].filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(f, 'utf8')))
  const prefabs = bundleManifests.flatMap(m => Object.keys(m.m_Container)).filter(p => p.endsWith('.prefab'))
  if (prefabs.length !== 1) throw new Error(`Expected 1 prefab in the bundle, found ${prefabs.length}: ${prefabs.join(', ')}`)
  const dependencies = bundleManifests.flatMap(m => m.m_Dependencies ?? [])
  if (dependencies.length) warnings.push(`depends on other bundles (${dependencies.join(', ')}). TTS does not load them, so materials from them are missing in TTS as well.`)

  const prefab = readPrefab(fs.readFileSync(findByLowerCasePath(project, prefabs[0]), 'utf8'))
  warnings.push(...prefab.warnings)
  const doc = await readGlb(findByLowerCasePath(primary, prefabs[0].replace(/\.prefab$/, '.glb')))
  applyRoot(doc, prefab.root)
  warnings.push(...applyMaterials(doc, project))
  return { doc, colliders: prefab.colliders, primary, project, warnings }
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
    const values = new Set(found.map(m => JSON.stringify(m)))
    if (values.size !== 1) {
      warnings.push(`material ${name}: ${found.length ? `${found.length} Unity materials with different values` : 'no Unity material'} with this name. It keeps the glTF defaults (metallic 1).`)
      continue
    }
    const m = found[0]
    if (m.standard) {
      // Unity's own defaults for the Standard shader, if the material does not store a value
      material.setMetallicFactor(m.metallic ?? 0)
      // Unity smoothness and glTF roughness are both perceptual values, so roughness = 1 - smoothness
      material.setRoughnessFactor(1 - (m.glossiness ?? 0.5))
      if (m.metallicGlossMap) warnings.push(`material ${name}: has a metallic map, which is not converted. It uses _Metallic and _Glossiness.`)
      if (m.smoothnessFromAlbedo) warnings.push(`material ${name}: takes smoothness from the color texture alpha, which is not converted. It uses _Glossiness.`)
    } else {
      material.setMetallicFactor(0).setRoughnessFactor(1)
      warnings.push(`material ${name}: the shader is not Unity's Standard shader. It gets metallic 0 and roughness 1.`)
    }
    if (m.color) {
      // Unity stores the color in sRGB. glTF baseColorFactor is linear.
      const linear = new THREE.Color().setRGB(m.color[0], m.color[1], m.color[2], THREE.SRGBColorSpace)
      material.setBaseColorFactor([linear.r, linear.g, linear.b, m.color[3]])
    }
  }
  return warnings
}

// AssetRipper writes the files with the original upper and lower case; bundle manifests use lower case
function findByLowerCasePath(dir, lowerPath) {
  for (const file of walk(dir)) if (path.relative(dir, file).toLowerCase() === lowerPath) return file
  throw new Error(`No ${lowerPath} in ${dir}`)
}
