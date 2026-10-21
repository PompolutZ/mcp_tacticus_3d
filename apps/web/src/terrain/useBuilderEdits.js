import { applyBoard, renameBoard } from '../rooms/table.js'
import { selectPiece } from '../selection.js'
import { MATS } from './catalog.js'
import {
  boardPieces,
  editStoredPiece,
  movePlacement,
  newPlacement,
  storedCustom,
  turnPlacement,
  validateBoard,
} from './builder.js'
import { loadPieceBox } from './pieceBox.js'

// The edits of Build mode (docs/features/map-builder.md), written to the table document. The edit functions are the
// ones of builder.js; a map piece becomes a custom piece when it is moved or turned. App calls it always (hooks), the
// writes happen only from the Build panel and the keys of Build mode.
// table: the table (net/doc.js). mapId: the map of the table. setTerrain: the list setter. setSelection: the selection.
// Returns { move, turn, add, clear, rename, pickMat, importText, importData }.
export function useBuilderEdits({ table, mapId, setTerrain, setSelection }) {
  const deselect = () => setSelection((prev) => prev.filter((p) => p.kind !== 'terrain'))

  // dx, dz: Three coords on the mat (useTerrainDrag)
  const move = (id, dx, dz) =>
    setTerrain((prev) => editStoredPiece(mapId, prev, id, (l) => movePlacement(l, id, dx, dz)))
  // dir 1 is Q, -1 is E
  const turn = (id, dir) =>
    setTerrain((prev) => editStoredPiece(mapId, prev, id, (l) => turnPlacement(l, id, dir)))

  // The box comes first (the files load async), so the piece is written at its final height, on the mat
  async function add(piece) {
    const id = crypto.randomUUID()
    let box
    try {
      box = await loadPieceBox(piece.key)
    } catch (error) {
      console.error('terrain piece box', piece.key, error)
      return
    }
    setTerrain((prev) => [...prev, storedCustom(newPlacement(piece, id, box))])
    setSelection((prev) => selectPiece(prev, { kind: 'terrain', id }))
  }

  const clear = () => {
    setTerrain([])
    deselect()
  }

  // The name field of the board record (renameBoard in rooms/table.js)
  const rename = (name) => renameBoard(table, name)

  // The mat changes, the pieces stay
  const pickMat = (name) => {
    const mat = MATS.find((m) => m.name === name)
    if (mat) table.game.setField('mat', { name: mat.name, rotation: mat.rotation })
  }

  // A parsed map (a file, or the board of the account). Returns { board } (written) or { error } (nothing changed).
  function importData(data) {
    const result = validateBoard(data)
    if (result.error) return result
    const { board } = result
    applyBoard(
      table,
      { name: board.mat, rotation: board.matRotation },
      boardPieces(board, () => crypto.randomUUID()),
      board,
    )
    deselect()
    return result
  }

  // The text of a map file
  function importText(text) {
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return { error: 'The file is not JSON.' }
    }
    return importData(data)
  }

  return { move, turn, add, clear, rename, pickMat, importText, importData }
}
