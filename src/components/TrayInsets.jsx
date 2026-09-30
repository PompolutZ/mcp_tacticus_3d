import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, PerspectiveCamera } from 'three'
import { insetCamera } from '../dice/tray.js'

// Draws each tray's inset box (design, "Inset view") on top of the main render.
//
// SelectionOutlines' EffectComposer runs its own useFrame at priority 1 (enabled) or 0 (the
// 'no-composer' debug mode, composer={false}; checked in node_modules/@react-three/postprocessing:
// `useFrame(callback, enabled ? renderPriority : 0)`). R3F skips its own render of the default
// camera whenever any useFrame has a priority above 0 (checked in @react-three/fiber: internal.priority
// only counts priority > 0 subscribers, and the frame loop does `if (!internal.priority) gl.render(...)`).
// So a priority above 1 here always runs after the composer, and, in 'no-composer' mode, is also
// the only thing left that draws the main view at all -- this component has to do that render
// itself first, in that mode only.
const PRIORITY = 2

// New camera per tray, once. The pose never changes; only its aspect (from the box's own size).
function buildCamera(trayKey) {
  const { position, target, fov } = insetCamera(trayKey)
  const camera = new PerspectiveCamera(fov, 1, 0.1, 200)
  camera.position.set(position.x, position.y, position.z)
  camera.lookAt(target.x, target.y, target.z)
  camera.updateProjectionMatrix()
  return camera
}

// `insetBoxes`: the ref Map from App.jsx (trayKey -> box element), filled by DicePanel.
// `noComposer`: true in the 'no-composer' debug mode (see PRIORITY above).
export default function TrayInsets({ insetBoxes, noComposer }) {
  const gl = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const defaultCamera = useThree(state => state.camera)
  const camerasRef = useRef(new Map())

  useFrame(() => {
    // Nothing else draws the main view while this component's priority keeps R3F from doing it
    // itself (see PRIORITY above), so this component draws it, full canvas, default camera, first.
    if (noComposer) gl.render(scene, defaultCamera)

    // A box element exists as soon as DicePanel mounts, even while its tray is empty: DicePanel
    // hides it then with CSS visibility, not display, so it still has a size. Skip both an absent
    // box and a hidden one -- rendering into a hidden box would still show on the canvas, since the
    // box's own invisibility does not hide the canvas underneath it.
    const boxes = []
    for (const [trayKey, el] of insetBoxes.current) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      if (getComputedStyle(el).visibility === 'hidden') continue
      boxes.push([trayKey, rect])
    }
    if (boxes.length === 0) return

    const canvasRect = gl.domElement.getBoundingClientRect()
    const prevShadowAutoUpdate = gl.shadowMap.autoUpdate
    const prevToneMapping = gl.toneMapping
    // One shadow map is enough for every render this frame (design, "Inset view").
    gl.shadowMap.autoUpdate = false
    // The composer turns the renderer's own tone mapping off and does it in a pass instead
    // (SelectionOutlines.jsx); a render outside the composer, like this one, needs it back on.
    gl.toneMapping = ACESFilmicToneMapping

    for (const [trayKey, rect] of boxes) {
      let camera = camerasRef.current.get(trayKey)
      if (!camera) {
        camera = buildCamera(trayKey)
        camerasRef.current.set(trayKey, camera)
      }
      camera.aspect = rect.width / rect.height
      camera.updateProjectionMatrix()

      // Box rect, relative to the canvas, in the units gl.setViewport/setScissor expect: CSS
      // pixels (three multiplies by the pixel ratio itself, checked in three's WebGLRenderer:
      // setViewport/setScissor do `_currentViewport.copy(_viewport).multiplyScalar(_pixelRatio)`).
      // getBoundingClientRect() counts y from the top; WebGL's viewport/scissor count from the
      // bottom, so the box's top edge becomes the distance from the canvas bottom to its own bottom edge.
      const x = rect.left - canvasRect.left
      const top = rect.top - canvasRect.top
      const y = canvasRect.height - (top + rect.height)

      gl.setViewport(x, y, rect.width, rect.height)
      gl.setScissor(x, y, rect.width, rect.height)
      gl.setScissorTest(true)
      // Depth only: the color already drawn for this screen rectangle (by the main render) stays
      // underneath, and the tray/dice, opaque and depth-tested, draw over it (design, "Inset view").
      gl.clear(false, true, false)
      gl.render(scene, camera)
    }

    // Leave the renderer as any later render this frame or next frame expects: the size the
    // renderer keeps for its own setRenderTarget(null) resets is whatever setViewport/setScissor
    // last set, not the canvas size, so this has to be undone explicitly, not just turned off.
    gl.setScissorTest(false)
    gl.setViewport(0, 0, canvasRect.width, canvasRect.height)
    gl.setScissor(0, 0, canvasRect.width, canvasRect.height)
    gl.shadowMap.autoUpdate = prevShadowAutoUpdate
    gl.toneMapping = prevToneMapping
  }, PRIORITY)

  return null
}
