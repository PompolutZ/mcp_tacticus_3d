import { useMemo, useRef } from 'react'
import { Color, SRGBColorSpace } from 'three'
import { usePointerTablePoint } from '../drag/usePointerTablePoint.js'
import { canDropTool, toolArms } from './dropShape.js'
import { useSideColor } from '../table/useSideColors.jsx'
import { TOOL_TINT } from './toolTips.js'
import { freeSpawnYaw } from './storedTool.js'
import { MARKER_LIFT } from '../pieces/heights.js'
import { useTableStore } from '../table/TableStoreContext.jsx'

// The tool that is dragged from the rack: a flat, semi-transparent outline of its footprint in the player tint,
// at the table or terrain point under the pointer, turned as the tool spawns free (docs/features/table-tools.md,
// "Tool rack"). It is dimmed while a release would do nothing (over the own rack), and hidden off the table.
// It reads the drag from the store (toolDrag, tableStore.js) and shows only while the drag is active. pointRef
// (toolDragPointRef in the store): useTableTools reads the last point, { x, y, z } or null, on release. start: { clientX,
// clientY } of the pointer when the ghost mounts, so it shows before the next pointermove. kind, which: the tool
// (dropShape.js, toolArms). side: the own side.

const OPACITY = 0.45
const DIMMED_OPACITY = 0.12

export default function ToolDragGhost() {
  const drag = useTableStore((s) => s.toolDrag)
  const pointRef = useTableStore((s) => s.toolDragPointRef)
  const side = useTableStore((s) => s.ownSide)
  if (!drag?.active) return null
  return (
    <Ghost pointRef={pointRef} start={drag.start} kind={drag.kind} which={drag.which} side={side} />
  )
}

function Ghost({ pointRef, start, kind, which, side }) {
  const groupRef = useRef()
  const arms = useMemo(() => toolArms(kind, which), [kind, which])
  const materials = useRef([])
  const color = useSideColor(side)
  const tint = useMemo(() => new Color().setRGB(...TOOL_TINT[color], SRGBColorSpace), [color])

  usePointerTablePoint(pointRef, start, (point) => {
    const group = groupRef.current
    if (!group) return
    group.visible = Boolean(point)
    if (!point) return
    group.position.set(point.x, point.y + MARKER_LIFT, point.z)
    const opacity = canDropTool(side, point) ? OPACITY : DIMMED_OPACITY
    for (const material of materials.current) if (material) material.opacity = opacity
  })

  // Hidden until handleMove gives it a point
  return (
    <group ref={groupRef} visible={false} rotation-y={freeSpawnYaw(side)}>
      {arms.map((arm, i) => (
        <group key={i} rotation-y={arm.angle}>
          <mesh position={[arm.length / 2, 0, 0]} rotation-x={-Math.PI / 2} raycast={() => {}}>
            <planeGeometry args={[arm.length, arm.width]} />
            <meshBasicMaterial
              ref={(m) => {
                materials.current[i] = m
              }}
              color={tint}
              transparent
              opacity={OPACITY}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
