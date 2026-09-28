// Reads the prefab of a Unity bundle that AssetRipper exported (exportBundle in assetripper.mjs).

import fs from 'node:fs'
import path from 'node:path'
import { readGlb } from './convert.mjs'
import { readPrefab, walk } from './unity-prefab.mjs'

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

// AssetRipper writes the files with the original upper and lower case; bundle manifests use lower case
function findByLowerCasePath(dir, lowerPath) {
  for (const file of walk(dir)) if (path.relative(dir, file).toLowerCase() === lowerPath) return file
  throw new Error(`No ${lowerPath} in ${dir}`)
}
