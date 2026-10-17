import '../rooms/comicBase.js'
import '../ui/hud.css'

// The gem of the Power button (the design Hud.dc.html): light green, with a bolt
function GemIcon() {
  return (
    <svg className="phase-icon" viewBox="0 0 40 40" aria-hidden="true">
      <path
        className="phase-gem"
        d="M20 2L38 20L20 38L2 20Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M20 7L33 20L20 33L7 20Z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeOpacity="0.7"
      />
      <path
        className="phase-bolt"
        d="M22 10L13 22h6l-2 8 9-12h-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// The two turning arrows of the Cleanup button
function TurnIcon() {
  return (
    <svg
      className="phase-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

// The Power and Cleanup buttons when the settings put them in the HUD: a column fixed in the bottom right
// corner, Power on top (docs/features/round-phases.md, docs/features/table-tools.md). The handlers, the
// disabled state and the titles are the same as on the table; App passes them.
// shown: false hides both (phaseHudShown in setup/setup.js).
// onPowerPhase(): gives Power to the sides this browser plays. powerBlock: the reason Power is off, or null. cleanupDisabled, cleanupTitle: the Cleanup
// lock and its reason.
export function PhaseButtons({
  shown,
  settings,
  onPowerPhase,
  powerBlock,
  onCleanupPhase,
  cleanupDisabled,
  cleanupTitle,
}) {
  const powerHud = settings.tools.power === 'hud'
  const cleanupHud = settings.tools.cleanup === 'hud'
  if (!shown || (!powerHud && !cleanupHud)) return null
  // The button that can run is big, the one that cannot is small and grey (hud.css)
  const size = (blocked) => (blocked ? 'phase-button--small' : 'phase-button--big')
  return (
    <div className="comic phase-buttons">
      {powerHud && (
        <button
          type="button"
          className={`phase-button phase-button--power ${size(powerBlock)}`}
          aria-disabled={Boolean(powerBlock)}
          title={powerBlock ?? 'Automatic Power Phase: each of your characters gains Power'}
          onClick={powerBlock ? undefined : onPowerPhase}
        >
          <GemIcon />
          <span className="phase-text">
            {powerBlock ? 'Auto power phase' : 'Auto power phase!'}
          </span>
        </button>
      )}
      {/* aria-disabled, not disabled: some browsers show no title on a disabled button */}
      {cleanupHud && (
        <button
          type="button"
          className={`phase-button phase-button--cleanup ${size(cleanupDisabled)}`}
          aria-disabled={cleanupDisabled}
          title={cleanupTitle}
          onClick={cleanupDisabled ? undefined : onCleanupPhase}
        >
          <TurnIcon />
          <span className="phase-text">
            {cleanupDisabled ? 'Auto cleanup phase' : 'Auto cleanup phase!'}
          </span>
        </button>
      )}
    </div>
  )
}
