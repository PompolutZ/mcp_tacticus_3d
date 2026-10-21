import { useState } from 'react'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { selectedId as selectedPieceId } from '../selection.js'
import { tableMat } from '../rooms/table.js'
import BuilderPanel from './BuilderPanel.jsx'
import { exportBoardText } from './builder.js'
import { useBuilderKeys } from './useBuilderKeys.js'
import { MAPS } from './maps/index.js'

// The Build mode panel of the Sandbox (docs/features/map-builder.md): BuilderPanel on the table document, and the keys
// of Build mode (Q / E turn the selected piece, Delete removes it). App mounts it only while Build mode is on, so the
// keys are the builder's only then.
// mapId, mat (game.mat): the board. terrain: the pieces with placements. edits: useBuilderEdits. onRemove(id): the
// Delete of the game (handleTerrainRemove: the pieces above drop down, the log has an Undo). onLoadMap(id): the Map
// select of the Sandbox. keysOn: false while a popup is open.
export default function SandboxBuilder({
  mapId,
  mat,
  terrain,
  edits,
  onRemove,
  onLoadMap,
  keysOn,
}) {
  const selected = useTableStore((s) => selectedPieceId(s.selection, 'terrain'))
  // The id and name fields of the export
  const [boardId, setBoardId] = useState('')
  const [boardName, setBoardName] = useState('')
  const [message, setMessage] = useState('')
  const shownMat = tableMat(mapId, mat)

  const target = keysOn && terrain.some((p) => p.id === selected) ? selected : null
  useBuilderKeys({
    selectedId: target,
    onTurn: (dir) => edits.turn(target, dir),
    onRemove: () => onRemove(target),
  })

  function exportFile() {
    if (!shownMat) return
    const text = exportBoardText({
      id: boardId,
      name: boardName,
      mat: shownMat.name,
      matRotation: shownMat.rotation,
      placements: terrain,
    })
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${boardId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadMap(id) {
    if (!MAPS[id]) return
    onLoadMap(id)
    setBoardId(id)
    setBoardName(MAPS[id].name)
    setMessage('')
  }

  async function importFile(file) {
    const result = edits.importText(await file.text())
    if (result.error) {
      setMessage(result.error)
      return
    }
    setMessage('')
    setBoardId(result.board.id)
    setBoardName(result.board.name)
  }

  return (
    <div className="comic build-panel">
      <BuilderPanel
        mapId={boardId}
        mapName={boardName}
        onMapId={setBoardId}
        onMapName={setBoardName}
        matName={shownMat?.name ?? ''}
        pieceCount={terrain.length}
        onLoadMap={loadMap}
        onExport={exportFile}
        onPickMat={edits.pickMat}
        onClear={edits.clear}
        onAdd={edits.add}
        onImport={importFile}
        message={message}
        canExport={Boolean(shownMat)}
      />
    </div>
  )
}
