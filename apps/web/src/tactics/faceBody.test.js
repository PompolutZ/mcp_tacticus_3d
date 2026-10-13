import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBody } from './faceBody.js'

test('plain text is one text node', () => {
  assert.deepEqual(parseBody('Hello'), [{ t: 'text', text: 'Hello' }])
})

test('bold, icon and break', () => {
  assert.deepEqual(parseBody('Spend 1 |!power| on |*Onslaught|.|\\|'), [
    { t: 'text', text: 'Spend 1 ' },
    { t: 'icon', name: 'power' },
    { t: 'text', text: ' on ' },
    { t: 'nobreak', children: [{ t: 'bold', children: [{ t: 'text', text: 'Onslaught' }] }] },
    { t: 'br' },
  ])
})

test('a part that starts with a dot joins the part before it', () => {
  const nodes = parseBody('|!damage|.')
  assert.deepEqual(nodes, [{ t: 'nobreak', children: [{ t: 'icon', name: 'damage' }] }])
})

test('a bullet turns & into a part separator', () => {
  assert.deepEqual(parseBody('~ Get 1 &!power&'), [
    {
      t: 'bullet',
      children: [
        { t: 'text', text: 'Get 1 ' },
        { t: 'icon', name: 'power' },
      ],
    },
  ])
})

test('a condition shows its label with a capital', () => {
  assert.deepEqual(parseBody('§stun§stun'), [{ t: 'cond', text: 'Stun' }])
})

test('a token parses its label', () => {
  assert.deepEqual(parseBody('<bomb>*Bomb'), [
    { t: 'token', children: [{ t: 'bold', children: [{ t: 'text', text: 'Bomb' }] }] },
  ])
})
