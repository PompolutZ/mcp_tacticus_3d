import { useMemo } from 'react'
import { TABLE_WIDTH } from '../table.js'
import { BOARD_HALF_WIDTH, BOARD_X } from '../scoreboard/board.js'
import { DEFAULT_AFFILIATION, affiliationName } from '../scoreboard/affiliations.js'
import { parseRosterText, rosterCard, squadAffiliationKeys, squadThreat } from '../rosters/cards.js'
import { CRISIS_GAP_X, USE_BUTTON_X, crisisCenterZ, crisisRowLayout } from '../rosters/layout.js'
import {
  CRISIS_TYPES,
  TEAMS,
  crisisRows,
  otherTeam,
  otherType,
  placedSides,
  priorityOf,
  setupStep,
} from '../setup/setup.js'
import { COLOR_NAME, useSideColors } from '../sideColors.js'
import { RosterCard } from './RosterCards.jsx'
import { OnTable } from './OnTable.jsx'

const TYPE = { secure: 'Secure', extract: 'Extract' }
// Players select up to 5 Team Tactic cards (p11). The app shows the count and does not stop a 6th card.
const TACTIC_LIMIT = 5
// The buttons lie flat on the table, just above it (OnTable).
const TABLE_Y = 0.05
// The panel lies between the table edge and the scoring board, at the middle of the board
const PANEL_X = (-TABLE_WIDTH / 2 + BOARD_X - BOARD_HALF_WIDTH) / 2

// The name of the color of a side. colors: from useSideColors. A side key is a seat, not a color.
const nameOf = (colors, team) => COLOR_NAME[colors[team]]

// The reason why the deck of `type` of `team` cannot start the mission, or null
function deckProblem(team, type, parsed, colors) {
  const other = otherTeam(team)
  if (!parsed[other]) return `Load the ${nameOf(colors, other)} roster first`
  if (parsed[team][type].length === 0)
    return `The ${nameOf(colors, team)} roster has no ${TYPE[type]} cards`
  if (parsed[other][otherType(type)].length === 0)
    return `The ${nameOf(colors, other)} roster has no ${TYPE[otherType(type)]} cards`
  return null
}

// One row of crisis cards of a roster, next to the scoring board. With row.use, each card has a Use button
// next to it. row: see crisisRows in setup/setup.js. A click on a card opens the crisis tab of the roster popup.
function CrisisRow({ row, parsed, onOpen, onUse }) {
  const cards = useMemo(
    () => crisisRowLayout(row.team, row.type, row.codes, row.drawn),
    [row.team, row.type, row.codes, row.drawn],
  )
  // The crisis tab holds the Secure cards, then the Extract cards (rosters/cards.js, rosterTabs)
  const tabIndex = (code) =>
    (row.type === 'secure' ? 0 : parsed.secure.length) + parsed[row.type].indexOf(code)
  return cards.map((card, i) => {
    const info = rosterCard(card.code)
    if (!info) return null
    return (
      <group key={`${i}-${card.code}`}>
        <RosterCard
          card={{ ...card, tab: 'crisis', index: tabIndex(card.code) }}
          info={info}
          onOpen={onOpen}
        />
        {row.use && (
          <OnTable position={[USE_BUTTON_X, TABLE_Y, card.z]}>
            <button
              type="button"
              className="chip setup-use"
              title={`Use ${info.name}`}
              onClick={() => onUse(card.code)}
            >
              Use
            </button>
          </OnTable>
        )}
      </group>
    )
  })
}

// The 2 deck buttons of the player with Priority, between their Secure and Extract rows. They have no color:
// the color of a button does not tell the crisis type.
function DeckButtons({ team, parsed, onChoose }) {
  const colors = useSideColors()
  return (
    <OnTable position={[CRISIS_GAP_X, TABLE_Y, crisisCenterZ(team)]}>
      <div className="setup-buttons">
        {CRISIS_TYPES.map((type) => {
          const problem = deckProblem(team, type, parsed, colors)
          return (
            <button
              key={type}
              type="button"
              className="chip"
              disabled={problem !== null}
              title={problem ?? `Draw 2 of the ${nameOf(colors, team)} ${TYPE[type]} cards`}
              onClick={() => onChoose(type)}
            >
              Choose {TYPE[type]}s
            </button>
          )
        })}
      </div>
    </OnTable>
  )
}

