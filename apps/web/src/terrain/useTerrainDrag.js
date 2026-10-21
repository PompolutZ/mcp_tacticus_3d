import { useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { isDragActive, startPointerDrag } from '../drag/pointerDrag.js'
import { tablePoint } from '../drag/tablePoint.js'
import { localDelta } from './localDelta.js'

// The drag of a placed terrain piece (docs/features/map-builder.md, "Drag"). Inside a Canvas.
// The drag plane is the horizontal plane through the point where the press grabbed the piece, so that
// point stays under the pointer. The height of the piece does not change.
// A drag moves only the placement group (the body is fixed and does not follow). The drop calls
// onDrop(id, dx, dz) with the move in Three coords of the parent of the group (the mat group, which turns with
// matTurns; the pointer points are world points, so the move is turned back, see localDelta), and the caller writes the new position and
// mounts the piece again with its body (movePlacement in builder.js). onSelect(id): the drag began.
// Returns { groupRef(id, group), onPointerDown(id, e) } for the props of Terrain.
export function useTerrainDrag({ onDrop, onSelect }) {
  const { camera, gl } = useThree()
  const controls = useThree((state) => state.controls)
  const groups = useRef(new Map())

  const groupRef = (id, group) => {
    if (group) groups.current.set(id, group)
    else groups.current.delete(id)
  }

  function onPointerDown(id, e) {
    const group = groups.current.get(id)
    // One drag at a time: a second press (another finger) must not replace the drag in progress
    if (!group || !e.point || isDragActive()) return
    const scene = { camera, canvas: gl.domElement }
    const planeY = e.point.y
    const pointer = (ev) => tablePoint(scene, ev.clientX, ev.clientY, { planeY })
    const start = pointer(e)
    if (!start) return
    const origin = group.position.clone()
    group.updateWorldMatrix(true, false)
    const parentWorld = group.parent.matrixWorld.clone()
    let move = { dx: 0, dz: 0 }
    startPointerDrag(e, {
      controls,
      canvas: gl.domElement,
      onStart: () => onSelect?.(id),
      onMove: (ev) => {
        const point = pointer(ev)
        if (!point) return false
        move = localDelta(parentWorld, start, point)
        // A re-render may have mounted the group again: always move the one in the map
        const current = groups.current.get(id) ?? group
        current.position.set(origin.x + move.dx, origin.y, origin.z + move.dz)
        return false
      },
      onEnd: () => onDrop(id, move.dx, move.dz),
      // A cancel puts the group back
      onCancel: () => (groups.current.get(id) ?? group).position.copy(origin),
    })
  }

  return { groupRef, onPointerDown }
}
