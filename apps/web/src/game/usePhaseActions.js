import { COLOR_NAME } from '../sideColors.js'
import { getCard } from '../crisis/cards.js'
import { characterIsGrunt, characterName, characterPowerBonus } from '../characters/characters.js'
import { characterOnBoard } from '../characters/models.js'
import { powerAfterPhase } from '../characters/power.js'
import { cleanupBlockers, cleanupCharacter } from '../characters/cleanup.js'
import { cleanupCrisisTokens } from '../crisis/cleanup.js'
import { ROUND_POINTS, scoreFromMarkers } from '../scoreboard/board.js'
import { CLEANUP_KEYS } from '../tokens/tokens.js'
import { colorOf, finishDeploy, otherTeam, setupStep } from '../setup/setup.js'
import { gamePriority, priorityAfterCleanup, priorityNote } from './priority.js'
import { cleanupStatus, cleanupText, powerPhaseText } from './phases.js'

// The Power and Cleanup phases and the Priority click (docs/features/round-phases.md). Call it after the
// log writer and the HUD message. The Cleanup chip state is computed at each render.
export function usePhaseActions({
  table,
  room,
  setup,
  characters,
  poses,
  priority,
  nameCtx,
  setSetup,
  setDeployLine,
  setCharacters,
  setLooseTokens,
  setTokens,
  setScoreMarkers,
  setPriorityField,
  writeLog,
  showHudMessage,
}) {
  // Power button in the toolbar and the Power Phase buttons on the table (docs/features/round-phases.md). Gives
  // the Power of the Power Phase to each non-Grunt character of `sides` that has a model on the mat. The
  // toolbar passes the played sides, a table button its own side. The updater form reads the list
  // now, not at the last render, so a change the other browser just made is kept. The updater runs
  // inside setCharacters, so gains is filled when the HUD message is built.
  function handlePowerPhase(sides) {
    const gains = []
    table.transact(() => {
      // The first Power Phase ends the deployment: the setup is done and Deploy Lock is off
      const current = table.setup.read()
      if (setupStep(current) === 'deploy') {
        setSetup((prev) => finishDeploy(prev))
        setDeployLine(false)
        writeLog('deployed', {}, `deployed:${current.id}`)
      }
      setCharacters((prev) =>
        prev.map((ch) => {
          if (!sides.includes(ch.team) || !characterOnBoard(ch, poses)) return ch
          if (characterIsGrunt(ch.key)) return ch
          const power = powerAfterPhase({
            power: ch.power,
            bonus: characterPowerBonus(ch.key, ch.side),
            gems: ch.attached,
            stun: ch.tokens?.stun ?? 0,
            poison: ch.tokens?.poison ?? 0,
            grunt: false,
          })
          gains.push({ side: ch.team, name: characterName(ch.key), from: ch.power, to: power })
          return { ...ch, power }
        }),
      )
      // One entry for each side that gained Power
      for (const side of sides) {
        const own = gains.filter((gain) => gain.side === side)
        if (own.length > 0)
          writeLog('power', {
            side,
            gains: own.map(({ name, from, to }) => ({ name, from, to })),
          })
      }
    })
    // With one side, the message names it
    showHudMessage(
      powerPhaseText(gains, sides, (side) => COLOR_NAME[colorOf(side, setup, Boolean(room))]),
      8000,
    )
  }

  // Cleanup chip state (docs/features/round-phases.md, decision 8): off while a character on the board has
  // neither Activated nor Dazed, and while no character is on the board.
  const {
    empty: cleanupEmpty,
    disabled: cleanupDisabled,
    title: cleanupTitle,
  } = cleanupStatus(characters, poses, (key) => characterName(key))

  // Cleanup button in the toolbar (docs/features/round-phases.md): both sides at once, in one transaction.
  // It checks the blockers again at the click, and does nothing when blocked. Each write uses the updater
  // form, which reads the list now and runs inside set, so flipped and the round are filled after the
  // transaction. flipped lists the Dazed characters, also one that was already Injured.
  function handleCleanupPhase() {
    if (cleanupBlockers(characters, poses).length > 0 || cleanupEmpty) return
    const flipped = []
    let round = null
    // Priority passes when its holder activated last (p12). Read now, inside the transaction.
    const before = gamePriority(table.game.read(), table.setup.read())
    const after = priorityAfterCleanup(before, table.game.read().lastActivated)
    table.transact(() => {
      setCharacters((prev) =>
        prev.map((ch) => {
          if ((ch.tokens?.dazed ?? 0) > 0) flipped.push(characterName(ch.key))
          return cleanupCharacter(ch, CLEANUP_KEYS)
        }),
      )
      setLooseTokens((prev) => prev.filter((t) => !CLEANUP_KEYS.includes(t.key)))
      setTokens((prev) => cleanupCrisisTokens(prev, getCard))
      setScoreMarkers((prev) => {
        // The round after the one under the marker, the same on the last round. Null: the marker is on no
        // spot (a player moved it off the track), so the Cleanup Phase leaves it.
        const current = scoreFromMarkers(prev).round
        if (!current) return prev
        round = Math.min(current + 1, ROUND_POINTS.length)
        const spot = ROUND_POINTS[round - 1]
        return { ...prev, round: { x: spot.x, z: spot.z } }
      })
      if (after !== before) table.game.setField('priority', after)
      table.game.setField('lastActivated', null)
      writeLog('cleanup', { round, flipped, before, after })
    })
    const note = priorityNote(before, after, nameCtx)
    showHudMessage(cleanupText(round, flipped, note), 8000)
  }

  // A click on the Priority marker gives Priority to the other side. Any player can click, also in a
  // multiplayer room, because cards change Priority.
  function handlePriorityClick() {
    if (!priority) return
    table.transact(() => {
      setPriorityField(otherTeam(priority))
      writeLog('priority', { side: otherTeam(priority) })
    })
  }

  return {
    handlePowerPhase,
    cleanupDisabled,
    cleanupTitle,
    handleCleanupPhase,
    handlePriorityClick,
  }
}
