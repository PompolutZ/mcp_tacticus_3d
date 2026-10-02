import { assetUrl } from '../assets/index.js'
import { characterName } from '../characters/roster.js'
import { tokenInfo } from '../crisis/cards.js'
import { crisisMarker, crisisToken } from '../crisis/files.js'
import { characterToken } from '../tokens/files.js'

// Damage and Power reuse the mod's own counter tokens ("1 Damage", "1 Power"), see
// docs/characters-hud.md, "Tokens from the TTS mod".
const DAMAGE_ICON = assetUrl(crisisMarker('damage'))
const POWER_ICON = assetUrl(characterToken('1-power'))

// Damage and Power counters, the Flip and Remove buttons, and the "Held" row of crisis tokens, for
// one character's tray. The tokens on the character and the Give sources are real-size 3D tokens
// on the tray (see CharacterTray.jsx). Plain DOM, no three.js/drei: the 3D tray mounts it in a
// <Html transform> (see CharacterTray.jsx), and a later 2D HUD panel can mount the same component
// (see docs/characters-hud.md, "First iteration"). data-character-id is the drop target for giving
// tokens by drag and drop, and the target CrisisToken.jsx's own drag uses to hold a crisis token
// (Phase 6, "Hold and drop").
export default function TrayControls({ character, stamina, onDamage, onPower, onFlip, onRemove, heldTokens = [], onTokenDrop }) {
  // A native confirm, so Remove needs no extra dialog component (Phase 7): a mistaken click on a
  // model removes nothing, since the browser dialog always pauses for an answer.
  function handleRemove(e) {
    e.stopPropagation()
    if (window.confirm(`Remove ${characterName(character.key)} from the table?`)) onRemove()
  }

  return (
    <div className="tray-controls" data-character-id={character.id}>
      <div className="tray-controls-row">
        <Counter
          icon={DAMAGE_ICON}
          alt="Damage"
          value={character.damage}
          max={stamina}
          warn={character.damage >= stamina}
          onDec={() => onDamage(character.damage - 1)}
          onInc={() => onDamage(character.damage + 1)}
        />
        <Counter
          icon={POWER_ICON}
          alt="Power"
          value={character.power}
          max={10}
          onDec={() => onPower(character.power - 1)}
          onInc={() => onPower(character.power + 1)}
        />
      </div>
      <div className="tray-controls-row tray-controls-actions">
        <button type="button" className="chip tray-controls-flip" onClick={e => { e.stopPropagation(); onFlip() }}>
          Flip
        </button>
        <button type="button" className="chip tray-controls-remove" onClick={handleRemove}>
          Remove
        </button>
      </div>
      {heldTokens.length > 0 && (
        <div className="tray-controls-row tray-controls-held">
          <span className="tray-controls-row-label">Held</span>
          {heldTokens.map(token => (
            <HeldChip key={token.id} token={token} onClick={() => onTokenDrop(token.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// A crisis token this character holds (the "Held" row, see docs/characters-hud.md, "Hold and
// drop"): an Asset, Civilian, or a Source's supply token. A click drops it on the table next to the
// character's model (App.jsx, handleTokenDrop), simpler than a separate Drop button and just as
// clear, since Held chips only ever drop. Shows the face that is currently up, like the 3D token did.
function HeldChip({ token, onClick }) {
  const key = token.up === 'front' ? token.frontKey : (token.backKey ?? token.frontKey)
  const name = tokenInfo(key)?.name ?? key
  return (
    <button type="button" className="token-chip token-chip--held" title={`${name} (click to drop)`} onClick={e => { e.stopPropagation(); onClick() }}>
      <img className="token-chip-icon" src={assetUrl(crisisToken(key))} alt={name} />
    </button>
  )
}

// A single -/value/+ counter. warn shows the value in a warning color, for Damage at Stamina.
function Counter({ icon, alt, label, value, max, warn = false, onDec, onInc }) {
  return (
    <div className="tray-counter">
      <button type="button" className="tray-counter-btn" onClick={e => { e.stopPropagation(); onDec() }}>−</button>
      {icon
        ? <img className="tray-counter-icon" src={icon} alt={alt} />
        : <span className="tray-counter-label">{label}</span>}
      <span className={`tray-counter-value${warn ? ' tray-counter-value--warn' : ''}`}>{value}/{max}</span>
      <button type="button" className="tray-counter-btn" onClick={e => { e.stopPropagation(); onInc() }}>+</button>
    </div>
  )
}
