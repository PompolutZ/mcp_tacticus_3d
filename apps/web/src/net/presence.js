// What the players look at (plan 09, decisions 24 and 25): the selected pieces, the selected tools and the range
// mark, in the awareness state next to the claims of ownership.js. Each module sets only its own fields with
// setLocalStateField, so neither overwrites the other. Plain module: no three.js and no import.meta.env, so
// node --test can load it.

const NONE = Object.freeze({ selection: [], tools: [], mark: null })

function sameList(a, b) {
  return a.length === b.length && a.every((item, i) => item === b[i])
}

function sameMark(a, b) {
  return a?.key === b?.key && a?.mode === b?.mode
}

function cleanList(list) {
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : []
}

function cleanMark(mark) {
  return mark && typeof mark.key === 'string' && typeof mark.mode === 'string'
    ? { key: mark.key, mode: mark.mode }
    : null
}

// The version without a connection, for a single player room and the Sandbox: nobody else to see.
function createLocalPresence() {
  return {
    set() {},
    other: () => NONE,
    subscribe: () => () => {},
    destroy() {},
  }
}

// awareness: the y-protocols Awareness of the table, or none for the local version.
// Fields: selection (piece keys, the last one is the tool target), tools (kinds), mark ({ key, mode } or null).
export function createPresence({ awareness = null } = {}) {
  if (!awareness) return createLocalPresence()
  const ownId = awareness.clientID
  const listeners = new Set()

  // The same object until a field changes
  let shown = NONE
  function refresh() {
    let found = null
    for (const [id, state] of awareness.getStates()) {
      if (id !== ownId && state) {
        found = {
          selection: cleanList(state.selection),
          tools: cleanList(state.tools),
          mark: cleanMark(state.mark),
        }
        break
      }
    }
    if (!found) found = NONE
    if (
      sameList(shown.selection, found.selection) &&
      sameList(shown.tools, found.tools) &&
      sameMark(shown.mark, found.mark)
    )
      return
    shown = found
    for (const fn of listeners) fn()
  }

  awareness.on('change', refresh)
  const local = awareness.getLocalState()
  if (local?.selection === undefined) awareness.setLocalStateField('selection', [])
  if (local?.tools === undefined) awareness.setLocalStateField('tools', [])
  if (local?.mark === undefined) awareness.setLocalStateField('mark', null)
  refresh()

  return {
    // fields: any of { selection, tools, mark }. A field that equals the current one is not sent again.
    set(fields) {
      const now = awareness.getLocalState() ?? {}
      if (fields.selection !== undefined) {
        const next = cleanList(fields.selection)
        if (!sameList(cleanList(now.selection), next))
          awareness.setLocalStateField('selection', next)
      }
      if (fields.tools !== undefined) {
        const next = cleanList(fields.tools)
        if (!sameList(cleanList(now.tools), next)) awareness.setLocalStateField('tools', next)
      }
      if (fields.mark !== undefined) {
        const next = cleanMark(fields.mark)
        if (!sameMark(cleanMark(now.mark), next)) awareness.setLocalStateField('mark', next)
      }
    },
    other: () => shown,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    destroy() {
      awareness.off('change', refresh)
      listeners.clear()
    },
  }
}
