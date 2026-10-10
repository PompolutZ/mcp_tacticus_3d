import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness'
import { linkedChannels } from './linkedChannels.js'
import { syncOverChannel } from './syncChannel.js'
import { createOwnership, lostKeys, otherOwnedKeys, resolveOwner } from './ownership.js'

const settle = () => new Promise((resolve) => setImmediate(resolve))

// Two players on linked channels. `open: false` keeps the channels closed until link() is called.
function players({ open = true } = {}) {
  const channels = linkedChannels({ open })
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  // The lower client id is A, so the tests know who wins a tie
  if (docA.clientID > docB.clientID) docA.clientID = docB.clientID - 1
  const awA = new Awareness(docA)
  const awB = new Awareness(docB)
  syncOverChannel(docA, channels.a, awA)
  syncOverChannel(docB, channels.b, awB)
  const host = createOwnership({ awareness: awA, role: 'host' })
  const guest = createOwnership({ awareness: awB, role: 'guest' })
  return {
    host,
    guest,
    awA,
    awB,
    link: channels.openBoth,
    end() {
      host.destroy()
      guest.destroy()
      awA.destroy()
      awB.destroy()
    },
  }
}

test('claim, owner, mine and release', async () => {
  const p = players()
  await settle()
  assert.equal(p.host.owner('token:1'), null)
  assert.equal(p.host.claim('token:1'), true)
  assert.equal(p.host.claim('token:1'), true)
  assert.deepEqual(p.host.mine(), ['token:1'])
  assert.equal(p.host.owner('token:1'), 'me')
  await settle()
  assert.equal(p.guest.owner('token:1'), 'other')
  p.host.release('token:1')
  await settle()
  assert.deepEqual(p.host.mine(), [])
  assert.equal(p.guest.owner('token:1'), null)
  p.end()
})

test('a refused claim changes nothing', async () => {
  const p = players()
  p.host.claim('pile:1')
  await settle()
  assert.equal(p.guest.claim('pile:1'), false)
  assert.deepEqual(p.guest.mine(), [])
  await settle()
  assert.equal(p.host.owner('pile:1'), 'me')
  p.end()
})

test('a tie: the lower client id keeps the piece, the other gets onLost', async () => {
  const p = players({ open: false })
  const hostLost = []
  const guestLost = []
  p.host.onLost((key) => hostLost.push(key))
  p.guest.onLost((key) => guestLost.push(key))
  assert.equal(p.host.claim('character:1'), true)
  assert.equal(p.guest.claim('character:1'), true)
  assert.equal(p.guest.claim('marker:red'), true)
  p.link()
  await settle()
  assert.ok(p.awA.clientID < p.awB.clientID)
  assert.deepEqual(hostLost, [])
  assert.deepEqual(guestLost, ['character:1'])
  assert.deepEqual(p.host.mine(), ['character:1'])
  assert.deepEqual(p.guest.mine(), ['marker:red'])
  assert.equal(p.host.owner('character:1'), 'me')
  assert.equal(p.guest.owner('character:1'), 'other')
  assert.deepEqual([...p.guest.otherOwned()], ['character:1'])
  p.end()
})

test('onLost returns an unsubscribe', async () => {
  const p = players({ open: false })
  const lost = []
  const off = p.guest.onLost((key) => lost.push(key))
  off()
  p.host.claim('token:1')
  p.guest.claim('token:1')
  p.link()
  await settle()
  assert.deepEqual(lost, [])
  p.end()
})

test('writes: host and guest, with and without the other player', async () => {
  const aloneAwareness = new Awareness(new Y.Doc())
  const alone = createOwnership({ awareness: aloneAwareness, role: 'guest' })
  assert.equal(alone.otherPresent(), false)
  assert.equal(alone.writes('character:1'), true)
  alone.destroy()
  aloneAwareness.destroy()

  const p = players({ open: false })
  assert.equal(p.guest.writes('character:1'), true)
  p.link()
  await settle()
  assert.equal(p.host.otherPresent(), true)
  assert.equal(p.host.writes('character:1'), true)
  assert.equal(p.guest.writes('character:1'), false)
  p.guest.claim('character:1')
  assert.equal(p.guest.writes('character:1'), true)
  await settle()
  assert.equal(p.host.writes('character:1'), false)
  p.end()
})

test('otherOwned is the same Set until its content changes; subscribe runs on change', async () => {
  const p = players()
  await settle()
  const first = p.guest.otherOwned()
  let calls = 0
  const off = p.guest.subscribe(() => calls++)
  p.guest.claim('token:9')
  await settle()
  assert.equal(p.guest.otherOwned(), first)
  assert.equal(calls, 0)
  p.host.claim('token:1')
  await settle()
  const second = p.guest.otherOwned()
  assert.notEqual(second, first)
  assert.deepEqual([...second], ['token:1'])
  assert.equal(calls, 1)
  p.host.claim('token:2')
  await settle()
  assert.equal(calls, 2)
  off()
  p.host.release('token:2')
  await settle()
  assert.equal(calls, 2)
  p.end()
})

