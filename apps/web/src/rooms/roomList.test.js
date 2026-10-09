import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAPS } from '../terrain/maps.js'
import { roomList } from './roomList.js'

const mapId = Object.keys(MAPS)[0]
const single = (id, updatedAt, map = mapId) => ({ id, mapId: map, rosters: {}, updatedAt })
const multi = (code, updatedAt, map = mapId) => ({
  code,
  mapId: map,
  rosters: {},
  updatedAt,
  players: { blue: null, red: null },
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
