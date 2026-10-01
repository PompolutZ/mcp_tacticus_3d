import { assetUrl } from '../assets/index.js'
import { characterGiveTokens, characterName } from '../characters/roster.js'
import { tokenInfo } from '../crisis/cards.js'
import { crisisMarker, crisisToken } from '../crisis/files.js'
import { characterToken } from '../tokens/files.js'
import { getToken } from '../tokens/tokens.js'

// Damage and Power reuse the mod's own counter tokens ("1 Damage", "1 Power"), see
// docs/characters-hud.md, "Tokens from the TTS mod".
const DAMAGE_ICON = assetUrl(crisisMarker('damage'))
const POWER_ICON = assetUrl(characterToken('1-power'))
// Every character's Give row starts with Activated and Dazed (characterGiveTokens adds only the
// character-specific tokens, see migrate-characters.mjs: the mod spawns these next to every tray).
const ALWAYS_GIVEN = ['activated', 'dazed']

// Damage and Power counters, the Flip button, the "On" row of tokens, and the "Held" row of crisis
// tokens, for one character's tray. Plain DOM, no three.js/drei: the 3D tray mounts it in a <Html
// transform> (see CharacterTray.jsx), and a later 2D HUD panel can mount the same component (see
// docs/characters-hud.md, "First iteration"). data-character-id is the drop target Phase 4 adds
// for giving tokens by drag and drop, and the target CrisisToken.jsx's own drag uses to hold a
// crisis token (Phase 6, "Hold and drop").
export default function TrayControls({ character, stamina, onDamage, onPower, onFlip, onRemove, onTokenRemove, onTokenDragStart, heldTokens = [], onTokenDrop }) {
  // Give row: Activated, Dazed, then the character's own tokens (conditions, personal tokens, ...),
  // see docs/characters-hud.md, "Controls". Chips are dragged, never clicked, so the same key can be
  // given more than once (counts up, see App.jsx, handleCharacterTokenGive).
  const giveKeys = [...ALWAYS_GIVEN, ...characterGiveTokens(character.key)]

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
      {Object.keys(character.tokens ?? {}).length > 0 && (
        <div className="tray-controls-row tray-controls-on">
          <span className="tray-controls-row-label">On</span>
          {Object.entries(character.tokens).map(([key, count]) => (
            <TokenChip key={key} tokenKey={key} count={count} onClick={() => onTokenRemove(key)} />
          ))}
        </div>
      )}
      {heldTokens.length > 0 && (
        <div className="tray-controls-row tray-controls-held">
          <span className="tray-controls-row-label">Held</span>
          {heldTokens.map(token => (
            <HeldChip key={token.id} token={token} onClick={() => onTokenDrop(token.id)} />
          ))}
        </div>
      )}
      <div className="tray-controls-row tray-controls-give">
        <span className="tray-controls-row-label">Give</span>
        {giveKeys.map(key => (
          <GiveChip key={key} tokenKey={key} onDragStart={e => onTokenDragStart(e, key)} />
        ))}
      </div>
    </div>
  )
}

// One token "on" the character. Shows a count above 1 (p17: a character has each condition, or
// Activated/Dazed, at most once; other tokens count up). The tooltip is the token's name and the
// mod's description. A click removes one (see docs/characters-hud.md, "Controls").
function TokenChip({ tokenKey, count, onClick }) {
  const token = getToken(tokenKey)
  if (!token) return null
  const title = token.description ? `${token.name}: ${token.description}` : token.name
  return (
    <button type="button" className="token-chip" title={title} onClick={e => { e.stopPropagation(); onClick() }}>
      <img className="token-chip-icon" src={assetUrl(characterToken(tokenKey))} alt={token.name} />
      {count > 1 && <span className="token-chip-count">{count}</span>}
    </button>
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

// One token this character can give (the "Give" row). A drag, not a click, the same as a Tokens
// panel chip (see App.jsx, handleTokenDragStart): dashed border and a grab cursor tell it apart
// from an "On" chip, which is solid and clicks to remove.
function GiveChip({ tokenKey, onDragStart }) {
  const token = getToken(tokenKey)
  if (!token) return null
  return (
    <button type="button" className="token-chip token-chip--give" title={token.name} onPointerDown={onDragStart}>
      <img className="token-chip-icon" src={assetUrl(characterToken(tokenKey))} alt={token.name} draggable={false} />
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
