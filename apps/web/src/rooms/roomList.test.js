import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAPS } from '../terrain/maps/index.js'
import { roomList, rosterLinks } from './roomList.js'

const mapId = Object.keys(MAPS)[0]
const single = (id, updatedAt, map = mapId) => ({ id, mapId: map, rosters: {}, updatedAt })
const multi = (code, updatedAt, map = mapId) => ({
  code,
  mapId: map,
  rosters: {},
  updatedAt,
  players: { host: null, guest: null },
})

test('both kinds in one list, the last changed first', () => {
  const list = roomList(
    [
      single('S1', Date.parse('2026-01-02T00:00:00Z')),
      single('S2', Date.parse('2026-01-04T00:00:00Z')),
    ],
    [multi('M1', '2026-01-03T00:00:00.000Z'), multi('M2', '2026-01-01T00:00:00.000Z')],
  )
  assert.deepEqual(
    list.map((item) => [item.kind, item.id]),
    [
      ['single', 'S2'],
      ['multiplayer', 'M1'],
      ['single', 'S1'],
      ['multiplayer', 'M2'],
    ],
  )
})

test('a room of an unknown map is left out', () => {
  const list = roomList(
    [single('S1', 1, 'nope')],
    [multi('M1', '2026-01-01T00:00:00.000Z', 'nope')],
  )
  assert.deepEqual(list, [])
})

test('a multiplayer room with mapId null stays, a single room without a map does not', () => {
  const list = roomList([single('S1', 1, null)], [multi('M1', '2026-01-01T00:00:00.000Z', null)])
  assert.deepEqual(
    list.map((item) => item.id),
    ['M1'],
  )
})

test('rosterLinks: multiplayer shows names without colors', () => {
  const room = { players: { host: { name: 'James' }, guest: null } }
  const item = { kind: 'multiplayer', rosters: { host: { code: 'a' }, guest: null }, room }
  assert.deepEqual(rosterLinks(item), [{ team: 'host', color: null, label: 'James roster' }])
})

test('rosterLinks: single player shows the colors of the record, or numbers', () => {
  const rosters = { host: { code: 'a' }, guest: { code: 'b' } }
  const colors = { host: 'red', guest: 'blue' }
  assert.deepEqual(rosterLinks({ kind: 'single', rosters, colors }), [
    { team: 'host', color: 'red', label: 'Red roster' },
    { team: 'guest', color: 'blue', label: 'Blue roster' },
  ])
  assert.deepEqual(
    rosterLinks({ kind: 'single', rosters, colors: undefined }).map((l) => l.label),
    ['Roster 1', 'Roster 2'],
  )
})
