import { OnTable, OWNER_FACING_ROTATION } from './OnTable.jsx'
import { TEAMS } from '../setup/setup.js'
import { useSideName } from '../sideColors.js'
import { boardStrip, powerButton } from '../tabletools/layout.js'
import { assetUrl } from '../assets/index.js'
import { characterToken } from '../tokens/files.js'

// The buttons that lie on the table: a Power Phase button for each player and a board strip for each player.
// See docs/features/table-tools.md. They lie flat just above the table (OnTable), 1 CSS px is 0.04".
const TABLE_Y = 0.05
const INCHES_PER_PX = 0.04
// The same image as the Power counter of a tray (TrayControls.jsx)
const POWER_ICON = assetUrl(characterToken('1-power'))
const otherSide = (side) => (side === 'blue' ? 'red' : 'blue')

const px = (inches) => Math.round(inches / INCHES_PER_PX)

// Automatic Power Phase of `side`, on the table to the owner's left of the Team Tactic tray (the place is in
// tabletools/layout.js, docs/features/table-tools.md, "Automatic Power Phase button"). It gives Power to the characters of its
// own side only. In a multiplayer room, only the owner presses it.
function PowerPhaseButton({ side, ownSide, multiplayer, onPowerPhase }) {
  const place = powerButton(side)
  const locked = multiplayer && side !== ownSide
  const otherName = useSideName(otherSide(ownSide))
  return (
    <OnTable position={[place.x, TABLE_Y, place.z]} rotation={OWNER_FACING_ROTATION[side]}>
      {/* aria-disabled, not disabled: some browsers show no title on a disabled button */}
      <button
        type="button"
        className="chip table-button table-button--power"
        style={{ width: px(place.width), height: px(place.depth) }}
        aria-disabled={locked}
        title={
          locked
            ? `Only the ${otherName} player presses this.`
            : 'Automatic Power Phase: each of your characters gains Power'
        }
        onClick={locked ? undefined : () => onPowerPhase([side])}
      >
        <img className="table-button-icon" src={POWER_ICON} alt="" />
        Automatic Power Phase
      </button>
    </OnTable>
  )
}

// The board strip of `side`, in the corner between the mat and the end of the scoring board. It reads like the
// scoring board (the top faces -x), so row 1 is nearer the table edge. Row 1: Cleanup Phase. Row 2: Deploy
// Lock, and the mat turn where the toolbar has it. These change shared state, so any player presses them.
// show: which buttons the settings put on the table (settings/settings.js). A row with no button is not drawn,
// and a strip with no row is not drawn.
function BoardStrip({
  side,
  multiplayer,
  show,
  onTurnMat,
  onCleanupPhase,
  cleanupDisabled,
  cleanupTitle,
  deployLine,
  onDeployLineClick,
}) {
  const strip = boardStrip(side)
  const style = { width: px(strip.length), height: px(1) }
  const showTurn = show.matTurn && !multiplayer
  return (
    <>
      {show.cleanup && (
        <OnTable position={[strip.rowX[0], TABLE_Y, strip.z]}>
          <div className="table-strip-row" style={style}>
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
export default function TableButtons({ ownSide, multiplayer, show, onPowerPhase, ...strip }) {
  return TEAMS.map((side) => (
    <group key={side}>
      {show.power && (
        <PowerPhaseButton
          side={side}
          ownSide={ownSide}
          multiplayer={multiplayer}
          onPowerPhase={onPowerPhase}
        />
      )}
      {(show.cleanup || show.deployLock || (show.matTurn && !multiplayer)) && (
        <BoardStrip side={side} multiplayer={multiplayer} show={show} {...strip} />
      )}
    </group>
  ))
}
