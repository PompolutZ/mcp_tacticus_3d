import { useEffect, useState } from 'react'
import { DEFAULT_LOOK, DEFAULT_TRAY_LOOK, setLook, setTrayLook } from '../components/look.js'

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
  // TEMPORARY dice tray tuning, see components/look.js
  const [tray, setTray] = useState(DEFAULT_TRAY_LOOK)
  useEffect(() => {
    setTrayLook(debug ? tray : DEFAULT_TRAY_LOOK)
  }, [debug, tray])
  const mode = debug ? renderMode : 'full'
  const panel = {
    renderMode,
    onRenderModeChange: setRenderMode,
    toneMapping,
    onToneMappingChange: setToneMapping,
    surface,
    onSurfaceChange: setSurface,
    tray,
    onTrayChange: (patch) => setTray((prev) => ({ ...prev, ...patch })),
    onTrayReset: () => setTray(DEFAULT_TRAY_LOOK),
  }
  return { mode, panel }
}
