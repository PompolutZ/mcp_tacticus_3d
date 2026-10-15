// The settings of this browser, in localStorage (docs/features/table-tools.md, "Settings menu"). They belong
// to the browser, not to the user or the room. No React.
import { ACTIONS, cleanBinding, sameBindings } from '../input/bindings.js'
import { readJson, writeJson } from '../storage.js'

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

// Size of the spectator columns in percent (docs/features/spectator-view.md, "Squad columns")
export const DEFAULT_SPECTATOR_SIZE = 100
export const MIN_SPECTATOR_SIZE = 60
export const MAX_SPECTATOR_SIZE = 150

// Step of a Q / E press and a wheel step, in degrees (docs/features/key-shortcuts.md, "Q / E")
export const DEFAULT_TURN_STEP = 15
export const MIN_TURN_STEP = 5
export const MAX_TURN_STEP = 15

export function defaultSettings() {
  return {
    version: VERSION,
    tools: Object.fromEntries(
      TOOL_ITEMS.map((item) => [item, HUD_DEFAULT.includes(item) ? 'hud' : 'table']),
    ),
    sound: { volume: DEFAULT_VOLUME },
    spectator: { size: DEFAULT_SPECTATOR_SIZE },
    turn: { step: DEFAULT_TURN_STEP },
    // Terrain labels (piece name and game Size) above every piece. The piece under the pointer always has one.
    labels: false,
    // Dice: a die that rests tilted (or does not rest in 8 s) is thrown again. Off: it reads the face nearest to up
    // (docs/features/dice-rolling.md, "Tilted dice").
    rethrowTilted: false,
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
  const size = raw?.spectator?.size
  if (Number.isFinite(size))
    settings.spectator.size = Math.round(
      Math.min(MAX_SPECTATOR_SIZE, Math.max(MIN_SPECTATOR_SIZE, size)),
    )
  const step = raw?.turn?.step
  if (Number.isFinite(step))
    settings.turn.step = Math.round(Math.min(MAX_TURN_STEP, Math.max(MIN_TURN_STEP, step)))
  settings.labels = raw?.labels === true
  settings.rethrowTilted = raw?.rethrowTilted === true
  settings.bindings = normalizeBindings(raw?.bindings)
  return settings
}

// Storage turned off, or a broken record, gives the defaults
export function readSettings() {
  try {
    return normalize(readJson(KEY))
  } catch {
    return defaultSettings()
  }
}

// Returns false when the browser did not store it
export function writeSettings(settings) {
  return writeJson(KEY, normalize(settings))
}
