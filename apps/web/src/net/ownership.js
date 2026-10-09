// Claims on pieces (plan 09, decisions 5 to 7). A claim is a piece key in `owns` of the own awareness state.
// The other player's claims come in over the awareness of syncChannel.js. Plain module: no three.js and no
// import.meta.env, so node --test can load it.

// Who owns key. ownId: the own client id. own: the own keys. others: Map client id → keys of the other
// clients. Both own it (a tie): the lower client id keeps it (decision 7).
export function resolveOwner(key, ownId, own, others) {
  const mine = own.includes(key)
  let lowest = null
  for (const [id, keys] of others) {
    if (keys.includes(key) && (lowest === null || id < lowest)) lowest = id
  }
  if (lowest === null) return mine ? 'me' : null
  if (mine && ownId < lowest) return 'me'
  return 'other'
}

// The keys that the other clients own, after the tie rule
export function otherOwnedKeys(ownId, own, others) {
  const keys = new Set()
  for (const list of others.values()) {
    for (const key of list) if (resolveOwner(key, ownId, own, others) === 'other') keys.add(key)
  }
  return keys
}

// The own keys that lost a tie
export function lostKeys(ownId, own, others) {
  return own.filter((key) => {
    for (const [id, keys] of others) if (id < ownId && keys.includes(key)) return true
    return false
  })
}

export function sameSet(a, b) {
  if (a.size !== b.size) return false
  for (const key of a) if (!b.has(key)) return false
  return true
}

function listeners() {
  const set = new Set()
  return {
    add(fn) {
      set.add(fn)
      return () => set.delete(fn)
    },
    call(...args) {
      for (const fn of set) fn(...args)
    },
  }
}

// The version without a connection, for a single player room and the Sandbox: always the writer, never an
// other owner.
function createLocalOwnership() {
  const own = new Set()
  const none = new Set()
  return {
    claim(key) {
      own.add(key)
      return true
    },
    release(key) {
      own.delete(key)
    },
    owner: (key) => (own.has(key) ? 'me' : null),
    writes: () => true,
    otherPresent: () => false,
    mine: () => [...own],
    onLost: () => () => {},
    subscribe: () => () => {},
    otherOwned: () => none,
    destroy() {},
  }
}

// awareness: the y-protocols Awareness of the table, or none for the local version. role: 'host' or 'guest'.
export function createOwnership({ awareness = null, role = 'guest' } = {}) {
  if (!awareness) return createLocalOwnership()
  const lost = listeners()
  const changed = listeners()
  const ownId = awareness.clientID

  const ownKeys = () => awareness.getLocalState()?.owns ?? []
  const setOwn = (keys) => awareness.setLocalStateField('owns', keys)
  // Map client id → keys, of the other clients
  function others() {
    const map = new Map()
    for (const [id, state] of awareness.getStates()) {
      if (id !== ownId) map.set(id, Array.isArray(state?.owns) ? state.owns : [])
    }
    return map
  }

  let set = new Set()
  let present = false
  function refresh() {
    const next = otherOwnedKeys(ownId, ownKeys(), others())
    const isPresent = others().size > 0
    if (sameSet(set, next) && present === isPresent) return
    if (!sameSet(set, next)) set = next
    present = isPresent
    changed.call()
  }

  function onChange() {
    const gone = lostKeys(ownId, ownKeys(), others())
    if (gone.length > 0) {
      setOwn(ownKeys().filter((key) => !gone.includes(key)))
      for (const key of gone) lost.call(key)
    }
    refresh()
  }

  // Sets the field, so the other end gets a state with `owns` at once
  setOwn(ownKeys())
  awareness.on('change', onChange)
  refresh()

  const owner = (key) => resolveOwner(key, ownId, ownKeys(), others())
  const otherPresent = () => others().size > 0
  return {
    claim(key) {
      if (owner(key) === 'other') return false
      if (!ownKeys().includes(key)) setOwn([...ownKeys(), key])
      return true
    },
    release(key) {
      if (ownKeys().includes(key)) setOwn(ownKeys().filter((k) => k !== key))
    },
    owner,
    // Decision 6: an unclaimed pose is written by the host, or by this browser when it is alone
    writes(key) {
      const who = owner(key)
      if (who === 'me') return true
      if (who === 'other') return false
      return role === 'host' || !otherPresent()
    },
    otherPresent,
    mine: () => [...ownKeys()],
    onLost: lost.add,
    subscribe: changed.add,
    otherOwned: () => set,
    destroy() {
      awareness.off('change', onChange)
    },
  }
}
