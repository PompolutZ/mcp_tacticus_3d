// Whether the Log panel is expanded, per browser, in localStorage. No React.

const KEY = 'mcp-assist-3d/log-open'

// Collapsed by default, and when the browser has no storage
export function readLogOpen() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function writeLogOpen(open) {
  try {
    localStorage.setItem(KEY, open ? '1' : '0')
  } catch {
    // The state is kept for this page only
  }
}
