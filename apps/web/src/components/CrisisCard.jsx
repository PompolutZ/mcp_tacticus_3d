import { useEffect, useRef, useState } from 'react'
import { useTexture } from '@react-three/drei'
import { DoubleSide } from 'three'
import { assetUrl } from '../assets/index.js'
import { crisisCardFace } from '../crisis/files.js'
import { CARD_WIDTH, CARD_HEIGHT } from '../crisis/layout.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import { useHoverCursor } from './useHoverCursor.js'
import FaceMaterial from './FaceMaterial.jsx'

// The card reads the same way as the scoring board (see crisis/layout.js): the image top faces world
// -X (the table edge) and the image right faces world -Z (the guest side). Rz turns the image in its own
// plane first, then Rx lays it flat, the same way as the mat (see Terrain.jsx and Scene.jsx).
const CARD_ROTATION = [-Math.PI / 2, 0, Math.PI / 2]

// A crisis card face, flat on the table at one end of the scoring board. It does not turn with the
// mat and has no collider. A click opens the full image in a HUD popup (see CardPopup.jsx).
// See docs/features/crisis.md, "Setup flow". onCardHover(card, over): the pointer moved onto or off the card,
// for Alt (useCardPeek.js).
export default function CrisisCard({ cardKey, position, onOpen, onCardHover }) {
  const cardUrl = assetUrl(crisisCardFace(cardKey))
  const map = useTexture(cardUrl)
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef()
  useHoverCursor(hovered, 'pointer')
  useOutline(meshRef, outlineMode(false, hovered))
  useEffect(() => {
    if (!hovered) return undefined
    const card = { src: cardUrl, alt: 'Crisis card', by: `crisis:${cardKey}` }
    onCardHover?.(card, true)
    return () => onCardHover?.(card, false)
  }, [hovered])
  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={CARD_ROTATION}
      onClick={(e) => {
        e.stopPropagation()
        onOpen({ src: cardUrl, alt: 'Crisis card' })
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
      <FaceMaterial map={map} side={DoubleSide} />
    </mesh>
  )
}
