import { Overlay } from './Overlay.jsx'

// The loading screen without three.js, so Root can show it while the table chunk loads
// (docs/features/rooms.md, "Loading"). count 0: the bar is empty and there is no detail, only the animation.
// A full-screen dialog, so it renders through Overlay (portal to document.body).
export function LoadingScreen({ done = 0, count = 0 }) {
  const progress = count > 0 ? (done / count) * 100 : 0
  return (
    <Overlay className="loading">
      <div className="loading-panel">
        <div className="loading-title">Loading assets…</div>
        <div className="loading-bar">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        {count > 0 && (
          <div className="loading-detail">
            {done} / {count} files · {Math.round(progress)}%
          </div>
        )}
      </div>
    </Overlay>
  )
}
