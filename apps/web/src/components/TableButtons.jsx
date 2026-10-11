import { OnTable, OWNER_FACING_ROTATION } from './OnTable.jsx'
import { SIDES, boardStrip, powerButton } from '../tabletools/layout.js'

// The buttons that lie on the table: a Power Phase button for each player and a board strip for each player.
// See docs/features/table-tools.md. They lie flat just above the table (OnTable), 1 CSS px is 0.04".
const TABLE_Y = 0.05
const INCHES_PER_PX = 0.04
const PLAYER = { blue: 'Blue', red: 'Red' }
const otherSide = (side) => (side === 'blue' ? 'red' : 'blue')

const px = (inches) => Math.round(inches / INCHES_PER_PX)

// Power Phase of `side`, at the owner's right end of the rack. It gives Power to the characters of its
// own side only. In a multiplayer room, only the owner presses it.
function PowerPhaseButton({ side, ownSide, multiplayer, onPowerPhase }) {
  const place = powerButton(side)
  const locked = multiplayer && side !== ownSide
  return (
    <OnTable position={[place.x, TABLE_Y, place.z]} rotation={OWNER_FACING_ROTATION[side]}>
      {/* aria-disabled, not disabled: some browsers show no title on a disabled button */}
      <button
        type="button"
        className={`chip chip--player-${side} table-button`}
        style={{ width: px(place.width), height: px(place.depth) }}
        aria-disabled={locked}
        title={
          locked
            ? `Only the ${PLAYER[otherSide(ownSide)]} player presses this.`
            : 'Power Phase: each of your characters gains Power'
        }
        onClick={locked ? undefined : () => onPowerPhase([side])}
      >
        Power Phase
      </button>
    </OnTable>
  )
}

// The board strip of `side`, in the corner between the mat and the end of the scoring board. It reads like the
// scoring board (the top faces -x), so row 1 is nearer the table edge. Row 1: Cleanup Phase. Row 2: Deploy
// Lock, and the mat turn where the toolbar has it. These change shared state, so any player presses them.
function BoardStrip({
  side,
  multiplayer,
  onTurnMat,
  onCleanupPhase,
  cleanupDisabled,
  cleanupTitle,
  deployLine,
  onDeployLineClick,
}) {
  const strip = boardStrip(side)
  const style = { width: px(strip.length), height: px(1) }
  return (
    <>
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
      <OnTable position={[strip.rowX[1], TABLE_Y, strip.z]}>
        <div className="table-strip-row" style={style}>
          <button
            type="button"
            className={`chip table-button${deployLine ? ' chip--active' : ''}`}
            title="Lock models to within Range 3 of their deployment edge"
            onClick={onDeployLineClick}
          >
            Deploy Lock
          </button>
          {!multiplayer && (
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
    </>
  )
}

// All the table buttons. `ownSide` and `multiplayer` tell which Power Phase button is the player's own. The
// other props are the handlers and states of the toolbar buttons, which these repeat.
export default function TableButtons({ ownSide, multiplayer, onPowerPhase, ...strip }) {
  return SIDES.map((side) => (
    <group key={side}>
      <PowerPhaseButton
        side={side}
        ownSide={ownSide}
        multiplayer={multiplayer}
        onPowerPhase={onPowerPhase}
      />
      <BoardStrip side={side} multiplayer={multiplayer} {...strip} />
    </group>
  ))
}
