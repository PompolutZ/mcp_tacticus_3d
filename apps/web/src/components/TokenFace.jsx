import { useEffect, useState } from 'react'
import { Html, useTexture } from '@react-three/drei'
import { assetUrl } from '../assets/index.js'
import { TOKEN_SIZE, characterToken } from '../tokens/files.js'
import { TOKEN_THICKNESS } from '../tokens/solid.js'
import { getToken } from '../tokens/tokens.js'
import TokenSolid from './TokenSolid.jsx'
import { useHoverCursor } from './useHoverCursor.js'

// The count badge sits on the token's bottom right corner, as seen by the owner of its tray, just above
// the token's top
const BADGE_POSITION = [TOKEN_SIZE / 2 - 0.06, TOKEN_THICKNESS + 0.01, TOKEN_SIZE / 2 - 0.06]
// Rx(-pi/2) lays an Html transform flat on the table, facing up, with its top to local -z (see
// CharacterTray.jsx, the controls strip).
const FLAT = [-Math.PI / 2, 0, 0]
// The name label floats above the token, so the pointer and the token do not hide it.
const LABEL_POSITION = [0, 0.4, -TOKEN_SIZE / 2]
// Without an <Html transform>, drei ignores its pointerEvents prop, and its wrapper div takes the
// pointer. That div is as big as the label and covers the token on screen, so R3F reads the pointer
// position inside the div, loses the token, the label hides, and then shows again (flicker).
const NO_POINTER = { pointerEvents: 'none' }
const NO_RAYCAST = () => null

// One character token, real size (TOKEN_SIZE) and TOKEN_THICKNESS thick, with its bottom at y = 0, its
// image facing up and the image top to local -z. The solid has the outline of the image (see
// tokens/solid.js), so the pointer hits only the token and not the transparent corners of its image.
// Used for the tray's "On" row and Give sources (CharacterTray.jsx), the tokens on the table
// (LooseToken.jsx), and the token under the pointer during a drag (TokenDragPreview.jsx).
// count: shown on a badge when above 1. cursor: the canvas cursor while the pointer is over the
// token. interactive false: the token gets no pointer events, so it does not hide what is under it.
// While the pointer is over the token, a label shows its name and the mod's description, as the
// tooltip of a token chip did before.
export default function TokenFace({
  tokenKey,
  count = 1,
  cursor = 'pointer',
  interactive = true,
  onPointerDown,
  onClick,
  onHover,
}) {
  const map = useTexture(assetUrl(characterToken(tokenKey)))
  const token = getToken(tokenKey)
  const [hovered, setHovered] = useState(false)
  useHoverCursor(hovered, cursor)
  // onHover(true) while the pointer is over the token, onHover(false) after. The cleanup also runs
  // on unmount, so a removed token does not stay hovered.
  useEffect(() => {
    if (!hovered) return undefined
    onHover?.(true)
    return () => onHover?.(false)
  }, [hovered])

  const events = interactive
    ? {
        onPointerDown,
        onClick,
        onPointerOver: (e) => {
          e.stopPropagation()
          setHovered(true)
        },
        onPointerOut: () => setHovered(false),
      }
    : { raycast: NO_RAYCAST }

  return (
    <group>
      <TokenSolid map={map} size={TOKEN_SIZE} {...events} />
      {count > 1 && (
        <group position={BADGE_POSITION} rotation={FLAT}>
          <Html center transform pointerEvents="none">
            <span className="token-face-count">{count}</span>
          </Html>
        </group>
      )}
      {hovered && token && (
        <Html position={LABEL_POSITION} center style={NO_POINTER}>
          <div className="token-face-label">
            <strong>{token.name}</strong>
            {token.description && <span>{token.description}</span>}
          </div>
        </Html>
      )}
    </group>
  )
}
