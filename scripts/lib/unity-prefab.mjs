// Reads a prefab from AssetRipper's Unity project export (Unity YAML): the root transform and the colliders.
// The GLB export of the same prefab has neither: it drops the root transform and all collider components.
// Also reads materials (readMaterial), because the GLB export drops their values too.
//
// Results are in GLB space. AssetRipper converts Unity (left-handed) to glTF (right-handed) by mirroring X,
// so this module mirrors X too: position (-x, y, z), rotation (x, -y, -z, w). Checked on the container
// bundle: Unity localPosition x -0.05 is GLB translation x 0.05.

import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'

const GAME_OBJECT = 1
const TRANSFORM = 4
const MATERIAL = 21
const MESH_COLLIDER = 64
const BOX_COLLIDER = 65
const SPHERE_COLLIDER = 135
const CAPSULE_COLLIDER = 136

// Unity's built-in meshes, by fileID in its default resources. Built-in cube and cylinder are common collider shapes.
const BUILTIN_GUID = '0000000000000000e000000000000000'
const BUILTIN_MESH = { 10202: 'cube', 10206: 'cylinder', 10207: 'sphere', 10208: 'capsule', 10209: 'plane', 10210: 'quad' }

// Mirroring X converts a Unity matrix to GLB space: S * M * S
const MIRROR_X = new THREE.Matrix4().makeScale(-1, 1, 1)

// root: { rotation: [x, y, z, w], scale: [x, y, z] } of the prefab root, in GLB space.
//   TTS keeps the root rotation and scale and ignores the root position. The placement heights in the
//   Terrain Database match this (concrete barrier: expected y 1.60, stored y 1.599).
// colliders: see readCollider. Position, quaternion and scale are relative to the root, with the root rotation
//   and scale applied, so they fit the GLB after root is applied to it.
// warnings: collider data that the script cannot convert
export function readPrefab(yamlText) {
  const docs = parseDocuments(yamlText)
  const transforms = [...docs.values()].filter(d => d.classId === TRANSFORM)
  const transformByObject = new Map(transforms.map(t => [ref(t.text, 'm_GameObject').fileID, t]))
  const roots = transforms.filter(t => ref(t.text, 'm_Father').fileID === '0')
  if (roots.length !== 1) throw new Error(`Prefab has ${roots.length} root transforms, expected 1`)
  const root = roots[0]

  const unityRoot = new THREE.Matrix4().compose(new THREE.Vector3(), quat(root.text, 'm_LocalRotation'), vec(root.text, 'm_LocalScale'))
  const rootGlb = toGlb(unityRoot)
  const rootRotation = new THREE.Quaternion()
  const rootScale = new THREE.Vector3()
  rootGlb.decompose(new THREE.Vector3(), rootRotation, rootScale)

  // Matrix from a transform's local space to root space (root position ignored, as TTS does)
  function toRoot(t) {
    if (t === root) return unityRoot.clone()
    const local = new THREE.Matrix4().compose(vec(t.text, 'm_LocalPosition'), quat(t.text, 'm_LocalRotation'), vec(t.text, 'm_LocalScale'))
    return toRoot(docs.get(ref(t.text, 'm_Father').fileID)).multiply(local)
  }
  // A collider works only if its object and all parents are active
  function active(t) {
    const go = docs.get(ref(t.text, 'm_GameObject').fileID)
    if (go && num(go.text, 'm_IsActive') === 0) return false
    return t === root || active(docs.get(ref(t.text, 'm_Father').fileID))
  }

  const colliders = []
  const warnings = []
  for (const doc of docs.values()) {
    if (![MESH_COLLIDER, BOX_COLLIDER, SPHERE_COLLIDER, CAPSULE_COLLIDER].includes(doc.classId)) continue
    if (num(doc.text, 'm_Enabled') === 0 || num(doc.text, 'm_IsTrigger') === 1) continue
    const t = transformByObject.get(ref(doc.text, 'm_GameObject').fileID)
    if (!t) {
      warnings.push('collider on an object without a transform was skipped')
      continue
    }
    if (!active(t)) continue
    const collider = readCollider(doc, toGlb(toRoot(t)))
    if (typeof collider === 'string') warnings.push(collider)
    else colliders.push(collider)
  }
  return { root: { rotation: rootRotation.toArray(), scale: rootScale.toArray() }, colliders, warnings }
}

