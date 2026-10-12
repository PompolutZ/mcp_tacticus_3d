import test from 'node:test'
import assert from 'node:assert/strict'
import { LOG_LIMIT, addEntry, entrySide, logEntry, logText, mergeLog } from './log.js'

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
  assert.equal(logText(entry, ROOM), 'Nelly chooses the Secure deck.')
  assert.equal(logText(entry, { ...ROOM, mySide: 'guest' }), 'You choose the Secure deck.')
  assert.equal(logText(entry, SOLO), 'Red chooses the Secure deck.')
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
