import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LOG_LIMIT,
  MERGE_MS,
  addEntry,
  addStatEntry,
  canUndo,
  entrySide,
  logEntry,
  logText,
  mergeLog,
  soundOf,
} from './log.js'

const COLORS = { host: 'Blue', guest: 'Red' }
const SOLO = { mySide: null, players: null, peer: null, colors: COLORS }
const ROOM = {
  mySide: 'host',
  players: { host: { name: 'Oleh' }, guest: { name: 'Nelly' } },
  peer: null,
  colors: COLORS,
}

test('an entry has id, time, writer and data', () => {
  const entry = logEntry('threat', 'host', { side: 'guest', threat: 18 })
  assert.equal(entry.kind, 'threat')
  assert.equal(entry.by, 'host')
  assert.equal(entry.threat, 18)
  assert.equal(typeof entry.id, 'string')
  assert.equal(logEntry('restart', undefined).by, null)
})

test('an entry with an id that is there is not added again', () => {
  const first = logEntry('rollOff', 'host', { side: 'host' }, 'rolloff:a:b', 1)
  const second = logEntry('rollOff', 'guest', { side: 'host' }, 'rolloff:a:b', 2)
  const list = addEntry(addEntry([], first), second)
  assert.deepEqual(list, [first])
})

test('the list keeps the newest entries', () => {
  let list = []
  for (let i = 0; i < LOG_LIMIT + 5; i++)
    list = addEntry(list, logEntry('restart', null, {}, `e${i}`, i))
  assert.equal(list.length, LOG_LIMIT)
  assert.equal(list[0].id, 'e5')
  assert.equal(list.at(-1).id, `e${LOG_LIMIT + 4}`)
})

test('both lists merge, newest first, and the log wins a tie', () => {
  const rolls = [
    { id: 'r1', at: 10, side: 'host', kind: 'throw' },
    { id: 'r2', at: 30, side: 'guest', kind: 'throw' },
  ]
  const log = [
    logEntry('rollOff', null, { side: 'host' }, 'l1', 30),
    logEntry('restart', null, {}, 'l2', 20),
  ]
  assert.deepEqual(
    mergeLog(rolls, log).map(({ type, entry }) => `${type}:${entry.id}`),
    ['log:l1', 'dice:r2', 'log:l2', 'dice:r1'],
  )
  assert.deepEqual(mergeLog([], []), [])
})

test('the color side is the side of the entry, else the writer', () => {
  assert.equal(entrySide({ side: 'guest', by: 'host' }), 'guest')
  assert.equal(entrySide({ by: 'host' }), 'host')
  assert.equal(entrySide({ by: null }), null)
})

test('the text uses the names of the viewer', () => {
  const entry = logEntry('deck', 'guest', { side: 'guest', type: 'secure' })
  assert.equal(logText(entry, ROOM), 'Nelly plays on their Secure crises.')
  assert.equal(logText(entry, { ...ROOM, mySide: 'guest' }), 'You play on your Secure crises.')
  assert.equal(logText(entry, SOLO), 'Red plays on their Secure crises.')
})

test('roll off, with a tie and by hand', () => {
  assert.equal(
    logText(logEntry('rollOff', null, { side: 'host' }), ROOM),
    'Roll off: You have Priority.',
  )
  assert.equal(logText(logEntry('rollOff', null, { side: null }), ROOM), 'Roll off: a tie.')
  assert.equal(
    logText(logEntry('rollOff', null, { side: 'guest', manual: true }), ROOM),
    'Roll off: Nelly has Priority (set by hand).',
  )
})

test('setup entries', () => {
  const t = (kind, data, ctx = ROOM) => logText(logEntry(kind, null, data), ctx)
  assert.equal(
    t('pick', { side: 'host', type: 'extract', card: 'Hostage' }),
    'You choose Hostage (Extract).',
  )
  assert.equal(t('threat', { side: 'guest', threat: 18 }), 'Nelly chooses Maximum Threat 18.')
  assert.equal(t('edge', { side: 'host' }), 'You choose this board edge.')
  assert.equal(t('ready', { side: 'guest', ready: true }), 'Nelly is ready.')
  assert.equal(t('ready', { side: 'guest', ready: false }), 'Nelly is not ready.')
  assert.equal(t('revealed', { side: 'host' }), 'Your squad is on the table.')
  assert.equal(t('revealed', { side: 'guest' }), "Nelly's squad is on the table.")
  assert.equal(
    t('affiliation', { side: 'guest', affiliation: 'Avengers' }),
    'Nelly chooses the affiliation Avengers.',
  )
  assert.equal(t('deployed', {}), 'Deployment done.')
})

