import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, SRGBColorSpace } from 'three'
import { assetUrl } from '../assets/index.js'
import { COLOR_TINT, PRIORITY_MARKER_SIZE, priorityMarkerSpot } from '../scoreboard/board.js'
import { PRIORITY_TEXTURE } from '../scoreboard/files.js'
import { useSideColor } from '../sideColors.js'
import TokenSolid from './TokenSolid.jsx'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import { useHoverCursor } from './useHoverCursor.js'
import { SURFACE_GAP } from '../pieces/heights.js'

// The marker closes the distance to its spot with 1 - e^(-dt / SLIDE_TIME) of what is left per frame, so
// the slide takes about 0.4 s (4 × SLIDE_TIME leaves 2%)
const SLIDE_TIME = 0.1

// The face of the marker (the Priority Token of the mod), with the edge in the color of the side that has
// Priority
function MarkerSolid({ side }) {
  const map = useTexture(assetUrl(PRIORITY_TEXTURE))
  const color = useSideColor(side)
  const edgeColor = useMemo(() => new Color().setRGB(...COLOR_TINT[color], SRGBColorSpace), [color])
  return <TokenSolid map={map} size={PRIORITY_MARKER_SIZE} edgeColor={edgeColor} />
}

// The Priority marker: a token that lies by the end of the scoring board nearer the side that has Priority.
// When Priority changes it slides to the other spot, in both browsers (each one reads the document). A click
// gives Priority to the other side: any player can click, because cards change Priority. No confirm. See
// docs/features/round-phases.md, "Priority marker".
// priority: the side that has Priority, or null (no marker). title: the text of the hover tip, with names.
// onClick: gives Priority to the other side.
export default function PriorityMarker({ priority, title, onClick }) {
  const gl = useThree((state) => state.gl)
  const groupRef = useRef()
  // Where the marker is now. null while it is hidden, so the first spot is not a slide.
  const poseRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  useFrame((_, dt) => {
    const group = groupRef.current
    if (!group || !priority) {
      poseRef.current = null
      return
    }
    const spot = priorityMarkerSpot(priority)
    const pose = poseRef.current ?? spot
    const k = poseRef.current ? 1 - Math.exp(-dt / SLIDE_TIME) : 1
    poseRef.current = { x: pose.x + (spot.x - pose.x) * k, z: pose.z + (spot.z - pose.z) * k }
    group.position.set(poseRef.current.x, SURFACE_GAP, poseRef.current.z)
  })

  useHoverCursor(hovered && Boolean(priority), 'pointer')
  useOutline(groupRef, outlineMode(false, hovered && Boolean(priority)))

  // The title of the canvas is the tip of the browser while the pointer is on the marker
  useEffect(() => {
    if (!hovered || !priority) return undefined
    const canvas = gl.domElement
    const before = canvas.getAttribute('title')
    canvas.setAttribute('title', title)
    return () => {
      if (before === null) canvas.removeAttribute('title')
      else canvas.setAttribute('title', before)
    }
  }, [hovered, priority, title, gl])

  if (!priority) return null
  const spot = priorityMarkerSpot(priority)
  return (
    <group
      ref={groupRef}
      position={[spot.x, SURFACE_GAP, spot.z]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <Suspense fallback={null}>
        <MarkerSolid side={priority} />
      </Suspense>
    </group>
  )
}
