import { tokenInfo } from '../crisis/cards.js'

// Bottom HUD for the selected crisis token. Shows only the actions the token allows (see
// docs/feature-crisis.md, "Token actions"). Hold/drop is not built yet.
export function TokenPanel({ token, onFlip, onControl, onDamage }) {
  if (!token) return null
  const name = tokenInfo(token.up === 'front' ? token.frontKey : token.backKey ?? token.frontKey)?.name ?? token.frontKey

  return (
    <div className="token-panel">
      <span className="token-panel-name">{name}</span>
      {token.canFlip && (
        <button type="button" className="chip" onClick={onFlip}>Flip</button>
      )}
      {token.hasMarkers && (
        <>
          <span className="group-label">Control</span>
          <button type="button" className={`chip${token.control === null ? ' chip--active' : ''}`} onClick={() => onControl(null)}>None</button>
          <button type="button" className={`chip chip--player-blue${token.control === 'blue' ? ' chip--active' : ''}`} onClick={() => onControl('blue')}>Blue</button>
          <button type="button" className={`chip chip--player-red${token.control === 'red' ? ' chip--active' : ''}`} onClick={() => onControl('red')}>Red</button>
          <span className="group-label">Damage</span>
          <button type="button" className={`chip${token.damage ? ' chip--active' : ''}`} onClick={() => onDamage(!token.damage)}>
            {token.damage ? 'On' : 'Off'}
          </button>
        </>
      )}
    </div>
  )
}
