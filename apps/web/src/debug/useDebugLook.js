import { useEffect, useState } from 'react'
import { DEFAULT_LOOK, setLook } from '../components/look.js'

// The state of the Debug panel and the look effect. debug: the constant of App (dev server and the Debug
// chip), so a build leaves the debug code out. mode: the render mode when debug is on, else 'full'.
// panel: the props of DebugPanel.
export function useDebugLook(debug) {
  // 'full' | 'no-outline' | 'no-composer', see DebugPanel
  const [renderMode, setRenderMode] = useState('full')
  // Look options of cards and tokens, see DebugPanel and components/look.js
  const [toneMapping, setToneMapping] = useState(DEFAULT_LOOK.toneMapping)
  const [surface, setSurface] = useState(DEFAULT_LOOK.surface)
  useEffect(() => {
    setLook(debug ? { toneMapping, surface } : DEFAULT_LOOK)
  }, [debug, toneMapping, surface])
  const mode = debug ? renderMode : 'full'
  const panel = {
    renderMode,
    onRenderModeChange: setRenderMode,
    toneMapping,
    onToneMappingChange: setToneMapping,
    surface,
    onSurfaceChange: setSurface,
  }
  return { mode, panel }
}
