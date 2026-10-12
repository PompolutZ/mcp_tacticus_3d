import { useMemo } from 'react'
import { TABLE_WIDTH } from '../table.js'
import { BOARD_HALF_WIDTH, BOARD_X } from '../scoreboard/board.js'
import { DEFAULT_AFFILIATION, affiliationName } from '../scoreboard/affiliations.js'
import { parseRosterText, rosterCard, squadAffiliationKeys, squadThreat } from '../rosters/cards.js'
import { CRISIS_GAP_X, USE_BUTTON_X, crisisCenterZ, crisisRowLayout } from '../rosters/layout.js'
import {
  CRISIS_TYPES,
  TEAMS,
  chooserOf,
  crisisRows,
  doneSteps,
  neighbourStep,
  otherTeam,
  otherType,
  placedSides,
  priorityOf,
  setupStep,
  viewOf,
} from '../setup/setup.js'
import { capital, chose, isYou, playerName, possessive, says } from '../setup/names.js'
import { useSideColors } from '../sideColors.js'
import { useNames } from '../setup/useNames.js'
import { RosterCard } from './RosterCards.jsx'
import { OnTable, OWNER_FACING_ROTATION } from './OnTable.jsx'
import {
  EDGE_ARROW_GAP,
  EDGE_ARROW_HEIGHT,
  EDGE_ARROW_WIDTH,
  EDGE_CHOOSE_HEIGHT,
  EDGE_ROW_GAP,
  edgeControls,
  squadPanel,
} from '../tabletools/layout.js'

const TYPE = { secure: 'Secure', extract: 'Extract' }
// Players select up to 5 Team Tactic cards (p11). The app shows the count and does not stop a 6th card.
const TACTIC_LIMIT = 5
// The buttons lie flat on the table, just above it (OnTable).
const TABLE_Y = 0.05
// The panel lies between the table edge and the scoring board, at the middle of the board
const PANEL_X = (-TABLE_WIDTH / 2 + BOARD_X - BOARD_HALF_WIDTH) / 2
const INCHES_PER_PX = 0.04
const px = (inches) => Math.round(inches / INCHES_PER_PX)

// The names of the done steps (Prev / Next, Override)
const STEP_NAME = {
  rollOff: 'Roll off',
  deck: 'Deck',
  first: 'First card',
  second: 'Second card',
  threat: 'Maximum Threat',
  edge: 'Deployment edge',
  squads: 'Squads',
  affiliation: 'Affiliation',
  deploy: 'Deployment',
}

// The choice of a done step in words: "Nelly chose Extract · 18"
function stepChoice(setup, step, ctx) {
  const winner = priorityOf(setup)
  const other = winner && otherTeam(winner)
  const first = setup.deck?.type
  const second = first && otherType(first)
  const card = (code) => rosterCard(code)?.name ?? code
  switch (step) {
    case 'rollOff':
      return `${says(winner, ctx, 'have')} Priority`
    case 'deck':
      return `${chose(winner, ctx)} ${TYPE[first]}s`
    case 'first':
      return `${chose(other, ctx)} ${card(setup.picks[first])}`
    case 'second':
      return `${chose(winner, ctx)} ${card(setup.picks[second])}`
    case 'threat': {
      const type = CRISIS_TYPES.find((t) => rosterCard(setup.picks[t])?.threat === setup.threat)
      return `${chose(other, ctx)} ${type ? `${TYPE[type]} · ` : ''}${setup.threat}`
    }
    case 'edge':
      return `${chose(winner, ctx)} the board edge`
    case 'squads':
      return 'Both squads are Ready'
    case 'affiliation':
      return TEAMS.map(
        (team) =>
          `${playerName(team, ctx)}: ${affiliationName(setup.affiliation?.[team] ?? DEFAULT_AFFILIATION)}`,
      ).join(' · ')
    default:
      return 'Both squads deployed'
  }
}

