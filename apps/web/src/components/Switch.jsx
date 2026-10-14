// An on/off switch: a track with a knob, and the label next to it. onChange(nextChecked).
export function Switch({ checked, onChange, label, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={checked ? 'switch switch--on' : 'switch'}
      title={title}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-knob" />
      </span>
      <span className="switch-label">{label}</span>
    </button>
  )
}
