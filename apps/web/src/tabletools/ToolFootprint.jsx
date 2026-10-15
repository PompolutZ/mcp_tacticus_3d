import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { useLatest, useOnMount } from '../scene/useLatest.js'
import {
  useFootprintSlot,
  FOOTPRINT_APART,
  FOOTPRINT_COLOR,
  FOOTPRINT_TOUCH,
} from '../scene/footprintProjection.js'
import { footprintGap } from './placeLock.js'
import {
  CONTACT_EPS,
  sameMark,
  sameModel,
  toolPose,
  toolShape,
  withinRangeOne,
} from './toolGeometry.js'

// Range tool: the piece that a turn of the snapped tool measures against gets a green or red outline
// (see SelectionOutlines.jsx). measuredRef: the piece under the pointer while a drag turns the snapped
// tool around the base, else null (set in Tool). In range:
// - Range 2 to 5: the measured base touches the footprint.
// - R1 (rangeOne): the measured base is within range 1 of the snapped base.
// onChange(mark): called when the mark changes, with { kind, id, mode: 'inRange' | 'outOfRange' },
// or with null. The tool turns on every frame of a drag, so the mark is found on every frame.
export function RangeMark({
  rigidRef,
  turn,
  halfLength,
  halfWidth,
  rangeOne,
  snap,
  measuredRef,
  onChange,
}) {
  // The mark of the last onChange call
  const last = useRef(null)

  // A removed tool marks nothing. Scene passes a state setter, so onChange stays the same function.
  const latestOnChange = useLatest(onChange)
  useOnMount(() => () => latestOnChange.current(null))

  useFrame(() => {
    const model = measuredRef.current
    let mark = null
    if (model && snap && rigidRef.current) {
      const reached = rangeOne
        ? withinRangeOne(snap.target, model, halfWidth)
        : footprintGap(
            toolShape(toolPose(rigidRef.current), turn),
            halfLength,
            halfWidth,
            model.getCenter(),
            model.radius,
          ) <= CONTACT_EPS
      mark = { kind: model.kind, id: model.id, mode: reached ? 'inRange' : 'outOfRange' }
    }
    if (sameMark(mark, last.current)) return
    last.current = mark
    onChange(mark)
  })

  return null
}

// The tool's footprint straight below the tool, painted by the table and terrain
// materials on every surface under it that faces up (see footprintProjection.js).
// Follows the body's XZ position and yaw, and the turn of each half. With a target base
// it turns green when the base touches it and red when it does not.
// rangeFrom: on the range 1 tool while snapped, the snapped model, else null. Then, for another
// target, green means the target base is within range 1 of the snapped base (edge to edge, seen
// from above). Touching is not enough there, because the long sides go across the line.
// oneSided: only the right half (the line of the Line of Sight tool, from the center along the yaw). opacity: the
// fill opacity, instead of the default for a selected or free tool.
export function ToolFootprint({
  rigidRef,
  turn,
  halfLength,
  halfWidth,
  selected,
  target,
  rangeFrom,
  oneSided = false,
  opacity,
}) {
  const slotRef = useFootprintSlot()

  useFrame(() => {
    if (!rigidRef.current || !slotRef.current) return
    const shape = toolShape(toolPose(rigidRef.current), turn)
    if (oneSided) shape.left = shape.right

    // Set colors here, not through React state, because contact changes every frame during a drag
    const center = selected && target?.getCenter()
    let fill = FOOTPRINT_COLOR
    if (center) {
      const reached =
        rangeFrom && !sameModel(rangeFrom, target)
          ? withinRangeOne(rangeFrom, target, halfWidth)
          : footprintGap(shape, halfLength, halfWidth, center, target.radius) <= CONTACT_EPS
      fill = reached ? FOOTPRINT_TOUCH : FOOTPRINT_APART
    }
    const line = center ? fill : selected ? '#ffffff' : FOOTPRINT_COLOR
    slotRef.current.set(
      shape,
      halfLength,
      halfWidth,
      fill,
      opacity ?? (selected ? 0.35 : 0.2),
      line,
    )
  })

  return null
}