test('subscribe runs when the other player comes and goes', async () => {
  const p = players({ open: false })
  let calls = 0
  p.guest.subscribe(() => calls++)
  p.link()
  await settle()
  assert.equal(calls, 1)
  assert.equal(p.guest.otherPresent(), true)
  assert.equal(p.guest.otherOwned().size, 0)
  p.awA.destroy()
  await settle()
  assert.equal(p.guest.otherPresent(), false)
  assert.equal(calls, 2)
  p.end()
})

test('the claims of a player who left are gone', async () => {
  const p = players()
  p.host.claim('token:1')
  await settle()
  assert.equal(p.guest.owner('token:1'), 'other')
  p.awA.destroy()
  await settle()
  assert.equal(p.guest.owner('token:1'), null)
  assert.equal(p.guest.claim('token:1'), true)
  p.end()
})

test('destroy removes the awareness listener', async () => {
  const p = players()
  await settle()
  let calls = 0
  p.guest.subscribe(() => calls++)
  p.guest.destroy()
  p.host.claim('token:1')
  await settle()
  assert.equal(calls, 0)
  p.end()
})

test('setDrag and otherDrag; subscribe runs on change', async () => {
  const p = players()
  await settle()
  assert.equal(p.guest.otherDrag(), null)
  let calls = 0
  const off = p.guest.subscribe(() => calls++)
  p.host.setDrag('character:a')
  await settle()
  assert.equal(p.guest.otherDrag(), 'character:a')
  assert.equal(p.host.otherDrag(), null)
  assert.equal(calls, 1)
  p.host.setDrag('character:a')
  await settle()
  assert.equal(calls, 1)
  p.host.setDrag(null)
  await settle()
  assert.equal(p.guest.otherDrag(), null)
  assert.equal(calls, 2)
  off()
  p.end()
})

test('the drag of a player who left is gone', async () => {
  const p = players()
  await settle()
  p.host.setDrag('character:a')
  await settle()
  assert.equal(p.guest.otherDrag(), 'character:a')
  removeAwarenessStates(p.awB, [p.awA.clientID], 'test')
  await settle()
  assert.equal(p.guest.otherDrag(), null)
  p.end()
})

test('setSpawn and otherSpawn; subscribe runs on change', async () => {
  const p = players()
  await settle()
  assert.equal(p.guest.otherSpawn(), null)
  let calls = 0
  const off = p.guest.subscribe(() => calls++)
  p.host.setSpawn({ key: 'loose:n1', tokenKey: 'x' })
  await settle()
  const first = p.guest.otherSpawn()
  assert.deepEqual(first, { key: 'loose:n1', tokenKey: 'x' })
  assert.equal(p.host.otherSpawn(), null)
  assert.equal(calls, 1)
  p.host.setSpawn({ key: 'loose:n1', tokenKey: 'x' })
  await settle()
  assert.equal(calls, 1)
  assert.equal(p.guest.otherSpawn(), first)
  p.host.setSpawn(null)
  await settle()
  assert.equal(p.guest.otherSpawn(), null)
  assert.equal(calls, 2)
  off()
  p.end()
})

test('the spawn of a player who left is gone', async () => {
  const p = players()
  await settle()
  p.host.setSpawn({ key: 'pile:n2', tokenKey: 'y' })
  await settle()
  assert.equal(p.guest.otherSpawn().key, 'pile:n2')
  removeAwarenessStates(p.awB, [p.awA.clientID], 'test')
  await settle()
  assert.equal(p.guest.otherSpawn(), null)
  p.end()
})

test('the local version', () => {
  const own = createOwnership({})
  assert.equal(own.owner('token:1'), null)
  assert.equal(own.claim('token:1'), true)
  assert.equal(own.owner('token:1'), 'me')
  assert.deepEqual(own.mine(), ['token:1'])
  assert.equal(own.writes('token:1'), true)
  assert.equal(own.writes('token:2'), true)
  assert.equal(own.otherPresent(), false)
  assert.equal(own.otherOwned(), own.otherOwned())
  assert.equal(own.otherOwned().size, 0)
  own.setSpawn({ key: 'loose:n', tokenKey: 'x' })
  assert.equal(own.otherSpawn(), null)
  own.onLost(() => assert.fail())()
  own.subscribe(() => assert.fail())()
  own.release('token:1')
  assert.deepEqual(own.mine(), [])
  own.setDrag('character:a')
  assert.equal(own.otherDrag(), null)
  own.destroy()
})

test('the pure rules', () => {
  const others = new Map([[5, ['a', 'b']]])
  assert.equal(resolveOwner('a', 3, ['a'], others), 'me')
  assert.equal(resolveOwner('a', 7, ['a'], others), 'other')
  assert.equal(resolveOwner('b', 7, [], others), 'other')
  assert.equal(resolveOwner('c', 7, [], others), null)
  assert.deepEqual(lostKeys(7, ['a', 'c'], others), ['a'])
  assert.deepEqual(lostKeys(3, ['a'], others), [])
  assert.deepEqual([...otherOwnedKeys(3, ['a'], others)], ['b'])
  assert.deepEqual([...otherOwnedKeys(7, ['a'], others)].sort(), ['a', 'b'])
})
