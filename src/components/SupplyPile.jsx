import { Suspense, useState } from 'react'
import { useTexture } from '@react-three/drei'
import { assetUrl } from '../assets/index.js'
import { crisisToken } from '../crisis/files.js'
import { CRISIS_TOKEN_SIZE } from '../crisis/layout.js'
import TokenSolid from './TokenSolid.jsx'
import { useHoverCursor } from './useHoverCursor.js'

// Gap between the table and the pile, the same as LooseToken.jsx
const GAP = 0.02

// One crisis token as a solid, CRISIS_TOKEN_SIZE wide, with its bottom at y = 0. Used for the supply
// pile below and for the token under the pointer while it is dragged from the pile (Scene.jsx,
// TokenDragPreview). Other props go to the mesh, for example pointer events.
export function SupplyToken({ tokenKey, ...props }) {
  const map = useTexture(assetUrl(crisisToken(tokenKey)))
  return <TokenSolid map={map} size={CRISIS_TOKEN_SIZE} {...props} />
}

// The supply of a Source card (Asset or Civilian), next to its card (crisis/layout.js,
// supplyPilePosition). It never runs out, the same as a Give source of a tray: a left drag takes a
// new token from it (App.jsx, handleSupplyDragStart). The pile itself never moves. It lies on the
// table, which is flat there, so it does not look for the ground under it.
// tokenKey: the supply token key (cards.json, supply). position: { x, z }.
// onDragStart(nativeEvent): a left pointerdown on the pile.
export default function SupplyPile({ tokenKey, position, onDragStart }) {
  const [hovered, setHovered] = useState(false)
  useHoverCursor(hovered, 'grab')

  function handlePointerDown(e) {
    // Only the left button takes a token. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    onDragStart(e.nativeEvent)
  }

  return (
    <group position={[position.x, GAP, position.z]}>
      <Suspense fallback={null}>
        <SupplyToken
          tokenKey={tokenKey}
          onPointerDown={handlePointerDown}
          onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
          onPointerOut={() => setHovered(false)}
        />
      </Suspense>
    </group>
  )
}
