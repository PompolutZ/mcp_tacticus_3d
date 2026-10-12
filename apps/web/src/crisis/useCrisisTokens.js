import { useEffect, useRef } from 'react'
import { getCard } from './cards.js'
import { buildMatTokens, supplyToken } from './matTokens.js'
import { priorityOf } from '../setup/setup.js'
import { characterDropPlacer, characterName } from '../characters/characters.js'
import { BASE_DIAMETER } from '../characters/files.js'
import { trayHeldDefault } from '../characters/trays.js'
import { getToken } from '../tokens/tokens.js'
import { deselectPiece } from '../selection.js'
import { panToPoint } from '../camera.js'
import { playSound } from '../sound.js'
import {
  droppedToken,
  dropRowOffset,
  modelsToReturn,
  placedToken,
  placerSide,
  waitLinesOf,
  waitingTokens,
} from '../tokens/dropWait.js'

// The crisis tokens on the table and the dropped objective tokens that wait for their place: the notice lines,
// the sound of a new wait, the token handlers, the drop and the placing (docs/features/crisis.md,
// docs/features/character-trays.md, "Hold and drop"). Call it after the log writer, the selection and the tools,
// at the place of the effect: the effect runs among the passive effects in this order.
export function useCrisisTokens({
  table,
  room,
  ownSide,
  playedSides,
  nameCtx,
  characters,
  crisis,
  setCrisis,
  tokens,
  setTokens,
  setup,
  setSelection,
  writeLog,
  characterLogData,
  writeHeldLog,
  placeTool,
  modelPositionRef,
  returnModelsRef,
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
  const multiplayerRoom = Boolean(room?.multiplayer)
  useEffect(() => {
    const sides = multiplayerRoom ? [ownSide] : ['host', 'guest']
    const ids = new Set(
      waitingTokens(tokens)
        .filter((t) => sides.includes(t.placeBy))
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
  }, [tokens, multiplayerRoom, ownSide])

  // type: 'secure' | 'extract'. key: a card key, or null for "None". The old card takes its tokens with it,
  // also the supply tokens that players took from its pile. The new card's tokens turn with the Priority
  // of the game setup (buildMatTokens).
  function handleCrisisChange(type, key) {
    const oldKey = crisis[type]
    table.transact(() => {
      setCrisis((prev) => ({ ...prev, [type]: key }))
      setTokens((prev) => {
        const kept = prev.filter((t) => t.cardKey !== oldKey)
        const card = getCard(key)
        return card ? [...kept, ...buildMatTokens(card, priorityOf(setup) === 'guest')] : kept
      })
    })
    // The selected token may no longer exist; a selected character is not affected.
    setSelection((prev) => prev.filter((p) => p.kind !== 'token'))
  }

  // A held token dragged off its tray card and released on the table is no longer held.
  function handleTokenMove(id, x, z) {
    playSound('tokenPlace')
    // A dropped token that waits for its place is placed where it is released
    if (table.tokens.read().find((t) => t.id === id)?.placeBy) {
      placeTokens([id], { [id]: { x, z } })
      return
    }
    const token = tokens.find((t) => t.id === id)
    table.transact(() => {
      setTokens((prev) =>
        prev.map((t) => (t.id === id ? { ...t, x, z, heldBy: null, heldAt: null } : t)),
      )
      if (token?.heldBy)
        writeHeldLog(
          characters.find((ch) => ch.id === token.heldBy),
          token,
          false,
        )
    })
  }

  function handleTokenTurn(id, yaw) {
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, yaw } : t)))
  }

  function handleTokenFlip(id) {
    setTokens((prev) =>
      prev.map((t) =>
        t.id === id && t.canFlip ? { ...t, up: t.up === 'front' ? 'back' : 'front' } : t,
      ),
    )
  }

  function handleTokenControl(id, control) {
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, control } : t)))
  }

  function handleTokenDamage(id, damage) {
    setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, damage } : t)))
  }

  // A canHold token is released over a character (CrisisToken.jsx reports it, Scene.jsx finds the
  // character with characterAt): that character now holds it. The token leaves the mat (Scene.jsx
  // keeps heldBy tokens out of the tool snap list) and lies on its holder's tray card, on the
  // character art (trays.js, trayHeldDefault). No range check (see docs/features/crisis.md, "Players
  // apply the rules"). cardPoint: the tray-local [x, z] on the character's card when the release
  // point is on its tray, otherwise null. It is used only to move a token on its own holder's card:
  // a token given to a character always goes to the default place.
  function handleTokenHold(id, characterId, cardPoint) {
    const held = tokens.find((t) => t.id === id)
    table.transact(() => {
      setTokens((prev) => {
        const token = prev.find((t) => t.id === id)
        if (!token) return prev
        if (token.heldBy === characterId) {
          return cardPoint ? prev.map((t) => (t.id === id ? { ...t, heldAt: cardPoint } : t)) : prev
        }
        const heldCount = prev.filter((t) => t.heldBy === characterId).length
        return prev.map((t) =>
          t.id === id ? { ...t, heldBy: characterId, heldAt: trayHeldDefault(heldCount) } : t,
        )
      })
      // A move on its own holder's card is no entry
      if (held && held.heldBy !== characterId)
        writeHeldLog(
          characters.find((ch) => ch.id === characterId),
          held,
          true,
        )
    })
  }

  // A new supply token from the pile of a Source card (handleTokenRelease), with the id of the drag. Released over a
  // character: that character holds it, at the default place on its card, the same as
  // handleTokenHold. Otherwise it lies on the table at (x, z).
  function handleSupplyTake(cardKey, x, z, characterId, id) {
    const card = getCard(cardKey)
    if (!card?.supply) return
    table.transact(() => {
      setTokens((prev) => {
        const token = supplyToken(card, x, z, id)
        if (!characterId) return [...prev, token]
        const heldCount = prev.filter((t) => t.heldBy === characterId).length
        return [...prev, { ...token, heldBy: characterId, heldAt: trayHeldDefault(heldCount) }]
      })
      if (characterId)
        writeHeldLog(
          characters.find((ch) => ch.id === characterId),
          supplyToken(card, x, z, id),
          true,
        )
    })
  }

  // Delete key over a token on a character's card, as in TTS. Players remove a Source's supply
  // tokens in the Cleanup Phase, and the pile gives new ones. The hover can outlive the hold (a
  // drag off the card ends on the table before the pointer leaves the token), so only a token that
  // is still held is removed.
  function handleHeldRemove(id) {
    if (!tokens.find((t) => t.id === id)?.heldBy) return
    setTokens((prev) => prev.filter((t) => t.id !== id))
    setSelection((prev) => deselectPiece(prev, { kind: 'token', id }))
  }

  // Drop, when its holder is removed: the token goes back on the table, next to the base of the
  // model that held it (the live Rapier/object position, not the spawn position, so a moved
  // character drops it where it stands). rowOffset moves it along the base's edge (+z of the +x drop
  // direction), so several tokens dropped together (handleDropCharacterTokens) land in a row
  // instead of stacked on each other. If the holder's position is not available (see Scene.jsx,
  // modelPosition), the token stays where it last sat on the mat. During the game, a player drops a
  // token by dragging it from the card to the table (handleTokenMove).
  // wait: { placeBy, offBoard } or null. The token then waits for its place: only the side placeBy places it, and
  // placeFrom keeps the base it dropped from (tokens/dropWait.js).
  function handleTokenDrop(id, rowOffset, wait = null) {
    setTokens((prev) => {
      const token = prev.find((t) => t.id === id)
      if (!token?.heldBy) return prev
      const holder = characters.find((ch) => ch.id === token.heldBy)
      const pos = modelPositionRef.current?.(token.heldBy)
      const baseRadius = holder ? BASE_DIAMETER[holder.base] / 2 : 0
      const dropped = droppedToken(token, { pos, baseRadius, rowOffset, wait })
      return prev.map((t) => (t.id === id ? dropped : t))
    })
  }

  // Remove calls this for a character it is about to remove, so the character drops every token it
  // holds first (see docs/features/character-trays.md, "Hold and drop"). Several tokens spread along a row
  // next to the base (a row spacing apart, dropWait.js) instead of landing on the same spot.
  // wait: { placeBy, offBoard } or null (Dazed and Remove, decision of the plan "game flow"): the tokens then wait
  // for their place and the log tells it. Call it inside a transaction. A character that already has a Remove
  // wait keeps it for the new tokens too, so its models go back when the last one is placed.
  function handleDropCharacterTokens(characterId, wait = null) {
    const held = tokens.filter((t) => t.heldBy === characterId)
    const holder = characters.find((ch) => ch.id === characterId)
    const offBoard =
      Boolean(wait?.offBoard) ||
      tokens.some(
        (t) => t.placeBy && t.placeFrom?.characterId === characterId && t.placeFrom.offBoard,
      )
    const mark = wait && { placeBy: wait.placeBy, offBoard }
    held.forEach((t, i) => {
      const rowOffset = dropRowOffset(i, held.length)
      handleTokenDrop(t.id, rowOffset, mark)
      if (mark && holder)
        writeLog('dropped', {
          ...characterLogData(holder),
          tokenId: t.id,
          tokenName: getToken(t.frontKey)?.name ?? t.frontKey,
          placeBy: mark.placeBy,
        })
    })
  }

  // The side that places what `ch` drops: its opponent, or its controlling player (characters/dropPlacer.js)
  function dropWait(ch, offBoard) {
    return {
      placeBy: placerSide(ch.team, characterDropPlacer(ch.key, ch.side)),
      offBoard,
    }
  }

  // The waiting tokens `ids` are placed: at the points (id → { x, z }) or where they lie (a click on Done). A token
  // that is not waiting is skipped, so a second call does nothing. Only the browser that clears the last waiting
  // token of a character that had Remove puts its models back, as Remove did before the wait.
  function placeTokens(ids, points = {}) {
    const current = table.tokens.read()
    const waiting = current.filter((t) => ids.includes(t.id) && t.placeBy)
    if (waiting.length === 0) return
    const back = modelsToReturn(current, ids)
    table.transact(() => {
      setTokens((prev) =>
        prev.map((t) =>
          ids.includes(t.id) && t.placeBy ? placedToken(t, points[t.id] ?? null) : t,
        ),
      )
      for (const t of waiting) {
        const ch = characters.find((c) => c.id === t.placeFrom?.characterId)
        if (ch)
          writeLog('placed', {
            ...characterLogData(ch),
            side: t.placeBy,
            tokenId: t.id,
            tokenName: getToken(t.frontKey)?.name ?? t.frontKey,
            placeBy: t.placeBy,
          })
      }
    })
    back.forEach((id) => returnModelsRef.current?.(id))
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
    waitLines,
    removeWaits,
    handleCrisisChange,
    handleTokenMove,
    handleTokenTurn,
    handleTokenFlip,
    handleTokenControl,
    handleTokenDamage,
    handleTokenHold,
    handleSupplyTake,
    handleHeldRemove,
    handleDropCharacterTokens,
    dropWait,
    placeTokens,
    handleNoticeShow,
  }
}
