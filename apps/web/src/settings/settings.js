// The settings of this browser, in localStorage (docs/features/table-tools.md, "Settings menu"). They belong
// to the browser, not to the user or the room. No React.
import { ACTIONS, cleanBinding, sameBindings } from '../input/bindings.js'

const KEY = 'mcp-assist-3d/settings'

// Where each item of the table tools shows: on the table, or in the HUD (the toolbar)
export const PLACES = ['table', 'hud']
const TOOL_ITEMS = ['rack', 'power', 'cleanup', 'deployLock', 'matTurn']

// The version of the saved settings. Saved settings without it (or with an older one) get power and cleanup
// set to 'hud' once, when the default moved to the HUD (docs/plans/playtest/playtest-3.md, decision 3).
export const VERSION = 2
// The items that default to the HUD, the others to the table
const HUD_DEFAULT = ['power', 'cleanup']

// Sound volume, 0 (off) to 100 (docs/features/sounds.md)
export const DEFAULT_VOLUME = 10

export function defaultSettings() {
  return {
    version: VERSION,
    tools: Object.fromEntries(
      TOOL_ITEMS.map((item) => [item, HUD_DEFAULT.includes(item) ? 'hud' : 'table']),
    ),
    sound: { volume: DEFAULT_VOLUME },
    // Only the actions the user changed: action id → [{ code, shift, ctrl, alt, meta, when }]. The others use
    // their default keys (input/bindings.js, docs/features/key-shortcuts.md).
    bindings: {},
  }
}

// The changed actions of stored bindings. Drops an unknown action, and a binding with an unknown code or
// a condition the action does not allow. An action with no valid binding left that had some is dropped
// (its defaults apply). An empty list stays: the user took every key off the action. An action with
// the default bindings is not stored.
function normalizeBindings(raw) {
  const bindings = {}
  if (!raw || typeof raw !== 'object') return bindings
  for (const { id, keys } of ACTIONS) {
    const list = raw[id]
    if (!Array.isArray(list)) continue
    const valid = list.map((b) => cleanBinding(b, id)).filter(Boolean)
    if (valid.length === 0 && list.length > 0) continue
    if (!sameBindings(valid, keys)) bindings[id] = valid
  }
  return bindings
}

// Fills every missing or unknown value with the default
function normalize(raw) {
  const settings = defaultSettings()
  for (const item of TOOL_ITEMS) {
    const place = raw?.tools?.[item]
    if (PLACES.includes(place)) settings.tools[item] = place
  }
  // Saved before the version: the new HUD default wins once, then the saved value is respected
  if (raw && raw.version !== VERSION) for (const item of HUD_DEFAULT) settings.tools[item] = 'hud'
  const volume = raw?.sound?.volume
  if (Number.isFinite(volume))
    settings.sound.volume = Math.round(Math.min(100, Math.max(0, volume)))
  settings.bindings = normalizeBindings(raw?.bindings)
  return settings
}

// localStorage can throw: storage turned off, or full. A read then gives the defaults.
export function readSettings() {
  try {
    const text = localStorage.getItem(KEY)
    return normalize(text ? JSON.parse(text) : null)
  } catch {
    return defaultSettings()
  }
}

// Returns false when the browser did not store it
export function writeSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalize(settings)))
    return true
  } catch {
    return false
  }
}
