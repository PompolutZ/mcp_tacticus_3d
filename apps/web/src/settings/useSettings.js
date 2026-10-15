import { useEffect, useMemo, useState } from 'react'
import { setVolume } from '../sound.js'
import { effectiveBindings } from '../input/bindings.js'
import { readSettings, writeSettings } from './settings.js'

// The settings of this browser (settings/settings.js), read once. A change is stored at once.
export function useSettings() {
  const [settings, setSettings] = useState(readSettings)
  // patch: the changed top-level parts, for example { tools }, { sound: { volume } }, { bindings: changed }
  // (bindings: only the actions that differ from the defaults, changedBindings in input/bindings.js)
  function updateSettings(patch) {
    const next = { ...settings, ...patch }
    setSettings(next)
    writeSettings(next)
  }
  // The bindings in use: the defaults with the changed actions of the settings
  const bindings = useMemo(() => effectiveBindings(settings.bindings), [settings.bindings])
  useEffect(() => setVolume(settings.sound.volume / 100), [settings.sound.volume])
  return { settings, bindings, updateSettings }
}
