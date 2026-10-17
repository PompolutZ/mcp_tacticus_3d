// An on/off switch: a track with a knob, and the label next to it. onChange(nextChecked).
// variant="comic": the comic look of the new room dialog (rooms/comic.css): the whole row is the button, the
// label with an optional hint (a line under it) on the left, and a track with an ON / OFF knob on the right.
export function Switch({ checked, onChange, label, hint, title, variant }) {
  const comic = variant === 'comic'
  const base = comic ? 'switch-comic' : 'switch'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={checked ? `${base} ${base}--on` : base}
      title={title}
      onClick={() => onChange(!checked)}
    >
      {comic ? (
        <>
          <span className="switch-comic-text">
            <span className="switch-comic-label">{label}</span>
            {hint && <span className="switch-comic-hint">{hint}</span>}
          </span>
          <span className="switch-comic-track" aria-hidden="true">
            <span className="switch-comic-knob">{checked ? 'ON' : 'OFF'}</span>
          </span>
        </>
      ) : (
        <>
          <span className="switch-track" aria-hidden="true">
            <span className="switch-knob" />
          </span>
          <span className="switch-label">{label}</span>
        </>
      )}
    </button>
  )
}
