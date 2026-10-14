import { useEffect } from 'react'
import { useRapier } from '@react-three/rapier'

// Gives code outside <Physics> (Scene's listeners and effects) the Rapier world, for liveBody
// (physics.js). Cleared when the world goes away. Renders nothing.
export default function WorldRef({ worldRef, rapierRef }) {
  const { world, rapier } = useRapier()
  worldRef.current = world
  useEffect(() => {
    if (rapierRef) rapierRef.current = rapier
    return () => {
      worldRef.current = null
      if (rapierRef) rapierRef.current = null
    }
  }, [worldRef, rapierRef, rapier])
  return null
}