// One collider in root space:
//   { shape: 'box', position, quaternion, halfExtents }
//   { shape: 'sphere', position, radius }
//   { shape: 'cylinder' | 'capsule', position, quaternion, radius, halfHeight }  axis is local Y;
//      for a capsule, halfHeight is the half length of the straight part, without the round ends
//   { shape: 'mesh', meshGuid, convex, position, quaternion, scale }  a custom mesh; see findAssetByGuid
// Returns a warning string for a collider that cannot be converted.
function readCollider(doc, matrix) {
  const { classId, text } = doc
  // Collider center is an offset in the object's local space
  const center = classId === MESH_COLLIDER ? new THREE.Vector3() : vec(text, 'm_Center')
  const m = matrix.clone().multiply(new THREE.Matrix4().makeTranslation(-center.x, center.y, center.z))
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  m.decompose(position, quaternion, scale)
  const s = [Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z)]
  const pose = { position: position.toArray(), quaternion: quaternion.toArray() }

  if (classId === BOX_COLLIDER) {
    const size = vec(text, 'm_Size')
    return { shape: 'box', ...pose, halfExtents: [size.x * s[0] / 2, size.y * s[1] / 2, size.z * s[2] / 2] }
  }
  if (classId === SPHERE_COLLIDER) {
    return { shape: 'sphere', position: pose.position, radius: num(text, 'm_Radius') * Math.max(...s) }
  }
  if (classId === CAPSULE_COLLIDER) {
    // m_Direction: 0 = X, 1 = Y, 2 = Z. Turn the capsule so its axis is local Y.
    const axis = num(text, 'm_Direction')
    const radius = num(text, 'm_Radius') * Math.max(...s.filter((_, i) => i !== axis))
    const halfHeight = Math.max(0, num(text, 'm_Height') * s[axis] / 2 - radius)
    const toAxis = new THREE.Quaternion().setFromEuler(new THREE.Euler(axis === 2 ? Math.PI / 2 : 0, 0, axis === 0 ? -Math.PI / 2 : 0))
    return { shape: 'capsule', ...pose, quaternion: quaternion.clone().multiply(toAxis).toArray(), radius, halfHeight }
  }

  const mesh = ref(text, 'm_Mesh')
  const convex = num(text, 'm_Convex') === 1
  if (mesh.guid === BUILTIN_GUID) {
    // Built-in meshes: cube 1 × 1 × 1, cylinder and capsule radius 0.5 and height 2 along Y, sphere radius 0.5
    const radial = Math.max(s[0], s[2]) / 2
    switch (BUILTIN_MESH[mesh.fileID]) {
      case 'cube': return { shape: 'box', ...pose, halfExtents: s.map(v => v / 2) }
      case 'cylinder': return { shape: 'cylinder', ...pose, radius: radial, halfHeight: s[1] }
      case 'capsule': return { shape: 'capsule', ...pose, radius: radial, halfHeight: Math.max(0, s[1] - radial) }
      case 'sphere': return { shape: 'sphere', position: pose.position, radius: Math.max(...s) / 2 }
      default: return `MeshCollider with built-in mesh ${mesh.fileID} (${BUILTIN_MESH[mesh.fileID] ?? 'unknown'}) was skipped`
    }
  }
  if (!mesh.guid) return 'MeshCollider without a mesh was skipped'
  return { shape: 'mesh', meshGuid: mesh.guid, convex, ...pose, scale: s }
}

