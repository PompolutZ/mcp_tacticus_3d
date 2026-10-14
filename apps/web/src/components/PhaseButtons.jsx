// The Power and Cleanup buttons when the settings put them in the HUD: a group fixed in the bottom right
// corner, Power first (docs/features/round-phases.md, docs/features/table-tools.md). The handlers, the
// disabled state and the titles are the same as on the table; App passes them.
// onPowerPhase(): gives Power to the sides this browser plays. cleanupDisabled, cleanupTitle: the Cleanup
// lock and its reason.
export function PhaseButtons({
  settings,
  onPowerPhase,
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
          className="phase-button"
          title="Automatic Power Phase: each of your characters gains Power"
          onClick={onPowerPhase}
        >
          Power
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
          Cleanup
        </button>
      )}
    </div>
  )
}