// In a multiplayer room, only the chooser of the current step clicks (chooserOf, setup/setup.js). Returns
// null when this browser may click, else the title for the disabled button: "Nelly chooses the Maximum
// Threat". The Sandbox and a single player room (no mySide) let anyone click.
function lockedTitle(setup, what, ctx) {
  if (viewOf(setup)) return 'Browsing an earlier step'
  const chooser = chooserOf(setup)
  if (!ctx.mySide || !chooser || chooser === ctx.mySide) return null
  return `${says(chooser, ctx, 'choose')} ${what}`
}

// What `team` does in a step that one player chooses. The own side in a multiplayer room gets "You choose the
// board edge", the other player "Waiting for Nelly to choose the board edge." What: "a deck", "the Maximum
// Threat". With imperative, the own side gets "Choose …" ("Choose from Nelly's Secures.").
function chooses(team, what, ctx, imperative = false) {
  if (ctx.mySide && !isYou(team, ctx))
    return `Waiting for ${playerName(team, ctx)} to choose ${what}.`
  return imperative && isYou(team, ctx)
    ? `Choose ${what}.`
    : `${says(team, ctx, 'choose')} ${what}.`
}

// The reason why the deck of `type` of `team` cannot start the mission, or null
function deckProblem(team, type, parsed, ctx) {
  const other = otherTeam(team)
  if (!parsed[other]) return `Load ${possessive(other, ctx)} roster first`
  if (parsed[team][type].length === 0)
    return `${capital(possessive(team, ctx))} roster has no ${TYPE[type]} cards`
  if (parsed[other][otherType(type)].length === 0)
    return `${capital(possessive(other, ctx))} roster has no ${TYPE[otherType(type)]} cards`
  return null
}

// One row of crisis cards of a roster, next to the scoring board. With row.use, each card has a Choose button
// next to it. row: see crisisRows in setup/setup.js. A click on a card opens the crisis tab of the roster popup.
function CrisisRow({ row, parsed, locked, onOpen, onUse, onCardHover }) {
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
          onCardHover={onCardHover}
        />
        {row.use && (
          <OnTable position={[USE_BUTTON_X, TABLE_Y, card.z]}>
            <button
              type="button"
              className="chip setup-use"
              aria-disabled={locked !== null}
              title={locked ?? `Choose ${info.name}`}
              onClick={locked === null ? () => onUse(card.code) : undefined}
            >
              Choose
            </button>
          </OnTable>
        )}
      </group>
    )
  })
}

// The 2 deck buttons of the player with Priority, between their Secure and Extract rows. They have no color:
// the color of a button does not tell the crisis type.
function DeckButtons({ team, parsed, ctx, locked, onChoose }) {
  return (
    <OnTable position={[CRISIS_GAP_X, TABLE_Y, crisisCenterZ(team)]}>
      <div className="setup-buttons">
        {CRISIS_TYPES.map((type) => {
          const problem = deckProblem(team, type, parsed, ctx)
          return (
            <button
              key={type}
              type="button"
              className="chip"
              disabled={locked === null && problem !== null}
              aria-disabled={locked !== null}
              title={locked ?? problem ?? `Draw 2 of ${possessive(team, ctx)} ${TYPE[type]} cards`}
              onClick={locked === null ? () => onChoose(type) : undefined}
            >
              Choose {TYPE[type]}s
            </button>
          )
        })}
      </div>
    </OnTable>
  )
}

// The text of a roll off that the app read: "Nelly wins the roll off: 4 successes against 3." On equal
// successes the Crits or the Wilds decided. result: { winner, counts } (rollOff.js).
function rollOffText({ winner, counts }, ctx) {
  if (!winner) return 'Tie: roll again.'
  const a = counts[winner]
  const b = counts[otherTeam(winner)]
  const base = `${says(winner, ctx, 'win')} the roll off: ${a.successes} successes against ${b.successes}`
  if (a.successes !== b.successes) return `${base}.`
  if (a.crits !== b.crits) return `${base}, with more Crits (${a.crits} against ${b.crits}).`
  return `${base}, with more Wilds (${a.wilds} against ${b.wilds}).`
}

