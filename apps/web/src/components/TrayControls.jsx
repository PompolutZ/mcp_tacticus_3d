import { attachedCards } from '../rosters/cards.js'
import { assetUrl } from '../assets/index.js'
import { crisisMarker } from '../crisis/files.js'
import { characterToken } from '../tokens/files.js'

// Damage and Power reuse the mod's own counter tokens ("1 Damage", "1 Power"), see
// docs/features/character-trays.md, "Tokens from the TTS mod".
const DAMAGE_ICON = assetUrl(crisisMarker('damage'))
const POWER_ICON = assetUrl(characterToken('1-power'))

// Damage and Power counters and the Flip and Remove buttons, for one character's tray. The tokens on
// the character and the Give sources are real-size 3D tokens on the tray (see CharacterTray.jsx).
// The objective tokens the character holds lie on its card (see Scene.jsx, "Hold and drop").
// Plain DOM, no three.js/drei: the 3D tray mounts it in a <Html transform> (see CharacterTray.jsx),
// and a later 2D HUD panel can mount the same component (see docs/features/character-trays.md, "First
// iteration"). data-character-id is the drop target for giving
// tokens by drag and drop, and the target CrisisToken.jsx's own drag uses to hold a crisis token
// (docs/features/character-trays.md, "Hold and drop").
// onAttachedOpen(code): a click on a gem chip, one per attached card (see App.jsx, handleAttachedOpen).
// The chip only reads the card, so it works on any player's tray. hideAttached: no gem chips; the
// tray popup sets it, because its thumbnails do the same job (TrayPopup.jsx).
// onRemove(): Remove puts the model back on its card (docs/features/round-phases.md, decision 16), with no
// confirm. onBoard: a model of the character is on the mat. Without it Remove does nothing (aria-disabled,
// not disabled, so the browser still shows the title). removeWait: the text of a dropped token that waits for its
// place. Remove is off then, with this text as the title (docs/features/character-trays.md, "Hold and drop").
const REMOVE_TITLE =
  'Remove from the board: the model goes back on its card. Delete key over the card deletes the character.'

export default function TrayControls({
  character,
  stamina,
  onDamage,
  onPower,
  onFlip,
  onRemove,
  onBoard,
  removeWait = null,
  onAttachedOpen,
  hideAttached = false,
}) {
  function handleRemove(e) {
    e.stopPropagation()
    if (onBoard && !removeWait) onRemove()
  }

  const attached = hideAttached ? [] : attachedCards(character)
  // A grunt has no Power and no Injured side to flip to (docs/features/character-trays.md, "Grunts")
  const grunt = Boolean(character.host)

  return (
    <div className="tray-controls" data-character-id={character.id}>
      <TrayCounters character={character} stamina={stamina} onDamage={onDamage} onPower={onPower} />
      {attached.length > 0 && (
        <div className="tray-controls-row">
          {attached.map((card) => (
            <button
              key={card.code}
              type="button"
              className="chip tray-controls-gem"
              title={card.name}
              onClick={(e) => {
                e.stopPropagation()
                onAttachedOpen?.(card.code)
              }}
            >
              {card.label}
            </button>
          ))}
        </div>
      )}
      <div className="tray-controls-row tray-controls-actions">
        {!grunt && (
          <button
            type="button"
            className="chip tray-controls-flip"
            onClick={(e) => {
              e.stopPropagation()
              onFlip()
            }}
          >
            Flip
          </button>
        )}
        <button
          type="button"
          className="chip tray-controls-remove"
          aria-disabled={!onBoard || Boolean(removeWait)}
          title={removeWait ?? REMOVE_TITLE}
          onClick={handleRemove}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

// The Damage and Power counters in one row. Without onDamage and onPower, the counters only show the
// values, with no -/+ buttons: the spectator view above a model uses them so (SpectatorBadge.jsx). A grunt
// (character.host) shows no Power counter.
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
      {!character.host && (
        <Counter
          icon={POWER_ICON}
          alt="Power"
          value={character.power}
          max={10}
          onDec={onPower && (() => onPower(character.power - 1))}
          onInc={onPower && (() => onPower(character.power + 1))}
        />
      )}
    </div>
  )
}

// A single -/value/+ counter. warn shows the value in a warning color, for Damage at Stamina.
// Without onDec and onInc it has no buttons.
function Counter({ icon, alt, label, value, max, warn = false, onDec, onInc }) {
  return (
    <div className="tray-counter">
      {onDec && (
        <button
          type="button"
          className="tray-counter-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDec()
          }}
        >
          −
        </button>
      )}
      {icon ? (
        <img className="tray-counter-icon" src={icon} alt={alt} />
      ) : (
        <span className="tray-counter-label">{label}</span>
      )}
      <span className={`tray-counter-value${warn ? ' tray-counter-value--warn' : ''}`}>
        {value}/{max}
      </span>
      {onInc && (
        <button
          type="button"
          className="tray-counter-btn"
          onClick={(e) => {
            e.stopPropagation()
            onInc()
          }}
        >
          +
        </button>
      )}
    </div>
  )
}