test('override and restart name the writer when there is one', () => {
  const t = (kind, by, data) => logText(logEntry(kind, by, data), ROOM)
  assert.equal(t('override', 'guest', { step: 'threat' }), 'Nelly went back to the Maximum Threat.')
  assert.equal(t('override', null, { step: 'rollOff' }), 'Went back to the roll off.')
  assert.equal(t('restart', 'host', {}), 'You started the setup again.')
  assert.equal(t('restart', null, {}), 'Started the setup again.')
})

test('power phase and priority', () => {
  const gains = [
    { name: 'Hulk', from: 4, to: 7 },
    { name: 'Angela', from: 2, to: 4 },
  ]
  assert.equal(
    logText(logEntry('power', null, { side: 'guest', gains }), ROOM),
    'Power Phase (Nelly): Hulk 4 → 7, Angela 2 → 4',
  )
  assert.equal(
    logText(logEntry('priority', 'host', { side: 'guest' }), ROOM),
    'Priority goes to Nelly.',
  )
  assert.equal(
    logText(logEntry('priority', 'guest', { side: 'host' }), ROOM),
    'Priority goes to you.',
  )
})

test('cleanup lists the round, the flipped characters and Priority', () => {
  const data = { round: 3, flipped: ['Hulk'], before: 'host', after: 'guest' }
  assert.equal(
    logText(logEntry('cleanup', null, data), ROOM),
    'Cleanup Phase: round 3. Flipped: Hulk. Priority passes to Nelly.',
  )
  assert.equal(
    logText(
      logEntry('cleanup', null, { round: null, flipped: [], before: null, after: null }),
      ROOM,
    ),
    'Cleanup Phase: the round marker did not move.',
  )
})

const stat = (by, from, to, at, extra = {}) =>
  logEntry(
    'stat',
    by,
    { characterId: 'c1', name: 'Hulk', stat: 'damage', from, to, ...extra },
    undefined,
    at,
  )

test('clicks on one stat within 10 s are one entry', () => {
  let list = addStatEntry([], stat('host', 2, 3, 1000))
  list = addStatEntry(list, stat('host', 3, 4, 2000))
  list = addStatEntry(list, stat('host', 4, 5, 3000))
  assert.equal(list.length, 1)
  assert.equal(list[0].from, 2)
  assert.equal(list[0].to, 5)
  assert.equal(logText(list[0], SOLO), 'Hulk Damage 2 → 5')
})

test('a click after the merge time is a new entry', () => {
  let list = addStatEntry([], stat('host', 2, 3, 1000))
  list = addStatEntry(list, stat('host', 3, 4, 1000 + MERGE_MS + 1))
  assert.equal(list.length, 2)
})

test('another player, character, stat or entry in between is a new entry', () => {
  const first = stat('host', 2, 3, 1000)
  assert.equal(addStatEntry([first], stat('guest', 3, 4, 2000)).length, 2)
  assert.equal(addStatEntry([first], stat('host', 3, 4, 2000, { characterId: 'c2' })).length, 2)
  assert.equal(addStatEntry([first], stat('host', 3, 4, 2000, { stat: 'power' })).length, 2)
  const between = logEntry('priority', 'host', { side: 'host' }, undefined, 1500)
  assert.equal(addStatEntry([first, between], stat('host', 3, 4, 2000)).length, 3)
})

test('back to the start value removes the entry', () => {
  let list = addStatEntry([], stat('host', 2, 3, 1000))
  list = addStatEntry(list, stat('host', 3, 4, 2000))
  list = addStatEntry(list, stat('host', 4, 3, 3000))
  list = addStatEntry(list, stat('host', 3, 2, 4000))
  assert.deepEqual(list, [])
})

test('a change that does nothing adds no entry', () => {
  assert.deepEqual(addStatEntry([], stat('host', 5, 5, 1000)), [])
})

