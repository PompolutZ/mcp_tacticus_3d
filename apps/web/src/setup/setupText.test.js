import assert from 'node:assert/strict'
import { test } from 'node:test'
import { STEP_NAME, chooses, decides, rollOffText, stepChoice } from './setupText.js'

const colors = { host: 'Blue', guest: 'Red' }
const room = {
  mySide: 'host',
  players: { host: { name: 'Me' }, guest: { name: 'Nelly' } },
  peer: null,
  colors,
}
const sandbox = { mySide: null, players: null, peer: null, colors }

const CARDS = {
  s1: { name: 'Secure One', threat: 18 },
  e1: { name: 'Extract One', threat: 20 },
}
const cardOf = (code) => CARDS[code]
// The host has Priority and plays on the guest's Secure crises: the guest picks a Secure card first, the host an
// Extract card second.
const setup = {
  priority: 'host',
  deck: { type: 'secure' },
  picks: { secure: 's1', extract: 'e1' },
  threat: 20,
  affiliation: { host: 'avengers' },
}

test('STEP_NAME names every step', () => {
  assert.equal(STEP_NAME.rollOff, 'Roll off')
  assert.equal(STEP_NAME.deploy, 'Deployment')
  assert.equal(Object.keys(STEP_NAME).length, 9)
})

test('stepChoice: each step, with mySide', () => {
  const t = (step) => stepChoice(setup, step, room, cardOf)
  assert.equal(t('rollOff'), 'You have Priority')
  assert.equal(t('deck'), 'You play on your Secure crises.')
  assert.equal(t('first'), 'Nelly chose Secure One')
  assert.equal(t('second'), 'You chose Extract One')
  assert.equal(t('threat'), 'Nelly chose Extract · 20')
  assert.equal(t('edge'), 'You chose the board edge')
  assert.equal(t('squads'), 'Both squads are Ready')
  assert.match(t('affiliation'), /^You: .* · Nelly: /)
  assert.equal(t('deploy'), 'Both squads deployed')
})

test('stepChoice: each step, without mySide', () => {
  const t = (step) => stepChoice(setup, step, sandbox, cardOf)
  assert.equal(t('rollOff'), 'Blue has Priority')
  assert.equal(t('deck'), 'Blue plays on their Secure crises.')
  assert.equal(t('first'), 'Red chose Secure One')
  assert.equal(t('second'), 'Blue chose Extract One')
  assert.equal(t('threat'), 'Red chose Extract · 20')
  assert.equal(t('edge'), 'Blue chose the board edge')
  assert.match(t('affiliation'), /^Blue: .* · Red: /)
})

test('stepChoice: unknown card code falls back to the code, threat without a type', () => {
  const other = { ...setup, picks: { secure: 'zz', extract: 'yy' }, threat: 5 }
  assert.equal(stepChoice(other, 'second', sandbox, cardOf), 'Blue chose yy')
  assert.equal(stepChoice(other, 'threat', sandbox, cardOf), 'Red chose 5')
})

test('chooses: own side, other side, imperative', () => {
  assert.equal(chooses('host', 'the board edge', room), 'You choose the board edge.')
  assert.equal(
    chooses('guest', 'the board edge', room),
    'Waiting for Nelly to choose the board edge.',
  )
  assert.equal(chooses('host', "from Nelly's Secures", room, true), "Choose from Nelly's Secures.")
  assert.equal(chooses('guest', 'a deck', sandbox), 'Red chooses a deck.')
  assert.equal(chooses('guest', 'a deck', sandbox, true), 'Red chooses a deck.')
})

test('decides: own side, other side, no mySide', () => {
  assert.equal(
    decides('host', room),
    'Decide if you want to play on your Secure or Extract crises.',
  )
  assert.equal(
    decides('guest', room),
    'Waiting for Nelly to decide if they want to play on their Secure or Extract crises.',
  )
  assert.equal(
    decides('host', sandbox),
    'Blue decides if they want to play on their Secure or Extract crises.',
  )
})

test('rollOffText: tie, successes, Crits, Wilds', () => {
  const counts = (h, g) => ({ host: h, guest: g })
  assert.equal(rollOffText({ winner: null, counts: {} }, room), 'Tie: roll again.')
  assert.equal(
    rollOffText({ winner: 'guest', counts: counts({ successes: 3 }, { successes: 4 }) }, room),
    'Nelly wins the roll off: 4 successes against 3.',
  )
  assert.equal(
    rollOffText(
      {
        winner: 'host',
        counts: counts({ successes: 3, crits: 2 }, { successes: 3, crits: 1 }),
      },
      sandbox,
    ),
    'Blue wins the roll off: 3 successes against 3, with more Crits (2 against 1).',
  )
  assert.equal(
    rollOffText(
      {
        winner: 'host',
        counts: counts({ successes: 3, crits: 1, wilds: 2 }, { successes: 3, crits: 1, wilds: 0 }),
      },
      room,
    ),
    'You win the roll off: 3 successes against 3, with more Wilds (2 against 0).',
  )
})
