import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatBytes, sumTraffic, trafficLine, trafficOf } from './traffic.js'

const candidates = (local = 'host', remote = 'host') => [
  ['l1', { type: 'local-candidate', candidateType: local }],
  ['r1', { type: 'remote-candidate', candidateType: remote }],
]
const pair = (extra = {}) => ({
  type: 'candidate-pair',
  localCandidateId: 'l1',
  remoteCandidateId: 'r1',
  bytesSent: 100,
  bytesReceived: 200,
  ...extra,
})

test('Chrome and Safari: the transport names the selected pair', () => {
  const report = new Map([
    ['t1', { type: 'transport', selectedCandidatePairId: 'p2' }],
    ['p1', pair({ bytesSent: 1, bytesReceived: 2 })],
    ['p2', pair()],
    ...candidates(),
  ])
  assert.deepEqual(trafficOf(report), { sent: 100, received: 200, relayed: false })
})

test('Firefox: the pair has selected: true', () => {
  const report = new Map([
    ['p1', pair({ bytesSent: 1, bytesReceived: 2, selected: false })],
    ['p2', pair({ selected: true })],
    ...candidates(),
  ])
  assert.deepEqual(trafficOf(report), { sent: 100, received: 200, relayed: false })
})

test('a relay candidate on either end makes the pair relayed', () => {
  const make = (local, remote) =>
    new Map([
      ['t1', { type: 'transport', selectedCandidatePairId: 'p1' }],
      ['p1', pair()],
      ...candidates(local, remote),
    ])
  assert.equal(trafficOf(make('relay', 'host')).relayed, true)
  assert.equal(trafficOf(make('srflx', 'relay')).relayed, true)
  assert.equal(trafficOf(make('srflx', 'prflx')).relayed, false)
})

test('no selected pair gives null', () => {
  assert.equal(trafficOf(new Map()), null)
  assert.equal(trafficOf(new Map([['p1', pair({ selected: false })], ...candidates()])), null)
  assert.equal(
    trafficOf(
      new Map([
        ['t1', { type: 'transport' }],
        ['p1', pair()],
      ]),
    ),
    null,
  )
})

test('formatBytes: KB or MB with one decimal', () => {
  assert.equal(formatBytes(0), '0.0 KB')
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(1024 * 1024), '1.0 MB')
  assert.equal(formatBytes(3.4 * 1024 * 1024), '3.4 MB')
})

test('sumTraffic adds connections', () => {
  const list = [
    { sent: 1, received: 2, ms: 60_000 },
    { sent: 10, received: 20, ms: 120_000 },
  ]
  assert.deepEqual(sumTraffic(list), { sent: 11, received: 22, ms: 180_000 })
  assert.deepEqual(sumTraffic([]), { sent: 0, received: 0, ms: 0 })
})

test('trafficLine: connection and table', () => {
  const MB = 1024 * 1024
  const connection = { sent: 1.2 * MB, received: 3.4 * MB, ms: 12 * 60_000, relayed: false }
  const table = { sent: 2 * MB, received: 5.1 * MB, ms: 30 * 60_000 }
  assert.equal(
    trafficLine(connection, table),
    'traffic: connection 1.2 MB sent, 3.4 MB received, 12 min, direct; table 2.0 MB sent, 5.1 MB received, 30 min',
  )
  assert.match(trafficLine({ ...connection, relayed: true }, table), /12 min, relayed;/)
})
