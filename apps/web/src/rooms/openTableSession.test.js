import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { SCHEMA, createTable, tableSchema } from '../net/doc.js'
import { MAPS } from '../terrain/maps/index.js'
import { startTableBytes } from './startTable.js'
import { openTableSession } from './openTableSession.js'
import { CUSTOM_MAP_ID } from './table.js'

// Sessions of a test, closed after it: the awareness of a room has a timer that keeps Node alive
const sessions = []
afterEach(() => {
  for (const session of sessions.splice(0)) session.close()
})

const settle = () => new Promise((resolve) => setImmediate(resolve))
const fail = (status) => Object.assign(new Error('x'), { status })
const MAP = Object.keys(MAPS)[0]
const OTHER_MAP = Object.keys(MAPS)[1] ?? MAP
const guestRoom = { id: 'K7Q2-M9XD', multiplayer: true, host: 'h', mapId: MAP }

// A session with fakes. over: replaces entries of deps (open: the openTableDoc result or function).
function setup({ room = null, userId = 'u', over = {} } = {}) {
  const calls = []
  const events = []
  const listeners = []
  const page = {
    visibilityState: 'visible',
    addEventListener: (type) => listeners.push(`+${type}`),
    removeEventListener: (type) => listeners.push(`-${type}`),
  }
  const writers = []
  const links = []
  const records = []
  const deps = {
    openTableDoc: async () => ({ doc: new Y.Doc(), storageFailed: false }),
    getTable: async () => startTableBytes(MAP, { host: null, guest: null }),
    putTable: async () => {},
    postMessage: async () => {},
    getMessages: async () => [],
    deleteDoc: (name) => calls.push(`delete:${name}`),
    watchRoomRecord: (id) => {
      const record = {
        flushed: 0,
        stopped: 0,
        flush: () => record.flushed++,
        stop: () => record.stopped++,
      }
      records.push(record)
      calls.push(`record:${id}`)
      return record
    },
    watchServerTable: (options) => {
      const writer = {
        options,
        flushed: 0,
        paused: [],
        stopped: 0,
        flush: () => writer.flushed++,
        pause: (value) => writer.paused.push(value),
        stop: () => writer.stopped++,
      }
      writers.push(writer)
      return writer
    },
    connectRoom: (options) => {
      const link = { options, stopped: 0, retried: 0 }
      link.stop = () => link.stopped++
      link.retry = () => link.retried++
      links.push(link)
      calls.push('connect')
      return link
    },
    createPeerConnection: () => ({}),
    build: () => 'b1',
    schema: () => SCHEMA,
    iceConfig: () => ({}),
    liveFlags: () => ({ drop: 0, delay: 0 }),
    randomId: () => 'peer-1',
    reportError: (source, error) => events.push(`report:${source}:${error.message}`),
    document: page,
    window: page,
    ...over,
  }
  let opened = null
  const session = openTableSession({
    room,
    userId,
    deps,
    onOpen: (value) => {
      opened = value
      events.push('open')
    },
    onServerWarning: (text) => events.push(`warn:${text}`),
    onConnection: (state) => events.push(`state:${state.state}`),
    onExit: (text) => events.push(`exit:${text}`),
  })
  sessions.push(session)
  return { session, calls, events, listeners, writers, links, records, opened: () => opened }
}

test('the Sandbox opens a filled table and makes no connect call', async () => {
  const t = setup()
  await settle()
  assert.deepEqual(t.events, ['open'])
  assert.equal(tableSchema(t.opened().table), SCHEMA)
  assert.equal(t.opened().table.game.get('mapId'), MAP)
  assert.equal(t.opened().live, null)
  assert.equal(t.calls.length, 0)
  assert.equal(t.writers.length, 0)
})

test('a single player room starts the room record, and flush flushes it', async () => {
  const t = setup({ room: { id: 'r1', multiplayer: false, mapId: MAP } })
  await settle()
  assert.deepEqual(t.calls, ['record:r1'])
  t.session.flush()
  assert.equal(t.records[0].flushed, 1)
  t.session.close()
  assert.equal(t.records[0].stopped, 1)
})

test('a multiplayer room applies the server bytes and connects', async () => {
  const bytes = startTableBytes(OTHER_MAP, { host: null, guest: null })
  const t = setup({ room: guestRoom, over: { getTable: async () => bytes } })
  await settle()
  assert.deepEqual(t.events, ['open'])
  assert.equal(t.opened().table.game.get('mapId'), OTHER_MAP)
  assert.ok(t.opened().live)
  assert.equal(t.writers[0].flushed, 1)
  assert.equal(t.links[0].options.role, 'guest')
  assert.equal(t.links[0].options.schema, SCHEMA)
  assert.equal(t.links[0].options.build, 'b1')
  t.session.retry()
  assert.equal(t.links[0].retried, 1)
  t.session.flush()
  assert.equal(t.writers[0].flushed, 2)
})

for (const status of [403, 404]) {
  test(`${status} from the server deletes the local copy and exits`, async () => {
    const t = setup({
      room: guestRoom,
      userId: 'u',
      over: {
        getTable: async () => {
          throw fail(status)
        },
      },
    })
    await settle()
    const text =
      status === 404
        ? `Room ${guestRoom.id} not found.`
        : `You have no seat in room ${guestRoom.id}.`
    assert.deepEqual(t.events, [`exit:${text}`])
    assert.equal(t.calls.filter((c) => c.startsWith('delete:')).length, 1)
    assert.equal(t.links.length, 0)
  })
}

