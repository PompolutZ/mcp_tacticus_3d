import { BASE_DIAMETER } from '../characters/files.js'
import { priorityOf } from '../setup/setup.js'
import { droppedToken, dropRowOffset, modelsToReturn, placedToken } from '../tokens/dropWait.js'

// The document writes of the crisis cards and the crisis tokens (docs/features/crisis.md, "Code"). Plain module,
// no React: it writes only the table, each action in one transaction, and reads the table, not render state.
// It does not touch the selection, the sounds or the scene: the hook (useCrisisTokens) does, with what an
// action returns.
// lookups: the lookups and calls that do not load in Node: getCard(key), buildMatTokens(card, turned),
// supplyToken(card, x, z, id), trayHeldDefault(heldCount), tokenName(key), modelPosition(characterId) (the
// live position of a model, or undefined), and the log: writeLog(kind, data), writeHeldLog(ch, token, on),
// characterLogData(ch).
export function createCrisisActions(table, lookups) {
  const characterOf = (id) => table.characters.read().find((ch) => ch.id === id)

  // type: 'secure' | 'extract'. key: a card key, or null for "None". The old card takes its tokens with it,
  // also the supply tokens that players took from its pile. The new card's tokens turn with the Priority
  // of the game setup (buildMatTokens).
  function changeCrisis(type, key) {
    const oldKey = table.game.get('crisis')?.[type]
    const turned = priorityOf(table.setup.read()) === 'guest'
    table.transact(() => {
      table.game.setField('crisis', (prev) => ({ ...prev, [type]: key }))
      table.tokens.set((prev) => {
        const kept = prev.filter((t) => t.cardKey !== oldKey)
        const card = lookups.getCard(key)
        return card ? [...kept, ...lookups.buildMatTokens(card, turned)] : kept
      })
    })
  }

  const patchToken = (id, patch) =>
    table.tokens.set((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  // A held token dragged off its tray card and released on the table is no longer held. A dropped token that
  // waits for its place is placed where it is released. Returns the ids of the characters whose models go
  // back (placeTokens).
  function moveToken(id, x, z) {
    const token = table.tokens.read().find((t) => t.id === id)
    if (token?.placeBy) return placeTokens([id], { [id]: { x, z } })
    table.transact(() => {
      patchToken(id, { x, z, heldBy: null, heldAt: null })
      if (token?.heldBy) lookups.writeHeldLog(characterOf(token.heldBy), token, false)
    })
    return []
  }

  const turnToken = (id, yaw) => patchToken(id, { yaw })
  const controlToken = (id, control) => patchToken(id, { control })
  const damageToken = (id, damage) => patchToken(id, { damage })

  function flipToken(id) {
    table.tokens.set((prev) =>
      prev.map((t) =>
        t.id === id && t.canFlip ? { ...t, up: t.up === 'front' ? 'back' : 'front' } : t,
      ),
    )
  }

  // A canHold token is released over a character: that character now holds it, on its tray card, at the default
  // place. No range check (docs/features/crisis.md, "Players apply the rules"). cardPoint: the tray-local
  // [x, z] on the character's card when the release point is on its tray, otherwise null. It is used only to
  // move a token on its own holder's card: a token given to a character always goes to the default place.
  function holdToken(id, characterId, cardPoint) {
    const held = table.tokens.read().find((t) => t.id === id)
    table.transact(() => {
      table.tokens.set((prev) => {
        const token = prev.find((t) => t.id === id)
        if (!token) return prev
        if (token.heldBy === characterId) {
          return cardPoint ? prev.map((t) => (t.id === id ? { ...t, heldAt: cardPoint } : t)) : prev
        }
        const heldCount = prev.filter((t) => t.heldBy === characterId).length
        return prev.map((t) =>
          t.id === id
            ? { ...t, heldBy: characterId, heldAt: lookups.trayHeldDefault(heldCount) }
            : t,
        )
      })
      // A move on its own holder's card is no entry
      if (held && held.heldBy !== characterId)
        lookups.writeHeldLog(characterOf(characterId), held, true)
    })
  }

  // A new supply token from the pile of a Source card, with the id of the drag. Released over a character:
  // that character holds it, at the default place on its card, the same as holdToken. Otherwise it lies on
  // the table at (x, z).
  function supplyTake(cardKey, x, z, characterId, id) {
    const card = lookups.getCard(cardKey)
    if (!card?.supply) return
    table.transact(() => {
      table.tokens.set((prev) => {
        const token = lookups.supplyToken(card, x, z, id)
        if (!characterId) return [...prev, token]
        const heldCount = prev.filter((t) => t.heldBy === characterId).length
        return [
          ...prev,
          { ...token, heldBy: characterId, heldAt: lookups.trayHeldDefault(heldCount) },
        ]
      })
      if (characterId)
        lookups.writeHeldLog(characterOf(characterId), lookups.supplyToken(card, x, z, id), true)
    })
  }

  // Delete key over a token on a character's card. Players remove a Source's supply tokens in the Cleanup
  // Phase, and the pile gives new ones. The hover can outlive the hold, so only a token that is still held is
  // removed. Returns true when it removed.
  function removeHeld(id) {
    if (!table.tokens.read().find((t) => t.id === id)?.heldBy) return false
    table.tokens.set((prev) => prev.filter((t) => t.id !== id))
    return true
  }

  // Drop, when its holder is removed: the token goes back on the table, next to the base of the model that held
  // it (the live position, so a moved character drops it where it stands). rowOffset moves it along the
  // base's edge. If the position is not available, the token stays where it last sat.
  // wait: { placeBy, offBoard } or null. The token then waits for its place (tokens/dropWait.js).
  function dropToken(id, rowOffset, wait = null) {
    table.tokens.set((prev) => {
      const token = prev.find((t) => t.id === id)
      if (!token?.heldBy) return prev
      const holder = characterOf(token.heldBy)
      const pos = lookups.modelPosition(token.heldBy)
      const baseRadius = holder ? BASE_DIAMETER[holder.base] / 2 : 0
      const dropped = droppedToken(token, { pos, baseRadius, rowOffset, wait })
      return prev.map((t) => (t.id === id ? dropped : t))
    })
  }

  // Remove calls this for a character it is about to remove, so the character drops every token it holds first
  // (docs/features/character-trays.md, "Hold and drop"). Several tokens spread along a row next to the base.
  // wait: { placeBy, offBoard } or null: the tokens then wait for their place and the log tells it. A character
  // that already has a Remove wait keeps it for the new tokens too, so its models go back when the last one is
  // placed.
  function dropCharacterTokens(characterId, wait = null) {
    const all = table.tokens.read()
    const held = all.filter((t) => t.heldBy === characterId)
    const holder = characterOf(characterId)
    const offBoard =
      Boolean(wait?.offBoard) ||
      all.some((t) => t.placeBy && t.placeFrom?.characterId === characterId && t.placeFrom.offBoard)
    const mark = wait && { placeBy: wait.placeBy, offBoard }
    table.transact(() => {
      held.forEach((t, i) => {
        dropToken(t.id, dropRowOffset(i, held.length), mark)
        if (mark && holder)
          lookups.writeLog('dropped', {
            ...lookups.characterLogData(holder),
            tokenId: t.id,
            tokenName: lookups.tokenName(t.frontKey),
            placeBy: mark.placeBy,
          })
      })
    })
  }

  // The waiting tokens `ids` are placed: at the points (id → { x, z }) or where they lie (a click on Done). A
  // token that is not waiting is skipped, so a second call does nothing. Returns the ids to put models back for:
  // only the browser that clears the last waiting token of a character that had Remove puts its models back, as
  // Remove did before the wait.
  function placeTokens(ids, points = {}) {
    const current = table.tokens.read()
    const waiting = current.filter((t) => ids.includes(t.id) && t.placeBy)
    if (waiting.length === 0) return []
    const back = modelsToReturn(current, ids)
    table.transact(() => {
      table.tokens.set((prev) =>
        prev.map((t) =>
          ids.includes(t.id) && t.placeBy ? placedToken(t, points[t.id] ?? null) : t,
        ),
      )
      for (const t of waiting) {
        const ch = characterOf(t.placeFrom?.characterId)
        if (ch)
          lookups.writeLog('placed', {
            ...lookups.characterLogData(ch),
            side: t.placeBy,
            tokenId: t.id,
            tokenName: lookups.tokenName(t.frontKey),
            placeBy: t.placeBy,
          })
      }
    })
    return back
  }

  return {
    changeCrisis,
    moveToken,
    turnToken,
    flipToken,
    controlToken,
    damageToken,
    holdToken,
    supplyTake,
    removeHeld,
    dropToken,
    dropCharacterTokens,
    placeTokens,
  }
}
