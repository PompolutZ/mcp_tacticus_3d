import { useState } from 'react'
import { useProgress } from '@react-three/drei'
import { Overlay } from './Overlay.jsx'

// Covers the table until it is ready: ready turns true when the scene and the preloaded files (map and
// models, see Preload.jsx) are in. Files that load later (a tool on click, a new map in the Sandbox) do not
// bring it back. A full-screen dialog, so it renders through Overlay (portal to document.body), the same
// as CardPopup.
// three.js counts the files of the whole page life, also of the tables before this one. So the numbers
// count from the moment this overlay mounts.
export function LoadingOverlay({ ready }) {
  const { loaded, total } = useProgress()
  const [start] = useState(() => {
    const state = useProgress.getState()
    return { loaded: state.loaded, total: state.total }
  })

  if (ready) return null

  const done = loaded - start.loaded
  const count = total - start.total
  const progress = count > 0 ? (done / count) * 100 : 0
  return (
    <Overlay className="loading">
      <div className="loading-panel">
        <div className="loading-title">Loading assets…</div>
        <div className="loading-bar">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="loading-detail">
          {done} / {count} files · {Math.round(progress)}%
        </div>
      </div>
    </Overlay>
  )
}
