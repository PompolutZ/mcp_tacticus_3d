import { OccludedHtml } from './LabelOcclusion.jsx'
import { FLAT_HTML_Y } from '../tabletools/useDragTool.js'

const BUTTON_STYLE = {
  background: '#1a1a1a',
  border: '1px solid #f5a623',
  color: '#f5a623',
  cursor: 'pointer',
  fontFamily: 'sans-serif',
  pointerEvents: 'auto',
}

// Html element flat on the tool at local x, facing up. Html stays inside RigidBody,
// so it follows the body's transform automatically.
// Without a CSS rotation, the element reads toward local −X, with its top toward local +Z.

export function FlatHtml({ x = 0, z = 0, children }) {
  return (
    // Rx(π/2) lays the Html element flat on the tool's XZ surface facing up.
    // Without this the element stands perpendicular to the table.
    <group position={[x, FLAT_HTML_Y, z]} rotation={[Math.PI / 2, Math.PI, 0]}>
      {/* The wrapper div keeps the unscaled button size and would block the tool drag around a
          scaled button. Only the button itself takes the pointer (BUTTON_STYLE). */}
      <OccludedHtml center transform pointerEvents="none">
        {children}
      </OccludedHtml>
    </group>
  )
}

// drei's Html transform draws 1 CSS px as 1/40 world unit (see DiceKeys.jsx)
const PX_PER_INCH = 40
// Share of the tool width that Place covers
const PLACE_FILL = 0.85

// A pointer press on a button goes through onPointerDown (a click presses the button, a drag moves the tool),
// so a native click runs the action only for the keyboard (detail 0).
function clickByKey(e, onClick) {
  if (e.detail === 0) onClick?.(e)
}

// Place, Place 1, Place 2, Throw and Toward / Away.
// toolWidth: width of the tool in inches. The button is 1" long before the scale, so the scale is the
// length in inches: 0.47" on a movement tool, 0.85" on a range tool.
// on: the toggle state, or undefined for the one-shot Place 1 on the R1 tool
// along: on the R1 tool, Place lies along the tool instead of across it. See the transform below.
// rotation: the CSS rotation in degrees, for a button that is not across or along. Reads toward local
// −X with 0, and toward local +X with 180.
export function ToolButton({
  label = 'Place',
  toolWidth,
  on,
  along = false,
  rotation,
  disabled = false,
  disabledTitle = 'Select a character',
  title,
  onClick,
  onPointerDown,
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      style={{
        ...BUTTON_STYLE,
        background: on ? '#f5a623' : '#1a1a1a',
        color: on ? '#1a1a1a' : '#f5a623',
        width: PX_PER_INCH,
        padding: '4px 0',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontSize: '11px',
        whiteSpace: 'nowrap',
        // Across the tool, reading toward the tool's local +Z. A tool snapped to a model on the
        // player's half points to the mat center (snapPose), so the label reads from the player's side.
        // Along: reading toward local +X, with its top toward local −Z. The R1 tool snapped to a model
        // on the player's half has local +Z away from the mat center (snapPoseOne), so the same holds.
        transform: `rotate(${rotation ?? (along ? 180 : -90)}deg) scale(${PLACE_FILL * toolWidth})`,
      }}
      disabled={disabled}
      title={disabled ? disabledTitle : title}
      onClick={(e) => clickByKey(e, onClick)}
      onPointerDown={onPointerDown}
    >
      {label}
    </button>
  )
}

// Round toggle with a half circle that has an arrow at each end. About as big as the hinge.
export function BendButton({ on, onClick, onPointerDown }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="Bend"
      title={on ? 'Bend on: dragging a half turns it around the hinge' : 'Bend'}
      style={{
        ...BUTTON_STYLE,
        background: on ? '#f5a623' : '#1a1a1a',
        color: on ? '#1a1a1a' : '#f5a623',
        width: '22px',
        height: '22px',
        padding: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => clickByKey(e, onClick)}
      onPointerDown={onPointerDown}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 15 A7 7 0 0 1 19 15" />
        <path d="M2 12 L5 15.5 L8 12 M16 12 L19 15.5 L22 12" />
      </svg>
    </button>
  )
}
