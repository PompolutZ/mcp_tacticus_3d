import { useRef, useState } from 'react'
import { useYRecord } from '../net/useY.js'
import { losEntry, spawnEntry } from '../components/storedTool.js'
import { startPointerDrag } from '../drag/pointerDrag.js'
import { canDropTool } from './dropShape.js'
import { NO_PIECES, NO_TOOLS, isToolPiece, selectPiece, toolSelects } from '../selection.js'

// The tools on the table: the tools record, the spawn state, the toolbar and key handlers, and the drag of a
// tool from the rack (docs/features/table-tools.md). Call it after the hover and selection hooks, before the
// effects that place a tool.
export function useTableTools({
  table,
  ownSide,
  playedSides,
  characters,
  selection,
  setSelection,
  selectedTools,
  setSelectedTools,
  hoveredRef,
  sceneApi,
  controlsRef,
}) {
  const [tools] = useYRecord(table.tools)

  const ownTools = tools[ownSide]
  // The toolbar state comes from the own entries: the range number, the movement type, and whether the
  // Toward / Away tool is on
  const activeRange = ownTools?.range?.which ?? null
  const activeMove = ownTools?.move?.which ?? null
  const angleOn = Boolean(ownTools?.angle)
  const losOn = Boolean(ownTools?.los)
  // Where the Toward / Away tool spawns: { target, aim }, the piece it snaps to and the piece it aims at,
  // each { kind, id } | null. Used once, at the spawn, in this browser only.
  const [angleSpawn, setAngleSpawn] = useState({ target: null, aim: null })
  // Where the range and movement tools spawn: { range, move }, the piece the tool snaps to, { kind, id } | null.
  // Set by a tool key over a piece, null for any other spawn (null: the tool snaps to the selected piece, as
  // before). Used once, at the spawn, in this browser only. Like angleSpawn.target, it also works over a model
  // that the key does not select (see handleToolKey).
  const [toolSpawn, setToolSpawn] = useState({ range: null, move: null })
  // A drag of a tool from the rack in progress: { kind, which, active, start } | null. active: the pointer has
  // moved DRAG_THRESHOLD px, so the outline of the tool shows (Scene.jsx, ToolDragGhost). start: the pointer
  // position at that moment. Like the token drag, the state changes only at start and when the drag becomes active.
  const [toolDrag, setToolDrag] = useState(null)
  // The table point under the pointer, written by ToolDragGhost: { x, y, z } | null
  const toolDragPointRef = useRef(null)

  // Spawn point of a tool turned on by the toolbar or by a key off the table: with a selected piece, null
  // (it snaps to the piece). Else the table point in the middle of the screen.
  function toolbarSpawnAt(snapPiece) {
    if (snapPiece) return null
    return sceneApi.current?.pointAtCenter() ?? { x: 0, z: 0 }
  }

  // Writes the own entry of a tool kind, or deletes it with null. Only the own side is written.
  function setOwnTool(kind, entry) {
    table.tools.setField(ownSide, (side) => {
      if (!entry && !side?.[kind]) return side
      const next = { ...side }
      if (entry) next[kind] = entry
      else delete next[kind]
      return next
    })
  }

  // A spawn: a new entry with a new id and no pose, so the tool mounts again in both browsers and an
  // old pose is gone. at: { x, z } for a free spawn, null to snap to a piece.
  function spawnTool(kind, which, at) {
    setOwnTool(kind, spawnEntry(which, at))
  }

  // A tool of the own side rested (Tool in RulerTool.jsx). Only the entry of that spawn takes it, so
  // a tool that was replaced meanwhile writes nothing.
  function handleToolStore(kind, spawn, fields) {
    table.tools.setField(ownSide, (side) => {
      const entry = side?.[kind]
      return entry?.spawn === spawn ? { ...side, [kind]: { ...entry, ...fields } } : side
    })
  }

  function handleRangeClick(range) {
    setToolSpawn((prev) => ({ ...prev, range: null }))
    if (activeRange === range) setOwnTool('range', null)
    else spawnTool('range', range, toolbarSpawnAt(selection.findLast(isToolPiece)))
  }

  function handleMoveClick(move) {
    setToolSpawn((prev) => ({ ...prev, move: null }))
    if (activeMove === move) setOwnTool('move', null)
    else spawnTool('move', move, toolbarSpawnAt(selection.findLast(isToolPiece)))
  }

  // The toolbar button: the tool spawns at the selected character, aimed at the selected token
  function handleAngleClick() {
    const target = selection.find((p) => p.kind === 'character') ?? null
    setAngleSpawn({
      target,
      aim: selection.find((p) => p.kind === 'token') ?? null,
    })
    if (angleOn) setOwnTool('angle', null)
    else spawnTool('angle', true, toolbarSpawnAt(target))
  }

  // Escape clears every selection: the character, the token and the tools. The selected tools are
  // also removed from the table.
  function handleEscape() {
    if (selectedTools.range) setOwnTool('range', null)
    if (selectedTools.move) setOwnTool('move', null)
    if (selectedTools.angle) setOwnTool('angle', null)
    if (selectedTools.los) setOwnTool('los', null)
    setSelectedTools(NO_TOOLS)
    setSelection(NO_PIECES)
  }

  // Key 0: removes every tool from the table. The selected pieces stay selected.
  function clearTools() {
    table.tools.setField(ownSide, {})
    setSelectedTools(NO_TOOLS)
  }

  // Over a model of a side this browser does not play (the other side in a multiplayer room), a tool key
  // snaps the tool to it but does not select it. Else Place could move that model.
  function keySelects(piece) {
    return toolSelects(piece, characters, playedSides)
  }

  // The Line of Sight tool at a character (key Shift + 1, and the drop of a drag from the rack). piece: { kind, id } |
  // null, the piece under the pointer. Only a character counts: over anything else, nothing happens. With no line,
  // the character is the looker. With a line, a character that is not its looker or target becomes the target (the
  // line turns to it). The looker and the target again: no change. See docs/features/line-of-sight.md, "Spawn".
  function placeLos(piece) {
    if (piece?.kind !== 'character') return
    const entry = ownTools?.los
    if (!entry) setOwnTool('los', losEntry(piece.id))
    else if (piece.id !== entry.looker && piece.id !== entry.target)
      setOwnTool('los', { ...entry, target: piece.id })
  }

  function handleLosKey() {
    placeLos(hoveredRef.current)
  }

  // The LOS chip of the rack, clicked: it takes the line away, or starts it at the selected character
  function handleLosClick() {
    if (losOn) setOwnTool('los', null)
    else placeLos(selection.find((p) => p.kind === 'character') ?? null)
  }

  // Key 6, the Toward / Away tool: placeAngleTool at the hovered piece and the table point under the pointer.
  function handleAngleKey() {
    placeAngleTool(hoveredRef.current, sceneApi.current?.pointAtPointer())
  }

  // The tool keys 1 to 5 and 7 to 9: placeTool at the hovered piece and the table point under the pointer.
  // tool: 'range' | 'move'. value: the range number or the movement tool type.
  function handleToolKey(tool, value) {
    placeTool(tool, value, hoveredRef.current, sceneApi.current?.pointAtPointer())
  }

  // The Toward / Away tool at a piece or a table point (key 6, and the drop of a drag from the rack). Over a
  // character or a token (piece), it selects that piece and spawns the tool again snapped to it, even if
  // the tool is already out. It aims at the character or token selected last that is not that piece, or at the
  // mat center. Over the table or terrain (at: { x, z }), it spawns the tool free at that point, also if it is
  // already out. With neither, it toggles the tool, the same as its toolbar button.
  function placeAngleTool(piece, at) {
    if (!piece) {
      if (!at) {
        handleAngleClick()
        return
      }
      setAngleSpawn({ target: null, aim: null })
      spawnTool('angle', true, at)
      return
    }
    setAngleSpawn({
      target: piece,
      aim:
        selection.findLast(
          (p) => isToolPiece(p) && !(p.kind === piece.kind && p.id === piece.id),
        ) ?? null,
    })
    if (keySelects(piece)) setSelection((prev) => selectPiece(prev, piece))
    spawnTool('angle', true, null)
  }

  // A range or movement tool at a piece or a table point (the tool keys, and the drop of a drag from the rack).
  // tool: 'range' | 'move'. value: the range number or the movement tool type.
  // Over a character or a token (piece), it selects that piece and spawns the tool again, snapped to it, even
  // if the tool is already out. A selected piece of the other kind stays selected. Over the table or terrain
  // (at: { x, z }), it spawns the tool free at that point, also if it is already out. With neither, it toggles
  // the tool, the same as its toolbar button.
  function placeTool(tool, value, piece, at) {
    if (!piece) {
      if (!at) {
        if (tool === 'range') handleRangeClick(value)
        else handleMoveClick(value)
        return
      }
      setToolSpawn((prev) => ({ ...prev, [tool]: null }))
      spawnTool(tool, value, at)
      return
    }
    setToolSpawn((prev) => ({ ...prev, [tool]: piece }))
    if (keySelects(piece)) setSelection((prev) => selectPiece(prev, piece))
    spawnTool(tool, value, null)
  }

  // A press on an own tool or chip of the rack (ToolRack.jsx). e is the pointer event of the 3D scene or the DOM
  // event of a chip. kind: 'range' | 'move' | 'angle' | 'los'. which: the range number, the movement type, or true. The
  // camera does not move during the press (startPointerDrag). After DRAG_THRESHOLD px, the outline of the tool
  // follows the pointer, and the release drops the tool (handleToolDrop). onClick: the release of a press
  // that did not become a drag (chips only; a tool of the 3D scene has its own click). Esc cancels (cancelActiveDrag
  // in drag/pointerDrag.js).
  function startToolDrag(e, kind, which, onClick) {
    const drag = { kind, which }
    const handle = startPointerDrag(e, {
      controls: controlsRef.current,
      canvas: e.nativeEvent?.target ?? e.target,
      preventDefault: true,
      onStart: (ev) =>
        setToolDrag(
          (prev) =>
            prev && { ...prev, active: true, start: { clientX: ev.clientX, clientY: ev.clientY } },
        ),
      onEnd: (ev) => {
        handleToolDrop(drag, ev.clientX, ev.clientY)
        endToolDrag()
      },
      onClick: () => {
        endToolDrag()
        onClick?.()
      },
      onCancel: endToolDrag,
    })
    if (!handle) return
    setToolDrag({ ...drag, active: false, start: null })
  }

  function endToolDrag() {
    setToolDrag(null)
  }

  // The release of a tool drag at (clientX, clientY): the same as the tool key at that point. Over the piece
  // under the pointer, the tool snaps to it. Over the table or terrain, it spawns free there. Over a HUD
  // panel, off the table or over the own rack: nothing, and no toggle (docs/features/table-tools.md, "Tool
  // rack"). The piece under the pointer is hoveredRef: the drag releases the pointer capture of the canvas,
  // so the hover events of the 3D scene go on during the drag.
  function handleToolDrop({ kind, which }, clientX, clientY) {
    if (!document.elementFromPoint(clientX, clientY)?.closest('.scene-root')) return
    const point = toolDragPointRef.current
    if (!canDropTool(ownSide, point)) return
    const at = { x: point.x, z: point.z }
    if (kind === 'angle') placeAngleTool(hoveredRef.current, at)
    else if (kind === 'los') placeLos(hoveredRef.current)
    else placeTool(kind, which, hoveredRef.current, at)
  }

  // A move drag of an own tool ended on the own rack: the tool goes back to it (Scene.jsx, onToolReturn)
  function handleToolReturn(kind) {
    setOwnTool(kind, null)
  }

  return {
    tools,
    activeRange,
    activeMove,
    angleOn,
    losOn,
    angleSpawn,
    toolSpawn,
    toolDrag,
    toolDragPointRef,
    handleToolStore,
    handleRangeClick,
    handleMoveClick,
    handleAngleClick,
    handleEscape,
    clearTools,
    handleAngleKey,
    handleLosKey,
    handleLosClick,
    handleToolKey,
    placeTool,
    startToolDrag,
    handleToolReturn,
  }
}
