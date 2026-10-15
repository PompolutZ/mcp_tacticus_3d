import { useRef } from 'react'
import { useLatest, useOnMount } from './components/useLatest.js'
import { useRapier } from '@react-three/rapier'
import { liveBody } from './physics.js'

// The ref for a <RigidBody ref>, for a component inside <Physics>. RigidBody never passes null when it
// removes the body, so the ref is cleared on unmount here, with the extra refs (each one a ref to a
// collider, or to a list of colliders). liveRb() gives the body if it is still in the world, else null:
// use it before a body call from a listener, an effect or peer data (physics.js, liveBody).
// Returns { rigidRef, liveRb, world }.
export function useBodyRef(...extraRefs) {
  const { world } = useRapier()
  const rigidRef = useRef()
  const extra = useLatest(extraRefs)
  useOnMount(() => () => {
    rigidRef.current = undefined
    for (const ref of extra.current) ref.current = Array.isArray(ref.current) ? [] : undefined
  })
  function liveRb() {
    const rb = rigidRef.current
    return liveBody(world, rb) ? rb : null
  }
  return { rigidRef, liveRb, world }
}
