// The top view image of a board (docs/features/map-builder.md, "Top view image"): the mat and the terrain from straight
// above, drawn off screen. Called from the scene (Scene.jsx, sceneApi.captureBoardImage), because it needs the renderer
// and the scene of the Canvas.
import {
  Color,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
} from 'three'
import { withoutShades } from '../scene/shade.js'
import { MAT_SIZE } from '../table.js'

// The image is a square of this many pixels
export const IMAGE_SIZE = 512
const IMAGE_TYPE = 'image/webp'
const IMAGE_QUALITY = 0.85
// The camera sits this far above the mat. The far plane reaches below the table, so no piece is cut.
const CAMERA_HEIGHT = 50
const CAMERA_FAR = 100

// The tone mapping function of each look option (table/tableStore.js, DEFAULT_LOOK), by its three.js name
const TONE_FUNCTION = {
  aces: 'ACESFilmicToneMapping',
  neutral: 'NeutralToneMapping',
  agx: 'AgXToneMapping',
}

// Pixel rows of a bottom-up image (what readRenderTargetPixels gives) -> a new top-down array. 4 bytes per pixel.
export function flipRows(pixels, width, height) {
  const stride = width * 4
  const out = new Uint8ClampedArray(pixels.length)
  for (let y = 0; y < height; y++) {
    out.set(pixels.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride)
  }
  return out
}

// Hides every object of the scene that is not keep, a light, or a parent of keep. Returns the function that shows them
// again. Lights stay, so the mat and the terrain have the light they have on the table.
export function hideOthers(root, keep) {
  const hidden = []
  const holdsKeep = (object) => {
    for (let node = keep; node; node = node.parent) if (node === object) return true
    return false
  }
  const visit = (parent) => {
    for (const child of parent.children) {
      if (child === keep || child.isLight) continue
      if (holdsKeep(child)) visit(child)
      else if (child.visible) {
        child.visible = false
        hidden.push(child)
      }
    }
  }
  visit(root)
  return () => {
    for (const object of hidden) object.visible = true
  }
}

// The camera above the table center that frames exactly the mat square. The mat and its terrain turn with matTurns (90
// degrees each, around the mat center, Scene.jsx). The camera turns with them (its up vector), so the image shows
// the board as it is saved, with matTurns 0, and what is drawn is the table as it is now.
function topCamera(turns) {
  const half = MAT_SIZE / 2
  const camera = new OrthographicCamera(-half, half, half, -half, 0.1, CAMERA_FAR)
  const angle = (turns * Math.PI) / 2
  camera.position.set(0, CAMERA_HEIGHT, 0)
  // The up vector -z of the table, turned the same as the mat group
  camera.up.set(-Math.sin(angle), 0, -Math.cos(angle))
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  return camera
}

// A screen quad that tone maps the linear image like the renderer does on screen, and writes sRGB. Render targets get no
// tone mapping and no color space conversion from three.js, so this pass does both. The result is the same look as the
// table (the composer of SelectionOutlines does the same with the ToneMapping pass).
function resolvePass(texture, toneMapping, exposure) {
  const material = new ShaderMaterial({
    uniforms: { tDiffuse: { value: texture }, toneMappingExposure: { value: exposure } },
    vertexShader: `varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `#include <tonemapping_pars_fragment>
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        vec3 color = ${TONE_FUNCTION[toneMapping] ?? TONE_FUNCTION.neutral}(texture2D(tDiffuse, vUv).rgb);
        gl_FragColor = sRGBTransferOETF(vec4(color, 1.0));
      }`,
    depthTest: false,
    depthWrite: false,
  })
  const scene = new Scene()
  const quad = new Mesh(new PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  scene.add(quad)
  return {
    scene,
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    dispose: () => {
      quad.geometry.dispose()
      material.dispose()
    },
  }
}

function encode(rgba) {
  const canvas = document.createElement('canvas')
  canvas.width = IMAGE_SIZE
  canvas.height = IMAGE_SIZE
  canvas.getContext('2d').putImageData(new ImageData(rgba, IMAGE_SIZE, IMAGE_SIZE), 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob?.type === IMAGE_TYPE ? resolve(blob) : reject(new Error('WebP is not supported')),
      IMAGE_TYPE,
      IMAGE_QUALITY,
    )
  })
}

// Draws the mat group (the mat and the terrain: keep) from above, without the models, their shadows and the selection
// shade, and returns the WebP image as a Blob.
// gl, scene: the renderer and the scene of the Canvas. turns: matTurns. toneMapping: the look option of the table.
// Everything it changes is put back in finally, and it draws in one synchronous block, so nothing shows on screen.
export async function captureBoardImage({ gl, scene, keep, turns = 0, toneMapping = 'neutral' }) {
  if (!keep) throw new Error('No mat to draw')
  const target = new WebGLRenderTarget(IMAGE_SIZE, IMAGE_SIZE, { type: HalfFloatType, samples: 4 })
  const output = new WebGLRenderTarget(IMAGE_SIZE, IMAGE_SIZE)
  const pass = resolvePass(target.texture, toneMapping, gl.toneMappingExposure)
  const background = scene.background
  const previousTarget = gl.getRenderTarget()
  const previousColor = gl.getClearColor(new Color())
  const previousAlpha = gl.getClearAlpha()
  const rgba = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE * 4)
  const showOthers = hideOthers(scene, keep)
  try {
    scene.background = null
    gl.setClearColor(0x101010, 1)
    scene.updateMatrixWorld()
    gl.setRenderTarget(target)
    gl.clear()
    // Shadow updates are on demand (scene/ShadowUpdates.jsx): without this, the hidden models still cast shadows
    gl.shadowMap.needsUpdate = true
    // No selection shade (the orange tint of a selected piece with the composer off, scene/shade.js)
    withoutShades(() => gl.render(scene, topCamera(turns)))
    gl.setRenderTarget(output)
    gl.render(pass.scene, pass.camera)
    gl.readRenderTargetPixels(output, 0, 0, IMAGE_SIZE, IMAGE_SIZE, rgba)
  } finally {
    showOthers()
    scene.background = background
    gl.setRenderTarget(previousTarget)
    gl.setClearColor(previousColor, previousAlpha)
    // The shadow map was drawn without the hidden objects, if it was drawn at all: draw it again for the screen
    gl.shadowMap.needsUpdate = true
    target.dispose()
    output.dispose()
    pass.dispose()
  }
  return encode(flipRows(rgba, IMAGE_SIZE, IMAGE_SIZE))
}
