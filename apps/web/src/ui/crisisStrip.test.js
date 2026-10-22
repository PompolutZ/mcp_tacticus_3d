import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crisisStripItems, scoreboardFits } from './crisisStrip.js'

const nameOf = (key) => `Name ${key}`

test('Secure comes first, whatever the key order', () => {
  const items = crisisStripItems({ extract: 'e1', secure: 's1' }, 'done', nameOf)
  assert.deepEqual(
    items.map((i) => i.type),
    ['secure', 'extract'],
  )
  assert.equal(items[0].name, 'Name s1')
})

test('Only the cards in play show; nothing in play is no strip', () => {
  assert.deepEqual(
    crisisStripItems({ secure: null, extract: 'e1' }, null, nameOf).map((i) => i.type),
    ['extract'],
  )
  assert.deepEqual(crisisStripItems({ secure: null, extract: null }, null, nameOf), [])
  assert.deepEqual(crisisStripItems(undefined, null, nameOf), [])
})

test('No strip during a setup step; shows in the later steps and in the Sandbox', () => {
  const crisis = { secure: 's1', extract: 'e1' }
  for (const step of ['rollOff', 'deck', 'first', 'second', 'threat', 'edge']) {
    assert.deepEqual(crisisStripItems(crisis, step, nameOf), [], step)
  }
  for (const step of ['squads', 'reveal', 'deploy', 'done', null]) {
    assert.equal(crisisStripItems(crisis, step, nameOf).length, 2, String(step))
  }
})

test('A card with no name shows its key', () => {
  assert.equal(crisisStripItems({ secure: 's1' }, null, () => undefined)[0].name, 's1')
})

test('Scoreboard fits only when no box reaches into its span', () => {
  const boxes = [
    { left: 0, right: 300 },
    { left: 700, right: 1000 },
  ]
  assert.equal(scoreboardFits(500, 300, boxes), true)
  assert.equal(scoreboardFits(500, 500, boxes), false)
  assert.equal(scoreboardFits(500, 400, boxes), true)
})

test('The gap counts on both sides, and a bar with no boxes always fits', () => {
  const boxes = [{ left: 700, right: 1000 }]
  assert.equal(scoreboardFits(500, 400, boxes, 0), true)
  assert.equal(scoreboardFits(500, 400, boxes, 12), false)
  assert.equal(scoreboardFits(500, 4000, [], 12), true)
})
