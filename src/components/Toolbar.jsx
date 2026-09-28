import { MAPS } from '../terrain/maps.js'

const RANGES = [2, 3, 4, 5]
const MOVES = [
  { label: 'S', type: 'short' },
  { label: 'M', type: 'medium' },
  { label: 'L', type: 'long' },
]

export function Toolbar({ mapId, onMapChange, activeRange, activeMove, onRangeClick, onMoveClick, showColliders, onCollidersClick, onTurnMat }) {
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
        <span className="group-label">Debug</span>
        <button
          type="button"
          className={`chip${showColliders ? ' chip--active' : ''}`}
          onClick={onCollidersClick}
        >
          Colliders
        </button>
      </div>
    </div>
  )
}
