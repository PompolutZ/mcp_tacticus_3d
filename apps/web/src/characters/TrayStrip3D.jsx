import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { useTexture } from '@react-three/drei'
import { OccludedHtml } from '../scene/LabelOcclusion.jsx'
import { useHoverCursor } from '../scene/useHoverCursor.js'
import { attachedCards } from '../rosters/cards.js'
import { COUNTER_ICONS } from './trayIcons.js'
import {
  CLICK_MOVE,
  applyCounter,
  counterStep,
  counterZone,
  removeState,
  trayCounters,
} from './trayControls.js'
import { PX_PER_INCH, drawChip, drawCounter } from './trayStripDraw.js'
import { stripLayout } from './trayStrip.js'

// The controls strip of a 3D tray, drawn in the canvas: the Damage and Power counters, a chip for each
// attached card, Flip and Remove. Each part is one flat plane with its own canvas texture, so the depth
// test hides it behind a model that stands on the tray card (a DOM element would draw on top of the
// canvas). The DOM version (TrayControls.jsx) stays for the tray popup. What a click does comes from
// trayControls.js, the layout from trayStrip.js, the painting from trayStripDraw.js. See
// docs/features/character-trays.md, "Controls".
// The parent places the strip flat on the table: Rx(-pi/2), so the strip's up (+y) is the mat side.
// Props are those of TrayControls. The other player's tray looks and works the same.

const NO_POINTER = { pointerEvents: 'none' }
// Only the nearest hit counts: a model that stands in front of a part hides it from the pointer too,
// the same check as the tray card's click (CharacterTray.jsx, openPopup).
const onTop = (e) => e.intersections[0]?.object === e.object

export default function TrayStrip3D({
  character,
  stamina,
  onDamage,
  onPower,
  onFlip,
  onRemove,
  onBoard,
  removeWait = null,
  onAttachedOpen,
}) {
  const grunt = Boolean(character.host)
  const gems = attachedCards(character)
  const layout = useMemo(
    () => stripLayout({ grunt, gems: gems.map((g) => g.label) }),
    // The labels, not the array, which is new on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grunt, gems.map((g) => g.label).join('|')],
  )
  const byId = Object.fromEntries(layout.elements.map((el) => [el.id, el]))
  const icons = useTexture([COUNTER_ICONS.damage, COUNTER_ICONS.power])
  const iconOf = { damage: icons[0].image, power: icons[1].image }
  const handlers = { onDamage, onPower }
  const remove = removeState({ onBoard, removeWait })

  return (
    <group>
      {trayCounters(character, stamina).map((c) => (
        <Counter3D
          key={c.kind}
          el={byId[c.kind]}
          counter={c}
          icon={iconOf[c.kind]}
          onStep={(step) => applyCounter(character, c.kind, step, handlers)}
        />
      ))}
      {gems.map((card, i) => (
        <Chip3D
          key={card.code}
          el={byId[`gem:${i}`]}
          text={card.label}
          hint={card.name}
          onClick={() => onAttachedOpen?.(card.code)}
        />
      ))}
      {!grunt && <Chip3D el={byId.flip} text="Flip" onClick={onFlip} />}
      <Chip3D
        el={byId.remove}
        text="Remove"
        warn
        disabled={remove.disabled}
        hint={remove.title}
        onClick={() => {
          if (!remove.disabled) onRemove()
        }}
      />
    </group>
  )
}

// A flat plane at the element's place with a canvas texture. The texture and its canvas are made once and
// freed with the part; draw(ctx) repaints it when it changes (the values, the hover).
function repaint(canvas, texture, draw) {
  draw(canvas.getContext('2d'))
  texture.needsUpdate = true
}

function useDrawn(width, height, draw) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * PX_PER_INCH)
    canvas.height = Math.round(height * PX_PER_INCH)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return { canvas, texture }
  }, [width, height])
  useEffect(() => () => texture.dispose(), [texture])
  useLayoutEffect(() => {
    repaint(canvas, texture, draw)
  }, [canvas, texture, draw])
  return texture
}