// The text of a roll off that the app read: "Blue wins the roll off: 4 successes against 3." On equal
// successes the Crits or the Wilds decided. result: { winner, counts } (rollOff.js).
function rollOffText({ winner, counts }, name) {
  if (!winner) return 'Tie: roll again.'
  const a = counts[winner]
  const b = counts[otherTeam(winner)]
  const base = `${name(winner)} wins the roll off: ${a.successes} successes against ${b.successes}`
  if (a.successes !== b.successes) return `${base}.`
  if (a.crits !== b.crits) return `${base}, with more Crits (${a.crits} against ${b.crits}).`
  return `${base}, with more Wilds (${a.wilds} against ${b.wilds}).`
}

// The panel next to the scoring board: what to do in this step, the buttons of the steps that are not about one
// card, and Restart. The app does not know who won the roll off or who clicks, so the text names the player.
function BoardPanel({ setup, step, parsed, mySide, actions }) {
  const colors = useSideColors()
  const PLAYER = { blue: nameOf(colors, 'blue'), red: nameOf(colors, 'red') }
  const winner = priorityOf(setup)
  const other = winner && otherTeam(winner)
  const first = setup.deck?.type
  const second = first && otherType(first)
  let hint = null
  let note = null
  let controls = null
  let teamRows = null
  if ((step === 'rollOff' || step === 'deck') && (!parsed.blue || !parsed.red)) {
    hint = 'Load both rosters to set up the game.'
  } else if (step === 'rollOff') {
    hint = 'Roll off. The winner has Priority.'
    note =
      'Most Crits, Wilds and Hits wins. On a tie: most Crits, then most Wilds, else roll again.'
    // In a multiplayer room a name would flip when the color follows Priority, so the buttons name the side
    controls = TEAMS.map((team) => (
      <button
        key={team}
        type="button"
        className={`chip chip--player-${colors[team]}`}
        onClick={() => actions.priority(team)}
      >
        {PLAYER[team]}
        {mySide ? ' side' : ''} has Priority
      </button>
    ))
  } else if (step === 'deck') {
    hint = `${PLAYER[winner]} player has Priority: choose Secures or Extracts.`
  } else if (step === 'first') {
    hint = `${PLAYER[other]} player: choose 1 of the ${PLAYER[winner]} ${TYPE[first]} cards.`
  } else if (step === 'second') {
    hint = `${PLAYER[winner]} player: choose 1 of the ${PLAYER[other]} ${TYPE[second]} cards.`
  } else if (step === 'threat') {
    hint = `${PLAYER[other]} player: choose the Maximum Threat.`
    controls = CRISIS_TYPES.map((type) => {
      const info = rosterCard(setup.picks[type])
      return (
        <button
          key={type}
          type="button"
          className="chip"
          title={info.name}
          onClick={() => actions.threat(info.threat)}
        >
          {TYPE[type]} · {info.threat}
        </button>
      )
    })
  } else if (step === 'edge') {
    hint = `${PLAYER[winner]} player: turn the mat until your deployment edge faces you.`
    controls = (
      <>
        <button
          type="button"
          className="chip"
          title="Turn mat 90° counter-clockwise"
          onClick={() => actions.turnMat(1)}
        >
          ↺
        </button>
        <button
          type="button"
          className={`chip chip--player-${colors[winner]}`}
          onClick={actions.edge}
        >
          Select board edge
        </button>
        <button
          type="button"
          className="chip"
          title="Turn mat 90° clockwise"
          onClick={() => actions.turnMat(-1)}
        >
          ↻
        </button>
      </>
    )
  } else if (step === 'squads') {
    hint =
      'Each player chooses a squad and clicks Ready. The squads go on the table when both players are Ready.'
  } else if (step === 'reveal') {
    const placed = placedSides(setup)
    const waiting = TEAMS.find((team) => !placed[team])
    hint = `Waiting for the ${PLAYER[waiting]} player to reveal their squad.`
  } else if (step === 'affiliation') {
    hint = 'Choose the affiliation of your squad.'
    // One row for each team: the affiliations that more than half of the squad have, then Unaffiliated
    teamRows = TEAMS.map((team) => {
      const keys = parsed[team]
        ? [
            ...squadAffiliationKeys(parsed[team], setup.squads[team].characters),
            DEFAULT_AFFILIATION,
          ]
        : [DEFAULT_AFFILIATION]
      const locked = Boolean(mySide) && mySide !== team
      return (
        <div key={team} className="setup-row">
          <span className="setup-note">{PLAYER[team]}</span>
          {keys.map((key) => {
            const on = setup.affiliation?.[team] === key
            return (
              <button
                key={key}
                type="button"
                className={`chip chip--player-${colors[team]}${on ? ' setup-toggle--on' : ''}`}
                aria-pressed={on}
                disabled={locked}
                title={locked ? `The ${PLAYER[team]} player chooses` : undefined}
                onClick={() => actions.affiliation(team, key)}
              >
                {affiliationName(key)}
              </button>
            )
          })}
        </div>
      )
    })
  }
  // What the app read from the dice trays, until the deck is chosen
  const read = setup.rollOff && (step === 'rollOff' || step === 'deck') ? setup.rollOff : null
  const readText = read && rollOffText(read, (team) => PLAYER[team] + (mySide ? ' side' : ''))
  const status = [
    winner && `${PLAYER[winner]} player has Priority`,
    setup.threat !== null && `Max threat ${setup.threat}`,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <OnTable position={[PANEL_X, TABLE_Y, 0]}>
      <div className="setup-panel">
        <div className="setup-hint">{hint}</div>
        {note && <div className="setup-note">{note}</div>}
        {readText && <div className="setup-note">{readText}</div>}
        {teamRows}
        {controls && <div className="setup-row">{controls}</div>}
        {(status || step !== 'rollOff') && (
          <div className="setup-row">
            {status && <span className="setup-note">{status}</span>}
            {step !== 'rollOff' && (
              <button type="button" className="chip setup-restart" onClick={actions.restart}>
                Restart setup
              </button>
            )}
          </div>
        )}
      </div>
    </OnTable>
  )
}

