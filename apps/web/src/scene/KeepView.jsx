import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { resetView } from '../camera.js'

// Keeps the camera across a new <Canvas> (the Performance setting creates it again, see App.jsx). Put inside the
// Canvas. keep(view): called when this Canvas goes away, with { position, target }. take(): the kept view once, or
// null. App owns both (a ref outside the Canvas). The next Canvas puts the view back when its controls exist.
export default function KeepView({ keep, take }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)

  useEffect(() => {
    if (!controls) return
    const view = take()
    if (view) resetView(controls, null, view)
  }, [controls, take])

  useEffect(
    () => () => {
      if (controls) keep({ position: camera.position.toArray(), target: controls.target.toArray() })
    },
    [camera, controls, keep],
  )

  return null
}
