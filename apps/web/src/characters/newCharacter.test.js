import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newCharacter, newCharacters } from './newCharacter.js'

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

test('newCharacter: host field only for a grunt', () => {
  assert.equal('host' in newCharacter(ch, 'host'), false)
  assert.equal(newCharacter(ch, 'host', { host: 'h1' }).host, 'h1')
})

test('newCharacters: a character without grunts is one character', () => {
  const list = newCharacters(ch, 'host')
  assert.equal(list.length, 1)
  assert.equal('host' in list[0], false)
})

test('newCharacters: one character per grunt, with the id of the host, after the host', () => {
  const sandman = {
    ...ch,
    slug: 'sandman',
    grunts: [
      { slug: 'twisty', base: 'small', rotation: 30, transform: null, grunt: true },
      { slug: 'fisty', base: 'small', rotation: 30, transform: null, grunt: true },
    ],
  }
  const list = newCharacters(sandman, 'guest', { attached: ['gem'] })
  assert.deepEqual(
    list.map((c) => c.key),
    ['sandman', 'twisty', 'fisty'],
  )
  assert.equal('host' in list[0], false)
  assert.deepEqual(list[0].attached, ['gem'])
  assert.equal(list[1].host, list[0].id)
  assert.equal(list[2].host, list[0].id)
  assert.equal(list[1].team, 'guest')
  assert.equal('attached' in list[1], false)
  assert.equal(new Set(list.map((c) => c.id)).size, 3)
})
