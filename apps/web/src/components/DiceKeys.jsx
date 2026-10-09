import { useEffect, useRef } from 'react'
import { Html } from '@react-three/drei'
import { assetUrl } from '../assets/index.js'
import { SYMBOLS, SYMBOL_NAMES } from '../dice/faces.js'
import { FACE_PLATES, KEYS_LIP } from '../dice/tray.js'

// drei's Html transform draws 1 CSS px as 10 / 400 world units (its default distanceFactor, see
// getObjectCSSMatrix in drei's Html.js), so 1" of the table is 40 CSS px.
const PX_PER_INCH = 40

// The lip's angle from flat, and its center, in tray space (see KEYS_LIP in tray.js).
const LIP_TILT = Math.atan2(KEYS_LIP.high.y - KEYS_LIP.low.y, KEYS_LIP.high.z - KEYS_LIP.low.z)
const LIP_CENTER = [
  0,
  (KEYS_LIP.low.y + KEYS_LIP.high.y) / 2,
  (KEYS_LIP.low.z + KEYS_LIP.high.z) / 2,
]

// Html transform lays its element in the local XY plane of its group, facing +Z. Rx(PI/2 - tilt)
// * Ry(PI) turns that plane so the element faces up and toward the player (tray-space -z), tilted
// by `tilt`. Its right is then tray-space -x, the player's right, and its top points away from the
// player, so the player reads it the right way up.
function surfaceRotation(tilt) {
  return [Math.PI / 2 - tilt, Math.PI, 0]
}
const LIP_ROTATION = surfaceRotation(LIP_TILT)
const PLATE_ROTATION = surfaceRotation(0)

function iconUrl(symbol) {
  return assetUrl(`dice/icons/${symbol}.webp`)
}

// The keys of one dice tray, drawn on the tray itself, as in TTS. Must be a child of the tray body
// (tray space, see tray.js). The lip on the player's side has Clear, -, the count of dice not on
// the shelf, +, Roll and +N Crits. Each face plate on the rim past the shelf shows how many shelf
// dice show that face. A click on a plate opens its "Reroll one / Change one to" menu.
// state: { well, shelf, critsAvailable }, see DiceTray. actions: the tray's add, remove, roll,
// clear, addCrits, reroll and change. openMenuSymbol: the symbol whose menu is open on this tray,
// or null. onMenuToggle/onMenuClose: lifted to App so Escape can close the menu.
export default function DiceKeys({ state, actions, openMenuSymbol, onMenuToggle, onMenuClose }) {
  const { well, shelf, critsAvailable } = state
  return (
    <>
      <group position={LIP_CENTER} rotation={LIP_ROTATION}>
        <Html center transform>
          <div className="dice-keys">
            <button
              type="button"
              className="dice-key dice-key--clear"
              title="Remove all dice"
              onClick={actions.clear}
            >
              Clear
            </button>
            <button
              type="button"
              className="dice-key dice-key--step"
              title="Remove a die"
              onClick={actions.remove}
            >
              −
            </button>
            <span className="dice-key dice-key--count" title="Dice not on the shelf">
              {well}
            </span>
            <button
              type="button"
              className="dice-key dice-key--step"
              title="Add a die"
              onClick={actions.add}
            >
              +
            </button>
            <button
              type="button"
              className="dice-key dice-key--roll"
              title="Roll the dice"
              onClick={actions.roll}
            >
              Roll
            </button>
            <button
              type="button"
              className="dice-key dice-key--crits"
              title="Add a die for each Crit on the shelf, once per roll"
              disabled={critsAvailable === 0}
              onClick={actions.addCrits}
            >
              +{critsAvailable} Crits
            </button>
          </div>
        </Html>
      </group>
      {SYMBOLS.map((symbol) => (
        <FacePlate
          key={symbol}
          symbol={symbol}
          count={shelf[symbol]}
          menuOpen={openMenuSymbol === symbol}
          onToggle={() => onMenuToggle(symbol)}
          onReroll={() => {
            actions.reroll(symbol)
            onMenuClose()
          }}
          onChange={(toSymbol) => {
            actions.change(symbol, toSymbol)
            onMenuClose()
          }}
          onMenuClose={onMenuClose}
        />
      ))}
    </>
  )
}

// One face plate: a clear button the size of the plate, with the count on the half that has no
// icon (TTS shows its count there too). A plate with no dice does nothing, because Reroll and
// Change need a die with that face. The menu is screen-space Html (not transform), anchored at the
// plate, so it keeps the normal HUD size at any camera distance.
function FacePlate({ symbol, count, menuOpen, onToggle, onReroll, onChange, onMenuClose }) {
  const name = SYMBOL_NAMES[symbol]
  return (
    <group
      position={[FACE_PLATES.x[symbol], FACE_PLATES.y, FACE_PLATES.z]}
      rotation={PLATE_ROTATION}
    >
      <Html center transform>
        <button
          type="button"
          className="dice-face-key"
          style={{
            width: FACE_PLATES.width * PX_PER_INCH,
            height: FACE_PLATES.depth * PX_PER_INCH,
          }}
          title={`${name}: reroll one or change one`}
          disabled={count === 0}
          onClick={onToggle}
        >
          {count}
        </button>
      </Html>
      {menuOpen && (
        <Html>
          <FaceMenu symbol={symbol} onReroll={onReroll} onChange={onChange} onClose={onMenuClose} />
        </Html>
      )}
    </group>
  )
}

// The "Reroll one / Change one to" menu of one face plate. A pointerdown outside the menu closes
// it (a pointerdown listener on the document). A pointerdown on a face plate does not:
// the click that follows toggles this menu, or opens the other plate's menu (App keeps one open).
function FaceMenu({ symbol, onReroll, onChange, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(e) {
      if (menuRef.current?.contains(e.target) || e.target.closest?.('.dice-face-key')) return
      onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose])

  return (
    <div ref={menuRef} className="dice-face-menu">
      <button type="button" className="chip" onClick={onReroll}>
        Reroll one
      </button>
      <span className="group-label">Change one to</span>
      {SYMBOLS.filter((other) => other !== symbol).map((other) => (
        <button
          key={other}
          type="button"
          className="chip dice-face-menu-item"
          onClick={() => onChange(other)}
        >
          <img src={iconUrl(other)} alt={SYMBOL_NAMES[other]} className="dice-face-menu-icon" />
          {SYMBOL_NAMES[other]}
        </button>
      ))}
    </div>
  )
}
