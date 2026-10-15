import { useFrame } from '@react-three/fiber'
import { useFootprintSlot, FOOTPRINT_APART, FOOTPRINT_COLOR } from './footprintProjection.js'

const FILL_OPACITY = 0.35
const LINE = '#ffffff'

// The footprint of a dragged piece on the table or terrain under it (decision 18). Mount it only
// during the drag: it takes a slot on mount and gives it back on unmount.
// getShape(): read each frame. A circle { x, z, radius }, a long rectangle { x, z, angle, halfLength,
// halfWidth }, or null (the pointer is off the table): the footprint is hidden then.
// getApart(): optional, true shows the red color (a model over another model).
// Both are functions, not values, because the pose changes every frame, outside React state.
export default function DragFootprint({ getShape, getApart }) {
  const slotRef = useFootprintSlot()

  useFrame(() => {
    const slot = slotRef.current
    if (!slot) return
    const shape = getShape()
    if (!shape) {
      slot.hide()
      return
    }
    const fill = getApart?.() ? FOOTPRINT_APART : FOOTPRINT_COLOR
    if (shape.radius !== undefined) {
      slot.setCircle(shape.x, shape.z, shape.radius, fill, FILL_OPACITY, LINE)
    } else {
      // The two halves point opposite ways, so they make one rectangle through the center.
      // angle: the direction (cos a, 0, -sin a) of the long side, as in RulerTool. halfLength must
      // be at least halfWidth, because the round hinge at the center has the radius halfWidth.
      slot.set(
        { x: shape.x, z: shape.z, right: shape.angle, left: shape.angle + Math.PI },
        shape.halfLength,
        shape.halfWidth,
        fill,
        FILL_OPACITY,
        LINE,
      )
    }
  })

  return null
}