function Plane({ el, map, ...events }) {
  return (
    <mesh position={[el.x, el.y, 0]} {...events}>
      <planeGeometry args={[el.w, el.h]} />
      <meshBasicMaterial map={map} transparent toneMapped={false} />
    </mesh>
  )
}

// Left click on the + button or the body adds 1, on the - button takes 1; a right click on the body takes 1
// and shows no browser menu (counterStep).
function Counter3D({ el, counter, icon, onStep }) {
  const [hover, setHover] = useState(null)
  useHoverCursor(hover !== null, 'pointer')
  const { value, max, warn } = counter
  const draw = useMemo(
    () => (ctx) => drawCounter(ctx, el.w, el.h, { icon, value, max, warn, hover }),
    [el.w, el.h, icon, value, max, warn, hover],
  )
  const map = useDrawn(el.w, el.h, draw)
  const zoneOf = (e) => counterZone(e.object.worldToLocal(e.point.clone()).x, el.w)
  return (
    <Plane
      el={el}
      map={map}
      onPointerMove={(e) => {
        if (!onTop(e)) return setHover(null)
        e.stopPropagation()
        setHover(zoneOf(e))
      }}
      onPointerOut={() => setHover(null)}
      onClick={(e) => {
        if (!onTop(e)) return
        e.stopPropagation()
        if (e.delta <= CLICK_MOVE) onStep(counterStep(zoneOf(e), 0))
      }}
      onContextMenu={(e) => {
        if (!onTop(e)) return
        e.stopPropagation()
        e.nativeEvent.preventDefault()
        if (e.delta <= CLICK_MOVE) onStep(counterStep(zoneOf(e), 2))
      }}
    />
  )
}

// The chip textures are shared by every tray: one per text and look (Flip and Remove are the same on all
// of them). Counted, so the last chip that uses a texture frees it.
const chipTextures = new Map()

function useChipTexture(width, height, look) {
  const key = `${look.text}|${width}|${look.warn}|${look.disabled}|${look.hover}`
  const entry = useMemo(() => {
    const found = chipTextures.get(key)
    if (found) return found
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * PX_PER_INCH)
    canvas.height = Math.round(height * PX_PER_INCH)
    drawChip(canvas.getContext('2d'), width, height, look)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    const made = { texture, uses: 0 }
    chipTextures.set(key, made)
    return made
    // look is read through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width, height])
  useEffect(() => {
    chipTextures.set(key, entry)
    entry.uses += 1
    return () => {
      entry.uses -= 1
      if (entry.uses > 0) return
      entry.texture.dispose()
      if (chipTextures.get(key) === entry) chipTextures.delete(key)
    }
  }, [key, entry])
  return entry.texture
}

// A chip: Flip, Remove or a gem. hint: the text of a label above it while the pointer is over it (the
// title of the DOM chip). disabled: faded, with the not-allowed cursor, and the click is up to onClick.
function Chip3D({ el, text, warn = false, disabled = false, hint = null, onClick }) {
  const [hover, setHover] = useState(false)
  useHoverCursor(hover, disabled ? 'not-allowed' : 'pointer')
  const map = useChipTexture(el.w, el.h, { text, warn, disabled, hover: hover && !disabled })
  return (
    <>
      <Plane
        el={el}
        map={map}
        onPointerOver={(e) => {
          if (!onTop(e)) return
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => {
          if (!onTop(e)) return
          e.stopPropagation()
          if (e.delta <= CLICK_MOVE) onClick()
        }}
      />
      {hover && hint && (
        <group position={[el.x, el.y, 0.05]}>
          <OccludedHtml center style={NO_POINTER}>
            <div className="token-face-label">{hint}</div>
          </OccludedHtml>
        </group>
      )}
    </>
  )
}
