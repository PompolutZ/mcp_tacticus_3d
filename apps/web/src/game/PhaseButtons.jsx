import { POWER_ICON } from '../ui/TableButtons.jsx'

// The Power and Cleanup buttons when the settings put them in the HUD: a group fixed in the bottom right
// corner, Power first (docs/features/round-phases.md, docs/features/table-tools.md). The handlers, the
// disabled state and the titles are the same as on the table; App passes them.
// onPowerPhase(): gives Power to the sides this browser plays. powerBlock: the reason Power is off, or null. cleanupDisabled, cleanupTitle: the Cleanup
// lock and its reason.
export function PhaseButtons({
  settings,
  onPowerPhase,
  powerBlock,
  onCleanupPhase,
  cleanupDisabled,
  cleanupTitle,
}) {
  const powerHud = settings.tools.power === 'hud'
  const cleanupHud = settings.tools.cleanup === 'hud'
  if (!powerHud && !cleanupHud) return null
  return (
    <div className="phase-buttons">
      {powerHud && (
        <button
          type="button"
          className="phase-button phase-button--power"
          aria-disabled={Boolean(powerBlock)}
          title={powerBlock ?? 'Automatic Power Phase: each of your characters gains Power'}
          onClick={powerBlock ? undefined : onPowerPhase}
        >
          <img className="table-button-icon" src={POWER_ICON} alt="" />
          Auto Power Phase
        </button>
      )}
      {/* aria-disabled, not disabled: some browsers show no title on a disabled button */}
      {cleanupHud && (
        <button
          type="button"
          className="phase-button"
          aria-disabled={cleanupDisabled}
          title={cleanupTitle}
          onClick={cleanupDisabled ? undefined : onCleanupPhase}
        >
          Auto Cleanup Phase
        </button>
      )}
    </div>
  )
}
