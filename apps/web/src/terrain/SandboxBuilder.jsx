import { useState } from 'react'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { selectedId as selectedPieceId } from '../selection.js'
import { tableMat } from '../rooms/table.js'
import BuilderPanel from './BuilderPanel.jsx'
import { boardIdFromName, exportBoard, exportBoardText, newIdSuffix } from './builder.js'
import { getBoard, saveBoard } from '../api/board.js'
import { useUser } from '../auth/useUser.js'
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
  // The name field. The id is made from the name and a suffix that stays for the board (builder.js,
  // boardIdFromName). fixedId: the id of a loaded map or an imported file, which stays as it is.
  const [boardName, setBoardName] = useState('')
  const [suffix] = useState(() => newIdSuffix())
  const [fixedId, setFixedId] = useState(null)
  const [importedAuthor, setImportedAuthor] = useState('')
  const [message, setMessage] = useState('')
  const shownMat = tableMat(mapId, mat)
  // status: off, loading, out, error, in. Only 'in' has a user, so only then the account buttons show.
  const { status, user } = useUser()
  const loggedIn = status === 'in' && Boolean(user)
  const boardId = fixedId ?? boardIdFromName(boardName, suffix)

  const target = keysOn && terrain.some((p) => p.id === selected) ? selected : null
  useBuilderKeys({
    selectedId: target,
    onTurn: (dir) => edits.turn(target, dir),
    onRemove: () => onRemove(target),
  })

  // The board state of the export file and of the account
  const boardState = () => ({
    id: boardId,
    name: boardName.trim(),
    author: (loggedIn ? user.name : '') || importedAuthor,
    mat: shownMat.name,
    matRotation: shownMat.rotation,
    placements: terrain,
  })

  function exportFile() {
    if (!shownMat || !boardName.trim()) return
    const text = exportBoardText(boardState())
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
    setFixedId(id)
    setImportedAuthor(MAPS[id].author ?? '')
    setBoardName(MAPS[id].name)
    setMessage('')
  }

  function showImported(result) {
    if (result.error) {
      setMessage(result.error)
      return
    }
    setMessage('')
    setFixedId(result.board.id || null)
    setImportedAuthor(result.board.author)
    setBoardName(result.board.name)
  }

  async function importFile(file) {
    showImported(edits.importText(await file.text()))
  }

  async function saveToAccount() {
    if (!shownMat || !boardName.trim()) return
    try {
      await saveBoard(exportBoard(boardState()))
      setMessage('Saved to your account.')
    } catch (error) {
      setMessage(`Save failed: ${error.message}`)
    }
  }

  // The same path as Import: validateBoard and applyBoard
  async function loadFromAccount() {
    let data
    try {
      data = await getBoard()
    } catch (error) {
      setMessage(`Load failed: ${error.message}`)
      return
    }
    if (!data) {
      setMessage('No board saved in your account.')
      return
    }
    showImported(edits.importData(data))
  }

  return (
    <div className="comic build-panel">
      <BuilderPanel
        mapName={boardName}
        onMapName={setBoardName}
        matName={shownMat?.name ?? ''}
        pieceCount={terrain.length}
        onLoadMap={loadMap}
        onExport={exportFile}
        onPickMat={edits.pickMat}
        onClear={edits.clear}
        onAdd={edits.add}
        onImport={importFile}
        onSave={loggedIn ? saveToAccount : undefined}
        onLoad={loggedIn ? loadFromAccount : undefined}
        message={message}
        canExport={Boolean(shownMat)}
      />
    </div>
  )
}
