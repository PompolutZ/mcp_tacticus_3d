import test from 'node:test'
import assert from 'node:assert/strict'
import { API_HOST_SEAT, hostSeat, withSides } from './seats.js'

const nelly = { id: 'u1', name: 'Nelly' }
const zed = { id: 'u2', name: 'Zed' }

test('the seat of the host is host, whatever the API seat', () => {
  const room = {
    host: 'u2',
    players: { blue: nelly, red: zed },
    rosters: { blue: { code: 'a' }, red: { code: 'b' } },
  }
  assert.equal(hostSeat(room), 'red')
  const mapped = withSides(room)
  assert.deepEqual(mapped.players, { host: zed, guest: nelly })
  assert.deepEqual(mapped.rosters, { host: { code: 'b' }, guest: { code: 'a' } })
})

test('a room with only the host: the guest seat is free', () => {
  const room = {
    host: 'u1',
    players: { blue: nelly, red: null },
    rosters: { blue: { code: 'a' }, red: null },
  }
  assert.equal(hostSeat(room), 'blue')
  assert.equal(API_HOST_SEAT, 'blue')
  const mapped = withSides(room)
  assert.deepEqual(mapped.players, { host: nelly, guest: null })
  assert.equal(mapped.rosters.guest, null)
})

test('a deleted host keeps the seat by id', () => {
  const room = {
    host: 'u1',
    players: { blue: zed, red: { id: 'u1', gone: true } },
    rosters: { blue: null, red: null },
  }
  assert.equal(hostSeat(room), 'red')
})
