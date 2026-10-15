import { useMemo } from 'react'
import { useRapier } from '@react-three/rapier'
import { castDown } from '../physics.js'
import { SIDES, yawQuat, toolShape, alongHalf } from '../components/toolGeometry.js'

// Half height of the flat box cast down to find the ground under a footprint
export const FOOTPRINT_CAST_HALF_H = 0.01
// Extra distance around the footprint where terrain already raises the dragged tool
export const HOVER_MARGIN = 0.5

// Returns groundY(x, z, yaw): top of the table or terrain under the whole footprint of the tool
// with its center at (x, z), or null when nothing is under it.
// halfLength: length of each half. turn: how far each half is turned from straight.
export function useFootprintGround(halfLength, halfWidth, turn) {
  const { world, rapier } = useRapier()
  // One box for each half. Larger than the half, so the tool rises before it reaches terrain
  // and a tiny overlap at the edge does not switch it between heights
  const halfShape = useMemo(
    () =>
      new rapier.Cuboid(
        halfLength / 2 + HOVER_MARGIN,
        FOOTPRINT_CAST_HALF_H,
        halfWidth + HOVER_MARGIN,
      ),
    [rapier, halfLength, halfWidth],
  )

  return function groundY(x, z, yaw) {
    const shape = toolShape({ x, z, yaw }, turn)
    let top = null
    for (const side of SIDES) {
      const c = alongHalf(shape, side, halfLength / 2)
      const y = castDown(
        world,
        rapier,
        halfShape,
        yawQuat(shape[side]),
        c.x,
        c.z,
        FOOTPRINT_CAST_HALF_H,
      )
      if (y !== null && (top === null || y > top)) top = y
    }
    return top
  }
}
