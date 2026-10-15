// What the players look at (docs/features/peer-to-peer.md, "What each player controls"): the selected pieces, the selected tools, the range
// mark and the ping, in the awareness state next to the claims of ownership.js. Each module sets only its own fields with
// setLocalStateField, so neither overwrites the other. Plain module: no three.js and no import.meta.env, so
// node --test can load it.

const NONE = Object.freeze({ selection: [], tools: [], mark: null, ping: null })

function sameList(a, b) {
  return a.length === b.length && a.every((item, i) => item === b[i])
}

function sameMark(a, b) {
  return a?.key === b?.key && a?.mode === b?.mode
}

// A ping is new when its id is new (a ping replaces the last one)
function samePing(a, b) {
  return a?.id === b?.id
}

function cleanList(list) {
  return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : []
}

function cleanMark(mark) {
  return mark && typeof mark.key === 'string' && typeof mark.mode === 'string'
    ? { key: mark.key, mode: mark.mode }
    : null
}

function cleanPing(ping) {
  const { id, at } = ping ?? {}
  const ok =
    typeof id === 'string' && Array.isArray(at) && at.length === 3 && at.every(Number.isFinite)
  return ok ? { id, at: [...at] } : null
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
// Fields: selection (piece keys, the last one is the tool target), tools (kinds), mark ({ key, mode } or null),
// ping ({ id, at: [x, y, z] } or null, docs/features/ping.md).
/**
 * @param {object} [options]
 * @param {import("y-protocols/awareness").Awareness | null} [options.awareness]
 */
export function createPresence({ awareness = null } = {}) {
  if (!awareness) return createLocalPresence()
  const ownId = awareness.clientID
  const listeners = new Set()

  // The ping id that each other client had in the first state this browser got from it: that ping is from
  // before the join and shows nothing. A client that leaves is forgotten (docs/features/ping.md).
  const firstPing = new Map()

  // The same object until a field changes
  let shown = NONE
  function refresh() {
    const states = awareness.getStates()
    for (const id of firstPing.keys()) if (!states.get(id)) firstPing.delete(id)
    let found = null
    for (const [id, state] of states) {
      if (id !== ownId && state) {
        if (!firstPing.has(id)) firstPing.set(id, cleanPing(state.ping)?.id ?? null)
        const ping = cleanPing(state.ping)
        found = {
          selection: cleanList(state.selection),
          tools: cleanList(state.tools),
          mark: cleanMark(state.mark),
          ping: ping?.id === firstPing.get(id) ? null : ping,
        }
        break
      }
    }
    if (!found) found = NONE
    if (
      sameList(shown.selection, found.selection) &&
      sameList(shown.tools, found.tools) &&
      sameMark(shown.mark, found.mark) &&
      samePing(shown.ping, found.ping)
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
  if (local?.ping === undefined) awareness.setLocalStateField('ping', null)
  refresh()

  return {
    // fields: any of { selection, tools, mark, ping }. A field that equals the current one is not sent again.
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
      if (fields.ping !== undefined) {
        const next = cleanPing(fields.ping)
        if (!samePing(cleanPing(now.ping), next)) awareness.setLocalStateField('ping', next)
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
