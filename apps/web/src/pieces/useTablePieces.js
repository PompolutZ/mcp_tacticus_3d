import { TERRAIN_PIECES } from '../terrain/pieces.js'
import { droppedY, mapTerrain } from '../rooms/table.js'
import { deselectPiece } from '../selection.js'
import { cardPiles, firstFreeSlot, nearestFreeSlot, tacticTrayAt } from '../tactics/layout.js'
import { getTactic } from '../tactics/cards.js'
import { canUndo } from '../log/log.js'
import { deleteEntryData, undoPlan } from './terrainUndo.js'

// The handlers of the pieces on the table: mat turn, map, terrain lock and remove, loose tokens, token
// piles and Team Tactic cards (docs/features/team-tactic-cards.md). Call it after the selection and the HUD
// message. makeCardPiles is also used by the game setup.
export function useTablePieces({
  table,
  terrain,
  mapId,
  writeLog,
  sceneApi,
  setMatTurns,
  setMapId,
  setTerrain,
  setSelection,
  setLooseTokens,
  setTokenPiles,
  setTacticCards,
  showHudMessage,
}) {
  // direction: 1 turns the mat 90° counter-clockwise, -1 clockwise
  function handleTurnMat(direction) {
    setMatTurns((prev) => (prev + direction + 4) % 4)
  }

  // A new map brings its own terrain, all locked. The selected terrain piece is gone. One change of the
  // document, so no render shows the new map with the old terrain.
  function handleMapChange(id) {
    table.transact(() => {
      setMapId(id)
      setTerrain(mapTerrain(id))
    })
    setSelection((prev) => prev.filter((p) => p.kind !== 'terrain'))
  }

  // L, as in TTS: locks or unlocks the terrain piece under the pointer. A piece that gets locked is
  // deselected. A locked piece looks the same as an unlocked one, so the HUD message shows the new state.
  function handleLockKey() {
    const id = sceneApi.current?.terrainAt()
    const piece = id && terrain.find((p) => p.id === id)
    if (!piece) return
    const locked = !piece.locked
    setTerrain((prev) => prev.map((p) => (p.id === id ? { ...p, locked } : p)))
    if (locked) setSelection((prev) => deselectPiece(prev, { kind: 'terrain', id }))
    showHudMessage(`${TERRAIN_PIECES[piece.piece].name} ${locked ? 'locked' : 'unlocked'}`)
  }

  // Delete key over an unlocked terrain piece, the only way a piece leaves the table. A locked piece gets
  // no hover (Terrain.jsx), so it cannot be removed. What stood on it goes down to the next surface, with
  // no push (docs/features/maps.md, "Delete"). Scene plans it before the piece is gone: the pieces that
  // fall get a new `y` in the document, and Scene moves the models after the piece left the world.
  // Only this browser plans it. The other one gets the document and the poses.
  function handleTerrainRemove(id) {
    const piece = table.terrain.read().find((p) => p.id === id)
    table.transact(() => {
      const fall = sceneApi.current?.planFall(id) ?? { terrain: {}, models: {} }
      if (piece) writeLog('terrainDeleted', deleteEntryData(piece, mapId, terrain, fall))
      setTerrain((prev) =>
        prev
          .filter((p) => p.id !== id)
          .map((p) => {
            const placed = fall.terrain[p.id] && terrain.find((t) => t.id === p.id)
            return placed ? { ...p, y: droppedY(placed.position, fall.terrain[p.id]) } : p
          }),
      )
    })
    setSelection((prev) => deselectPiece(prev, { kind: 'terrain', id }))
  }

  // The Undo button of a `terrainDeleted` log entry (log/log.js, canUndo): one transaction. The piece is
  // back with its id, place and lock. A piece that fell gets its old `y` if it is still at the fallen
  // height, a model goes back up if it is still where it fell and this browser can claim it
  // (Scene, raiseModels; a lifted one raises its lift place). What moved onto the spot since is not moved.
  function handleTerrainUndo(entry) {
    if (!canUndo(entry, terrain, mapId)) return
    table.transact(() => {
      const plan = undoPlan(entry, table.terrain.read(), terrain)
      sceneApi.current?.raiseModels(entry.models, table.poses.read())
      writeLog('terrainRestored', { piece: entry.piece, pieceKey: entry.pieceKey })
      setTerrain(plan.terrain)
    })
  }

  // Delete key over a token on the table, as in TTS
  function handleLooseRemove(id) {
    setLooseTokens((prev) => prev.filter((t) => t.id !== id))
  }

  // Delete key over a pile on the table
  function handlePileRemove(id) {
    setTokenPiles((prev) => prev.filter((p) => p.id !== id))
  }

  // A click on a tactic card in the Library: the card goes into the first free slot of the team's
  // tactic tray, or next to the tray when its 5 slots are full. It lies face up.
  function handleTacticSpawn(key, team) {
    const slot = firstFreeSlot(team, table.tactics.read())
    const card = { id: crypto.randomUUID(), key, team, x: slot.x, z: slot.z, up: 'face' }
    const newPiles = makeCardPiles([card])
    table.transact(() => {
      setTacticCards((prev) => [...prev, card])
      setTokenPiles((prev) => [...prev, ...newPiles])
    })
  }

  // The end of a tactic card drag at table point (x, z). Over the plate of a tactic tray, the card goes
  // into the nearest free slot of that tray and faces that tray's player, the same as a TTS snap point.
  // Otherwise it lies at the point. The card moves to the end of the list, so it lies on top.
  function handleTacticMove(id, x, z) {
    setTacticCards((prev) => {
      const card = prev.find((c) => c.id === id)
      if (!card) return prev
      const team = tacticTrayAt({ x, z })
      const slot = team && nearestFreeSlot(team, { x, z }, prev, id)
      const moved = slot ? { ...card, team, x: slot.x, z: slot.z } : { ...card, x, z }
      return [...prev.filter((c) => c.id !== id), moved]
    })
  }

  function handleTacticFlip(id) {
    setTacticCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, up: c.up === 'face' ? 'back' : 'face' } : c)),
    )
  }

  // Delete key over a tactic card
  function handleTacticRemove(id) {
    table.transact(() => {
      setTacticCards((prev) => prev.filter((c) => c.id !== id))
      removeCardPiles([id])
    })
  }

  // Token piles for new tactic cards ([{ id, key, team }] as in tacticCards): one pile per token of each card, in the order
  // of the cards, on the first free places beside the owner's tray. `card` links a pile to its card, so
  // the pile goes with it (removeCardPiles). Reads the document, not React state.
  function makeCardPiles(cards) {
    return cardPiles(cards, table.tokenPiles.read(), (key) => getTactic(key)?.tokens ?? [])
  }

  // The piles of tactic cards that leave the table go too. A pile without `card` stays.
  function removeCardPiles(cardIds) {
    setTokenPiles((prev) => prev.filter((p) => !cardIds.includes(p.card)))
  }

  return {
    handleTurnMat,
    handleMapChange,
    handleLockKey,
    handleTerrainRemove,
    handleTerrainUndo,
    handleLooseRemove,
    handlePileRemove,
    handleTacticSpawn,
    handleTacticMove,
    handleTacticFlip,
    handleTacticRemove,
    makeCardPiles,
  }
}
