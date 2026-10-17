// A star burst: black outer shape, colored inner shape, text or icon inside ("3D", "VS", "+").
// Styles in lobby.css. size is in px; fontSize defaults to 40% of it.
export function Burst({ size = 64, color = 'var(--red)', fontSize, children }) {
  return (
    <span className="burst-wrap" style={{ width: size, height: size }}>
      <span className="burst burst-outer" aria-hidden="true" />
      <span
        className="burst burst-inner"
        style={{ background: color, fontSize: fontSize ?? Math.round(size * 0.4) }}
      >
        {children}
      </span>
    </span>
  )
}
