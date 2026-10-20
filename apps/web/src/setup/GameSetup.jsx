import { useMemo } from 'react'
import { TABLE_WIDTH } from '../table.js'
import { BOARD_HALF_WIDTH, BOARD_X } from '../scoreboard/board.js'
import { affiliationName } from '../scoreboard/affiliations.js'
import { rosterCard, squadAffiliationChoices, squadThreat } from '../rosters/cards.js'
import {
  CRISIS_GAP_X,
  USE_BUTTON_X,
  USE_BUTTON_X_TURNED,
  crisisCenterZ,
  crisisRowLayout,
} from '../rosters/layout.js'
import {
  CRISIS_TYPES,
  TEAMS,
  crisisRows,
  doneSteps,
  neighbourStep,
  otherTeam,
  otherType,
  placedSides,
  priorityOf,
  setupStep,
  squadProblem,
  viewOf,
} from './setup.js'
import { isYou, playerName, possessive, says } from './names.js'
import { STEP_NAME, chooses, decides, rollOffText, stepChoice } from './setupText.js'
import { TYPE, deckButton, lockedTitle, pickButton, threatChips } from './deckButton.js'
import { useSideColors } from '../table/useSideColors.jsx'
import { useTableStore } from '../table/TableStoreContext.jsx'
import { RosterCard } from '../rosters/RosterCards.jsx'
import { OnTable, OWNER_FACING_ROTATION, TABLE_Y, px } from '../scene/OnTable.jsx'
import {
  EDGE_ARROW_GAP,
  EDGE_ARROW_HEIGHT,
  EDGE_ARROW_WIDTH,
  EDGE_CHOOSE_HEIGHT,
  EDGE_ROW_GAP,
  edgeControls,
  squadPanel,
} from '../tabletools/layout.js'

// Players select up to 5 Team Tactic cards (p11). The app shows the count and does not stop a 6th card.
const TACTIC_LIMIT = 5
// The panel lies between the table edge and the scoring board, at the middle of the board
const PANEL_X = (-TABLE_WIDTH / 2 + BOARD_X - BOARD_HALF_WIDTH) / 2

