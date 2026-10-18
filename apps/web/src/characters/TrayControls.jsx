import { attachedCards } from '../rosters/cards.js'
import { COUNTER_ICONS } from './trayIcons.js'
import { applyCounter, removeState, trayCounters } from './trayControls.js'

// Damage and Power counters and the Flip and Remove buttons for one character, as DOM. The tray popup
// (TrayPopup.jsx) mounts them, and TrayCounters is the read-only badge above a model (SpectatorBadge.jsx).
// The 3D tray on the table draws its own strip in the canvas (TrayStrip3D.jsx), so a model in front hides
// it. Both share what a click does and says in trayControls.js. The tokens on the character and the Give
// sources are real-size 3D tokens on the tray (see CharacterTray.jsx). The objective tokens the character
// holds lie on its card (see Scene.jsx, "Hold and drop").
// data-character-id is the drop target for giving tokens by drag and drop, and the target CrisisToken.jsx's
// own drag uses to hold a crisis token (docs/features/character-trays.md, "Hold and drop").
// onAttachedOpen(code): a click on a gem chip, one per attached card (see App.jsx, handleAttachedOpen).
// The chip only reads the card, so it works on any player's tray. hideAttached: no gem chips; the
// tray popup sets it, because its thumbnails do the same job (TrayPopup.jsx).
// onRemove(): Remove puts the model back on its card (docs/features/round-phases.md, decision 16), with no
// confirm. onBoard: a model of the character is on the mat. Without it Remove does nothing (aria-disabled,
// not disabled, so the browser still shows the title). removeWait: the text of a dropped token that waits for its
// place. Remove is off then, with this text as the title (docs/features/character-trays.md, "Hold and drop").
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
  const remove = removeState({ onBoard, removeWait })
  function handleRemove(e) {
    e.stopPropagation()
    if (!remove.disabled) onRemove()
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
      <div
        className={`tray-controls-row tray-controls-actions${grunt ? ' tray-controls-actions--grunt' : ''}`}
      >
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
          aria-disabled={remove.disabled}
          title={remove.title}
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
  const handlers = { onDamage, onPower }
  return (
    <div className="tray-controls-row">
      {trayCounters(character, stamina).map((c) => {
        const set = c.kind === 'damage' ? onDamage : onPower
        return (
          <Counter
            key={c.kind}
            icon={COUNTER_ICONS[c.kind]}
            alt={c.alt}
            value={c.value}
            max={c.max}
            warn={c.warn}
            onDec={set && (() => applyCounter(character, c.kind, -1, handlers))}
            onInc={set && (() => applyCounter(character, c.kind, 1, handlers))}
          />
        )
      })}
    </div>
  )
}

// A single -/value/+ counter. warn shows the value in a warning color, for Damage at Stamina.
// Without onDec and onInc it has no buttons and no click. With them, a left click on the body (icon or
// value) adds 1 and a right click takes 1, as in TTS; no browser menu, and the table does not see it.
// onDamage/onPower clamp (actions.js), so the click needs no limit of its own.
function Counter({ icon, alt, label, value, max, warn = false, onDec, onInc }) {
  const clickable = Boolean(onDec && onInc)
  function handleClick(e) {
    if (e.target.closest('.tray-counter-btn')) return
    e.stopPropagation()
    onInc()
  }
  function handleContextMenu(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!e.target.closest('.tray-counter-btn')) onDec()
  }
  return (
    <div
      className={`tray-counter${clickable ? ' tray-counter--click' : ''}`}
      onClick={clickable ? handleClick : undefined}
      onContextMenu={clickable ? handleContextMenu : undefined}
    >
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
