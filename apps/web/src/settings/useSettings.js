import { useEffect, useMemo, useState } from 'react'
import { setVolume } from '../sound.js'
import { effectiveBindings } from '../input/bindings.js'
import { readSettings, writeSettings } from './settings.js'

// The settings of this browser (settings/settings.js), read once. A change is stored at once.
export function useSettings() {
  const [settings, setSettings] = useState(readSettings)
  function handleSettingChange(item, place) {
    const next = { ...settings, tools: { ...settings.tools, [item]: place } }
    setSettings(next)
    writeSettings(next)
  }
  function handleVolumeChange(volume) {
    const next = { ...settings, sound: { volume } }
    setSettings(next)
    writeSettings(next)
  }
  function handleSpectatorSizeChange(size) {
    const next = { ...settings, spectator: { size } }
    setSettings(next)
    writeSettings(next)
  }
  function handleLabelsChange(labels) {
    const next = { ...settings, labels }
    setSettings(next)
    writeSettings(next)
  }
  // changed: the bindings of the actions that differ from the defaults (changedBindings in input/bindings.js)
  function handleBindingsChange(changed) {
    const next = { ...settings, bindings: changed }
    setSettings(next)
    writeSettings(next)
  }
  // The bindings in use: the defaults with the changed actions of the settings
  const bindings = useMemo(() => effectiveBindings(settings.bindings), [settings.bindings])
  useEffect(() => setVolume(settings.sound.volume / 100), [settings.sound.volume])
  return {
    settings,
    bindings,
    handleBindingsChange,
    handleLabelsChange,
    handleSettingChange,
    handleSpectatorSizeChange,
    handleVolumeChange,
  }
}
