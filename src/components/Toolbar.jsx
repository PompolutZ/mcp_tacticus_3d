import { MAPS } from '../terrain/maps.js'
import { cardsOfType } from '../crisis/cards.js'

const RANGES = [1, 2, 3, 4, 5]
const MOVES = [
  { label: 'S', type: 'short' },
  { label: 'M', type: 'medium' },
  { label: 'L', type: 'long' },
]
const CRISIS_TYPES = [
  { type: 'secure', label: 'Secure' },
  { type: 'extract', label: 'Extract' },
]

export function Toolbar({ mapId, onMapChange, activeRange, activeMove, onRangeClick, onMoveClick, showColliders, onCollidersClick, showLabels, onLabelsClick, onTurnMat, deployLine, onDeployLineClick, crisis, onCrisisChange }) {
  return (
    <div className="toolbar">
      <div className="group">
        <span className="group-label">Mat</span>
        <select className="chip" title="Map" value={mapId} onChange={e => onMapChange(e.target.value)}>
          {Object.entries(MAPS).map(([id, map]) => (
            <option key={id} value={id}>{map.name}</option>
          ))}
        </select>
        <button type="button" className="chip" title="Turn mat 90° counter-clockwise" onClick={() => onTurnMat(1)}>
          ↺
        </button>
        <button type="button" className="chip" title="Turn mat 90° clockwise" onClick={() => onTurnMat(-1)}>
          ↻
        </button>
      </div>
      <div className="group">
        <span className="group-label">Range</span>
        {RANGES.map(r => (
          <button
            key={r}
            type="button"
            className={`chip${activeRange === r ? ' chip--active' : ''}`}
            onClick={() => onRangeClick(r)}
          >
            R{r}
          </button>
        ))}
      </div>
      <div className="group">
        <span className="group-label">Move</span>
        {MOVES.map(m => (
          <button
            key={m.type}
            type="button"
            className={`chip${activeMove === m.type ? ' chip--active' : ''}`}
            onClick={() => onMoveClick(m.type)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="group">
        <span className="group-label">Crisis</span>
        {CRISIS_TYPES.map(({ type, label }) => (
          <select
            key={type}
            className="chip"
            title={`${label} card`}
            value={crisis[type] ?? ''}
            onChange={e => onCrisisChange(type, e.target.value || null)}
          >
            <option value="">None</option>
            {cardsOfType(type).map(card => (
              <option key={card.key} value={card.key}>{card.name} · {card.threat}</option>
            ))}
          </select>
        ))}
      </div>
      <div className="group">
        <span className="group-label">Deploy</span>
        <button
          type="button"
          className={`chip${deployLine ? ' chip--active' : ''}`}
          title="Lock models to within Range 3 of their deployment edge"
          onClick={onDeployLineClick}
        >
          Lock
        </button>
      </div>
      <div className="group">
        <span className="group-label">Debug</span>
        <button
          type="button"
          className={`chip${showColliders ? ' chip--active' : ''}`}
          onClick={onCollidersClick}
        >
          Colliders
        </button>
        <button
          type="button"
          className={`chip${showLabels ? ' chip--active' : ''}`}
          title="Show the piece name and game Size above each terrain piece"
          onClick={onLabelsClick}
        >
          Labels
        </button>
      </div>
    </div>
  )
}