test('another server error exits and keeps the local copy', async () => {
  const t = setup({
    room: guestRoom,
    over: {
      getTable: async () => {
        throw fail(500)
      },
    },
  })
  await settle()
  assert.deepEqual(t.events, [`exit:Could not load room ${guestRoom.id}. Try again.`])
  assert.equal(t.calls.length, 0)
})

test('a newer table exits and writes nothing', async () => {
  const doc = new Y.Doc()
  createTable(doc).game.setField('schema', SCHEMA + 1)
  const t = setup({ over: { openTableDoc: async () => ({ doc, storageFailed: false }) } })
  await settle()
  assert.deepEqual(t.events, [
    'exit:This table was saved by a newer version of the app. Reload the page to update.',
  ])
})

test('a room on the custom board with no copy of the board exits and fills nothing', async () => {
  const doc = new Y.Doc()
  let updates = 0
  doc.on('update', () => updates++)
  const t = setup({
    room: { id: 'r1', multiplayer: false, mapId: CUSTOM_MAP_ID },
    over: { openTableDoc: async () => ({ doc, storageFailed: false }) },
  })
  await settle()
  assert.deepEqual(t.events, ['exit:The board of this room can not be rebuilt.'])
  assert.equal(t.calls.length, 0)
  assert.equal(updates, 0)
})

test('writer gone deletes the copy and exits once', async () => {
  const t = setup({ room: guestRoom })
  await settle()
  t.writers[0].options.onGone()
  assert.deepEqual(t.events, ['open', `exit:The host deleted room ${guestRoom.id}.`])
  assert.equal(t.calls.filter((c) => c.startsWith('delete:')).length, 1)
  assert.equal(t.writers[0].stopped, 1)
  assert.equal(t.links[0].stopped, 1)
})

test('onState gone deletes the copy and exits once', async () => {
  const t = setup({ room: guestRoom })
  await settle()
  t.links[0].options.onState({ state: 'gone' })
  assert.deepEqual(t.events, ['open', `exit:The host deleted room ${guestRoom.id}.`])
  assert.equal(t.calls.filter((c) => c.startsWith('delete:')).length, 1)
})

test('the guest writer pauses while connected, and the state goes on', async () => {
  const t = setup({ room: guestRoom })
  await settle()
  t.links[0].options.onState({ state: 'connected' })
  t.links[0].options.onState({ state: 'reconnecting' })
  assert.deepEqual(t.writers[0].paused, [true, false])
  assert.deepEqual(t.events, ['open', 'state:connected', 'state:reconnecting'])
})

test('the host writer does not pause', async () => {
  const t = setup({ room: { ...guestRoom, host: 'u' } })
  await settle()
  t.links[0].options.onState({ state: 'connected' })
  assert.deepEqual(t.writers[0].paused, [])
})

test('a writer that stopped gives the warning', async () => {
  const t = setup({ room: guestRoom })
  await settle()
  t.writers[0].options.onStop('offline')
  assert.ok(t.events.includes('warn:This table is no longer saved on the server: offline'))
})

test('close before the document opens destroys it and gives no onOpen', async () => {
  const doc = new Y.Doc()
  let destroyed = 0
  doc.on('destroy', () => destroyed++)
  const t = setup({ over: { openTableDoc: async () => ({ doc, storageFailed: false }) } })
  t.session.close()
  await settle()
  assert.equal(destroyed, 1)
  assert.deepEqual(t.events, [])
})

test('an error in openTableDoc gives the error exit and a report', async () => {
  const t = setup({
    over: {
      openTableDoc: async () => {
        throw new Error('boom')
      },
    },
  })
  await settle()
  assert.deepEqual(t.events, ['report:promise:boom', 'exit:Could not open the table. Try again.'])
})

test('an error in the fill closes the document and gives the error exit', async () => {
  const doc = new Y.Doc()
  let destroyed = 0
  doc.on('destroy', () => destroyed++)
  const t = setup({
    room: { id: 'r1', multiplayer: false, mapId: 'no-such-map' },
    over: { openTableDoc: async () => ({ doc, storageFailed: false }) },
  })
  await settle()
  assert.deepEqual(t.events.slice(-1), ['exit:Could not open the table. Try again.'])
  assert.ok(t.events[0].startsWith('report:promise:'))
  assert.equal(destroyed, 1)
  assert.ok(!t.events.includes('open'))
})

test('a cancelled open ignores the error', async () => {
  const t = setup({
    over: {
      openTableDoc: async () => {
        throw new Error('boom')
      },
    },
  })
  t.session.close()
  await settle()
  assert.deepEqual(t.events, [])
})

test('close removes the page listeners', async () => {
  const t = setup({ room: guestRoom })
  await settle()
  assert.ok(t.listeners.includes('+pagehide'))
  t.session.close()
  assert.ok(t.listeners.includes('-pagehide'))
  assert.equal(t.links[0].stopped, 1)
})
