import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { CAMERA_FRAME_PRIORITY, matrixChanged } from '../camera.js'
import { isDragActive } from '../drag/pointerDrag.js'

// R3F raycasts only on pointer events, so a camera that moves under a still pointer (WASD, arrows, wheel,
// OrbitControls) leaves the hover on the old target. When the camera view changed since the last frame,
// this runs the hover again from the last pointer event (events.update). Nothing runs while the camera is
// still. A drag does its own follow (drag/pointerDrag.js, refreshActiveDrag), so hover is left alone then.
// docs/features/key-shortcuts.md, "Hover".
export function CameraHover() {
  const camera = useThree((state) => state.camera)
  const events = useThree((state) => state.events)
  const view = useRef([])
  const projection = useRef([])

  // After the camera moves (CAMERA_FRAME_PRIORITY), before the render
  useFrame(() => {
    camera.updateMatrixWorld()
    const moved = matrixChanged(view.current, camera.matrixWorld.elements)
    const zoomed = matrixChanged(projection.current, camera.projectionMatrix.elements)
    if ((moved || zoomed) && !isDragActive()) events.update?.()
  }, CAMERA_FRAME_PRIORITY + 0.5)

  return null
}
