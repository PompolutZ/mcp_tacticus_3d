import { useTexture } from '@react-three/drei'
import { DoubleSide } from 'three'
import { assetUrl } from '../assets/index.js'
import { crisisCardFace } from '../crisis/files.js'
import { CARD_WIDTH, CARD_HEIGHT } from '../crisis/layout.js'

// A crisis card face, flat on the table next to the scoring board. It does not turn with the mat
// and has no collider. A click opens the full image in a HUD popup (see CardPopup.jsx).
// The plane is rotated the same way as the mat and the table (see Terrain.jsx and Scene.jsx), so
// local +Y of the image (its top) faces world -Z, the red side. See docs/feature-crisis.md, "Setup flow".
export default function CrisisCard({ cardKey, position, onOpen }) {
  const map = useTexture(assetUrl(crisisCardFace(cardKey)))
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} onClick={e => { e.stopPropagation(); onOpen() }}>
      <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
      <meshStandardMaterial map={map} roughness={1} side={DoubleSide} />
    </mesh>
  )
}
