import { useMemo, useState } from 'react'
import { DEFAULT_LOOK } from '../table/tableStore.js'

// The state of the Debug panel and the look. debug: the constant of App (dev server and the Debug
// chip), so a build leaves the debug code out. mode: the render mode when debug is on, else 'full'.
// look: the look of cards and tokens, App writes it to the store of the table. panel: the props of DebugPanel.
export function useDebugLook(debug) {
  // 'full' | 'no-outline' | 'no-composer', see DebugPanel
  const [renderMode, setRenderMode] = useState('full')
  // Look options of cards and tokens, see DebugPanel and DEFAULT_LOOK in table/tableStore.js
  const [toneMapping, setToneMapping] = useState(DEFAULT_LOOK.toneMapping)
  const [surface, setSurface] = useState(DEFAULT_LOOK.surface)
  const [ambient, setAmbient] = useState(DEFAULT_LOOK.ambient)
  const [corner, setCorner] = useState(DEFAULT_LOOK.corner)
  const look = useMemo(
    () => (debug ? { toneMapping, surface, ambient, corner } : DEFAULT_LOOK),
    [debug, toneMapping, surface, ambient, corner],
  )
  const [showColliders, setShowColliders] = useState(false)
  const mode = debug ? renderMode : 'full'
  const panel = {
    renderMode,
    onRenderModeChange: setRenderMode,
    toneMapping,
    onToneMappingChange: setToneMapping,
    surface,
    onSurfaceChange: setSurface,
    ambient,
    onAmbientChange: setAmbient,
    corner,
    onCornerChange: setCorner,
    showColliders,
    onShowCollidersChange: setShowColliders,
  }
  return { mode, look, showColliders: debug && showColliders, panel }
}
