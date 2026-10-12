// The notice of dropped objective tokens that wait for their place (docs/features/character-trays.md, "Hold and
// drop"). One line for each character. lines: [{ id, text, mine }] (App.jsx, waitLines). onShow(line) moves the
// camera to the token. onDone(line) places the tokens where they lie, for the player that places them.
export default function HudNotice({ lines, onShow, onDone }) {
  if (lines.length === 0) return null
  return (
    <div className="hud-notice" role="status">
      {lines.map((line) => (
        <div key={line.id} className="hud-notice-line">
          <span>{line.text}</span>
          <button type="button" className="chip" onClick={() => onShow(line)}>
            Show
          </button>
          {line.mine && (
            <button type="button" className="chip" onClick={() => onDone(line)}>
              Done
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
