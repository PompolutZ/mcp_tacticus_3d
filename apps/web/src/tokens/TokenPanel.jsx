import { tokenInfo } from '../crisis/cards.js'
import { COLOR_NAME } from '../sideColors.js'
import { useSideColors } from '../table/useSideColors.jsx'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { selectedId } from '../selection.js'
import { TEAMS } from '../setup/setup.js'

// Bottom HUD for the selected crisis token. Shows only the actions the token allows (see
// docs/features/crisis.md, "Token actions"). Hold/drop is not built yet. It reads the selected token id from the
// store, so only the panel renders when the selection changes. tokens: all crisis tokens. The handlers get the token id.
export function TokenPanel({ tokens, onFlip, onControl, onDamage }) {
  const colors = useSideColors()
  const tokenId = useTableStore((s) => selectedId(s.selection, 'token'))
  const token = tokens.find((t) => t.id === tokenId)
  if (!token) return null
  const name =
    tokenInfo(token.up === 'front' ? token.frontKey : (token.backKey ?? token.frontKey))?.name ??
    token.frontKey

  return (
    <div className="token-panel">
      <span className="token-panel-name">{name}</span>
      {token.canFlip && (
        <button type="button" className="chip" onClick={() => onFlip(token.id)}>
          Flip
        </button>
      )}
      {token.hasMarkers && (
        <>
          <span className="group-label">Control</span>
          <button
            type="button"
            className={`chip${token.control === null ? ' chip--active' : ''}`}
            onClick={() => onControl(token.id, null)}
          >
            None
          </button>
          {TEAMS.map((side) => (
            <button
              key={side}
              type="button"
              className={`chip chip--player-${colors[side]}${token.control === side ? ' chip--active' : ''}`}
              onClick={() => onControl(token.id, side)}
            >
              {COLOR_NAME[colors[side]]}
            </button>
          ))}
          <span className="group-label">Damage</span>
          <button
            type="button"
            className={`chip${token.damage ? ' chip--active' : ''}`}
            onClick={() => onDamage(token.id, !token.damage)}
          >
            {token.damage ? 'On' : 'Off'}
          </button>
        </>
      )}
    </div>
  )
}
