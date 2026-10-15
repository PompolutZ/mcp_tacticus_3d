import { removalOf } from './models.js'

// The document writes of the characters on the table: spawn, Damage, Power, flip, off board, remove, and the
// tokens on a character (docs/features/character-trays.md, "State"). Plain module, no React: it writes only the
// table, each action in one transaction, and reads the table, not render state. It does not ask the player,
// show messages, or touch the selection or the scene: the hook (useCharacterActions) does, with what an
// action returns.
// lookups: the lookups and calls that do not load in Node: newCharacters(character, team),
// characterStamina(key, side), characterImmune(key, side), isCappedToken(key), dropWait(ch, offBoard) (the
// wait of the tokens a character drops), crisis (the crisis actions, crisis/actions.js), and the log:
// writeLog(kind, data), writeStatLog(ch, stat, from, to), characterLogData(ch),
// tokenEntryData(ch, key, on, count).
export function createCharacterActions(table, lookups) {
  const characterOf = (id) => table.characters.read().find((ch) => ch.id === id)
  const patchCharacter = (id, patch) =>
    table.characters.set((prev) => prev.map((ch) => (ch.id === id ? patch(ch) : ch)))

  // The new character's tray goes at the end of its player's row, and the row recenters (see trays.js,
  // layoutTrays). A player has at most one copy of each character (slug): every spawn comes here, so the check
  // covers all of them. Both players can have the same character. Returns { duplicate: true } when the player
  // has it already.
  function spawn(ch) {
    if (table.characters.read().some((c) => c.key === ch.slug && c.team === ch.team))
      return { duplicate: true }
    // The host and its grunts (newCharacters)
    table.characters.set((prev) => [...prev, ...lookups.newCharacters(ch, ch.team)])
    return { duplicate: false }
  }

  // Damage never goes below 0 or above the Stamina of the side that faces up (p16).
  function damage(id, value) {
    const target = characterOf(id)
    if (!target) return
    const to = Math.max(0, Math.min(value, lookups.characterStamina(target.key, target.side)))
    table.transact(() => {
      patchCharacter(id, (ch) => ({ ...ch, damage: to }))
      lookups.writeStatLog(target, 'damage', target.damage ?? 0, to)
    })
  }

  // Power never goes below 0 or above 10 (p7-8).
  function power(id, value) {
    const target = characterOf(id)
    if (!target || target.host) return
    const to = Math.max(0, Math.min(value, 10))
    table.transact(() => {
      patchCharacter(id, (ch) => ({ ...ch, power: to }))
      lookups.writeStatLog(target, 'power', target.power ?? 0, to)
    })
  }

  // Flip turns the card to the other side and clears Damage, the same as in TTS. A grunt has no Injured side: it
  // does not flip.
  function flip(id) {
    const target = characterOf(id)
    if (!target || target.host) return
    const to = target.side === 'healthy' ? 'injured' : 'healthy'
    table.transact(() => {
      patchCharacter(id, (ch) => ({ ...ch, side: to, damage: 0 }))
      lookups.writeLog('flip', { ...lookups.characterLogData(target), to })
    })
  }

  // Remove button on the tray: the character leaves the board (a KO'd character, p16). Its held tokens drop next
  // to the model first (the live position). The character, its tray, tokens, Damage and Power stay. With held
  // tokens, the models stay until the tokens are placed (crisis placeTokens). Returns { returnModels }: true
  // when the models go back on their cards now.
  function offBoard(id) {
    const target = characterOf(id)
    const holds = Boolean(target) && table.tokens.read().some((t) => t.heldBy === id)
    table.transact(() => {
      if (target) lookups.writeLog('offBoard', lookups.characterLogData(target))
      lookups.crisis.dropCharacterTokens(id, holds ? lookups.dropWait(target, true) : null)
    })
    return { returnModels: !holds }
  }

  // Removes a character with its grunts. Drops every token the character and its grunts hold first (p10), then
  // removes them: models and trays come from the same characters list, so one write removes all three. The
  // poses of their models go too, constructs included. A grunt id removes nothing: a grunt goes only with its
  // host. Returns { characters, models }, the ids removed (the hook clears the selection and the popup that
  // point at them), or null when nothing was removed.
  function remove(id) {
    const all = table.characters.read()
    const target = all.find((ch) => ch.id === id)
    const { characters: ids, models: modelIds } = removalOf(all, id)
    if (!target || ids.length === 0) return null
    table.transact(() => {
      lookups.writeLog('deleted', lookups.characterLogData(target))
      for (const removedId of ids) lookups.crisis.dropCharacterTokens(removedId)
      table.characters.set((prev) => prev.filter((ch) => ch.id !== id && ch.host !== id))
      // Every model of the character: the first, the second form and the constructs
      table.poses.set((poses) =>
        Object.fromEntries(Object.entries(poses).filter(([key]) => !modelIds.includes(key))),
      )
    })
    return { characters: ids, models: modelIds }
  }

  // Gives one of tokenKey to a character. A character cannot get a condition it is immune to (p21): nothing
  // changes and given is false. Conditions, Activated and Dazed stay at 1 at most (p17); every other token counts
  // up. given is true then, also for a token at its limit: the dropped token is used up, as in TTS, where the tray
  // deletes it. Returns { given, target }.
  function giveToken(id, tokenKey) {
    const target = characterOf(id)
    if (target && lookups.characterImmune(target.key, target.side).includes(tokenKey))
      return { given: false, target }
    // The Activated token also records the side of the character, for the Cleanup Phase (priority.js)
    table.transact(() => {
      patchCharacter(id, (ch) => {
        const count = ch.tokens[tokenKey] ?? 0
        if (lookups.isCappedToken(tokenKey) && count >= 1) return ch
        return { ...ch, tokens: { ...ch.tokens, [tokenKey]: count + 1 } }
      })
      if (tokenKey === 'activated' && target) table.game.setField('lastActivated', target.team)
      // A capped token that is already there changes nothing, so it has no entry
      const had = target?.tokens[tokenKey] ?? 0
      if (target && !(lookups.isCappedToken(tokenKey) && had >= 1))
        lookups.writeLog('token', lookups.tokenEntryData(target, tokenKey, true, had + 1))
      // A new Dazed token makes the character drop its objective tokens (p10)
      if (tokenKey === 'dazed' && target && had === 0)
        lookups.crisis.dropCharacterTokens(id, lookups.dropWait(target, false))
    })
    return { given: true, target }
  }

  // A click on a token in the tray's "On" row removes one.
  function removeToken(id, tokenKey) {
    const target = characterOf(id)
    table.transact(() => {
      patchCharacter(id, (ch) => {
        const count = (ch.tokens[tokenKey] ?? 0) - 1
        const tokens = { ...ch.tokens }
        if (count > 0) tokens[tokenKey] = count
        else delete tokens[tokenKey]
        return { ...ch, tokens }
      })
      const had = target?.tokens[tokenKey] ?? 0
      if (target && had > 0)
        lookups.writeLog('token', lookups.tokenEntryData(target, tokenKey, false, had - 1))
    })
  }

  return { spawn, damage, power, flip, offBoard, remove, giveToken, removeToken }
}
