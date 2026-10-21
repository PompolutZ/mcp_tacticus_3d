import { useMemo, useState } from 'react'
import { MAPS } from './maps/index.js'
import { MAP_ID_PATTERN } from './exportMap.js'
import { SORTED_MATS, pieceGroups } from './builder.js'

// The side panel of the map builder (docs/features/map-builder.md). It owns no board data, only the piece filter:
// the board comes in by props and every change goes out by a callback (the Sandbox keeps the board in the table
// document).
// mapId, mapName, onMapId, onMapName: the `id` and `name` fields of the export. matName: the shown mat.
// pieceCount: placed pieces. onLoadMap(id), onExport(), onPickMat(name), onClear(), onAdd(piece).
// onImport(file): the Import button, a .json file in the map format; without it there is no button. onSave(), onLoad():
// the account buttons; without them there are none. message: a line
// under the buttons (a refused file). canExport: false when there is nothing to export (no mat).
export default function BuilderPanel({
  mapId,
  mapName,
  onMapId,
  onMapName,
  matName,
  pieceCount,
  onLoadMap,
  onExport,
  onPickMat,
  onClear,
  onAdd,
  onImport,
  onSave,
  onLoad,
  message = '',
  canExport = true,
}) {
  const [filter, setFilter] = useState('')
  const groups = useMemo(() => pieceGroups(filter), [filter])
  return (
    <aside className="terrain-panel">
      <h2 className="terrain-heading">Map</h2>
      <select
        className="chip terrain-select"
        value=""
        aria-label="Load map"
        onChange={(e) => onLoadMap(e.target.value)}
      >
        <option value="">Load map...</option>
        {Object.values(MAPS).map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        className="chip chip--text terrain-filter"
        placeholder="id (kebab-case)"
        aria-label="Map id"
        value={mapId}
        onChange={(e) => onMapId(e.target.value)}
      />
      <input
        type="text"
        className="chip chip--text terrain-filter"
        placeholder="Name"
        aria-label="Map name"
        value={mapName}
        onChange={(e) => onMapName(e.target.value)}
      />
      <button
        type="button"
        className="terrain-row"
        disabled={!canExport || !MAP_ID_PATTERN.test(mapId)}
        onClick={onExport}
      >
        Export
      </button>
      {onImport && (
        <label className="terrain-row terrain-import">
          Import
          <input
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const [file] = e.target.files
              e.target.value = ''
              if (file) onImport(file)
            }}
          />
        </label>
      )}
      {onSave && (
        <button type="button" className="terrain-row" disabled={!canExport} onClick={onSave}>
          Save to account
        </button>
      )}
      {onLoad && (
        <button type="button" className="terrain-row" onClick={onLoad}>
          Load from account
        </button>
      )}
      {message && (
        <p className="terrain-message" role="alert">
          {message}
        </p>
      )}
      <h2 className="terrain-heading">Mats</h2>
      <ul className="terrain-list terrain-mats">
        {SORTED_MATS.map((m) => (
          <li key={m.name}>
            <button
              type="button"
              className={m.name === matName ? 'terrain-row terrain-row--active' : 'terrain-row'}
              onClick={() => onPickMat(m.name)}
            >
              {m.name}
            </button>
          </li>
        ))}
      </ul>
      <h2 className="terrain-heading">Pieces</h2>
      <button type="button" className="terrain-row" disabled={pieceCount === 0} onClick={onClear}>
        Clear ({pieceCount})
      </button>
      <input
        type="search"
        className="chip chip--text terrain-filter"
        placeholder="Filter by name"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="terrain-pieces">
        {groups.map((g) => (
          <section key={g.key}>
            <h3 className="terrain-group">
              {g.title} <span className="terrain-count">{g.pieces.length}</span>
            </h3>
            <ul className="terrain-list">
              {g.pieces.map((p) => (
                <li key={p.key}>
                  <button type="button" className="terrain-row" onClick={() => onAdd(p)}>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="terrain-empty">No piece</p>}
      </div>
    </aside>
  )
}
