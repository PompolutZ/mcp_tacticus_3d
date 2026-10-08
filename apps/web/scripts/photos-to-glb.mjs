// Makes a GLB for the app from a folder of photos of a real object, with Apple Object Capture.
// See docs/feature-custom-models.md.
//
// object-capture.swift reconstructs the object (OBJ, MTL and one color texture). This script then
// converts it in the same way as the TTS pieces: WebP texture, Draco mesh.

import { spawnSync, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { compactPrimitive, getBounds, transformMesh } from '@gltf-transform/functions'
import { CylinderGeometry } from 'three'
import { compressMesh, readObj, TEXTURE_SIZE, texturesToWebp, writeGlb } from './lib/convert.mjs'
import { BASE_DIAMETER } from '../src/characters/files.js'

const USAGE = `Usage:
  node scripts/photos-to-glb.mjs <photos dir> --out <file.glb>
Options:
  --base <size>       small, medium or large: a figure on a game base. The scanned base is replaced by a
                      base of the game size with the team color, and its center goes to the origin.
                      Without --height, the scale comes from the base size.
  --height <mm>       height of the real object in mm. The app uses inches (1 unit = 1"), so the script
                      converts it. Without it and without --base, the Object Capture size is read as
                      meters. That is correct only for iPhone photos with depth data.
  --triangles <n>     maximum number of triangles (default 30000)
  --texture <px>      maximum texture size: 1024, 2048 or 4096 (default ${TEXTURE_SIZE})`

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    base: { type: 'string' },
    height: { type: 'string' },
    triangles: { type: 'string', default: '30000' },
    texture: { type: 'string', default: String(TEXTURE_SIZE) },
    help: { type: 'boolean', short: 'h' },
  },
})
if (opts.help || positionals.length !== 1 || !opts.out) {
  console.log(USAGE)
  process.exit(opts.help ? 0 : 1)
}
const base = opts.base ?? null
const heightMm = opts.height === undefined ? null : Number(opts.height)
const triangles = Number(opts.triangles)
const textureSize = Number(opts.texture)
if (base !== null && !BASE_DIAMETER[base]) throw new Error(`--base must be small, medium or large, not "${opts.base}"`)
if (heightMm !== null && !(heightMm > 0)) throw new Error(`--height must be a number of mm, not "${opts.height}"`)
if (!Number.isInteger(triangles) || triangles <= 0) throw new Error(`--triangles must be a positive integer, not "${opts.triangles}"`)
if (![1024, 2048, 4096].includes(textureSize)) throw new Error(`--texture must be 1024, 2048 or 4096, not "${opts.texture}"`)

const PHOTOS = path.resolve(positionals[0])
const OUT = path.resolve(opts.out)
const SWIFT_SOURCE = path.join(import.meta.dirname, 'object-capture.swift')
// tools/ is in .gitignore, like AssetRipper
const TOOL = path.resolve(import.meta.dirname, '../tools/object-capture')
// The Object Capture output stays here after the run, so it can be inspected
const WORK_DIR = path.join(os.tmpdir(), 'mcp-assist-3d-photogrammetry', path.basename(OUT, '.glb'))
const INCHES_PER_METER = 39.37
const MM_PER_INCH = 25.4
// Height of the base that --base adds: the base collider of CharacterModel.jsx (2 × BASE_HALF_H).
// The base disk of the TTS model bundles is 0.12" high.
const BASE_HEIGHT = 0.118
// The same number of sides as the standee base in CharacterModel.jsx
const BASE_SEGMENTS = 48
// --base finds the scanned base in this bottom part of the scan (a fraction of the scan height), cut
// into BASE_BANDS bands. The base is the widest band. The very bottom of a scan is narrower than the base,
// because Object Capture rounds off the bottom edge: in the test, 38 mm at the bottom, 50 mm at 3.8 mm.
const BASE_SLICE = 0.06
const BASE_BANDS = 12

