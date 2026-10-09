// Mesh and texture conversion for the web. The steps are the ones used for the Vibranium Heist pieces:
// - mesh: GLB with one primitive per material, Draco compression
// - texture: WebP, at most 2048 × 2048 (mats at most 4096 × 4096, character models at most 1024 × 1024), quality 85,
//   metadata removed

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Logger, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions'
import {
  dedup,
  dequantize,
  draco,
  flatten,
  join,
  normals,
  prune,
  unweld,
} from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import obj2gltf from 'obj2gltf'

export const TEXTURE_SIZE = 2048
export const MAT_SIZE = 4096
// A figure is 2–3" tall, so 1024 is about 1 texture pixel per screen pixel at the closest zoom on a retina screen.
// It also uses a quarter of the GPU memory of 2048 (about 5.6 MB instead of 22 MB per figure).
export const CHARACTER_TEXTURE_SIZE = 1024

const io = new NodeIO()
  .setLogger(new Logger(Logger.Verbosity.WARN))
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  })

export function readGlb(file) {
  return io.read(file)
}

export function writeGlb(file, doc) {
  return io.write(file, doc)
}

// TTS OBJ → glTF document. obj2gltf flips V to the glTF convention, so the texture is used with flipY = false.
// The OBJ files from TTS have no material file, so the document gets one default material.
// An OBJ with a material file (Object Capture) keeps its material and texture.
export async function readObj(file) {
  const glb = await obj2gltf(file, { binary: true, logger: () => {} })
  return io.readBinary(new Uint8Array(glb))
}

// singleMaterial: put every primitive on one material, for pieces that get their texture from a separate file.
// Without it, materials and their textures stay in the GLB.
export async function compressMesh(doc, { singleMaterial }) {
  const root = doc.getRoot()
  const prims = root.listMeshes().flatMap((m) => m.listPrimitives())
  if (singleMaterial) {
    const material = doc.createMaterial('terrain')
    for (const prim of prims) prim.setMaterial(material)
  }
  // Only the color texture is used, so tangents, second UV sets and vertex colors are not needed
  for (const prim of prims) {
    for (const semantic of prim.listSemantics()) {
      if (/^(TANGENT|TEXCOORD_[1-9]|COLOR_\d+)$/.test(semantic)) prim.setAttribute(semantic, null)
    }
  }
  // Flat normals, as three.js OBJLoader computes them for a mesh without normals
  if (prims.some((p) => !p.getAttribute('NORMAL'))) await doc.transform(unweld(), normals())
  // dedup before join: bundles often have many copies of the same material, and join merges
  // only primitives that share one material.
  // prune keeps attributes: without keepAttributes it deletes the UVs of a material without a texture
  await doc.transform(
    dequantize(),
    flatten(),
    dedup(),
    join({ keepNamed: false }),
    prune({ keepAttributes: true }),
    draco({ quantizeTexcoord: 14 }),
  )
  return doc
}

// Converts every texture in the document to WebP (EXT_texture_webp, which three.js GLTFLoader reads)
export function texturesToWebp(doc, maxSize = TEXTURE_SIZE) {
  const textures = doc.getRoot().listTextures()
  if (!textures.length) return
  doc.createExtension(EXTTextureWebP).setRequired(true)
  for (const texture of textures) {
    texture.setImage(imageToWebp(texture.getImage(), maxSize)).setMimeType('image/webp').setURI('')
  }
}

// input: file path or image bytes. Returns WebP bytes.
// Image bytes go to magick through a temp file, not stdin. On 2026-10-08, execFileSync with a 1.3 MB
// `input` hung in 2 of 30 runs: magick waited for the rest of stdin, and Node did not write it.
// With a temp file, 60 of 60 runs finished.
export function imageToWebp(input, maxSize) {
  if (typeof input !== 'string') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-assist-3d-webp-'))
    try {
      const file = path.join(dir, 'image')
      fs.writeFileSync(file, input)
      return imageToWebp(file, maxSize)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
  return execFileSync(
    'magick',
    [input, '-resize', `${maxSize}x${maxSize}>`, '-strip', '-quality', '85', 'webp:-'],
    {
      maxBuffer: 512 * 1024 * 1024,
    },
  )
}
