import { OnTable, TABLE_Y, px } from './OnTable.jsx'
import { TEAMS, otherTeam } from '../setup/setup.js'
import { useSideName } from '../sideColors.js'
import { boardStrip, cleanupButton, powerButton } from '../tabletools/layout.js'
import { assetUrl } from '../assets/index.js'
import { characterToken } from '../tokens/files.js'

// The buttons that lie on the table: a board strip for each player (Power Phase in row 1) and one Cleanup Phase button.
// See docs/features/table-tools.md. They lie flat just above the table (OnTable), 1 CSS px is 0.04".
// The same image as the Power counter of a tray (TrayControls.jsx)
const POWER_ICON = assetUrl(characterToken('1-power'))

// Automatic Power Phase of `side`, in row 1 of its board strip (the place is in tabletools/layout.js,
// docs/features/table-tools.md, "Automatic Power Phase button"). It gives Power to the characters of its own
// side only. In a multiplayer room, only the owner presses it.
function PowerPhaseButton({ side, ownSide, multiplayer, onPowerPhase, powerBlock }) {
  const place = powerButton(side)
  const locked = multiplayer && side !== ownSide
  const otherName = useSideName(otherTeam(ownSide))
  return (
    <OnTable position={[place.x, TABLE_Y, place.z]}>
      {/* aria-disabled, not disabled: some browsers show no title on a disabled button */}
      <button
        type="button"
        className="chip table-button table-button--power"
        style={{ width: px(place.length), height: px(place.width) }}
        aria-disabled={locked || Boolean(powerBlock)}
        title={
          locked
            ? `Only the ${otherName} player presses this.`
            : (powerBlock ?? 'Automatic Power Phase: each of your characters gains Power')
        }
        onClick={locked || powerBlock ? undefined : () => onPowerPhase([side])}
      >
        <img className="table-button-icon" src={POWER_ICON} alt="" />
        Auto Power Phase
      </button>
    </OnTable>
  )
}

// Cleanup Phase: one button for the table, between the scoring board and the mat, turned like the strip. It
// changes shared state, so any player presses it.
function CleanupButton({ onCleanupPhase, cleanupDisabled, cleanupTitle }) {
  const place = cleanupButton()
  return (
    <OnTable position={[place.x, TABLE_Y, place.z]}>
      <div className="table-strip-row" style={{ width: px(place.length), height: px(place.width) }}>
        <button
          type="button"
          className="chip table-button"
          aria-disabled={cleanupDisabled}
          title={cleanupTitle}
          onClick={cleanupDisabled ? undefined : onCleanupPhase}
        >
          Cleanup Phase
        </button>
      </div>
    </OnTable>
  )
}

// The board strip of `side`, in the corner between the mat and the end of the scoring board. It reads like the
// scoring board (the top faces -x), so row 1 is nearer the table edge. Row 1: Auto Power Phase. Row 2: Deploy
// Lock, and the mat turn where the toolbar has it. Deploy Lock and the mat turn change shared state, so any player presses them.
// show: which buttons the settings put on the table (settings/settings.js). A row with no button is not drawn,
// and a strip with no row is not drawn.
function BoardStrip({
  side,
  multiplayer,
  show,
  ownSide,
  onPowerPhase,
  powerBlockTitle,
  onTurnMat,
  deployLine,
  onDeployLineClick,
}) {
  const strip = boardStrip(side)
  const style = { width: px(strip.length), height: px(1) }
  const showTurn = show.matTurn && !multiplayer
  return (
    <>
      {show.power && (
        <PowerPhaseButton
          side={side}
          ownSide={ownSide}
          multiplayer={multiplayer}
          onPowerPhase={onPowerPhase}
          powerBlock={powerBlockTitle([side])}
        />
      )}
      {(show.deployLock || showTurn) && (
        <OnTable position={[strip.rowX[1], TABLE_Y, strip.z]}>
          <div className="table-strip-row" style={style}>
            {show.deployLock && (
              <button
                type="button"
                className={`chip table-button${deployLine ? ' chip--active' : ''}`}
                title="Lock models to within Range 3 of their deployment edge"
                onClick={onDeployLineClick}
              >
                Deploy Lock
              </button>
            )}
            {showTurn && (
              <>
                <button
                  type="button"
                  className="chip table-button table-button--small"
                  title="Turn mat 90° counter-clockwise"
                  onClick={() => onTurnMat(1)}
                >
                  ↺
                </button>
                <button
                  type="button"
                  className="chip table-button table-button--small"
                  title="Turn mat 90° clockwise"
                  onClick={() => onTurnMat(-1)}
                >
                  ↻
                </button>
              </>
            )}
          </div>
        </OnTable>
      )}
    </>
  )
}

// All the table buttons. `ownSide` and `multiplayer` tell which Power Phase button is the player's own. The
// other props are the handlers and states of the toolbar buttons, which these repeat.
// show: { power, cleanup, deployLock, matTurn }, true where the settings put the button on the table.
export default function TableButtons({ ownSide, multiplayer, show, onPowerPhase, ...rest }) {
  const { onCleanupPhase, cleanupDisabled, cleanupTitle, ...strip } = rest
  return (
    <>
      {show.cleanup && (
        <CleanupButton
          onCleanupPhase={onCleanupPhase}
          cleanupDisabled={cleanupDisabled}
          cleanupTitle={cleanupTitle}
        />
      )}
      {TEAMS.map(
        (side) =>
          (show.power || show.deployLock || (show.matTurn && !multiplayer)) && (
            <BoardStrip
              key={side}
              side={side}
              ownSide={ownSide}
              multiplayer={multiplayer}
              show={show}
              onPowerPhase={onPowerPhase}
              {...strip}
            />
          ),
      )}
    </>
  )
}
