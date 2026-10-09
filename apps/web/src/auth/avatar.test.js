import assert from 'node:assert/strict'
import test from 'node:test'
import { avatarUrl } from './avatar.js'

test('avatarUrl with a hash', () => {
  assert.equal(
    avatarUrl({ discordId: '80351110224678912', avatar: 'abc123' }, 28),
    'https://cdn.discordapp.com/avatars/80351110224678912/abc123.png?size=28',
  )
})

test('avatarUrl default size is 64', () => {
  assert.match(avatarUrl({ discordId: '1', avatar: 'h' }), /size=64$/)
})

test('avatarUrl without a hash uses the id formula', () => {
  const index = Number((80351110224678912n >> 22n) % 6n)
  assert.equal(
    avatarUrl({ discordId: '80351110224678912', avatar: null }),
    `https://cdn.discordapp.com/embed/avatars/${index}.png`,
  )
})

test('avatarUrl for a dev id gives an index from 0 to 5', () => {
  for (const id of ['dev:bob', 'dev:alice', 'dev:x']) {
    const m = avatarUrl({ discordId: id, avatar: null }).match(/avatars\/(\d+)\.png$/)
    assert.ok(m && Number(m[1]) >= 0 && Number(m[1]) <= 5)
  }
})
