import { tokenInfo } from '../crisis/cards.js'
import { COLOR_NAME, useSideColors } from '../sideColors.js'

// Bottom HUD for the selected crisis token. Shows only the actions the token allows (see
// docs/features/crisis.md, "Token actions"). Hold/drop is not built yet.
export function TokenPanel({ token, onFlip, onControl, onDamage }) {
  const colors = useSideColors()
  if (!token) return null
  const name =
    tokenInfo(token.up === 'front' ? token.frontKey : (token.backKey ?? token.frontKey))?.name ??
    token.frontKey

  return (
    <div className="token-panel">
      <span className="token-panel-name">{name}</span>
      {token.canFlip && (
        <button type="button" className="chip" onClick={onFlip}>
          Flip
        </button>
      )}
      {token.hasMarkers && (
        <>
          <span className="group-label">Control</span>
          <button
            type="button"
            className={`chip${token.control === null ? ' chip--active' : ''}`}
            onClick={() => onControl(null)}
          >
            None
          </button>
          {['blue', 'red'].map((side) => (
            <button
              key={side}
              type="button"
              className={`chip chip--player-${colors[side]}${token.control === side ? ' chip--active' : ''}`}
              onClick={() => onControl(side)}
            >
              {COLOR_NAME[colors[side]]}
            </button>
          ))}
          <span className="group-label">Damage</span>
          <button
            type="button"
            className={`chip${token.damage ? ' chip--active' : ''}`}
            onClick={() => onDamage(!token.damage)}
          >
            {token.damage ? 'On' : 'Off'}
          </button>
        </>
      )}
    </div>
  )
}
