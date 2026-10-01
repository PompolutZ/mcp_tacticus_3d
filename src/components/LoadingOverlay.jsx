import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { Overlay } from './Overlay.jsx'

// Shown only for the first scene load. Tools load later on click and are small, so they don't
// bring it back. A full-screen dialog, so it renders through Overlay (portal to document.body),
// the same as CardPopup.
export function LoadingOverlay() {
  const { active, progress, loaded, total } = useProgress()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!active && total > 0 && loaded === total) setDone(true)
  }, [active, loaded, total])

  if (done) return null

  return (
    <Overlay className="loading">
      <div className="loading-panel">
        <div className="loading-title">Loading assets…</div>
        <div className="loading-bar">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="loading-detail">{loaded} / {total} files · {Math.round(progress)}%</div>
      </div>
    </Overlay>
  )
}
