import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'

// Shown only for the first scene load. Tools load later on click and are small, so they don't bring it back.
export function LoadingOverlay() {
  const { active, progress, loaded, total } = useProgress()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!active && total > 0 && loaded === total) setDone(true)
  }, [active, loaded, total])

  if (done) return null

  return (
    <div className="loading">
      <div className="loading-panel">
        <div className="loading-title">Loading assets…</div>
        <div className="loading-bar">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="loading-detail">{loaded} / {total} files · {Math.round(progress)}%</div>
      </div>
    </div>
  )
}
