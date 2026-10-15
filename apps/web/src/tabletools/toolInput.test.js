import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toolAction } from './toolInput.js'

const free = {
  snapped: false,
  snappedSide: undefined,
  bendable: true,
  bendOn: false,
  side: 'left',
  drag: null,
}
const snapped = { ...free, snapped: true, snappedSide: 'right' }
const kind = (state, input) => toolAction(state, input).kind

test('free, Bend off: drag moves, step turns around the center', () => {
  assert.deepEqual(toolAction(free, 'drag'), { kind: 'move' })
  assert.deepEqual(toolAction(free, 'step'), { kind: 'turnCenter' })
})

test('free, Bend on: both inputs bend that half', () => {
  for (const side of ['left', 'right']) {
    const s = { ...free, bendOn: true, side }
    assert.deepEqual(toolAction(s, 'drag'), { kind: 'bend', side })
    assert.deepEqual(toolAction(s, 'step'), { kind: 'bend', side })
  }
})

test('snapped, Bend off: both inputs turn around the base, any half', () => {
  for (const side of ['left', 'right']) {
    assert.equal(kind({ ...snapped, side }, 'drag'), 'turnBase')
    assert.equal(kind({ ...snapped, side }, 'step'), 'turnBase')
  }
})

test('snapped, Bend on: far half bends, half on the base turns around the base', () => {
  const s = { ...snapped, bendOn: true }
  assert.deepEqual(toolAction({ ...s, side: 'left' }, 'drag'), { kind: 'bend', side: 'left' })
  assert.deepEqual(toolAction({ ...s, side: 'left' }, 'step'), { kind: 'bend', side: 'left' })
  assert.equal(kind({ ...s, side: 'right' }, 'drag'), 'turnBase')
  assert.equal(kind({ ...s, side: 'right' }, 'step'), 'turnBase')
})

test('Bend on, no half under the pointer: as Bend off', () => {
  assert.equal(kind({ ...free, bendOn: true, side: null }, 'drag'), 'move')
  assert.equal(kind({ ...free, bendOn: true, side: null }, 'step'), 'turnCenter')
  assert.equal(kind({ ...snapped, bendOn: true, side: null }, 'drag'), 'turnBase')
})

test('range tool (no half, not bendable)', () => {
  const range = { ...free, bendable: false, side: null }
  assert.equal(kind(range, 'drag'), 'move')
  assert.equal(kind(range, 'step'), 'turnCenter')
  const snappedRange = { ...range, snapped: true, snappedSide: 'left', bendOn: true }
  assert.equal(kind(snappedRange, 'drag'), 'turnBase')
  assert.equal(kind(snappedRange, 'step'), 'turnBase')
})

test('a step during a drag goes to the drag action', () => {
  assert.deepEqual(toolAction({ ...snapped, drag: 'turn' }, 'step'), { kind: 'turnBase' })
  assert.deepEqual(toolAction({ ...free, bendOn: true, side: 'right', drag: 'bend' }, 'step'), {
    kind: 'bend',
    side: 'right',
  })
  assert.deepEqual(toolAction({ ...snapped, drag: 'move' }, 'step'), { kind: 'turnCenter' })
  assert.deepEqual(toolAction({ ...free, drag: 'move' }, 'step'), { kind: 'turnCenter' })
})
