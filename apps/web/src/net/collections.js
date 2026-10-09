// Table state as plain JSON in Yjs maps, read and written in the form of React state. No React.
// A list is a Y.Map from id to a Y.Map of the entity's fields. A record is a Y.Map of fields. See
// docs/plans/implement-backend/05-yjs-state.md, decisions 4 to 7 and 10.

import * as Y from 'yjs'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// True when two JSON values have the same content. A field with the value undefined counts as missing.
export function equal(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => equal(v, b[i]))
  const keys = Object.keys(a).filter((key) => a[key] !== undefined)
  const count = Object.keys(b).filter((key) => b[key] !== undefined).length
  return keys.length === count && keys.every((key) => equal(a[key], b[key]))
}

// next, with the parts that are equal to prev taken from prev. So an unchanged object keeps its
// identity, and React components and effects that depend on it do not run again.
function share(prev, next) {
  if (equal(prev, next)) return prev
  if (isPlainObject(prev) && isPlainObject(next)) {
    const out = {}
    for (const [key, value] of Object.entries(next)) out[key] = share(prev[key], value)
    return out
  }
  if (Array.isArray(prev) && Array.isArray(next)) return next.map((v, i) => share(prev[i], v))
  return next
}

// The same as share, but list entities are matched by id, so an entity added in the middle does not
// give new objects to the entities after it
function shareList(prev, next) {
  if (!prev) return next
  const byId = new Map(prev.map((entity) => [entity.id, entity]))
  const out = next.map((entity) => share(byId.get(entity.id), entity))
  return out.length === prev.length && out.every((entity, i) => entity === prev[i]) ? prev : out
}

// Entries for a new Y.Map. Down to depth, a plain object becomes a nested Y.Map of its fields.
function mapEntries(fields, depth) {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [
      key,
      depth > 0 && isPlainObject(value) ? new Y.Map(mapEntries(value, depth - 1)) : value,
    ])
}

// Writes one field. An equal value is not written, so the document does not grow.
function writeField(ymap, key, value, depth) {
  if (value === undefined) {
    if (ymap.has(key)) ymap.delete(key)
    return
  }
  const current = ymap.get(key)
  if (depth > 0 && isPlainObject(value)) {
    if (current instanceof Y.Map) writeFields(current, value, depth - 1)
    else ymap.set(key, new Y.Map(mapEntries(value, depth - 1)))
    return
  }
  if (current instanceof Y.AbstractType || !equal(current, value)) ymap.set(key, value)
}

// Makes the fields of ymap equal to fields: deletes the missing ones, writes the changed ones
function writeFields(ymap, fields, depth) {
  for (const key of ymap.keys()) if (fields[key] === undefined) ymap.delete(key)
  for (const [key, value] of Object.entries(fields)) writeField(ymap, key, value, depth)
}

// The part of a store that React reads: the last snapshot, built again after a change of ymap
function snapshotStore(ymap, read, shareWith) {
  let snapshot = null
  let stale = true
  const listeners = new Set()
  ymap.observeDeep(() => {
    stale = true
    for (const listener of listeners) listener()
  })
  return {
    getSnapshot() {
      if (stale) {
        snapshot = shareWith(snapshot, read())
        stale = false
      }
      return snapshot
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function compareIds(a, b) {
  if (a < b) return -1
  return a > b ? 1 : 0
}

// A list of entities [{ id, ...fields }], in the order of the array. fields: when set, only these
// fields are stored. The order is a hidden `order` field of each entity (decision 5).
export function createList(ymap, { fields = null } = {}) {
  function read() {
    const entries = []
    ymap.forEach((entity, id) => {
      if (!(entity instanceof Y.Map)) return
      const { order = 0, ...rest } = entity.toJSON()
      entries.push({ id, order, entity: { id, ...rest } })
    })
    entries.sort((a, b) => a.order - b.order || compareIds(a.id, b.id))
    return entries.map(({ entity }) => entity)
  }

  // An entity keeps its stored order while that is above the order of the entity before it. Else it
  // gets the next number. So an entity that moves to the end gets a new order, and the others keep theirs.
  function write(next) {
    const ids = new Set(next.map(({ id }) => id))
    for (const id of ymap.keys()) if (!ids.has(id)) ymap.delete(id)
    let last = 0
    for (const { id, ...rest } of next) {
      const stored = fields ? Object.fromEntries(fields.map((key) => [key, rest[key]])) : rest
      const current = ymap.get(id)
      const currentOrder = current instanceof Y.Map ? current.get('order') : undefined
      const order =
        typeof currentOrder === 'number' && currentOrder > last ? currentOrder : last + 1
      if (current instanceof Y.Map) writeFields(current, { ...stored, order }, 0)
      else ymap.set(id, new Y.Map(mapEntries({ ...stored, order }, 0)))
      last = order
    }
  }

  return {
    ...snapshotStore(ymap, read, shareList),
    read,
    // next: the new array, or a function of the current array (read now, not at the last render)
    set(next) {
      const value = typeof next === 'function' ? next(read()) : next
      ymap.doc.transact(() => write(value))
    },
  }
}

// A record of fields { key: value }. depth: how many levels of plain objects are nested Y.Maps, so
// that changes of different keys in them merge (decision 6).
export function createRecord(ymap, { depth = 0 } = {}) {
  const read = () => ymap.toJSON()

  function get(key) {
    const value = ymap.get(key)
    return value instanceof Y.AbstractType ? value.toJSON() : value
  }

  return {
    ...snapshotStore(ymap, read, share),
    read,
    get,
    // next: the new record, or a function of the current record
    set(next) {
      const value = typeof next === 'function' ? next(read()) : next
      ymap.doc.transact(() => writeFields(ymap, value, depth))
    },
    // next: the new value of key, or a function of its current value
    setField(key, next) {
      const value = typeof next === 'function' ? next(get(key)) : next
      ymap.doc.transact(() => writeField(ymap, key, value, depth))
    },
  }
}