// The squad buttons of a player, in their crisis area. The crisis cards are on the scoring board by now.
// Select squad: clicks on the roster cards add them to the squad or remove them (App.jsx,
// handleRosterClick). Ready works when the squad has a character and its threat is not above the Maximum
// Threat. A squad with less threat is fine. While the player is Ready, the squad does not change. When both
// players are Ready, both squads go on the table.
function SquadPanel({ team, setup, parsed, selecting, own, actions }) {
  const colors = useSideColors()
  const squad = setup.squads[team]
  const ready = setup.ready[team]
  // The other player in a multiplayer room (no squad is shown before the reveal), or a squad that is placed
  if (!own || placedSides(setup)[team]) {
    return (
      <OnTable position={[CRISIS_GAP_X, TABLE_Y, crisisCenterZ(team)]}>
        <div className="setup-panel">
          <div className="setup-note">{ready ? 'Ready' : 'Choosing a squad'}</div>
        </div>
      </OnTable>
    )
  }
  const threat = squadThreat(parsed, squad.characters)
  const over = threat > setup.threat
  const problem = over
    ? `The squad threat ${threat} is above the Maximum Threat ${setup.threat}`
    : squad.characters.length === 0
      ? 'Choose at least 1 character'
      : null
  return (
    <OnTable position={[CRISIS_GAP_X, TABLE_Y, crisisCenterZ(team)]}>
      <div className="setup-panel">
        <div className="setup-row">
          <span className={`setup-count${over ? ' setup-count--warn' : ''}`}>
            Threat {threat} / {setup.threat}
          </span>
          <span
            className={`setup-count${squad.tactics.length > TACTIC_LIMIT ? ' setup-count--warn' : ''}`}
          >
            Tactics {squad.tactics.length} / {TACTIC_LIMIT}
          </span>
        </div>
        <div className="setup-row">
          <button
            type="button"
            className={`chip chip--player-${colors[team]}${selecting ? ' setup-toggle--on' : ''}`}
            aria-pressed={selecting}
            disabled={ready}
            title={
              ready
                ? 'Click Ready again to change the squad'
                : selecting
                  ? 'Stop choosing: a click on a roster card opens it again'
                  : 'Choose the squad: a click on a roster card adds it or removes it'
            }
            onClick={() => actions.squadSelect(team)}
          >
            Select squad
          </button>
          <button
            type="button"
            className={`chip${ready ? ' setup-toggle--on' : ''}`}
            aria-pressed={ready}
            disabled={!ready && problem !== null}
            title={
              ready
                ? 'Not ready: change the squad'
                : (problem ?? 'The squads go on the table when both players are Ready')
            }
            onClick={() => actions.ready(team)}
          >
            Ready
          </button>
        </div>
        {selecting && (
          <div className="setup-note">
            Click characters and Team Tactic cards to add or remove them.
          </div>
        )}
        {ready && (
          <div className="setup-note">
            Waiting for the {nameOf(colors, otherTeam(team))} player.
          </div>
        )}
        {over && <div className="setup-note setup-note--warn">{problem}</div>}
      </div>
    </OnTable>
  )
}

