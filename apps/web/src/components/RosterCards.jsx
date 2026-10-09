import { Suspense, useEffect, useMemo, useState } from 'react'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'
import { assetUrl } from '../assets/index.js'
import { PLATE_COLORS, TAB_OF_KIND, parseRosterText, rosterCard } from '../rosters/cards.js'
import { ROSTER_CARD_Y, rosterLayout } from '../rosters/layout.js'
import { useColorTexture } from './useColorTexture.js'
import { useHoverCursor } from './useHoverCursor.js'

const FLAT = [-Math.PI / 2, 0, 0] // the image top faces local -z, toward the mat, the same as a tray card
const PX_PER_INCH = 100
const GEM_HEIGHT = 0.45
// The gem line lies only 0.003" above its card. A negative polygon offset on its material
// makes it draw on top of the card, so it does not z-fight from a distance.
const GEM_LIFT = 0.003
const NO_RAYCAST = () => null
// A card in the squad gets a frame around it (see docs/feature-setup-game.md, "Squads"). The frame lies
// next to the card, not under it, so the two do not z-fight.
const FRAME_WIDTH = 0.18
const FRAME_COLOR = '#ffd34d'

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
// "No model".
function Plate({ card, info }) {
  const { width, height } = card
  const draw = useMemo(
    () => (ctx, w, h) => {
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
    },
    [card.kind, info],
  )
  const map = useCanvasTexture(width, height, draw)
  return (
    <mesh rotation={FLAT}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={map} roughness={1} side={DoubleSide} />
    </mesh>
  )
}

// A card with an image
function Face({ card, info }) {
  const map = useColorTexture(assetUrl(info.image))
  return (
    <mesh rotation={FLAT}>
      <planeGeometry args={[card.width, card.height]} />
      <meshStandardMaterial map={map} roughness={1} side={DoubleSide} />
    </mesh>
  )
}

// "+ Soul Gem" on the lower edge of a character card. The app has no gem images.
function GemLine({ card, name, index }) {
  const draw = useMemo(
    () => (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${h * 0.6}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`+ ${name}`, w / 2, h / 2 + h * 0.04)
    },
    [name],
  )
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

// The frame of a card in the squad: 4 strips around the card
function SquadFrame({ card }) {
  const { width, height } = card
  const strips = [
    [0, -(height + FRAME_WIDTH) / 2, width + FRAME_WIDTH * 2, FRAME_WIDTH],
    [0, (height + FRAME_WIDTH) / 2, width + FRAME_WIDTH * 2, FRAME_WIDTH],
    [-(width + FRAME_WIDTH) / 2, 0, FRAME_WIDTH, height],
    [(width + FRAME_WIDTH) / 2, 0, FRAME_WIDTH, height],
  ]
  return strips.map(([x, z, w, h], i) => (
    <mesh key={i} position={[x, 0, z]} rotation={FLAT} raycast={NO_RAYCAST}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={FRAME_COLOR} toneMapped={false} />
    </mesh>
  ))
}

// One roster card with its gem lines. A click on the card goes to onOpen, also for a plate: App
// decides if the card can open (see handleRosterOpen). card: { code, kind, gems, x, z, width, height, yaw,
// tab, index }, see rosters/layout.js. selected: the card is in the squad. Also used for the crisis cards
// next to the scoring board (GameSetup.jsx).
export function RosterCard({ card, info, selected = false, onOpen }) {
  const [hovered, setHovered] = useState(false)
  useHoverCursor(hovered, 'pointer')
  return (
    <group
      position={[card.x, ROSTER_CARD_Y, card.z]}
      rotation={[0, card.yaw, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.(card.tab, card.index)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <Suspense fallback={null}>
        {info.image ? <Face card={card} info={info} /> : <Plate card={card} info={info} />}
      </Suspense>
      {selected && <SquadFrame card={card} />}
      {card.gems.map((gem, g) => {
        const gemInfo = rosterCard(gem)
        return gemInfo && <GemLine key={`${g}-${gem}`} card={card} name={gemInfo.name} index={g} />
      })}
    </group>
  )
}

// The character and Team Tactic cards of one team's roster: lie flat on the table, locked, with no physics
// body. See docs/feature-roster.md, "On the table". The crisis cards lie next to the scoring board
// (GameSetup.jsx). code: the stored MCT code (App.jsx, rosters). squad: the places of the cards in the
// squad, { characters, tactics } (setup/setup.js). onOpen(tab, index): a click on a card, see RosterPopup.jsx.
// tab: a key of ROSTER_TABS, index: the place of the card in that tab. In the characters and tactics tabs,
// the place in the tab is the place in the roster list.
export default function RosterCards({ team, code, squad, onOpen }) {
  const cards = useMemo(() => {
    // rosterLayout keeps the card order of rosterTabs (cards.js), so a count per tab gives the index.
    const next = { characters: 0, tactics: 0 }
    return rosterLayout(team, parseRosterText(code)).map((card) => {
      const tab = TAB_OF_KIND[card.kind]
      return { ...card, tab, index: next[tab]++ }
    })
  }, [team, code])
  return cards.map((card, i) => {
    const info = rosterCard(card.code)
    const selected = squad?.[card.tab]?.includes(card.index) ?? false
    return (
      info && (
        <RosterCard
          key={`${i}-${card.code}`}
          card={card}
          info={info}
          selected={selected}
          onOpen={onOpen}
        />
      )
    )
  })
}
