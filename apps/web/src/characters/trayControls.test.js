import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BUTTON_ZONE,
  applyCounter,
  counterStep,
  counterZone,
  removeState,
  trayCounters,
} from './trayControls.js'

test('left click on the body or + adds 1, right click on the body or left click on - takes 1', () => {
  assert.equal(counterStep('body', 0), 1)
  assert.equal(counterStep('body', 2), -1)
  assert.equal(counterStep('inc', 0), 1)
  assert.equal(counterStep('dec', 0), -1)
})

test('a right or middle click on a button does nothing', () => {
  assert.equal(counterStep('inc', 2), 0)
  assert.equal(counterStep('dec', 2), 0)
  assert.equal(counterStep('body', 1), 0)
})

test('counterZone gives the buttons at the ends and the body between', () => {
  const w = 2.3
  assert.equal(counterZone(-w / 2 + 0.05, w), 'dec')
  assert.equal(counterZone(w / 2 - 0.05, w), 'inc')
  assert.equal(counterZone(0, w), 'body')
  assert.equal(counterZone(-w / 2 + BUTTON_ZONE + 0.01, w), 'body')
})

test('applyCounter sends the new value of the right counter', () => {
  const calls = []
  const on = {
    onDamage: (v) => calls.push(['damage', v]),
    onPower: (v) => calls.push(['power', v]),
  }
  const ch = { damage: 3, power: 5 }
  applyCounter(ch, 'damage', 1, on)
  applyCounter(ch, 'power', -1, on)
  applyCounter(ch, 'power', 0, on)
  assert.deepEqual(calls, [
    ['damage', 4],
    ['power', 4],
  ])
})

test('a grunt has a Damage counter only', () => {
  assert.deepEqual(
    trayCounters({ host: 'h1', damage: 1, power: 0 }, 4).map((c) => c.kind),
    ['damage'],
  )
  assert.deepEqual(
    trayCounters({ damage: 1, power: 0 }, 4).map((c) => c.kind),
    ['damage', 'power'],
  )
})

test('Damage warns at Stamina, Power never', () => {
  const [damage, power] = trayCounters({ damage: 4, power: 10 }, 4)
  assert.equal(damage.warn, true)
  assert.equal(power.warn, false)
  assert.equal(trayCounters({ damage: 3, power: 0 }, 4)[0].warn, false)
})

test('Remove is off off the board and while a token waits, with the wait text as the title', () => {
  assert.equal(removeState({ onBoard: true }).disabled, false)
  assert.equal(removeState({ onBoard: false }).disabled, true)
  const wait = removeState({ onBoard: true, removeWait: 'Waiting for Nelly' })
  assert.equal(wait.disabled, true)
  assert.equal(wait.title, 'Waiting for Nelly')
})