test('the text of character entries', () => {
  const on = (key, tokenName, count) =>
    logText(logEntry('token', 'host', { name: 'Hulk', key, tokenName, on: true, count }), SOLO)
  assert.equal(on('activated', 'Activated', 1), 'Activated put on Hulk.')
  assert.equal(on('poison', 'Poison', 2), 'Poison put on Hulk (2).')
  const off = logEntry('token', 'host', { name: 'Hulk', tokenName: 'Dazed', on: false, count: 0 })
  assert.equal(logText(off, SOLO), 'Dazed taken off Hulk.')
  const held = logEntry('held', 'host', { name: 'Hulk', tokenName: 'Asset', on: true })
  assert.equal(logText(held, SOLO), 'Hulk holds Asset.')
  assert.equal(logText({ ...held, on: false }, SOLO), 'Hulk drops Asset from the card.')
  assert.equal(
    logText(logEntry('flip', 'host', { name: 'Hulk', to: 'injured' }), SOLO),
    'Hulk turns to the injured side.',
  )
  const dropped = logEntry('dropped', 'host', {
    name: 'Hulk',
    tokenName: 'Asset',
    placeBy: 'guest',
  })
  assert.equal(logText(dropped, SOLO), 'Hulk dropped Asset. Red places it.')
  assert.equal(logText(dropped, ROOM), 'Hulk dropped Asset. Nelly places it.')
  assert.equal(logText({ ...dropped, placeBy: 'host' }, ROOM), 'Hulk dropped Asset. You place it.')
  const placed = logEntry('placed', 'guest', { name: 'Hulk', tokenName: 'Asset', placeBy: 'guest' })
  assert.equal(logText(placed, ROOM), "Nelly placed Hulk's Asset.")
  assert.equal(logText({ ...placed, placeBy: 'host' }, ROOM), "You placed Hulk's Asset.")
  assert.equal(soundOf(dropped), null)
  assert.equal(
    logText(logEntry('offBoard', 'host', { name: 'Hulk' }), SOLO),
    'Hulk is removed from the board.',
  )
  assert.equal(
    logText(logEntry('deleted', 'host', { name: 'Hulk' }), SOLO),
    'Hulk is deleted from the table.',
  )
})

test('sounds: a token put on, Activated, a held token; nothing else', () => {
  const token = (key, on) => logEntry('token', 'host', { key, on })
  assert.equal(soundOf(token('dazed', true)), 'token')
  assert.equal(soundOf(token('activated', true)), 'activated')
  assert.equal(soundOf(token('activated', false)), null)
  assert.equal(soundOf(logEntry('held', 'host', { on: true })), 'token')
  assert.equal(soundOf(logEntry('held', 'host', { on: false })), null)
  assert.equal(soundOf(logEntry('stat', 'host', { from: 1, to: 2 })), null)
})

test('Undo shows only while the piece is off the table, on the same map', () => {
  const entry = logEntry('terrainDeleted', 'host', {
    piece: { id: 'm:3', index: 3, locked: false },
    pieceKey: 'crystals',
    boardKey: 'm',
    mapId: 'm',
    terrain: [],
    models: [],
  })
  assert.equal(canUndo(entry, [{ id: 'm:1' }], 'm', 'm'), true)
  assert.equal(canUndo(entry, [{ id: 'm:1' }, { id: 'm:3' }], 'm', 'm'), false)
  assert.equal(canUndo(entry, [], 'other', 'other'), false)
  assert.equal(canUndo(logEntry('deleted', 'host'), [], 'm', 'm'), false)
  // An entry from before the board record compares the mapId
  const old = { ...entry, boardKey: undefined }
  assert.equal(canUndo(old, [], null, 'm'), true)
  assert.equal(canUndo(old, [], 'm', 'other'), false)
})

test('terrain delete and undo text', () => {
  const data = { piece: { id: 'm:3' }, pieceKey: 'crystals' }
  const deleted = logEntry('terrainDeleted', 'guest', data)
  assert.equal(logText(deleted, ROOM), 'Nelly deleted Crystals.')
  assert.equal(logText(logEntry('terrainRestored', 'host', data), ROOM), 'You put back Crystals.')
  assert.equal(logText(logEntry('terrainDeleted', null, data), SOLO), 'Deleted Crystals.')
})
