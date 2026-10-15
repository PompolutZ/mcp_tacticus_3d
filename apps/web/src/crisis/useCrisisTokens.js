import { useEffect, useRef } from 'react'
import { getCard } from './cards.js'
import { buildMatTokens, supplyToken } from './matTokens.js'
import { createCrisisActions } from './actions.js'
import { characterDropPlacer, characterName } from '../characters/characters.js'
import { trayHeldDefault } from '../characters/trays.js'
import { getToken } from '../tokens/tokens.js'
import { deselectPiece } from '../selection.js'
import { panToPoint } from '../camera.js'
import { playSound } from '../sound.js'
import { placerSide, waitLinesOf, waitingTokens } from '../tokens/dropWait.js'

// The crisis tokens on the table and the dropped objective tokens that wait for their place: the notice lines,
// the sound of a new wait, the token handlers, the drop and the placing (docs/features/crisis.md,
// docs/features/character-trays.md, "Hold and drop"). Call it after the log writer, the selection and the tools,
// at the place of the effect: the effect runs among the passive effects in this order.
export function useCrisisTokens({
  table,
  playedSides,
  nameCtx,
  characters,
  tokens,
  setSelection,
  writeLog,
  characterLogData,
  writeHeldLog,
  placeTool,
  sceneApi,
  controlsRef,
  wheelCameraRef,
}) {
  // Dropped objective tokens that wait for their place (tokens/dropWait.js): one notice line for each character
  const waitLines = waitLinesOf(tokens, characters, {
    playedSides,
    nameCtx,
    nameOf: characterName,
    tokenNameOf: (key) => getToken(key)?.name ?? key,
  })
  // Remove is off while a dropped token of the character waits, with the same text as its title
  const removeWaits = Object.fromEntries(waitLines.map((line) => [line.characterId, line.text]))
  // The notice sound, once for each new drop that this browser places. The tokens of an open table play nothing.
  const seenWaiting = useRef(null)
  const stopPan = useRef(null)
  useEffect(() => {
    const ids = new Set(
      waitingTokens(tokens)
        .filter((t) => playedSides.includes(t.placeBy))
        .map((t) => t.id),
    )
    const known = seenWaiting.current
    seenWaiting.current = ids
    if (!known) return
    const fresh = waitingTokens(tokens).filter((t) => ids.has(t.id) && !known.has(t.id))
    if (!fresh.length) return
    playSound('notice')
    // The Range 2 tool snaps to the model once per drop. Only the own tool can be written, so in the Sandbox
    // and a single player room it is the own tool also for a token of the other side.
    const characterId = fresh.find((t) => t.placeFrom?.characterId)?.placeFrom.characterId
    if (characterId) placeTool('range', 2, { kind: 'character', id: characterId }, null)
  }, [tokens, playedSides])

  // The document writes (crisis/actions.js). Made every render: the lookups are new functions each time.
  const actions = createCrisisActions(table, {
    getCard,
    buildMatTokens,
    supplyToken,
    trayHeldDefault,
    tokenName: (key) => getToken(key)?.name ?? key,
    modelPosition: (id) => sceneApi.current?.modelPosition(id),
    writeLog,
    writeHeldLog,
    characterLogData,
  })

  // The selected token may no longer exist; a selected character is not affected.
  function handleCrisisChange(type, key) {
    actions.changeCrisis(type, key)
    setSelection((prev) => prev.filter((p) => p.kind !== 'token'))
  }

  // The models of a character that had Remove go back on their cards when its last waiting token is placed
  function returnModels(ids) {
    ids.forEach((id) => sceneApi.current?.returnModels(id))
  }

  function placeTokens(ids, points) {
    returnModels(actions.placeTokens(ids, points))
  }

  function handleTokenMove(id, x, z) {
    playSound('tokenPlace')
    returnModels(actions.moveToken(id, x, z))
  }

  function handleHeldRemove(id) {
    if (actions.removeHeld(id)) setSelection((prev) => deselectPiece(prev, { kind: 'token', id }))
  }

  // The side that places what `ch` drops: its opponent, or its controlling player (characters/dropPlacer.js)
  function dropWait(ch, offBoard) {
    return {
      placeBy: placerSide(ch.team, characterDropPlacer(ch.key, ch.side)),
      offBoard,
    }
  }

  // Show in the notice: the camera target moves to the first waiting token of the character, smooth
  function handleNoticeShow(line) {
    const token = tokens.find((t) => t.id === line.tokenId)
    const controls = controlsRef.current
    if (!token || !controls) return
    wheelCameraRef.current?.stop()
    stopPan.current?.()
    stopPan.current = panToPoint(controls, { x: token.x, y: 0, z: token.z })
  }

  return {
    crisisActions: actions,
    waitLines,
    removeWaits,
    handleCrisisChange,
    handleTokenMove,
    handleTokenTurn: actions.turnToken,
    handleTokenFlip: actions.flipToken,
    handleTokenControl: actions.controlToken,
    handleTokenDamage: actions.damageToken,
    handleTokenHold: actions.holdToken,
    handleSupplyTake: actions.supplyTake,
    handleHeldRemove,
    handleDropCharacterTokens: actions.dropCharacterTokens,
    dropWait,
    placeTokens,
    handleNoticeShow,
  }
}
