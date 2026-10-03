// A token as a solid piece of cardboard: the outline of its image, extruded to the token thickness. TTS
// builds a Custom_Token the same way, from the transparent pixels of its image. Used for the character
// tokens (TokenFace.jsx) and the VP markers of the scoring board (ScoreBoard.jsx).

import { ExtrudeGeometry, Shape, Vector2 } from 'three'

// Real tokens are cardboard, 1–2 mm thick. 0.08" is 2 mm. Every token uses it, also the crisis tokens
// (CrisisToken.jsx).
export const TOKEN_THICKNESS = 0.08
// Color of a token's edge, where the cardboard is cut
export const TOKEN_EDGE_COLOR = '#3a3f4c'

// The outline is found along rays from the image center, so it fits any outline that every ray crosses
// once: circles, rounded diamonds and the Starherb star. 128 rays keep the star tips sharp.
const OUTLINE_RAYS = 128
// A pixel with at least this alpha is part of the token. The flat tokens used the same alphaTest.
const INSIDE_ALPHA = 0.5
// Ray step in pixels
const RAY_STEP = 0.5

// image → Map(size → geometry). The geometries are shared by every token with the same image and size and
// are never disposed: there are at most a few hundred, of a few KB each.
const geometries = new WeakMap()

// Solid of a token image `size` inches wide, lying flat: its bottom at y = 0, its top at
// y = TOKEN_THICKNESS, and the image top to local -z. Group 0 is the top and bottom faces, with UVs that
// show the whole image across `size` (texture flipY true, the default). Group 1 is the edge.
export function tokenSolidGeometry(texture, size) {
  const image = texture.image
  let bySize = geometries.get(image)
  if (!bySize) {
    bySize = new Map()
    geometries.set(image, bySize)
  }
  let geometry = bySize.get(size)
  if (!geometry) {
    geometry = buildGeometry(imageOutline(image), size)
    bySize.set(size, geometry)
  }
  return geometry
}

// outline: points [u, v] in image coordinates, 0..1, v down
function buildGeometry(outline, size) {
  // Shape coordinates in inches, centered, with the image top at +y
  const shape = new Shape(outline.map(([u, v]) => new Vector2((u - 0.5) * size, (0.5 - v) * size)))
  const capUv = (vertices, i) => new Vector2(vertices[i * 3] / size + 0.5, vertices[i * 3 + 1] / size + 0.5)
  const uvGenerator = {
    generateTopUV: (geometry, vertices, a, b, c) => [capUv(vertices, a), capUv(vertices, b), capUv(vertices, c)],
    // The edge has a plain color and no image
    generateSideWallUV: () => [new Vector2(), new Vector2(), new Vector2(), new Vector2()],
  }
  const geometry = new ExtrudeGeometry(shape, { depth: TOKEN_THICKNESS, bevelEnabled: false, UVGenerator: uvGenerator })
  // Lay it flat: shape +y (the image top) goes to -z, and the extrusion (+z) goes up
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

// One point per ray: the outermost pixel of the token on that ray
function imageOutline(image) {
  const { data, width, height } = imagePixels(image)
  const inside = (x, y) => {
    const px = Math.floor(x)
    const py = Math.floor(y)
    if (px < 0 || py < 0 || px >= width || py >= height) return false
    return data[(py * width + px) * 4 + 3] / 255 >= INSIDE_ALPHA
  }
  const cx = width / 2
  const cy = height / 2
  const maxRadius = Math.hypot(cx, cy)
  const points = []
  for (let i = 0; i < OUTLINE_RAYS; i++) {
    const angle = (i / OUTLINE_RAYS) * 2 * Math.PI
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    let r = maxRadius
    while (r > 0 && !inside(cx + dx * r, cy + dy * r)) r -= RAY_STEP
    points.push([(cx + dx * r) / width, (cy + dy * r) / height])
  }
  return points
}

function imagePixels(image) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0)
  return { data: context.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height }
}
