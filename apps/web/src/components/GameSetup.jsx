import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { TABLE_WIDTH } from '../table.js'
import { BOARD_HALF_WIDTH, BOARD_X } from '../scoreboard/board.js'
import { parseRosterText, rosterCard, squadThreat } from '../rosters/cards.js'
import { CRISIS_GAP_X, USE_BUTTON_X, crisisCenterZ, crisisRowLayout } from '../rosters/layout.js'
import { CRISIS_TYPES, TEAMS, crisisRows, otherTeam, otherType, setupStep } from '../setup/setup.js'
import { RosterCard } from './RosterCards.jsx'

const PLAYER = { blue: 'Blue', red: 'Red' }
const TYPE = { secure: 'Secure', extract: 'Extract' }
// The deck buttons have the color of the crisis type, on both players' sides
const TYPE_COLOR = { secure: 'blue', extract: 'red' }
// Players select up to 5 Team Tactic cards (p11). The app shows the count and does not stop a 6th card.
const TACTIC_LIMIT = 5
// The buttons lie flat on the table, just above it. They read the same way as the scoring board and the
// crisis cards (CrisisCard.jsx, CARD_ROTATION): the top of the HTML faces the table edge (-x), and its
// right faces -z.
const TABLE_Y = 0.05
const BOARD_READ_ROTATION = [-Math.PI / 2, 0, Math.PI / 2]
// 1 CSS px of the buttons is this many inches on the table. drei Html with transform makes 1 CSS px
// distanceFactor / 400 world units.
const INCHES_PER_PX = 0.04
// The panel lies between the table edge and the scoring board, at the middle of the board
const PANEL_X = (-TABLE_WIDTH / 2 + BOARD_X - BOARD_HALF_WIDTH) / 2

// drei Html that lies flat on the table at `position`, see BOARD_READ_ROTATION
function OnTable({ position, children }) {
  return (
    <group position={position} rotation={BOARD_READ_ROTATION}>
      <Html center transform distanceFactor={INCHES_PER_PX * 400}>
        {children}
      </Html>
    </group>
  )
}

// The reason why the deck of `type` of `team` cannot start the mission, or null
function deckProblem(team, type, parsed) {
  const other = otherTeam(team)
  if (!parsed[other]) return `Load the ${PLAYER[other]} roster first`
  if (parsed[team][type].length === 0)
    return `The ${PLAYER[team]} roster has no ${TYPE[type]} cards`
  if (parsed[other][otherType(type)].length === 0)
    return `The ${PLAYER[other]} roster has no ${TYPE[otherType(type)]} cards`
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

// The 2 deck buttons of a player, between their Secure and Extract rows. The roll-off winner clicks one.
function DeckButtons({ team, parsed, onChoose }) {
  return (
    <OnTable position={[CRISIS_GAP_X, TABLE_Y, crisisCenterZ(team)]}>
      <div className="setup-buttons">
        {CRISIS_TYPES.map((type) => {
          const problem = deckProblem(team, type, parsed)
          return (
            <button
              key={type}
              type="button"
              className={`chip chip--player-${TYPE_COLOR[type]}`}
              disabled={problem !== null}
              title={problem ?? `Draw 2 of the ${PLAYER[team]} ${TYPE[type]} cards`}
              onClick={() => onChoose(team, type)}
            >
              Use {PLAYER[team]} player {TYPE[type]}s
            </button>
          )
        })}
      </div>
    </OnTable>
  )
}

// The panel next to the scoring board: what to do in this step, the buttons of the steps that are not about one
// card, and Restart. The app does not know who won the roll off or who clicks, so the text names the player.
function BoardPanel({ setup, step, parsed, actions }) {
  const winner = setup.deck?.team
  const other = winner && otherTeam(winner)
  const first = setup.deck?.type
  const second = first && otherType(first)
  let hint = null
  let note = null
  let controls = null
  if (step === 'deck' && (!parsed.blue || !parsed.red)) {
    hint = 'Load both rosters to set up the game.'
  } else if (step === 'deck') {
    hint = 'Roll off. The winner uses their Secure or Extract cards.'
    note =
      'Most Crits, Wilds and Hits wins. On a tie: most Crits, then most Wilds, else roll again.'
  } else if (step === 'first') {
    hint = `${PLAYER[other]} player: use 1 of the ${PLAYER[winner]} ${TYPE[first]} cards.`
  } else if (step === 'second') {
    hint = `${PLAYER[winner]} player: use 1 of the ${PLAYER[other]} ${TYPE[second]} cards.`
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
        <button type="button" className={`chip chip--player-${winner}`} onClick={actions.edge}>
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
  }
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
        {controls && <div className="setup-row">{controls}</div>}
        {(status || step !== 'deck') && (
          <div className="setup-row">
            {status && <span className="setup-note">{status}</span>}
            {step !== 'deck' && (
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
function SquadPanel({ team, setup, parsed, selecting, actions }) {
  const squad = setup.squads[team]
  const ready = setup.ready[team]
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
            className={`chip chip--player-${team}${selecting ? ' setup-toggle--on' : ''}`}
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
          <div className="setup-note">Waiting for the {PLAYER[otherTeam(team)]} player.</div>
        )}
        {over && <div className="setup-note setup-note--warn">{problem}</div>}
      </div>
    </OnTable>
  )
}

// The game setup on the table: the crisis cards of the rosters next to the scoring board, and the buttons
// of each step. The buttons lie flat on the table (OnTable). See docs/feature-setup-game.md.
// setup: see setup/setup.js. rosters: { blue, red } → null | { code }. squadSelect: { blue, red } → the
// player is choosing squad cards. actions: { deck(team, type), pick(code), threat(value), turnMat(direction),
// edge(), squadSelect(team), ready(team), restart() }, see App.jsx. onRosterOpen({ team, tab, index }):
// a click on a crisis card.
export default function GameSetup({ setup, rosters, squadSelect, actions, onRosterOpen }) {
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
      {step === 'deck' &&
        TEAMS.map(
          (team) =>
            parsed[team] && (
              <DeckButtons key={team} team={team} parsed={parsed} onChoose={actions.deck} />
            ),
        )}
      <BoardPanel setup={setup} step={step} parsed={parsed} actions={actions} />
      {step === 'squads' &&
        TEAMS.map((team) => (
          <SquadPanel
            key={team}
            team={team}
            setup={setup}
            parsed={parsed[team]}
            selecting={squadSelect[team]}
            actions={actions}
          />
        ))}
    </>
  )
}