// ↺ Choose this edge ↻ on the side of the player with Priority, lying flat and facing them (OWNER_FACING_ROTATION).
// The arrows are on the first row, Choose this edge on the second (tabletools/layout.js, edgeControls).
function EdgeControls({ team, locked, actions }) {
  const colors = useSideColors()
  const place = edgeControls(team)
  const arrow = {
    width: px(EDGE_ARROW_WIDTH),
    height: px(EDGE_ARROW_HEIGHT),
  }
  const click = (fn) => (locked === null ? fn : undefined)
  return (
    <OnTable position={[place.x, TABLE_Y, place.z]} rotation={OWNER_FACING_ROTATION[team]}>
      <div
        className="setup-edge"
        style={{ width: px(place.width), height: px(place.depth), gap: px(EDGE_ROW_GAP) }}
      >
        <div className="setup-edge-row" style={{ gap: px(EDGE_ARROW_GAP) }}>
          <button
            type="button"
            className="chip setup-edge-arrow"
            style={arrow}
            aria-disabled={locked !== null}
            title={locked ?? 'Turn mat 90° counter-clockwise'}
            onClick={click(() => actions.turnMat(1))}
          >
            ↺
          </button>
          <button
            type="button"
            className="chip setup-edge-arrow"
            style={arrow}
            aria-disabled={locked !== null}
            title={locked ?? 'Turn mat 90° clockwise'}
            onClick={click(() => actions.turnMat(-1))}
          >
            ↻
          </button>
        </div>
        <button
          type="button"
          className={`chip setup-edge-choose chip--player-${colors[team]}`}
          style={{ height: px(EDGE_CHOOSE_HEIGHT) }}
          aria-disabled={locked !== null}
          title={locked ?? undefined}
          onClick={click(actions.edge)}
        >
          Choose this edge
        </button>
      </div>
    </OnTable>
  )
}

