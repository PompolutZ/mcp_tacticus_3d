import { COLOR_NAME } from '../sideColors.js'
import { getCard } from '../crisis/cards.js'
import { characterIsGrunt, characterName, characterPowerBonus } from '../characters/characters.js'
import { CLEANUP_KEYS } from '../tokens/tokens.js'
import { colorOf, needsAffiliation } from '../setup/setup.js'
import { isYou, playerName } from '../setup/names.js'
import { createPhaseActions } from './actions.js'
import { priorityNote } from './priority.js'
import { cleanupStatus, cleanupText, powerPhaseText } from './phases.js'

// The Power and Cleanup phases and the Priority click (docs/features/round-phases.md). The document
// writes are in game/actions.js; this hook adds the HUD messages and the chip state. Call it after the log
// writer and the HUD message. The Cleanup chip state is computed at each render.
export function usePhaseActions({
  table,
  room,
  setup,
  characters,
  poses,
  nameCtx,
  writeLog,
  showHudMessage,
}) {
  // The document writes. Made every render: the log writer is a new function each time.
  const actions = createPhaseActions(table, {
    characterIsGrunt,
    characterName,
    characterPowerBonus,
    getCard,
    cleanupKeys: CLEANUP_KEYS,
    writeLog,
  })

  // The reason Power is off for `sides`, or null. Power waits until each side it acts for has its affiliation
  // (docs/features/setup-game.md, "Affiliation"). Used by the HUD button, the table buttons and the setup chip.
  function powerBlockTitle(sides) {
    const side = sides.find((s) => needsAffiliation(setup, s))
    if (!side) return null
    const whose = isYou(side, nameCtx) ? 'your' : `${playerName(side, nameCtx)}'s`
    return `Choose the affiliation of ${whose} squad first.`
  }

  // Power button in the toolbar and the Power Phase buttons on the table (docs/features/round-phases.md). The
  // toolbar passes the played sides, a table button its own side. With one side, the message names it.
  function handlePowerPhase(sides) {
    if (powerBlockTitle(sides)) return
    const { gains } = actions.power(sides)
    showHudMessage(
      powerPhaseText(gains, sides, (side) => COLOR_NAME[colorOf(side, setup, Boolean(room))]),
      8000,
    )
  }

  // Cleanup chip state (docs/features/round-phases.md, decision 8): off while a character on the board has
  // neither Activated nor Dazed, and while no character is on the board.
  const { disabled: cleanupDisabled, title: cleanupTitle } = cleanupStatus(
    characters,
    poses,
    (key) => characterName(key),
  )

  // Cleanup button in the toolbar (docs/features/round-phases.md): both sides at once. Does nothing when blocked.
  function handleCleanupPhase() {
    const done = actions.cleanup()
    if (!done) return
    const note = priorityNote(done.before, done.after, nameCtx)
    showHudMessage(cleanupText(done.round, done.flipped, note), 8000)
  }

  return {
    handlePowerPhase,
    powerBlockTitle,
    cleanupDisabled,
    cleanupTitle,
    handleCleanupPhase,
    handlePriorityClick: actions.priorityClick,
  }
}
