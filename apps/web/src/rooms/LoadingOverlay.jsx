import { useProgress } from '@react-three/drei'
import { Overlay } from '../ui/Overlay.jsx'

// Covers the table until it is ready: ready turns true when the scene and the preloaded files (map and
// models, see Preload.jsx) are in. Files that load later (a tool on click, a new map in the Sandbox) do not
// bring it back. A full-screen dialog, so it renders through Overlay (portal to document.body), the same
// as CardPopup.
// three.js counts the files of the whole page life, also of the tables before this one. So the numbers
// count from the moment this overlay mounts.
export function LoadingOverlay({ ready }) {
  const { progress } = useProgress()
  
  if (ready) return null

    return (
    <Overlay className="loading">
      <div className="loading-panel">
        <div className="loading-title">Loading assets…</div>
        <div className="loading-bar">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Overlay>
  )
}
