import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { collectCasters, createShadowTracker } from './shadowChange.js'

function setShadowMap(gl, autoUpdate, needsUpdate) {
  gl.shadowMap.autoUpdate = autoUpdate
  gl.shadowMap.needsUpdate = needsUpdate
}

function requestShadowUpdate(gl) {
  gl.shadowMap.needsUpdate = true
}

// Draws the shadow map again only when a shadow caster changes. Lasting behavior and the reasons:
// docs/features/rendering.md.
//
// Put inside <Canvas>. renderScene: true when nothing else draws the scene (the composer of
// SelectionOutlines is off), see the frame callback.
export default function ShadowUpdates({ renderScene = false }) {
  const tracker = useMemo(() => createShadowTracker(), [])
  const casters = useMemo(() => [], [])

  // autoUpdate false: the shadow map is drawn only after needsUpdate is set. three.js sets
  // needsUpdate back to false after it draws the map.
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    setShadowMap(gl, false, true)
    return () => setShadowMap(gl, true, false)
  }, [gl])

  // Priority 0.5: after every priority 0 callback (they move the pieces) and before the composer
  // (priority 1), so the check sees the pieces as they are drawn in this frame.
  // Any positive priority turns off R3F's own render, so this callback draws the scene itself when
  // the composer does not (the composer has priority 0 while it is disabled).
  useFrame(({ gl, scene, camera }) => {
    // three.js updates the world matrices inside render(), after this check. Updating them here
    // gives the numbers of this frame, so a shadow does not lag one frame behind its piece.
    // render() does it again; this costs one more walk over the tree.
    scene.updateMatrixWorld()
    if (tracker.update(collectCasters(scene, casters))) requestShadowUpdate(gl)
    if (renderScene) gl.render(scene, camera)
  }, 0.5)

  return null
}
