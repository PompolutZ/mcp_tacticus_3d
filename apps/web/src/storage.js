// The one place that touches localStorage and sessionStorage. Storage can throw: turned off, or full. Every
// function here never throws: a read of a missing or bad value gives null, a write returns false when the
// browser did not store it. Each takes an optional storage area: a Storage object, or SESSION for
// sessionStorage. The default is localStorage. The global is looked up inside the try, because merely
// naming it can throw when storage is turned off. No React.

export const SESSION = 'session'

function areaOf(area) {
  if (area === SESSION) return sessionStorage
  return area ?? localStorage
}

// The stored text, or null
export function readText(key, area) {
  try {
    return areaOf(area).getItem(key)
  } catch {
    return null
  }
}

// Returns false when the browser did not store it
export function writeText(key, text, area) {
  try {
    areaOf(area).setItem(key, text)
    return true
  } catch {
    return false
  }
}

// The parsed JSON, or null when the key is missing or the text is not JSON
export function readJson(key, area) {
  const text = readText(key, area)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Returns false when the browser did not store it
export function writeJson(key, value, area) {
  return writeText(key, JSON.stringify(value), area)
}

export function removeKey(key, area) {
  try {
    areaOf(area).removeItem(key)
  } catch {
    // Storage turned off: there is nothing to delete
  }
}

// Every key of the area that starts with prefix, in storage order. [] when storage is off.
export function storageKeys(prefix = '', area) {
  try {
    const store = areaOf(area)
    return Array.from({ length: store.length }, (_, i) => store.key(i)).filter((key) =>
      key?.startsWith(prefix),
    )
  } catch {
    return []
  }
}
