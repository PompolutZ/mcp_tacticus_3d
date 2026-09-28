// Mesh and texture conversion for the web. The steps are the ones used for the Vibranium Heist pieces:
// - mesh: GLB with one primitive per material, Draco compression
// - texture: WebP, at most 2048 × 2048 (mats at most 4096 × 4096), quality 85, metadata removed

import { execFileSync } from 'node:child_process'
import { Logger, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions'
import { dedup, dequantize, draco, flatten, join, normals, prune, unweld } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import obj2gltf from 'obj2gltf'

export const TEXTURE_SIZE = 2048
export const MAT_SIZE = 4096

const io = new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS).registerDependencies({
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
export async function readObj(file) {
  const glb = await obj2gltf(file, { binary: true, logger: () => {} })
  return io.readBinary(new Uint8Array(glb))
}

// singleMaterial: put every primitive on one material, for pieces that get their texture from a separate file.
// Without it, materials and their textures stay in the GLB.
export async function compressMesh(doc, { singleMaterial }) {
  const root = doc.getRoot()
  const prims = root.listMeshes().flatMap(m => m.listPrimitives())
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
  if (prims.some(p => !p.getAttribute('NORMAL'))) await doc.transform(unweld(), normals())
  // dedup before join: bundles often have many copies of the same material, and join merges
  // only primitives that share one material.
  // prune keeps attributes: without keepAttributes it deletes the UVs of a material without a texture
  await doc.transform(dequantize(), flatten(), dedup(), join({ keepNamed: false }), prune({ keepAttributes: true }), draco({ quantizeTexcoord: 14 }))
  return doc
}

// Converts every texture in the document to WebP (EXT_texture_webp, which three.js GLTFLoader reads)
export function texturesToWebp(doc) {
  const textures = doc.getRoot().listTextures()
  if (!textures.length) return
  doc.createExtension(EXTTextureWebP).setRequired(true)
  for (const texture of textures) {
    texture.setImage(imageToWebp(texture.getImage(), TEXTURE_SIZE)).setMimeType('image/webp').setURI('')
  }
}

// input: file path or image bytes. Returns WebP bytes.
export function imageToWebp(input, maxSize) {
  const fromBytes = typeof input !== 'string'
  return execFileSync('magick', [fromBytes ? '-' : input, '-resize', `${maxSize}x${maxSize}>`, '-strip', '-quality', '85', 'webp:-'], {
    input: fromBytes ? input : undefined,
    maxBuffer: 512 * 1024 * 1024,
  })
}
