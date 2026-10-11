// The settings of this browser, in localStorage (docs/features/table-tools.md, "Settings menu"). They belong
// to the browser, not to the user or the room. No React.

const KEY = 'mcp-assist-3d/settings'

// Where each item of the table tools shows: on the table, or in the HUD (the toolbar)
export const PLACES = ['table', 'hud']
export const TOOL_ITEMS = ['rack', 'power', 'cleanup', 'deployLock', 'matTurn']

export function defaultSettings() {
  return { tools: Object.fromEntries(TOOL_ITEMS.map((item) => [item, 'table'])) }
}

// Fills every missing or unknown value with the default
function normalize(raw) {
  const settings = defaultSettings()
  for (const item of TOOL_ITEMS) {
    const place = raw?.tools?.[item]
    if (PLACES.includes(place)) settings.tools[item] = place
  }
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
