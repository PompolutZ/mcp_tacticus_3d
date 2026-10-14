import { useEffect, useRef } from 'react'
import { OccludedHtml } from './LabelOcclusion.jsx'
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
// dice show that face. A click on a plate with dice rerolls one die of that face, as in TTS.
// state: { well, shelf, critsAvailable }, see DiceTray. actions: the tray's add, remove, roll,
// clear, addCrits and reroll.
// disabled: the other player's tray. Every button is off, a face plate is not a button.
export default function DiceKeys({ state, actions, disabled = false, skip }) {
  const { well, shelf, critsAvailable } = state
  return (
    <>
      <group position={LIP_CENTER} rotation={LIP_ROTATION}>
        <OccludedHtml center transform skip={skip}>
          <div className="dice-keys">
            <button
              type="button"
              className="dice-key dice-key--clear"
              title="Remove all dice"
              disabled={disabled}
              onClick={actions.clear}
            >
              Clear
            </button>
            <button
              type="button"
              className="dice-key dice-key--step"
              title="Remove a die"
              disabled={disabled}
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
              disabled={disabled}
              onClick={actions.add}
            >
              +
            </button>
            <button
              type="button"
              className="dice-key dice-key--roll"
              title="Roll the dice"
              disabled={disabled}
              onClick={actions.roll}
            >
              Roll
            </button>
            <button
              type="button"
              className="dice-key dice-key--crits"
              title="Add a die for each Crit on the shelf, once per roll"
              disabled={disabled || critsAvailable === 0}
              onClick={actions.addCrits}
            >
              +{critsAvailable} Crits
            </button>
          </div>
        </OccludedHtml>
      </group>
      {SYMBOLS.map((symbol) => (
        <FacePlate
          key={symbol}
          symbol={symbol}
          count={shelf[symbol]}
          disabled={disabled}
          skip={skip}
          onClick={() => actions.reroll(symbol)}
        />
      ))}
    </>
  )
}

// One face plate: a clear button the size of the plate, with the count on the half that has no
// icon (TTS shows its count there too). A plate with no dice does nothing, because Reroll needs a
// die with that face.
function FacePlate({ symbol, count, disabled, skip, onClick }) {
  const name = SYMBOL_NAMES[symbol]
  const plateSize = {
    width: FACE_PLATES.width * PX_PER_INCH,
    height: FACE_PLATES.depth * PX_PER_INCH,
  }
  // The count is always in a span: in Safari a flex <button> puts its content in an extra box and
  // the count sinks to the bottom.
  const countBox = (
    <span
      className={disabled ? 'dice-face-key dice-face-key--static' : 'dice-face-key'}
      style={plateSize}
      title={disabled ? name : undefined}
    >
      {count}
    </span>
  )
  return (
    <group
      position={[FACE_PLATES.x[symbol], FACE_PLATES.y, FACE_PLATES.z]}
      rotation={PLATE_ROTATION}
    >
      <OccludedHtml center transform skip={skip}>
        {disabled ? (
          countBox
        ) : (
          <button
            type="button"
            className="dice-face-button"
            style={plateSize}
            title={`${name}: reroll one`}
            disabled={count === 0}
            onClick={onClick}
          >
            {countBox}
          </button>
        )}
      </OccludedHtml>
    </group>
  )
}

// The "Change to" menu of one shelf die: the 5 other faces. A pointerdown outside the menu closes
// it (a pointerdown listener on the document). It is screen-space Html (not transform) in the die's
// body, so it follows the die when the shelf sorts and keeps the normal HUD size at any camera
// distance. symbol: the face of the die now. onChange(toSymbol), onClose(): see DiceTray.
export function DieMenu({ symbol, onChange, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(e) {
      if (menuRef.current?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose])

  return (
    <div ref={menuRef} className="dice-face-menu">
      <span className="group-label">Change to</span>
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
