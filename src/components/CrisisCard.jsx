import { useState } from 'react'
import { useTexture } from '@react-three/drei'
import { DoubleSide } from 'three'
import { assetUrl } from '../assets/index.js'
import { crisisCardFace } from '../crisis/files.js'
import { CARD_WIDTH, CARD_HEIGHT } from '../crisis/layout.js'
import { useHoverCursor } from './useHoverCursor.js'

// The card reads the same way as the scoring board (see crisis/layout.js): the image top faces world
// -X (the table edge) and the image right faces world -Z (the red side). Rz turns the image in its own
// plane first, then Rx lays it flat, the same way as the mat (see Terrain.jsx and Scene.jsx).
const CARD_ROTATION = [-Math.PI / 2, 0, Math.PI / 2]

// A crisis card face, flat on the table at one end of the scoring board. It does not turn with the
// mat and has no collider. A click opens the full image in a HUD popup (see CardPopup.jsx).
// See docs/feature-crisis.md, "Setup flow".
export default function CrisisCard({ cardKey, position, onOpen }) {
  const cardUrl = assetUrl(crisisCardFace(cardKey))
  const map = useTexture(cardUrl)
  const [hovered, setHovered] = useState(false)
  useHoverCursor(hovered, 'pointer')
  return (
    <mesh
      position={position}
      rotation={CARD_ROTATION}
      onClick={e => { e.stopPropagation(); onOpen({ src: cardUrl, alt: 'Crisis card' }) }}
      onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
      <meshStandardMaterial map={map} roughness={1} side={DoubleSide} />
    </mesh>
  )
}
