import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deleteTarget, flipTarget } from './hover.js'

const none = {
  piece: null,
  terrain: null,
  loose: null,
  pile: null,
  tactic: null,
  held: null,
  trayCard: null,
  diceTray: null,
}

test('deleteTarget: nothing hovered gives null', () => {
  assert.equal(deleteTarget(none), null)
})

test('deleteTarget: order is table token, held token, pile, tactic, terrain, tray card', () => {
  const all = {
    ...none,
    loose: 'l',
    held: 'h',
    pile: 'p',
    tactic: 'a',
    terrain: 't',
    trayCard: 'c',
  }
  const order = ['loose', 'held', 'pile', 'tactic', 'terrain', 'trayCard']
  const ids = { loose: 'l', held: 'h', pile: 'p', tactic: 'a', terrain: 't', trayCard: 'c' }
  const h = { ...all }
  for (const kind of order) {
    assert.deepEqual(deleteTarget(h), { kind, id: ids[kind] })
    h[kind] = null
  }
  assert.equal(deleteTarget(h), null)
})

test('deleteTarget: a piece hover and a dice tray are not targets', () => {
  assert.equal(
    deleteTarget({ ...none, piece: { kind: 'character', id: 'x' }, diceTray: 'host' }),
    null,
  )
})

test('deleteTarget: a falsy id is skipped, as an if chain does', () => {
  assert.deepEqual(deleteTarget({ ...none, loose: '', held: 0, pile: 'p' }), {
    kind: 'pile',
    id: 'p',
  })
})

test('flipTarget: order is piece, held token, tray card, tactic, last selected tool piece', () => {
  const selection = [
    { kind: 'character', id: 's1' },
    { kind: 'terrain', id: 'z' },
  ]
  const piece = { kind: 'token', id: 'p' }
  assert.equal(
    flipTarget({ ...none, piece, held: 'h', trayCard: 'c', tactic: 'a' }, selection),
    piece,
  )
  assert.deepEqual(flipTarget({ ...none, held: 'h', trayCard: 'c', tactic: 'a' }, selection), {
    kind: 'token',
    id: 'h',
  })
  assert.deepEqual(flipTarget({ ...none, trayCard: 'c', tactic: 'a' }, selection), {
    kind: 'character',
    id: 'c',
  })
  assert.deepEqual(flipTarget({ ...none, tactic: 'a' }, selection), { kind: 'tactic', id: 'a' })
  assert.deepEqual(flipTarget(none, selection), { kind: 'character', id: 's1' })
})

test('flipTarget: the last selected tool piece, terrain is skipped', () => {
  const selection = [
    { kind: 'character', id: 'a' },
    { kind: 'token', id: 'b' },
    { kind: 'terrain', id: 'z' },
  ]
  assert.deepEqual(flipTarget(none, selection), { kind: 'token', id: 'b' })
  assert.equal(flipTarget(none, [{ kind: 'terrain', id: 'z' }]), undefined)
  assert.equal(flipTarget(none, []), undefined)
})

test('flipTarget: undefined hovers fall through like null', () => {
  assert.deepEqual(flipTarget({ held: undefined, trayCard: undefined, tactic: 'a' }, []), {
    kind: 'tactic',
    id: 'a',
  })
})

test('flipTarget: a falsy id other than null stops the chain, as ?? does', () => {
  assert.equal(flipTarget({ ...none, held: '', tactic: 'a' }, [{ kind: 'token', id: 'b' }]), '')
  assert.equal(flipTarget({ ...none, held: 0, tactic: 'a' }, []), 0)
  assert.equal(flipTarget({ ...none, trayCard: '', tactic: 'a' }, []), '')
  assert.equal(flipTarget({ ...none, tactic: '' }, [{ kind: 'token', id: 'b' }]), '')
})
