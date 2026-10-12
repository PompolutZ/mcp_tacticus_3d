import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newCharacter } from './newCharacter.js'

const ch = {
  slug: 'wolverine',
  figure: 'wolverine.glb',
  base: 'small',
  rotation: 90,
  transform: null,
}

test('newCharacter: fields from the row, healthy start', () => {
  const c = newCharacter(ch, 'host')
  assert.equal(c.key, 'wolverine')
  assert.equal(c.figure, 'wolverine.glb')
  assert.equal(c.base, 'small')
  assert.equal(c.rotation, 90)
  assert.equal(c.transform, null)
  assert.equal(c.team, 'host')
  assert.equal(c.side, 'healthy')
  assert.equal(c.damage, 0)
  assert.equal(c.power, 0)
  assert.deepEqual(c.tokens, {})
})

test('newCharacter: no attached field when empty', () => {
  assert.equal('attached' in newCharacter(ch, 'host'), false)
  assert.equal('attached' in newCharacter(ch, 'host', { attached: [] }), false)
})

test('newCharacter: attached codes are kept', () => {
  assert.deepEqual(newCharacter(ch, 'guest', { attached: ['a', 'b'] }).attached, ['a', 'b'])
})

test('newCharacter: ids are unique', () => {
  assert.notEqual(newCharacter(ch, 'host').id, newCharacter(ch, 'host').id)
})
