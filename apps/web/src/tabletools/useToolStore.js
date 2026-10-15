import { useRef, useEffect } from 'react'
import { storedFields, sameStored } from '../components/storedTool.js'
import { toolPose } from '../components/toolGeometry.js'
import { useRestStore } from './useRestStore.js'

// The tool state that is written to the document and read for the live pose and the drop on the rack.
// Returns the ref `latest` = { turn, snap, mode, entry, onStore, onReturn } of the last render.
export function useToolStore({ liveRb, liveRef, turn, snap, mode, entry, onStore, onReturn }) {
  // Writes the stored fields once none of them changed for REST_TIME. The values are read on every frame,
  // because the pose is in the body, not in React state.
  const latest = useRef(null)
  useEffect(() => {
    latest.current = { turn, snap, mode, entry, onStore, onReturn }
  })
  // The live pose for LiveSync: the body and the bend, read when asked
  useEffect(() => {
    liveRef?.(() => {
      const rb = liveRb()
      if (!rb || !latest.current) return null
      const t = rb.translation()
      const { right, left } = latest.current.turn
      return { x: t.x, y: t.y, z: t.z, yaw: toolPose(rb).yaw, right, left }
    })
    return () => liveRef?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useRestStore(() => {
    const rb = liveRb()
    if (!rb || !latest.current) return null
    const { turn, snap, mode, entry, onStore } = latest.current
    if (!onStore) return null
    const cur = storedFields({
      pose: { ...toolPose(rb), y: rb.translation().y },
      turn,
      snap: snap && {
        kind: snap.target.kind,
        id: snap.target.id,
        side: snap.side,
        across: snap.across,
      },
      mode,
    })
    return { cur, entry, onStore }
  }, sameStored)
  return latest
}
