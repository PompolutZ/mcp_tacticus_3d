import { Suspense, useEffect, useMemo, useState } from 'react'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'
import { assetUrl } from '../assets/index.js'
import { parseRosterText, rosterCard } from '../rosters/cards.js'
import { ROSTER_CARD_Y, rosterLayout } from '../rosters/layout.js'
import { useColorTexture } from './useColorTexture.js'
import { useHoverCursor } from './useHoverCursor.js'

const FLAT = [-Math.PI / 2, 0, 0] // the image top faces local -z, toward the mat, the same as a tray card
const PX_PER_INCH = 100
const PLATE_COLORS = { character: '#3a4658', tactic: '#4a3f5c', secure: '#3d5a4a', extract: '#5c4a3d' }
const GEM_HEIGHT = 0.45
// The gem line lies only 0.003" above its card. A negative polygon offset on its material
// makes it draw on top of the card, so it does not z-fight from a distance.
const GEM_LIFT = 0.003
const NO_RAYCAST = () => null

// A CanvasTexture that draws on a canvas of width x height inches. draw(ctx, w, h) gets pixel sizes.
// The texture is freed when the component goes away.
function useCanvasTexture(width, height, draw) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * PX_PER_INCH))
    canvas.height = Math.max(1, Math.round(height * PX_PER_INCH))
    draw(canvas.getContext('2d'), canvas.width, canvas.height)
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
    // draw only reads the other values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, draw])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

// Splits text into lines of at most maxWidth pixels
function wrapLines(ctx, text, maxWidth) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

// A card without an image: a plain plate with the name, the MCT code and, for a character without a model,
// "No model". It takes no pointer events, so the pointer works as over the empty table.
function Plate({ card, info }) {
  const { width, height } = card
  const draw = useMemo(() => (ctx, w, h) => {
    ctx.fillStyle = PLATE_COLORS[card.kind]
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, w - 4, h - 4)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size = Math.min(h * 0.16, w * 0.12)
    ctx.font = `bold ${size}px sans-serif`
    const lines = wrapLines(ctx, info.name, w * 0.9)
    const lineHeight = size * 1.15
    const total = lines.length * lineHeight + size * 1.8
    let y = (h - total) / 2 + lineHeight / 2
    for (const line of lines) {
      ctx.fillText(line, w / 2, y)
      y += lineHeight
    }
    ctx.font = `${size * 0.8}px monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(info.code, w / 2, y + size * 0.2)
    if (info.kind === 'character' && !info.model) {
      ctx.font = `bold ${size * 0.7}px sans-serif`
      ctx.fillStyle = '#e8b04a'
      ctx.fillText('No model', w / 2, y + size * 1.1)
    }
  }, [card.kind, info])
  const map = useCanvasTexture(width, height, draw)
  return (
    <mesh rotation={FLAT} raycast={NO_RAYCAST}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={map} roughness={1} side={DoubleSide} />
    </mesh>
  )
}

// A card with an image. A click opens it in the card popup.
function Face({ card, info, onOpen }) {
  const url = assetUrl(info.image)
  const map = useColorTexture(url)
  const [hovered, setHovered] = useState(false)
  useHoverCursor(hovered, 'pointer')
  return (
    <mesh
      rotation={FLAT}
      onClick={e => { e.stopPropagation(); onOpen?.({ src: url, alt: info.name }) }}
      onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[card.width, card.height]} />
      <meshStandardMaterial map={map} roughness={1} side={DoubleSide} />
    </mesh>
  )
}

// "+ Soul Gem" on the lower edge of a character card. The app has no gem images.
function GemLine({ card, name, index }) {
  const draw = useMemo(() => (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${h * 0.6}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`+ ${name}`, w / 2, h / 2 + h * 0.04)
  }, [name])
  const height = GEM_HEIGHT * (card.height / 3)
  const map = useCanvasTexture(card.width, height, draw)
  // Local +z is the lower edge of the card. A second gem lies above the first.
  const z = card.height / 2 - height / 2 - index * height
  return (
    <mesh position={[0, GEM_LIFT, z]} rotation={FLAT} raycast={NO_RAYCAST}>
      <planeGeometry args={[card.width, height]} />
      <meshBasicMaterial
        map={map}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        side={DoubleSide}
      />
    </mesh>
  )
}

// The roster cards of one team: lie flat on the table, locked, with no physics body.
// See docs/feature-roster.md, "On the table". code: the stored MCT code (App.jsx, rosters).
// onOpen({ src, alt }): a click on a card with an image opens it in the card popup.
export default function RosterCards({ team, code, onOpen }) {
  const cards = useMemo(() => rosterLayout(team, parseRosterText(code)), [team, code])
  return cards.map((card, i) => {
    const info = rosterCard(card.code)
    if (!info) return null
    return (
      <group key={`${i}-${card.code}`} position={[card.x, ROSTER_CARD_Y, card.z]} rotation={[0, card.yaw, 0]}>
        <Suspense fallback={null}>
          {info.image ? <Face card={card} info={info} onOpen={onOpen} /> : <Plate card={card} info={info} />}
        </Suspense>
        {card.gems.map((gem, g) => {
          const gemInfo = rosterCard(gem)
          return gemInfo && <GemLine key={`${g}-${gem}`} card={card} name={gemInfo.name} index={g} />
        })}
      </group>
    )
  })
}