// Unity's built-in Standard shader (metallic setup), by fileID in its default resources
const BUILTIN_SHADER_GUID = '0000000000000000f000000000000000'
const STANDARD_SHADER = '46'

// Reads a material (.mat, Unity YAML) from AssetRipper's Unity project export.
// Returns { name, standard, metallic, glossiness, color: [r, g, b, a], metallicGlossMap, smoothnessFromAlbedo }.
// standard: the shader is Unity's built-in Standard shader. The other fields are null when the material
// does not have them. color is as Unity stores it, in sRGB.
export function readMaterial(yamlText) {
  const material = [...parseDocuments(yamlText).values()].find(d => d.classId === MATERIAL)
  if (!material) throw new Error('No Material object in the Unity YAML')
  const { text } = material
  const shader = ref(text, 'm_Shader')
  // Serialized version 3 of m_SavedProperties writes "_Name: value", older versions "- _Name: value"
  const property = name => new RegExp(`^\\s*(?:- )?${name}: (.*)$`, 'm').exec(text)?.[1] ?? null
  const float = name => property(name) === null ? null : Number(property(name))
  const color = /r: ([^,]+), g: ([^,]+), b: ([^,]+), a: ([^}]+)/.exec(property('_Color') ?? '')
  const texture = name => new RegExp(`^\\s*(?:- )?${name}:\\s*\\n\\s*m_Texture: \\{fileID: (-?\\d+)`, 'm').exec(text)?.[1] ?? '0'
  return {
    name: field(text, 'm_Name'),
    standard: shader.guid === BUILTIN_SHADER_GUID && shader.fileID === STANDARD_SHADER,
    metallic: float('_Metallic'),
    glossiness: float('_Glossiness'),
    color: color ? color.slice(1).map(Number) : null,
    metallicGlossMap: texture('_MetallicGlossMap') !== '0',
    smoothnessFromAlbedo: float('_SmoothnessTextureChannel') === 1,
  }
}

// Path of the asset whose .meta file has this guid, in an AssetRipper Unity project export, or null
export function findAssetByGuid(projectDir, guid) {
  for (const file of walk(projectDir)) {
    if (file.endsWith('.meta') && fs.readFileSync(file, 'utf8').includes(`guid: ${guid}`)) return file.slice(0, -'.meta'.length)
  }
  return null
}

export function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

function toGlb(unityMatrix) {
  return MIRROR_X.clone().multiply(unityMatrix).multiply(MIRROR_X)
}

// Unity YAML: each object starts with "--- !u!<class id> &<file id>"
function parseDocuments(text) {
  const docs = new Map()
  const parts = text.split(/^--- !u!(\d+) &(-?\d+).*$/m)
  for (let i = 1; i < parts.length; i += 3) docs.set(parts[i + 1], { classId: Number(parts[i]), text: parts[i + 2] })
  return docs
}

function field(text, name) {
  const m = new RegExp(`^\\s*${name}: (.*)$`, 'm').exec(text)
  if (!m) throw new Error(`No ${name} in Unity YAML object:\n${text.slice(0, 500)}`)
  return m[1]
}

function num(text, name) {
  return Number(field(text, name))
}

// {x: 1, y: 2, z: 3} as numbers
function components(text, name) {
  return Object.fromEntries([...field(text, name).matchAll(/(\w+): ([^,}]+)/g)].map(([, k, v]) => [k, Number(v)]))
}

function vec(text, name) {
  const { x, y, z } = components(text, name)
  return new THREE.Vector3(x, y, z)
}

function quat(text, name) {
  const { x, y, z, w } = components(text, name)
  return new THREE.Quaternion(x, y, z, w)
}

// {fileID: 123, guid: abc, type: 2} → { fileID: '123', guid: 'abc' }
function ref(text, name) {
  const m = /fileID: (-?\d+)(?:, guid: (\w+))?/.exec(field(text, name))
  return { fileID: m[1], guid: m[2] ?? null }
}
