import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRunRecord } from './runRecord.js'
import { FACES } from './faces.js'

const clicks = { sent: 3, acted: 2, blocked: 1 }

test('buildRunRecord copies counts and times, one entry per die', () => {
  const rec = buildRunRecord({
    clicks,
    throwTime: 3.4,
    dice: [
      {
        face: 1,
        dot: 0.99,
        tilted: false,
        timedOut: false,
        outOfWell: false,
        lost: 0,
        restTime: 2.9,
      },
      { face: 8, dot: 0.7, tilted: true, timedOut: true, outOfWell: true, lost: 2, restTime: 3.4 },
    ],
  })
  assert.equal(rec.diceCount, 2)
  assert.equal(rec.clicksSent, 3)
  assert.equal(rec.clicksActed, 2)
  assert.equal(rec.clicksBlocked, 1)
  assert.equal(rec.throwTime, 3.4)
  assert.deepEqual(rec.dice[1], {
    face: 8,
    symbol: FACES[7].symbol,
    dot: 0.7,
    tilted: true,
    timedOut: true,
    outOfWell: true,
    lost: 2,
    restTime: 3.4,
  })
})

test('buildRunRecord gives the symbol of every face and defaults the flags', () => {
  const dice = FACES.map((_, i) => ({ face: i + 1, dot: 1, restTime: 1 }))
  const rec = buildRunRecord({ clicks, throwTime: 1, dice })
  assert.equal(rec.diceCount, 8)
  rec.dice.forEach((d, i) => {
    assert.equal(d.symbol, FACES[i].symbol)
    assert.equal(d.tilted, false)
    assert.equal(d.timedOut, false)
    assert.equal(d.outOfWell, false)
    assert.equal(d.lost, 0)
  })
})

test('buildRunRecord of no dice has diceCount 0', () => {
  assert.deepEqual(buildRunRecord({ clicks, throwTime: 0, dice: [] }).dice, [])
})
