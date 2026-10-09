import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ICE_SERVERS, iceConfig } from './ice.js'

const hasTurn = (config) =>
  config.iceServers.some((s) => [s.urls].flat().some((u) => u.startsWith('turn:')))

test('production has only STUN and no policy', () => {
  const config = iceConfig({ dev: false, relay: false })
  assert.deepEqual(config.iceServers, ICE_SERVERS)
  assert.equal(hasTurn(config), false)
  assert.equal('iceTransportPolicy' in config, false)
})

test('production ignores relay', () => {
  const config = iceConfig({ dev: false, relay: true })
  assert.equal(hasTurn(config), false)
  assert.equal('iceTransportPolicy' in config, false)
})

test('dev adds the local TURN server', () => {
  const config = iceConfig({ dev: true, relay: false })
  assert.equal(hasTurn(config), true)
  assert.equal(config.iceServers.length, ICE_SERVERS.length + 1)
  assert.equal('iceTransportPolicy' in config, false)
})

test('dev with relay uses the relay policy', () => {
  assert.equal(iceConfig({ dev: true, relay: true }).iceTransportPolicy, 'relay')
})