// The game setup on the table: the crisis cards of the rosters next to the scoring board, and the buttons
// of each step. The buttons lie flat on the table (OnTable). See docs/features/setup-game.md.
// setup: see setup/setup.js. rosters: { blue, red } → null | { code }. squadSelect: { blue, red } → the
// player is choosing squad cards. mySide: the team of the player in a multiplayer room, or null when one
// person plays both teams. Only that team's squad panel has buttons. actions: { priority(team), deck(type), pick(code),
// threat(value), turnMat(direction), edge(), squadSelect(team), ready(team),
// affiliation(team, key), restart() }, see App.jsx.
// onRosterOpen({ team, tab, index }): a click on a crisis card.
export default function GameSetup({ setup, rosters, squadSelect, mySide, actions, onRosterOpen }) {
  const parsed = useMemo(
    () => ({
      blue: rosters.blue && parseRosterText(rosters.blue.code),
      red: rosters.red && parseRosterText(rosters.red.code),
    }),
    [rosters.blue, rosters.red],
  )
  const rows = useMemo(() => crisisRows(setup, parsed), [setup, parsed])
  const step = setupStep(setup)
  if (step === 'done' || (!parsed.blue && !parsed.red)) return null
  return (
    <>
      {rows.map((row) => (
        <CrisisRow
          key={`${row.team}-${row.type}`}
          row={row}
          parsed={parsed[row.team]}
          onOpen={(tab, index) => onRosterOpen({ team: row.team, tab, index })}
          onUse={actions.pick}
        />
      ))}
      {step === 'deck' && parsed[priorityOf(setup)] && (
        <DeckButtons team={priorityOf(setup)} parsed={parsed} onChoose={actions.deck} />
      )}
      <BoardPanel setup={setup} step={step} parsed={parsed} mySide={mySide} actions={actions} />
      {step === 'squads' &&
        TEAMS.map((team) => (
          <SquadPanel
            key={team}
            team={team}
            setup={setup}
            parsed={parsed[team]}
            selecting={squadSelect[team]}
            own={!mySide || mySide === team}
            actions={actions}
          />
        ))}
    </>
  )
}
