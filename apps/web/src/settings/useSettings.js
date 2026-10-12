import { useEffect, useState } from 'react'
import { setVolume } from '../sound.js'
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
  useEffect(() => setVolume(settings.sound.volume / 100), [settings.sound.volume])
  return { settings, handleSettingChange, handleVolumeChange }
}
