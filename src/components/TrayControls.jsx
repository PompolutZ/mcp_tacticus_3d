import { assetUrl } from '../assets/index.js'
import { characterName } from '../characters/characters.js'
import { crisisMarker } from '../crisis/files.js'
import { characterToken } from '../tokens/files.js'

// Damage and Power reuse the mod's own counter tokens ("1 Damage", "1 Power"), see
// docs/characters-hud.md, "Tokens from the TTS mod".
const DAMAGE_ICON = assetUrl(crisisMarker('damage'))
const POWER_ICON = assetUrl(characterToken('1-power'))

// Damage and Power counters and the Flip and Remove buttons, for one character's tray. The tokens on
// the character and the Give sources are real-size 3D tokens on the tray (see CharacterTray.jsx).
// The objective tokens the character holds lie on its card (see Scene.jsx, "Hold and drop").
// Plain DOM, no three.js/drei: the 3D tray mounts it in a <Html transform> (see CharacterTray.jsx),
// and a later 2D HUD panel can mount the same component (see docs/characters-hud.md, "First
// iteration"). data-character-id is the drop target for giving
// tokens by drag and drop, and the target CrisisToken.jsx's own drag uses to hold a crisis token
// (Phase 6, "Hold and drop").
export default function TrayControls({ character, stamina, onDamage, onPower, onFlip, onRemove }) {
  // A native confirm, so Remove needs no extra dialog component (Phase 7): a mistaken click on a
  // model removes nothing, since the browser dialog always pauses for an answer.
  function handleRemove(e) {
    e.stopPropagation()
    if (window.confirm(`Remove ${characterName(character.key)} from the table?`)) onRemove()
  }

  return (
    <div className="tray-controls" data-character-id={character.id}>
      <TrayCounters character={character} stamina={stamina} onDamage={onDamage} onPower={onPower} />
      <div className="tray-controls-row tray-controls-actions">
        <button type="button" className="chip tray-controls-flip" onClick={e => { e.stopPropagation(); onFlip() }}>
          Flip
        </button>
        <button type="button" className="chip tray-controls-remove" onClick={handleRemove}>
          Remove
        </button>
      </div>
    </div>
  )
}

// The Damage and Power counters in one row. Without onDamage and onPower, the counters only show the
// values, with no -/+ buttons: the spectator view above a model uses them so (SpectatorBadge.jsx).
export function TrayCounters({ character, stamina, onDamage, onPower }) {
  return (
    <div className="tray-controls-row">
      <Counter
        icon={DAMAGE_ICON}
        alt="Damage"
        value={character.damage}
        max={stamina}
        warn={character.damage >= stamina}
        onDec={onDamage && (() => onDamage(character.damage - 1))}
        onInc={onDamage && (() => onDamage(character.damage + 1))}
      />
      <Counter
        icon={POWER_ICON}
        alt="Power"
        value={character.power}
        max={10}
        onDec={onPower && (() => onPower(character.power - 1))}
        onInc={onPower && (() => onPower(character.power + 1))}
      />
    </div>
  )
}

// A single -/value/+ counter. warn shows the value in a warning color, for Damage at Stamina.
// Without onDec and onInc it has no buttons.
function Counter({ icon, alt, label, value, max, warn = false, onDec, onInc }) {
  return (
    <div className="tray-counter">
      {onDec && <button type="button" className="tray-counter-btn" onClick={e => { e.stopPropagation(); onDec() }}>−</button>}
      {icon
        ? <img className="tray-counter-icon" src={icon} alt={alt} />
        : <span className="tray-counter-label">{label}</span>}
      <span className={`tray-counter-value${warn ? ' tray-counter-value--warn' : ''}`}>{value}/{max}</span>
      {onInc && <button type="button" className="tray-counter-btn" onClick={e => { e.stopPropagation(); onInc() }}>+</button>}
    </div>
  )
}