// One row of crisis cards of a roster, next to the scoring board. With row.use, each card has a Choose button
// next to it. row: see crisisRows in setup/setup.js. A click on a card opens the crisis compare overlay (onOpen(code)).
function CrisisRow({ row, setup, ctx, onOpen, onUse, onCardHover }) {
  const cards = useMemo(
    () => crisisRowLayout(row.team, row.type, row.codes, row.drawn, row.facing),
    [row.team, row.type, row.codes, row.drawn, row.facing],
  )
  return cards.map((card, i) => {
    const info = rosterCard(card.code)
    if (!info) return null
    const { locked, title } = pickButton(setup, info.name, ctx)
    return (
      <group key={`${i}-${card.code}`}>
        <RosterCard
          card={{ ...card, tab: 'crisis', index: 0 }}
          info={info}
          onOpen={() => onOpen(card.code)}
          onCardHover={onCardHover}
        />
        {row.use && (
          <OnTable position={[row.facing ? USE_BUTTON_X_TURNED : USE_BUTTON_X, TABLE_Y, card.z]}>
            <button
              type="button"
              className="chip setup-use"
              aria-disabled={locked !== null}
              title={title}
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
function DeckButtons({ setup, team, parsed, ctx, onChoose }) {
  return (
    <OnTable position={[CRISIS_GAP_X, TABLE_Y, crisisCenterZ(team)]}>
      <div className="setup-buttons">
        {CRISIS_TYPES.map((type) => {
          const { locked, disabled, title } = deckButton(setup, team, type, parsed, ctx)
          return (
            <button
              key={type}
              type="button"
              className="chip"
              disabled={disabled}
              aria-disabled={locked !== null}
              title={title}
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
        style={{
          width: px(place.width),
          height: px(place.depth),
          gap: px(EDGE_ROW_GAP),
        }}
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
function BoardPanel({
  setup,
  step,
  parsed,
  mySide,
  ctx,
  actions,
  powerOnTable,
  powerHudShown,
  onStartRound,
  startRoundBlock,
}) {
  const view = viewOf(setup)
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
    hint = `${STEP_NAME[view]}: ${stepChoice(setup, view, ctx, rosterCard)}`
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
    hint = decides(winner, ctx)
  } else if (step === 'first') {
    hint = chooses(other, `from ${possessive(winner, ctx)} ${TYPE[first]}s`, ctx, true)
  } else if (step === 'second') {
    hint = chooses(winner, `from ${possessive(other, ctx)} ${TYPE[second]}s`, ctx, true)
  } else if (step === 'threat') {
    hint = chooses(other, 'the Maximum Threat', ctx)
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
      const keys = squadAffiliationChoices(parsed[team], setup.squads[team].characters)
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
    note = powerOnTable
      ? 'Press Auto Power Phase to start round 1 when both squads are deployed.'
      : powerHudShown
        ? 'Press Power (bottom right) to start round 1 when both squads are deployed.'
        : 'Press Start round 1 when both squads are deployed.'
    controls = (
      <button
        type="button"
        className="chip"
        disabled={Boolean(startRoundBlock)}
        title={startRoundBlock ?? undefined}
        onClick={onStartRound}
      >
        Start round 1
      </button>
    )
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

// The place below the roster rows of a team (squadPanel in tabletools/layout.js), flat and facing that player.
// The squad panel and the Maximum Threat chips use it; the threat step comes before the squad step, so they never overlap.
function SquadPlace({ team, compact = false, children }) {
  const place = squadPanel(team, compact)
  return (
    <OnTable position={[place.x, TABLE_Y, place.z]} rotation={OWNER_FACING_ROTATION[team]}>
      <div className="setup-panel setup-panel--squad">{children}</div>
    </OnTable>
  )
}

// The Maximum Threat chips (Secure · 17, Extract · 18) under the roster rows of the player who chooses, facing them.
function ThreatPanel({ team, setup, ctx, actions }) {
  const { locked, chips } = threatChips(setup, ctx, rosterCard)
  return (
    <SquadPlace team={team}>
      <div className="setup-note">{chooses(team, 'the Maximum Threat', ctx, true)}</div>
      <div className="setup-row">
        {chips.map((chip) => (
          <button
            key={chip.type}
            type="button"
            className="chip"
            aria-disabled={locked !== null}
            title={chip.title}
            onClick={locked === null ? () => actions.threat(chip.value) : undefined}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </SquadPlace>
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
  // The other player in a multiplayer room (no squad is shown before the reveal), or a squad that is placed
  if (compact) {
    return (
      <SquadPlace team={team} compact>
        <div className="setup-note">{ready ? 'Ready' : 'Choosing a squad'}</div>
      </SquadPlace>
    )
  }
  const threat = squadThreat(parsed, squad.characters)
  const kind = squadProblem({
    threat,
    count: squad.characters.length,
    maxThreat: setup.threat,
  })
  const over = kind === 'over'
  const problem = over
    ? `The squad threat ${threat} is above the Maximum Threat ${setup.threat}`
    : kind === 'empty'
      ? 'Choose at least 1 character'
      : null
  return (
    <SquadPlace team={team}>
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
    </SquadPlace>
  )
}

// The game setup on the table: the crisis cards of the rosters next to the scoring board, and the buttons
// of each step. The buttons lie flat on the table (OnTable). See docs/features/setup-game.md.
// setup: see setup/setup.js. parsed: { host, guest } → parsed roster | null (useGameSetup). Only the squad panel of the team of the player (mySide in the store, null when one
// person plays both teams) has buttons. The actions come from the table store (table/tableStore.js), actions.setup: { priority(team), deck(type), pick(code),
// threat(value), turnMat(direction), edge(), ready(team),
// affiliation(team, key), restart(), browse(step | null), override(step) }, see setup/useGameSetup.js (setupActions).
// powerOnTable: the Power button is on the table (the note names it). Start round 1 in the deploy step calls the Power button's
// powerHudShown: the HUD Power button is visible (Versus room after the squads are placed); else the note names the Start round 1 chip.
// action, phases.power(playedSides). startRoundBlock: the reason that button is off (a side has no affiliation), or null.
// A click on a crisis card calls the action onCrisisOpen({ team, type, code, drawn }). drawn: the card is one of the 2 drawn
// cards with a Choose button (App.jsx opens the Choose 1 overlay for it). The action onCardHover(card, over) is for Alt (useCardPeek.js).
export default function GameSetup({ setup, parsed, powerOnTable, powerHudShown, startRoundBlock }) {
  const mySide = useTableStore((s) => s.mySide)
  const ctx = useTableStore((s) => s.nameCtx)
  const tableActions = useTableStore((s) => s.actions)
  const actions = tableActions.setup
  const playedSides = useTableStore((s) => s.playedSides)
  const rows = useMemo(() => crisisRows(setup, parsed), [setup, parsed])
  const step = setupStep(setup)
  const browsing = viewOf(setup) !== null
  if (step === 'done' || (!parsed.host && !parsed.guest)) return null
  return (
    <>
      {rows.map((row) => (
        <CrisisRow
          key={`${row.team}-${row.type}`}
          row={row}
          setup={setup}
          ctx={ctx}
          onOpen={(code) =>
            tableActions.onCrisisOpen({
              team: row.team,
              type: row.type,
              code,
              drawn: row.use,
            })
          }
          onUse={actions.pick}
          onCardHover={tableActions.onCardHover}
        />
      ))}
      {step === 'deck' && parsed[priorityOf(setup)] && (
        <DeckButtons
          setup={setup}
          team={priorityOf(setup)}
          parsed={parsed}
          ctx={ctx}
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
        powerOnTable={powerOnTable}
        powerHudShown={powerHudShown}
        onStartRound={() => tableActions.phases.power(playedSides)}
        startRoundBlock={startRoundBlock}
      />
      {step === 'threat' && !browsing && parsed[otherTeam(priorityOf(setup))] && (
        <ThreatPanel
          team={otherTeam(priorityOf(setup))}
          setup={setup}
          ctx={ctx}
          actions={actions}
        />
      )}
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
