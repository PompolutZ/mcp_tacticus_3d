import { test } from 'node:test'
import assert from 'node:assert/strict'
import { multiplayerRoom, roomPage, seatOf } from './roomPage.js'

const alice = { id: 'a', name: 'Alice' }
const bob = { id: 'b', name: 'Bob' }
const loading = { status: 'loading', user: null }
const out = { status: 'out', user: null }
const as = (user) => ({ status: 'in', user })
const room = (blue, red) => ({
  code: 'K7Q2-M9XD',
  host: 'a',
  mapId: 'vibranium-heist',
  rosters: { blue: null, red: null },
  players: { blue, red },
})
const base = { code: 'K7Q2-M9XD', singleRoom: null, authOn: true, session: out, room: undefined }

test('a single player room of this browser opens first, even with login on and loading', () => {
  const single = { id: 'K7Q2-M9XD' }
  assert.deepEqual(roomPage({ ...base, singleRoom: single, session: loading }), { page: 'single' })
  assert.deepEqual(roomPage({ ...base, singleRoom: single, authOn: false }), { page: 'single' })
})

test('login off: the lobby, no fetch', () => {
  const page = roomPage({ ...base, authOn: false, session: { status: 'off', user: null } })
  assert.deepEqual(page, { page: 'lobby', notice: 'Room K7Q2-M9XD is not in this browser.' })
})

test('a loading session waits', () => {
  assert.deepEqual(roomPage({ ...base, session: loading }), { page: 'wait' })
})

test('the room is fetched once the session is known', () => {
  assert.deepEqual(roomPage(base), { page: 'fetch' })
  assert.deepEqual(roomPage({ ...base, session: as(alice) }), { page: 'fetch' })
})

test('404 and no answer open the lobby', () => {
  assert.deepEqual(roomPage({ ...base, room: { notFound: true } }), {
    page: 'lobby',
    notice: 'Room K7Q2-M9XD not found.',
  })
  assert.deepEqual(roomPage({ ...base, room: { failed: true } }), {
    page: 'lobby',
    notice: 'Could not load room K7Q2-M9XD: the server does not answer.',
  })
})

test('a user with a seat opens the multiplayer room, on either side', () => {
  const session = as(alice)
  assert.deepEqual(roomPage({ ...base, session, room: room(alice, null) }), {
    page: 'multiplayer',
  })
  assert.deepEqual(roomPage({ ...base, session, room: room(bob, alice) }), {
    page: 'multiplayer',
  })
})

test('a free seat opens the join page, with or without a login', () => {
  assert.deepEqual(roomPage({ ...base, session: as(bob), room: room(alice, null) }), {
    page: 'join',
    loggedIn: true,
  })
  assert.deepEqual(roomPage({ ...base, room: room(null, alice) }), {
    page: 'join',
    loggedIn: false,
  })
  assert.deepEqual(
    roomPage({ ...base, session: { status: 'error', user: null }, room: room(alice, null) }),
    {
      page: 'join',
      loggedIn: false,
    },
  )
})

test('no free seat opens the lobby, also when logged out', () => {
  const notice = 'This room has two players already.'
  const full = room(alice, { id: 'c' })
  assert.deepEqual(roomPage({ ...base, session: as(bob), room: full }), { page: 'lobby', notice })
  assert.deepEqual(roomPage({ ...base, room: full }), { page: 'lobby', notice })
})

test('the page is found again when the user changes', () => {
  const found = room(alice, null)
  assert.equal(roomPage({ ...base, room: found }).page, 'join')
  assert.equal(roomPage({ ...base, session: as(alice), room: found }).page, 'multiplayer')
})

test('seatOf and multiplayerRoom', () => {
  const found = room(alice, bob)
  assert.equal(seatOf(found, 'b'), 'red')
  assert.equal(seatOf(found, 'x'), null)
  assert.equal(seatOf(found, undefined), null)
  assert.deepEqual(multiplayerRoom(found, 'a'), {
    id: 'K7Q2-M9XD',
    multiplayer: true,
    side: 'blue',
    host: 'a',
    mapId: 'vibranium-heist',
    rosters: { blue: null, red: null },
    players: found.players,
  })
})
