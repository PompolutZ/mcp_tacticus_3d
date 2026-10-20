import { COLOR_NAME } from '../sideColors.js'
import { colorOf } from '../setup/setup.js'
import { createCharacterActions } from './actions.js'
import { newCharacters } from './newCharacter.js'
import { characterImmune, characterName, characterStamina } from './characters.js'
import { getToken, isCappedToken } from '../tokens/tokens.js'
import { deselectPiece } from '../selection.js'

// The character handlers: spawn, Damage, Power, flip, give and remove a token, off board, and Remove
// (docs/features/character-trays.md, "State"). The document writes are in characters/actions.js; this hook adds
// the HUD messages, the confirm, the selection and the scene. Call it after the log writer, the selection and
// the crisis tokens: it uses the drop functions and the wait lines of useCrisisTokens.
export function useCharacterActions({
  table,
  room,
  setup,
  characters,
  crisisActions,
  setSelection,
  setOpenTrayId,
  showHudMessage,
  writeLog,
  writeStatLog,
  characterLogData,
  tokenEntryData,
  dropWait,
  removeWaits,
  sceneApi,
}) {
  // The document writes. Made every render: the log writers and the crisis calls are new functions each time.
  const actions = createCharacterActions(table, {
    newCharacters,
    characterStamina,
    characterImmune,
    isCappedToken,
    dropWait,
    crisis: crisisActions,
    writeLog,
    writeStatLog,
    characterLogData,
    tokenEntryData,
  })

  function handleSpawn(ch) {
    if (actions.spawn(ch).duplicate)
      showHudMessage(
        `${COLOR_NAME[colorOf(ch.team, setup, Boolean(room))]} player already has ${ch.name} on the table`,
      )
  }

  // Remove button on the tray (actions.offBoard). The selection stays: the models are still there. Remove waits
  // while a dropped token of the character waits for its place.
  function handleCharacterOffBoard(id) {
    if (removeWaits[id]) return
    if (actions.offBoard(id).returnModels) sceneApi.current?.returnModels(id)
  }

  // Delete key over a tray card. The confirm names the character, because it takes the tray with it.
  // A grunt cannot be deleted alone: the key on a grunt card does nothing (docs/features/character-trays.md,
  // "Grunts").
  function handleTrayCardDelete(id) {
    const ch = characters.find((c) => c.id === id)
    if (!ch) return
    if (ch.host) {
      showHudMessage(`${characterName(ch.key)} is removed with its host.`)
      return
    }
    const grunts = characters.some((c) => c.host === id)
    const also = grunts ? ' Its grunts are removed too.' : ''
    if (
      window.confirm(
        `Remove ${characterName(ch.key)} from the table? Its tray is removed too.${also}`,
      )
    )
      handleCharacterRemove(id)
  }

  // Removes a character with its grunts (actions.remove). Also clears a selection or popup that still points at
  // them, so nothing keeps the id or its Rapier body after the model unmounts. The game setup calls this too,
  // when a restart removes the squads.
  function handleCharacterRemove(id) {
    const removed = actions.remove(id)
    if (!removed) return
    setSelection((prev) =>
      removed.models.reduce(
        (sel, modelId) => deselectPiece(sel, { kind: 'character', id: modelId }),
        prev,
      ),
    )
    setOpenTrayId((prev) => (removed.characters.includes(prev) ? null : prev))
  }

  // Gives one token to a character. The HUD shows why when the character is immune (p21); the result is then
  // false (the drop does nothing).
  function handleCharacterTokenGive(id, tokenKey) {
    const { given, target } = actions.giveToken(id, tokenKey)
    if (!given)
      showHudMessage(
        `${characterName(target.key)} is immune to ${getToken(tokenKey)?.name ?? tokenKey}.`,
      )
    return given
  }

  // A click on a Give source of a tray. Activated on a host with grunts goes to the grunts first
  // (actions.giveActivated); every other token is as a drop.
  function handleCharacterSourceClick(id, tokenKey) {
    if (tokenKey !== 'activated') return handleCharacterTokenGive(id, tokenKey)
    const { given, target } = actions.giveActivated(id)
    if (!given)
      showHudMessage(
        `${characterName(target.key)} is immune to ${getToken(tokenKey)?.name ?? tokenKey}.`,
      )
    return given
  }

  return {
    handleSpawn,
    handleCharacterDamage: actions.damage,
    handleCharacterPower: actions.power,
    handleCharacterFlip: actions.flip,
    handleCharacterOffBoard,
    handleTrayCardDelete,
    handleCharacterRemove,
    handleCharacterTokenGive,
    handleCharacterSourceClick,
    handleCharacterTokenRemove: actions.removeToken,
    handleCharacterSwap: actions.swap,
  }
}
