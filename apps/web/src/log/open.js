// Whether the Log panel is expanded, per browser, in localStorage. No React.
import { readJson, writeJson } from '../storage.js'

const KEY = 'mcp-assist-3d/log-open'

// Collapsed by default, and when the browser has no storage
export function readLogOpen() {
  return readJson(KEY) === 1
}

export function writeLogOpen(open) {
  // Storage turned off: the state is kept for this page only
  writeJson(KEY, open ? 1 : 0)
}
