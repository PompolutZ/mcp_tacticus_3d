import { useEffect, useMemo, useState } from 'react'
import { Html, useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Mesh } from 'three'
import { assetUrl } from '../assets/index.js'
import { TOKEN_SIZE, characterToken } from '../tokens/files.js'
import { getToken } from '../tokens/tokens.js'

// The token images have transparent corners: a circle or a rounded diamond fills the square.
// alphaTest drops those pixels, so the square plane shows the token's own shape.
const ALPHA_TEST = 0.5
// The count badge sits on the token's bottom right corner, as seen by the owner of its tray.
const BADGE_POSITION = [TOKEN_SIZE / 2 - 0.06, 0.01, TOKEN_SIZE / 2 - 0.06]
// Rx(-pi/2) lays an Html transform flat on the table, facing up, with its top to local -z (see
// CharacterTray.jsx, the controls strip).
const FLAT = [-Math.PI / 2, 0, 0]
// The name label floats above the token, so the pointer and the token do not hide it.
const LABEL_POSITION = [0, 0.4, -TOKEN_SIZE / 2]
const NO_RAYCAST = () => null

// Pixels of each token image, read once per image: image -> { data, width, height }
const imagePixels = new WeakMap()

// Alpha (0..1) of the texture's image at a hit's uv. The texture has the default flipY, so
// uv.y = 1 is the top row of the image.
function alphaAt(texture, uv) {
  const image = texture.image
  let pixels = imagePixels.get(image)
  if (!pixels) {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    pixels = { data: context.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height }
    imagePixels.set(image, pixels)
  }
  const x = Math.min(pixels.width - 1, Math.floor(uv.x * pixels.width))
  const y = Math.min(pixels.height - 1, Math.floor((1 - uv.y) * pixels.height))
  return pixels.data[(y * pixels.width + x) * 4 + 3] / 255
}

// One character token, flat and real size (TOKEN_SIZE), with its image facing up and the image
// top to local -z. Used for the tray's "On" row and Give sources (CharacterTray.jsx), the tokens
// on the table (LooseToken.jsx), and the token under the pointer during a drag (TokenDragPreview.jsx).
// count: shown on a badge when above 1. cursor: the canvas cursor while the pointer is over the
// token. interactive false: the token gets no pointer events, so it does not hide what is under it.
// While the pointer is over the token, a label shows its name and the mod's description, as the
// tooltip of a token chip did before.
export default function TokenFace({ tokenKey, count = 1, cursor = 'pointer', interactive = true, onPointerDown, onClick, onHover }) {
  const map = useTexture(assetUrl(characterToken(tokenKey)))
  const token = getToken(tokenKey)
  const gl = useThree(state => state.gl)
  const [hovered, setHovered] = useState(false)
  // The pointer hits only the pixels that alphaTest draws, not the transparent corners of the
  // square plane. Otherwise a corner next to a round or diamond token, which looks like empty
  // table, would show the token's label.
  const raycast = useMemo(() => function raycastVisible(raycaster, intersects) {
    const hits = []
    Mesh.prototype.raycast.call(this, raycaster, hits)
    for (const hit of hits) if (hit.uv && alphaAt(map, hit.uv) >= ALPHA_TEST) intersects.push(hit)
  }, [map])

  // onHover(true) while the pointer is over the token, onHover(false) after. The cleanup also runs
  // on unmount, so a removed token does not stay hovered and does not keep its cursor.
  useEffect(() => {
    if (!hovered) return undefined
    gl.domElement.style.cursor = cursor
    onHover?.(true)
    return () => {
      gl.domElement.style.cursor = ''
      onHover?.(false)
    }
  }, [hovered])

  const events = interactive
    ? {
        raycast,
        onPointerDown,
        onClick,
        onPointerOver: e => { e.stopPropagation(); setHovered(true) },
        onPointerOut: () => setHovered(false),
      }
    : { raycast: NO_RAYCAST }

  return (
    <group>
      <mesh rotation={FLAT} {...events}>
        <planeGeometry args={[TOKEN_SIZE, TOKEN_SIZE]} />
        <meshStandardMaterial map={map} alphaTest={ALPHA_TEST} roughness={1} />
      </mesh>
      {count > 1 && (
        <group position={BADGE_POSITION} rotation={FLAT}>
          <Html center transform pointerEvents="none">
            <span className="token-face-count">{count}</span>
          </Html>
        </group>
      )}
      {hovered && token && (
        <Html position={LABEL_POSITION} center>
          <div className="token-face-label">
            <strong>{token.name}</strong>
            {token.description && <span>{token.description}</span>}
          </div>
        </Html>
      )}
    </group>
  )
}
