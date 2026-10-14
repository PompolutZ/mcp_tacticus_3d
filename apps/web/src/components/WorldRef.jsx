import { useEffect } from 'react'
import { useRapier } from '@react-three/rapier'

// Gives code outside <Physics> (Scene's listeners and effects) the Rapier world, for liveBody
// (physics.js). Cleared when the world goes away. Renders nothing.
export default function WorldRef({ worldRef }) {
  const { world } = useRapier()
  worldRef.current = world
  useEffect(
    () => () => {
      worldRef.current = null
    },
    [worldRef],
  )
  return null
}