if (!fs.statSync(PHOTOS, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Not a directory: ${PHOTOS}`)
buildTool()
reconstruct()
await convert()

// Compiles object-capture.swift when the binary is missing or older than the source
function buildTool() {
  if (fs.existsSync(TOOL) && fs.statSync(TOOL).mtimeMs >= fs.statSync(SWIFT_SOURCE).mtimeMs) return
  console.log('Compiling object-capture.swift')
  fs.mkdirSync(path.dirname(TOOL), { recursive: true })
  execFileSync('swiftc', ['-O', SWIFT_SOURCE, '-o', TOOL], { stdio: 'inherit' })
}

function reconstruct() {
  console.log(`Object Capture: ${PHOTOS}`)
  // The OBJ file name changes on each run, so old output is deleted first
  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  // RealityKit writes many internal warnings to stderr. They are shown only when the run fails.
  const run = spawnSync(TOOL, [PHOTOS, WORK_DIR, String(triangles), String(textureSize)], {
    stdio: ['ignore', 'inherit', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
  if (run.status !== 0) {
    process.stderr.write(run.stderr ?? '')
    throw new Error(`object-capture failed (exit code ${run.status})`)
  }
}

async function convert() {
  const obj = fs.readdirSync(WORK_DIR).find(f => f.endsWith('.obj'))
  if (!obj) throw new Error(`No OBJ file in ${WORK_DIR}`)
  const doc = await readObj(path.join(WORK_DIR, obj))
  placeOnTable(doc)
  if (base) replaceBase(doc)
  texturesToWebp(doc, textureSize)
  await compressMesh(doc, { singleMaterial: false })
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  await writeGlb(OUT, doc)

  const { min, max } = getBounds(doc.getRoot().listScenes()[0])
  const size = [0, 2, 1].map(i => ((max[i] - min[i]) * MM_PER_INCH).toFixed(1))
  const count = prims(doc).reduce((n, p) => n + p.getIndices().getCount() / 3, 0)
  const shown = path.relative(process.cwd(), OUT).startsWith('..') ? OUT : path.relative(process.cwd(), OUT)
  console.log(`Wrote ${shown}: ${count} triangles, ${size.join(' × ')} mm (width × depth × height), ${Math.round(fs.statSync(OUT).size / 1024)} KB`)
  console.log(`Object Capture output: ${WORK_DIR}`)
}

function prims(doc) {
  return doc.getRoot().listMeshes().flatMap(m => m.listPrimitives())
}

// Scales the model to inches and puts it on the table: bottom at y = 0, center on the Y axis.
// The center is the center of the scanned base with --base, because the app puts the base collider
// at the origin. Otherwise it is the center of the bounding box. Object Capture already writes Y up,
// with the bottom at y = 0 and the bounding box center on the Y axis.
function placeOnTable(doc) {
  const { min, max } = getBounds(doc.getRoot().listScenes()[0])
  const scanBase = base ? findScanBase(doc, min[1], (max[1] - min[1]) * BASE_SLICE) : null
  const scale = heightMm !== null ? heightMm / MM_PER_INCH / (max[1] - min[1]) : scanBase ? BASE_DIAMETER[base] / scanBase.diameter : INCHES_PER_METER
  const [cx, cz] = scanBase ? scanBase.center : [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2]
  // Column-major, as glTF matrices are
  const matrix = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, -cx * scale, -min[1] * scale, -cz * scale, 1]
  for (const mesh of doc.getRoot().listMeshes()) transformMesh(mesh, matrix)
  // Without --height, the scanned base has the game size by definition
  if (scanBase && heightMm !== null) {
    const mm = inches => (inches * MM_PER_INCH).toFixed(1)
    console.log(`Scanned base: ${mm(scanBase.diameter * scale)} mm wide. Game base (${base}): ${mm(BASE_DIAMETER[base])} mm`)
  }
}

// Center (x, z) and diameter of the scanned base, in scan units: the bounding box of the widest band
// between bottom and bottom + sliceHeight. The diameter is the mean of the band's width and depth.
function findScanBase(doc, bottom, sliceHeight) {
  const bands = Array.from({ length: BASE_BANDS }, () => ({ lo: [Infinity, Infinity], hi: [-Infinity, -Infinity] }))
  const v = [0, 0, 0]
  for (const prim of prims(doc)) {
    const position = prim.getAttribute('POSITION')
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, v)
      const band = bands[Math.floor(((v[1] - bottom) / sliceHeight) * BASE_BANDS)]
      if (!band) continue
      band.lo = [Math.min(band.lo[0], v[0]), Math.min(band.lo[1], v[2])]
      band.hi = [Math.max(band.hi[0], v[0]), Math.max(band.hi[1], v[2])]
    }
  }
  const found = bands
    .filter(({ lo }) => lo[0] !== Infinity)
    .map(({ lo, hi }) => ({ center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], diameter: (hi[0] - lo[0] + hi[1] - lo[1]) / 2 }))
  return found.reduce((a, b) => (b.diameter > a.diameter ? b : a))
}

// Replaces the scanned base with a cylinder of the game size and the material defaultMat.
// CharacterModel.jsx gives that material the team color, as on the migrated models.
// Scan triangles with all corners below the top of the new base are deleted. The corners of the other
// triangles that are below the top move up to it. Without that, these corners stick out of the cylinder
// side, and the line between the team color and the scan is uneven.
function replaceBase(doc) {
  const v = [0, 0, 0]
  for (const prim of prims(doc)) {
    const indices = prim.getIndices()
    const all = indices.getArray()
    const scanned = prim.getAttribute('POSITION')
    const kept = []
    for (let i = 0; i < all.length; i += 3) {
      const corners = [all[i], all[i + 1], all[i + 2]]
      if (corners.some(c => scanned.getElement(c, v)[1] >= BASE_HEIGHT)) kept.push(...corners)
    }
    indices.setArray(new all.constructor(kept))
    // Deletes the vertices that no triangle uses now
    compactPrimitive(prim)
    const position = prim.getAttribute('POSITION')
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, v)
      if (v[1] < BASE_HEIGHT) position.setElement(i, [v[0], BASE_HEIGHT, v[2]])
    }
  }

  const radius = BASE_DIAMETER[base] / 2
  const geometry = new CylinderGeometry(radius, radius, BASE_HEIGHT, BASE_SEGMENTS).translate(0, BASE_HEIGHT / 2, 0)
  const buffer = doc.getRoot().listBuffers()[0]
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer)
  // Metallic 0 and roughness 1, as the base material of the migrated models
  const material = doc.createMaterial('defaultMat').setMetallicFactor(0).setRoughnessFactor(1)
  const cylinder = doc
    .createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', geometry.getAttribute('position').array))
    .setAttribute('NORMAL', accessor('VEC3', geometry.getAttribute('normal').array))
    .setIndices(accessor('SCALAR', geometry.getIndex().array))
    .setMaterial(material)
  doc.getRoot().listMeshes()[0].addPrimitive(cylinder)
}