// The panel next to the scoring board: what to do in this step, the buttons of the steps that are not about one
// card, and Restart. The text names the player who chooses (setup/names.js).
function BoardPanel({ setup, step, parsed, mySide, ctx, actions }) {
  const view = viewOf(setup)
  const threatLocked = lockedTitle(setup, 'the Maximum Threat', ctx)
  const colors = useSideColors()
  const winner = priorityOf(setup)
  const other = winner && otherTeam(winner)
  const first = setup.deck?.type
  const second = first && otherType(first)
  let hint = null
  let note = null
  let controls = null
  let teamRows = null
  if (view) {
    // A done step that a player browses: its name and choice, read only (Override goes back to it)
    hint = `${STEP_NAME[view]}: ${stepChoice(setup, view, ctx)}`
    note = 'You are looking at an earlier step. Override makes it the current step again.'
  } else if ((step === 'rollOff' || step === 'deck') && (!parsed.host || !parsed.guest)) {
    hint = 'Load both rosters to set up the game.'
  } else if (step === 'rollOff') {
    hint = 'Roll off. The winner has Priority.'
    note =
      'Most Crits, Wilds and Hits wins. On a tie: most Crits, then most Wilds, else roll again.'
    controls = TEAMS.map((team) => (
      <button
        key={team}
        type="button"
        className={`chip chip--player-${colors[team]}`}
        onClick={() => actions.priority(team)}
      >
        {says(team, ctx, 'have')} Priority
      </button>
    ))
  } else if (step === 'deck') {
    hint = chooses(winner, 'a deck', ctx)
  } else if (step === 'first') {
    hint = chooses(other, `from ${possessive(winner, ctx)} ${TYPE[first]}s`, ctx, true)
  } else if (step === 'second') {
    hint = chooses(winner, `from ${possessive(other, ctx)} ${TYPE[second]}s`, ctx, true)
  } else if (step === 'threat') {
    hint = chooses(other, 'the Maximum Threat', ctx)
    controls = CRISIS_TYPES.map((type) => {
      const info = rosterCard(setup.picks[type])
      return (
        <button
          key={type}
          type="button"
          className="chip"
          aria-disabled={threatLocked !== null}
          title={threatLocked ?? info.name}
          onClick={threatLocked === null ? () => actions.threat(info.threat) : undefined}
        >
          {TYPE[type]} · {info.threat}
        </button>
      )
    })
  } else if (step === 'edge') {
    hint = chooses(winner, 'the board edge', ctx)
    note = `Turn the mat until the deployment edge faces ${isYou(winner, ctx) ? 'you' : playerName(winner, ctx)}.`
    // The controls lie on the side of the player with Priority (EdgeControls)
  } else if (step === 'squads') {
    hint = `${mySide ? 'Choose your squad' : 'Each player chooses a squad'} and click Ready. The squads go on the table when both players are Ready.`
  } else if (step === 'reveal') {
    const placed = placedSides(setup)
    const waiting = TEAMS.find((team) => !placed[team])
    hint = isYou(waiting, ctx)
      ? 'Putting your squad on the table.'
      : `Waiting for ${playerName(waiting, ctx)} to reveal ${mySide ? 'their' : 'the'} squad.`
  } else if (step === 'affiliation') {
    hint = mySide
      ? 'Choose the affiliation of your squad.'
      : 'Choose the affiliation of each squad.'
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
          <span className="setup-note">{playerName(team, ctx)}</span>
          {keys.map((key) => {
            const on = setup.affiliation?.[team] === key
            return (
              <button
                key={key}
                type="button"
                className={`chip chip--player-${colors[team]}${on ? ' setup-toggle--on' : ''}`}
                aria-pressed={on}
                disabled={locked}
                title={locked ? says(team, ctx, 'choose') : undefined}
                onClick={() => actions.affiliation(team, key)}
              >
                {affiliationName(key)}
              </button>
            )
          })}
        </div>
      )
    })
  } else if (step === 'deploy') {
    // The players deploy one model at a time (p11). The player with Priority goes first.
    hint = `Deploy one model at a time, taking turns. ${says(winner, ctx, 'deploy')} first.`
    note = 'Press Power Phase when both squads are deployed.'
  }
  // What the app read from the dice trays, until the deck is chosen
  const read =
    !view && setup.rollOff && (step === 'rollOff' || step === 'deck') ? setup.rollOff : null
  const readText = read && rollOffText(read, ctx)
  const status = [
    winner && `${says(winner, ctx, 'have')} Priority`,
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
        {doneSteps(setup).length > 0 && (
          <div className="setup-row">
            <button
              type="button"
              className="chip"
              disabled={neighbourStep(setup, -1) === view}
              onClick={() => actions.browse(neighbourStep(setup, -1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="chip"
              disabled={view === null}
              onClick={() => actions.browse(neighbourStep(setup, 1))}
            >
              Next
            </button>
            {view && (
              <button
                type="button"
                className="chip setup-restart"
                onClick={() => actions.override(view)}
              >
                Override
              </button>
            )}
          </div>
        )}
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

// The squad buttons of a player, right below their roster rows (squadPanel in tabletools/layout.js), flat and facing them.
// The roster cards have a + / ✓ button that adds them to the squad or removes them (RosterCards.jsx, setup/useGameSetup.js
// handleSquadToggle). Squad ready works when the squad has a character and its threat is not above the Maximum
// Threat. A squad with less threat is fine. While the player is ready, the button is Change squad and the squad
// does not change. When both players are ready, both squads go on the table.
function SquadPanel({ team, setup, parsed, own, ctx, actions }) {
  const squad = setup.squads[team]
  const ready = setup.ready[team]
  const compact = !own || placedSides(setup)[team]
  const place = squadPanel(team, compact)
  // The other player in a multiplayer room (no squad is shown before the reveal), or a squad that is placed
  if (compact) {
    return (
      <OnTable position={[place.x, TABLE_Y, place.z]} rotation={OWNER_FACING_ROTATION[team]}>
        <div className="setup-panel setup-panel--squad">
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
    <OnTable position={[place.x, TABLE_Y, place.z]} rotation={OWNER_FACING_ROTATION[team]}>
      <div className="setup-panel setup-panel--squad">
        <div className="setup-row">
          <span className={`setup-count${over ? ' setup-count--warn' : ''}`}>
            Threat {threat} / {setup.threat}
          </span>
          <span
            className={`setup-count${squad.tactics.length > TACTIC_LIMIT ? ' setup-count--warn' : ''}`}
          >
            Tactics {squad.tactics.length} / {TACTIC_LIMIT}
          </span>
          {ready ? (
            <button
              type="button"
              className="chip"
              title="Squad ready is off, so the squad can change"
              onClick={() => actions.ready(team)}
            >
              Change squad
            </button>
          ) : (
            <button
              type="button"
              className="chip chip--primary"
              aria-disabled={problem !== null}
              title={problem ?? 'The squads go on the table when both players are ready'}
              onClick={() => {
                if (problem === null) actions.ready(team)
              }}
            >
              Squad ready
            </button>
          )}
        </div>
        {!ready && (
          <div className="setup-note">
            Click + on a roster card, or choose a squad in the Breakdown tab.
          </div>
        )}
        {ready && <div className="setup-note">Waiting for {playerName(otherTeam(team), ctx)}.</div>}
        {over && <div className="setup-note setup-note--warn">{problem}</div>}
      </div>
    </OnTable>
  )
}

// The game setup on the table: the crisis cards of the rosters next to the scoring board, and the buttons
// of each step. The buttons lie flat on the table (OnTable). See docs/features/setup-game.md.
// setup: see setup/setup.js. rosters: { host, guest } → null | { code }. seatPlayers: { players, peer } of a multiplayer room, for the names
// (setup/names.js). mySide: the team of the player in a multiplayer room, or null when one
// person plays both teams. Only that team's squad panel has buttons. actions: { priority(team), deck(type), pick(code),
// threat(value), turnMat(direction), edge(), ready(team),
// affiliation(team, key), restart(), browse(step | null), override(step) }, see setup/useGameSetup.js.
// onRosterOpen({ team, tab, index }): a click on a crisis card. onCardHover(card, over): for Alt (useCardPeek.js).
export default function GameSetup({
  setup,
  rosters,
  mySide,
  seatPlayers,
  actions,
  onRosterOpen,
  onCardHover,
}) {
  const ctx = useNames(mySide, seatPlayers)
  const parsed = useMemo(
    () => ({
      host: rosters.host && parseRosterText(rosters.host.code),
      guest: rosters.guest && parseRosterText(rosters.guest.code),
    }),
    [rosters.host, rosters.guest],
  )
  const rows = useMemo(() => crisisRows(setup, parsed), [setup, parsed])
  const step = setupStep(setup)
  const browsing = viewOf(setup) !== null
  const cardLocked = lockedTitle(setup, 'a card', ctx)
  if (step === 'done' || (!parsed.host && !parsed.guest)) return null
  return (
    <>
      {rows.map((row) => (
        <CrisisRow
          key={`${row.team}-${row.type}`}
          row={row}
          parsed={parsed[row.team]}
          locked={cardLocked}
          onOpen={(tab, index) => onRosterOpen({ team: row.team, tab, index })}
          onUse={actions.pick}
          onCardHover={onCardHover}
        />
      ))}
      {step === 'deck' && parsed[priorityOf(setup)] && (
        <DeckButtons
          team={priorityOf(setup)}
          parsed={parsed}
          ctx={ctx}
          locked={lockedTitle(setup, 'a deck', ctx)}
          onChoose={actions.deck}
        />
      )}
      {step === 'edge' && (
        <EdgeControls
          team={priorityOf(setup)}
          locked={lockedTitle(setup, 'the board edge', ctx)}
          actions={actions}
        />
      )}
      <BoardPanel
        setup={setup}
        step={step}
        parsed={parsed}
        mySide={mySide}
        ctx={ctx}
        actions={actions}
      />
      {step === 'squads' &&
        !browsing &&
        TEAMS.map((team) => (
          <SquadPanel
            key={team}
            team={team}
            setup={setup}
            parsed={parsed[team]}
            own={!mySide || mySide === team}
            ctx={ctx}
            actions={actions}
          />
        ))}
    </>
  )
}
