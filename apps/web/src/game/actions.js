import { characterOnBoard } from '../characters/models.js'
import { powerAfterPhase } from '../characters/power.js'
import { cleanupCharacter } from '../characters/cleanup.js'
import { cleanupCrisisTokens } from '../crisis/cleanup.js'
import { ROUND_POINTS, scoreFromMarkers } from '../scoreboard/board.js'
import { finishDeploy, otherTeam, setupStep } from '../setup/setup.js'
import { gamePriority, priorityAfterCleanup } from './priority.js'
import { cleanupStatus } from './phases.js'

// The document writes of the Power and Cleanup phases and the Priority click (docs/features/round-phases.md). Plain module, no React: it writes only the table, each action in one transaction, and reads the
// table, not render state. It does not show messages: the hook (usePhaseActions) does, with what an action
// returns.
// lookups: the lookups that do not load in Node: characterIsGrunt(key), characterName(key),
// characterPowerBonus(key, side), getCard(key), cleanupKeys (the keys of the tokens the Cleanup Phase
// removes), and the log: writeLog(kind, data, id).
export function createPhaseActions(table, lookups) {
  // Power button in the toolbar and the Power Phase buttons on the table. Gives the Power of the Power Phase to
  // each non-Grunt character of `sides` that has a model on the mat. The first Power Phase ends the
  // deployment: the setup is done and Deploy Lock is off. Returns { gains }, [{ side, name, from, to }].
  function power(sides) {
    const gains = []
    table.transact(() => {
      const current = table.setup.read()
      if (setupStep(current) === 'deploy') {
        table.setup.set(finishDeploy)
        table.game.setField('deployLine', false)
        lookups.writeLog('deployed', {}, `deployed:${current.id}`)
      }
      const poses = table.poses.read()
      table.characters.set((prev) =>
        prev.map((ch) => {
          if (!sides.includes(ch.team) || !characterOnBoard(ch, poses)) return ch
          if (lookups.characterIsGrunt(ch.key)) return ch
          const next = powerAfterPhase({
            power: ch.power,
            bonus: lookups.characterPowerBonus(ch.key, ch.side),
            gems: ch.attached,
            stun: ch.tokens?.stun ?? 0,
            poison: ch.tokens?.poison ?? 0,
            grunt: false,
          })
          gains.push({
            side: ch.team,
            name: lookups.characterName(ch.key),
            from: ch.power,
            to: next,
          })
          return { ...ch, power: next }
        }),
      )
      // One entry for each side that gained Power
      for (const side of sides) {
        const own = gains.filter((gain) => gain.side === side)
        if (own.length > 0)
          lookups.writeLog('power', {
            side,
            gains: own.map(({ name, from, to }) => ({ name, from, to })),
          })
      }
    })
    return { gains }
  }

  // Cleanup button: both sides at once, in one transaction. It checks the blockers again, and does nothing when
  // blocked (returns null). Otherwise returns { round, flipped, before, after }: the new round (null when the
  // marker is on no spot), the Dazed characters (also one that was already Injured), and the Priority before
  // and after. Priority passes when its holder activated last (p12).
  function cleanup() {
    const poses = table.poses.read()
    const status = cleanupStatus(table.characters.read(), poses, lookups.characterName)
    if (status.disabled) return null
    const flipped = []
    let round = null
    const before = gamePriority(table.game.read(), table.setup.read())
    const after = priorityAfterCleanup(before, table.game.read().lastActivated)
    table.transact(() => {
      table.characters.set((prev) =>
        prev.map((ch) => {
          if ((ch.tokens?.dazed ?? 0) > 0) flipped.push(lookups.characterName(ch.key))
          return cleanupCharacter(ch, lookups.cleanupKeys)
        }),
      )
      table.looseTokens.set((prev) => prev.filter((t) => !lookups.cleanupKeys.includes(t.key)))
      table.tokens.set((prev) => cleanupCrisisTokens(prev, lookups.getCard))
      table.game.setField('scoreMarkers', (prev) => {
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
      lookups.writeLog('cleanup', { round, flipped, before, after })
    })
    return { round, flipped, before, after }
  }

  // A click on the Priority marker gives Priority to the other side. Any player can click, also in a
  // multiplayer room, because cards change Priority. Does nothing with no marker.
  function priorityClick() {
    const current = gamePriority(table.game.read(), table.setup.read())
    if (!current) return
    table.transact(() => {
      table.game.setField('priority', otherTeam(current))
      lookups.writeLog('priority', { side: otherTeam(current) })
    })
  }

  return { power, cleanup, priorityClick }
}
