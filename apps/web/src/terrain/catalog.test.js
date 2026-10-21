import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MATS, PIECES_BY_SIZE } from './catalog.js'
import { MAPS } from './maps/index.js'
import { TERRAIN_PIECES } from './pieces.js'

const find = (size, key) => PIECES_BY_SIZE[size].find((e) => e.key === key)

test('one mat entry per mat, with the rotation of the first map that uses it', () => {
  const mats = new Set(Object.values(MAPS).map((m) => m.mat))
  assert.equal(MATS.length, mats.size)
  assert.deepEqual(new Set(MATS.map((m) => m.name)), mats)
  const first = Object.values(MAPS).find((m) => m.mat === MATS[0].name)
  assert.equal(MATS[0].rotation, first.matRotation)
})

test('a piece with a size and no placement is in its size group, with scale 1 and no tint', () => {
  const placed = new Set(Object.values(MAPS).flatMap((m) => m.placements.map((p) => p.piece)))
  const unplaced = Object.entries(TERRAIN_PIECES).filter(([k, p]) => p.size && !placed.has(k))
  assert.ok(unplaced.length > 0)
  for (const [key, piece] of unplaced) {
    const entry = find(piece.size, key)
    assert.ok(entry, `${key} is in group ${piece.size}`)
    assert.equal(entry.size, piece.size)
    assert.equal(entry.scale, 1)
    assert.equal(entry.tint, undefined)
  }
})

test('a piece with a size is in no other group unless a map places it there', () => {
  const placed = new Set(Object.values(MAPS).flatMap((m) => m.placements.map((p) => p.piece)))
  for (const [key, piece] of Object.entries(TERRAIN_PIECES)) {
    if (!piece.size || placed.has(key)) continue
    const groups = Object.keys(PIECES_BY_SIZE).filter((g) => find(g, key))
    assert.deepEqual(groups, [String(piece.size)], key)
  }
})

test('every piece of every map is in the group of each size it is placed with', () => {
  for (const map of Object.values(MAPS)) {
    for (const p of map.placements) assert.ok(find(p.size ?? 'none', p.piece), p.piece)
  }
})

test('each group is sorted by name', () => {
  for (const group of Object.values(PIECES_BY_SIZE)) {
    const names = group.map((e) => e.name)
    assert.deepEqual(
      names,
      [...names].sort((a, b) => a.localeCompare(b)),
    )
  }
})

test('pieces with two sizes are in both groups', () => {
  assert.ok(find(2, 'storage-container-size-2-3') && find(3, 'storage-container-size-2-3'))
  assert.ok(find(3, 'bulldozer-size-3') && find(4, 'bulldozer-size-3'))
  assert.equal(find(3, 'bulldozer-size-3').size, 3)
  assert.equal(find(4, 'bulldozer-size-3').size, 4)
})

test('a tie in the scale goes to the first placement (panther-statue at size 3: 3, 1.5, 2.5, 2 each)', () => {
  assert.equal(find(3, 'panther-statue').scale, 3)
})

test('every entry has a scale, and a tint only when a placement has one', () => {
  for (const group of Object.values(PIECES_BY_SIZE)) {
    for (const e of group) {
      assert.ok(Number.isFinite(e.scale) || e.scale?.length === 3, e.key)
      if (e.tint !== undefined) assert.equal(e.tint.length, 3, e.key)
    }
  }
})
