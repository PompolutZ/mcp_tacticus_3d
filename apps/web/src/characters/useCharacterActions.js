import { COLOR_NAME } from '../sideColors.js'
import { colorOf } from '../setup/setup.js'
import { newCharacter } from './newCharacter.js'
import { characterImmune, characterName, characterStamina } from './characters.js'
import { secondModelId } from './models.js'
import { getToken, isCappedToken } from '../tokens/tokens.js'
import { deselectPiece } from '../selection.js'

// The character handlers: spawn, Damage, Power, flip, give and remove a token, off board, and Remove
// (docs/features/character-trays.md). Call it after the log writer, the selection and the crisis tokens: it
// uses the drop functions and the wait lines of useCrisisTokens.
export function useCharacterActions({
  table,
  room,
  setup,
  characters,
  setCharacters,
  tokens,
  setSelection,
  setOpenTrayId,
  showHudMessage,
  writeLog,
  writeStatLog,
  characterLogData,
  tokenEntryData,
  handleDropCharacterTokens,
  dropWait,
  removeWaits,
  returnModelsRef,
}) {
  // The new character's tray goes at the end of its player's row, and the row recenters (see
  // trays.js, layoutTrays). A player has at most one copy of each character (slug): every spawn comes
  // here, so the check covers all of them. The two Sentinel MK4 sculpts have their own slugs, so a
  // player can have both. Both players can have the same character.
  function handleSpawn(ch) {
    if (characters.some((c) => c.key === ch.slug && c.team === ch.team)) {
      showHudMessage(
        `${COLOR_NAME[colorOf(ch.team, setup, Boolean(room))]} player already has ${ch.name} on the table`,
      )
      return
    }
    setCharacters((prev) => [...prev, newCharacter(ch, ch.team)])
  }

  // Damage never goes below 0 or above the Stamina of the side that faces up (p16).
  function handleCharacterDamage(id, damage) {
    const target = table.characters.read().find((ch) => ch.id === id)
    if (!target) return
    const to = Math.max(0, Math.min(damage, characterStamina(target.key, target.side)))
    table.transact(() => {
      setCharacters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, damage: to } : ch)))
      writeStatLog(target, 'damage', target.damage ?? 0, to)
    })
  }

  // Power never goes below 0 or above 10 (p7-8).
  function handleCharacterPower(id, power) {
    const target = table.characters.read().find((ch) => ch.id === id)
    if (!target) return
    const to = Math.max(0, Math.min(power, 10))
    table.transact(() => {
      setCharacters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, power: to } : ch)))
      writeStatLog(target, 'power', target.power ?? 0, to)
    })
  }

  // Flip turns the card to the other side and clears Damage, the same as in TTS.
  function handleCharacterFlip(id) {
    const target = table.characters.read().find((ch) => ch.id === id)
    if (!target) return
    const to = target.side === 'healthy' ? 'injured' : 'healthy'
    table.transact(() => {
      setCharacters((prev) =>
        prev.map((ch) => (ch.id === id ? { ...ch, side: to, damage: 0 } : ch)),
      )
      writeLog('flip', { ...characterLogData(target), to })
    })
  }

  // Remove button on the tray: the character leaves the board (a KO'd character, p16). Its held tokens
  // drop next to the model first (the live position), then each model goes back on its card (Scene.jsx,
  // returnModels). The character, its tray, tokens, Damage and Power stay. The selection stays too:
  // the models are still there.
  // With held tokens, the models stay until the tokens are placed (placeTokens). Remove waits then.
  function handleCharacterOffBoard(id) {
    const target = characters.find((ch) => ch.id === id)
    if (removeWaits[id]) return
    const holds = Boolean(target) && tokens.some((t) => t.heldBy === id)
    table.transact(() => {
      if (target) writeLog('offBoard', characterLogData(target))
      handleDropCharacterTokens(id, holds ? dropWait(target, true) : null)
    })
    if (!holds) returnModelsRef.current?.(id)
  }

  // Delete key over a tray card. The confirm names the character, because it takes the tray with it.
  function handleTrayCardDelete(id) {
    const ch = characters.find((c) => c.id === id)
    if (!ch) return
    if (window.confirm(`Remove ${characterName(ch.key)} from the table? Its tray is removed too.`))
      handleCharacterRemove(id)
  }

  // Delete key over a tray card (handleTrayCardDelete) removes a character. Drops every token
  // the character holds first (p10), then removes the character: its model and its tray both come
  // from the same characters array (Scene.jsx), so one state update removes all three. The poses of
  // its models go too. Also clears a selection or popup that still points at it, so nothing keeps the
  // id or its Rapier body after the model unmounts.
  function handleCharacterRemove(id) {
    const target = characters.find((ch) => ch.id === id)
    table.transact(() => {
      if (target) writeLog('deleted', characterLogData(target))
      handleDropCharacterTokens(id)
      setCharacters((prev) => prev.filter((ch) => ch.id !== id))
      table.poses.set(({ [id]: _first, [secondModelId(id)]: _second, ...rest }) => rest)
    })
    setSelection((prev) =>
      deselectPiece(deselectPiece(prev, { kind: 'character', id }), {
        kind: 'character',
        id: secondModelId(id),
      }),
    )
    setOpenTrayId((prev) => (prev === id ? null : prev))
  }

  // Gives one of tokenKey to a character. A character cannot get a condition it is immune to
  // (p21): the drop does nothing, the HUD shows why, and the result is false. Conditions, Activated
  // and Dazed stay at 1 at most (p17); every other token counts up (see docs/features/character-trays.md,
  // "Players apply the rules"). The result is true then, also for a token at its limit: the
  // dropped token is used up, as in TTS, where the tray deletes it.
  function handleCharacterTokenGive(id, tokenKey) {
    const target = characters.find((ch) => ch.id === id)
    if (target && characterImmune(target.key, target.side).includes(tokenKey)) {
      showHudMessage(
        `${characterName(target.key)} is immune to ${getToken(tokenKey)?.name ?? tokenKey}.`,
      )
      return false
    }
    // The Activated token also records the side of the character, for the Cleanup Phase (priority.js)
    table.transact(() => {
      setCharacters((prev) =>
        prev.map((ch) => {
          if (ch.id !== id) return ch
          const count = ch.tokens[tokenKey] ?? 0
          if (isCappedToken(tokenKey) && count >= 1) return ch
          return { ...ch, tokens: { ...ch.tokens, [tokenKey]: count + 1 } }
        }),
      )
      if (tokenKey === 'activated' && target) table.game.setField('lastActivated', target.team)
      // A capped token that is already there changes nothing, so it has no entry
      const had = target?.tokens[tokenKey] ?? 0
      if (target && !(isCappedToken(tokenKey) && had >= 1))
        writeLog('token', tokenEntryData(target, tokenKey, true, had + 1))
      // A new Dazed token makes the character drop its objective tokens (p10)
      if (tokenKey === 'dazed' && target && had === 0)
        handleDropCharacterTokens(id, dropWait(target, false))
    })
    return true
  }

  // A click on a token in the tray's "On" row removes one.
  function handleCharacterTokenRemove(id, tokenKey) {
    const target = characters.find((ch) => ch.id === id)
    table.transact(() => {
      setCharacters((prev) =>
        prev.map((ch) => {
          if (ch.id !== id) return ch
          const count = (ch.tokens[tokenKey] ?? 0) - 1
          const tokens = { ...ch.tokens }
          if (count > 0) tokens[tokenKey] = count
          else delete tokens[tokenKey]
          return { ...ch, tokens }
        }),
      )
      const had = target?.tokens[tokenKey] ?? 0
      if (target && had > 0) writeLog('token', tokenEntryData(target, tokenKey, false, had - 1))
    })
  }

  return {
    handleSpawn,
    handleCharacterDamage,
    handleCharacterPower,
    handleCharacterFlip,
    handleCharacterOffBoard,
    handleTrayCardDelete,
    handleCharacterRemove,
    handleCharacterTokenGive,
    handleCharacterTokenRemove,
  }
}
