// Migrates the dice tray assets of the TTS mod to src/assets/dice/: the die mesh and texture, the
// tray mesh and texture, and the 6 result icons. See scripts/README.md, "TTS dice migration".
//
// The die is not a TTS mesh: it is the app's own regular octahedron (src/dice/faces.js), built here
// as a GLB with 24 vertices (flat faces, one UV set per face). The UV triangles below were measured
// once, by hand, from the TTS D8 mesh (D8_1885.obj, from AssetRipper) and are not re-derived on every
// run: see "Where the die UVs come from" below.

import fs from 'node:fs'
import path from 'node:path'
import { Document } from '@gltf-transform/core'
import { compressMesh, imageToWebp, readObj, TEXTURE_SIZE, writeGlb } from './lib/convert.mjs'
import { cachedFile, modObject } from './lib/tts.mjs'
import { D8_CORNERS, FACES, SYMBOLS } from '../src/dice/faces.js'

const ASSETS = path.resolve(import.meta.dirname, '../src/assets/dice')
const DIE_TEXTURE_SIZE = 1024
const ICON_SIZE = 256

// Where the die UVs come from: for each face, fit the affine map from the face plane to UV using
// the flat (unbevelled) triangle of D8_1885.obj that has the same normal as the ideal face, then
// evaluate that map at the corners of the app's own regular octahedron (see docs/plan-dice-rolling.md,
// Phase 1 Result, for the full method). Checked by cropping the die texture at these UVs: face 1 is
// the skull, 2 the shield, 3 and 6 the starburst, 5 the "!" burst, 7 the spiral, 4 and 8 are blank.
// index = face number - 1. Each triple is [tip, cornerA, cornerB], the same order as FACES[i].corners.
// glTF convention (V flipped from the OBJ file).
const FACE_UVS = [
  [[0.1845, 0.6654], [0.0034, 0.9937], [0.3656, 0.9937]], // 1 skull
  [[0.5693, 0.3118], [0.3882, 0.6401], [0.7504, 0.6401]], // 2 block
  [[0.3776, 0.6098], [0.5587, 0.2816], [0.1965, 0.2816]], // 3 hit
  [[0.8143, 0.9872], [0.9954, 0.6589], [0.6332, 0.6589]], // 4 blank
  [[0.7569, 0.6125], [0.938, 0.2842], [0.5758, 0.2842]], // 5 crit
  [[0.3936, 0.9884], [0.5747, 0.6601], [0.2125, 0.6601]], // 6 hit
  [[0.1845, 0.3118], [0.0034, 0.6401], [0.3656, 0.6401]], // 7 wild
  [[0.6062, 0.6571], [0.4251, 0.9854], [0.7873, 0.9854]], // 8 blank
]

const ICON_URL = symbol => `https://d37ev18qvj5a3m.cloudfront.net/tts/token/ui/D${{ crit: 'CRIT', wild: 'WILD', hit: 'HIT', block: 'BLOCK', blank: 'BLANK', skull: 'FAIL' }[symbol]}_UI.png`
// The mesh, texture and rotation values are the same in the Lua script of both trays, so one nickname is enough
const TRAY_NICKNAME = 'Blue Dice Tray'
const DIE_IMAGE_RE = /image\s*=\s*"(https:[^"]+)"/

await migrate()

async function migrate() {
  fs.mkdirSync(path.join(ASSETS, 'icons'), { recursive: true })

  await writeDie()
  await writeTray()
  writeIcons()

  console.log('Wrote src/assets/dice/d8.glb, d8.webp, tray.glb, tray.webp, icons/*.webp')
}

// 24 vertices (8 faces x 3 corners, no sharing, so each face keeps flat normals and its own UVs),
// no texture inside the GLB (d8.webp is a separate file, like the terrain pieces), no Draco: the
// mesh is tiny.
async function writeDie() {
  const positions = new Float32Array(24 * 3)
  const normals = new Float32Array(24 * 3)
  const uvs = new Float32Array(24 * 2)
  const indices = new Uint16Array(24)
  FACES.forEach((face, f) => {
    face.corners.forEach((cornerIndex, c) => {
      const v = f * 3 + c
      positions.set(D8_CORNERS[cornerIndex], v * 3)
      normals.set(face.normal, v * 3)
      uvs.set(FACE_UVS[f][c], v * 2)
      indices[v] = v
    })
  })

  const doc = new Document()
  const buffer = doc.createBuffer()
  const position = doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer)
  const normal = doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer)
  const texcoord = doc.createAccessor().setType('VEC2').setArray(uvs).setBuffer(buffer)
  const index = doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer)
  const prim = doc.createPrimitive().setAttribute('POSITION', position).setAttribute('NORMAL', normal).setAttribute('TEXCOORD_0', texcoord).setIndices(index)
  const mesh = doc.createMesh('d8').addPrimitive(prim)
  const node = doc.createNode('d8').setMesh(mesh)
  const scene = doc.createScene().addChild(node)
  doc.getRoot().setDefaultScene(scene)
  await writeGlb(path.join(ASSETS, 'd8.glb'), doc)

  const dieImageUrl = DIE_IMAGE_RE.exec(modObject(TRAY_NICKNAME).LuaScript)?.[1]
  if (!dieImageUrl) throw new Error(`No die image URL in the "${TRAY_NICKNAME}" script`)
  const dieImage = cachedFile(dieImageUrl)
  if (!dieImage) throw new Error(`Die texture not in the TTS cache: ${dieImageUrl}`)
  fs.writeFileSync(path.join(ASSETS, 'd8.webp'), imageToWebp(dieImage, DIE_TEXTURE_SIZE))
}

async function writeTray() {
  const tray = modObject(TRAY_NICKNAME).CustomMesh
  const mesh = cachedFile(tray.MeshURL)
  const diffuse = cachedFile(tray.DiffuseURL)
  if (!mesh || !diffuse) throw new Error(`Tray mesh or texture not in the TTS cache (nickname "${TRAY_NICKNAME}")`)
  await writeGlb(path.join(ASSETS, 'tray.glb'), await compressMesh(await readObj(mesh), { singleMaterial: true }))
  fs.writeFileSync(path.join(ASSETS, 'tray.webp'), imageToWebp(diffuse, TEXTURE_SIZE))
}

function writeIcons() {
  for (const symbol of SYMBOLS) {
    const file = cachedFile(ICON_URL(symbol))
    if (!file) throw new Error(`Icon not in the TTS cache: ${ICON_URL(symbol)}`)
    fs.writeFileSync(path.join(ASSETS, 'icons', `${symbol}.webp`), imageToWebp(file, ICON_SIZE))
  }
}
