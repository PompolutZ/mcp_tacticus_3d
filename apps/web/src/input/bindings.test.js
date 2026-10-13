import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTIONS,
  acceptsInput,
  codeName,
  inputName,
  reservedReason,
  CONDITIONS,
  changedBindings,
  defaultBindings,
  effectiveBindings,
  findConflicts,
  inputFromEvent,
  resolve,
} from './bindings.js'

const none = {
  popup: false,
  dragging: false,
  modelDrag: false,
  overDiceTray: false,
  overPiece: false,
}
const input = (code, mods = {}) => ({
  code,
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
  ...mods,
})
const at = (code, now = {}, mods = {}, bindings) =>
  resolve(input(code, mods), { ...none, ...now }, bindings)

test('every key of today gives its action', () => {
  const keys = {
    KeyW: 'panUp',
    KeyS: 'panDown',
    KeyA: 'panLeft',
    KeyD: 'panRight',
    ArrowUp: 'turnUp',
    ArrowDown: 'turnDown',
    ArrowLeft: 'turnLeft',
    ArrowRight: 'turnRight',
    Space: 'resetView',
    KeyQ: 'rotateLeft',
    KeyE: 'rotateRight',
    KeyF: 'flip',
    KeyR: 'lift',
    KeyL: 'lock',
    KeyP: 'ping',
    Delete: 'delete',
    Backspace: 'delete',
    AltLeft: 'peek',
    AltRight: 'peek',
    Escape: 'cancel',
    WheelUp: 'zoomIn',
    WheelDown: 'zoomOut',
  }
  for (const [code, id] of Object.entries(keys)) assert.equal(at(code), id, code)
  const tools = { 1: 'range1', 2: 'range2', 3: 'range3', 4: 'range4', 5: 'range5', 6: 'angle' }
  Object.assign(tools, { 7: 'moveShort', 8: 'moveMedium', 9: 'moveLong', 0: 'clearTools' })
  for (const [n, id] of Object.entries(tools)) {
    assert.equal(at(`Digit${n}`), id, n)
    assert.equal(at(`Numpad${n}`), id, 'pad ' + n)
  }
})

test('over the own dice tray the number keys add dice, also 0 for 10', () => {
  for (let n = 1; n <= 9; n++) {
    assert.equal(at(`Digit${n}`, { overDiceTray: true }), `dice${n}`)
    assert.equal(at(`Numpad${n}`, { overDiceTray: true }), `dice${n}`)
  }
  assert.equal(at('Digit0', { overDiceTray: true }), 'dice10')
  assert.equal(at('Numpad0', { overDiceTray: true }), 'dice10')
})

test('the arrows step cards only with a popup', () => {
  assert.equal(at('ArrowLeft', { popup: true }), 'cardPrev')
  assert.equal(at('ArrowRight', { popup: true }), 'cardNext')
  assert.equal(at('ArrowUp', { popup: true }), 'turnUp')
})

test('the first condition in the order wins', () => {
  const bindings = effectiveBindings({
    flip: [
      { ...input('KeyZ'), when: 'anywhere' },
      { ...input('KeyZ'), when: 'overPiece' },
    ],
    lift: [{ ...input('KeyZ'), when: 'dragging' }],
    lock: [{ ...input('KeyZ'), when: 'overDiceTray' }],
    ping: [{ ...input('KeyZ'), when: 'popup' }],
  })
  const all = { popup: true, dragging: true, overDiceTray: true, overPiece: true }
  assert.equal(at('KeyZ', all, {}, bindings), 'ping')
  assert.equal(at('KeyZ', { ...all, popup: false }, {}, bindings), 'lift')
  assert.equal(at('KeyZ', { overDiceTray: true, overPiece: true }, {}, bindings), 'lock')
  assert.equal(at('KeyZ', { overPiece: true }, {}, bindings), 'flip')
  assert.equal(at('KeyZ', {}, {}, bindings), 'flip')
  assert.deepEqual(CONDITIONS, [
    'popup',
    'dragging',
    'modelDrag',
    'overDiceTray',
    'overPiece',
    'anywhere',
  ])
})

test('modifiers match exactly', () => {
  assert.equal(at('KeyQ', {}, { shift: true }), null)
  assert.equal(at('KeyQ', {}, { ctrl: true }), null)
  assert.equal(at('KeyQ', {}, { alt: true }), null)
  assert.equal(at('KeyQ', {}, { meta: true }), null)
  const bindings = effectiveBindings({
    flip: [{ ...input('KeyQ', { shift: true }), when: 'anywhere' }],
  })
  assert.equal(at('KeyQ', {}, { shift: true }, bindings), 'flip')
  assert.equal(at('KeyQ', {}, {}, bindings), 'rotateLeft')
})

test('a modifier key alone is an input: its own flag does not count', () => {
  const alt = inputFromEvent({ code: 'AltLeft', altKey: true })
  assert.deepEqual(alt, input('AltLeft'))
  assert.equal(resolve(alt, none), 'peek')
  // another modifier with it does count
  const both = inputFromEvent({ code: 'AltRight', altKey: true, shiftKey: true })
  assert.equal(resolve(both, none), null)
  assert.deepEqual(inputFromEvent({ code: 'KeyQ', ctrlKey: true }), input('KeyQ', { ctrl: true }))
  assert.deepEqual(inputFromEvent({ code: 'ShiftLeft', shiftKey: true }), input('ShiftLeft'))
})

test('held actions are the camera, piece turn and peek, and each allows its conditions', () => {
  const held = ACTIONS.filter((a) => a.held).map((a) => a.id)
  assert.deepEqual(held, [
    'panUp',
    'panDown',
    'panLeft',
    'panRight',
    'turnUp',
    'turnDown',
    'turnLeft',
    'turnRight',
    'rotateLeft',
    'rotateRight',
    'peek',
  ])
  for (const a of ACTIONS) {
    assert.ok(a.when.length > 0, a.id)
    for (const b of a.keys) assert.ok(a.when.includes(b.when), `${a.id} ${b.code}`)
  }
})

test('effective bindings: a changed action replaces its defaults, the others stay', () => {
  const custom = [{ ...input('KeyG'), when: 'anywhere' }]
  const bindings = effectiveBindings({ flip: custom, unknown: custom })
  assert.deepEqual(bindings.flip, custom)
  assert.equal(bindings.unknown, undefined)
  assert.deepEqual(bindings.lift, defaultBindings().lift)
  assert.equal(at('KeyF', {}, {}, bindings), null)
  assert.equal(at('KeyG', {}, {}, bindings), 'flip')
  assert.deepEqual(effectiveBindings(null), defaultBindings())
})

test('changedBindings keeps only the actions that differ from the defaults', () => {
  const bindings = defaultBindings()
  assert.deepEqual(changedBindings(bindings), {})
  bindings.flip = []
  bindings.lift = [{ ...input('KeyG'), when: 'anywhere' }]
  assert.deepEqual(Object.keys(changedBindings(bindings)), ['flip', 'lift'])
})

test('conflicts: same input, modifiers and condition in another action', () => {
  const bindings = defaultBindings()
  const probe = { ...input('KeyF'), when: 'anywhere' }
  assert.deepEqual(findConflicts(bindings, probe), [{ id: 'flip', index: 0 }])
  assert.deepEqual(findConflicts(bindings, probe, 'flip'), [])
  assert.deepEqual(findConflicts(bindings, { ...probe, shift: true }), [])
  assert.deepEqual(findConflicts(bindings, { ...probe, when: 'overPiece' }), [])
  const dice = { ...input('Numpad3'), when: 'overDiceTray' }
  assert.deepEqual(findConflicts(bindings, dice), [{ id: 'dice3', index: 1 }])
})

test('the default bindings have no conflict', () => {
  const seen = new Set()
  for (const [id, list] of Object.entries(defaultBindings()))
    for (const b of list) {
      const k = `${b.code}|${b.shift}|${b.ctrl}|${b.alt}|${b.meta}|${b.when}`
      assert.ok(!seen.has(k), `${id} ${k}`)
      seen.add(k)
    }
})

test('wheel: dragging turns the piece, anywhere zooms, exact modifiers', () => {
  assert.equal(at('WheelUp'), 'zoomIn')
  assert.equal(at('WheelDown'), 'zoomOut')
  assert.equal(at('WheelUp', { dragging: true }), 'rotateLeft')
  assert.equal(at('WheelDown', { dragging: true }), 'rotateRight')
  // over a piece that is not dragged, the wheel zooms
  assert.equal(at('WheelUp', { overPiece: true }), 'zoomIn')
  assert.equal(at('WheelUp', {}, { shift: true }), null)
  assert.equal(at('WheelUp', { dragging: true }, { shift: true }), null)
  const bindings = defaultBindings()
  bindings.flip = [{ ...input('WheelDown', { shift: true }), when: 'anywhere' }]
  assert.equal(at('WheelDown', {}, { shift: true }, bindings), 'flip')
  assert.equal(at('WheelDown', {}, {}, bindings), 'zoomOut')
})

test('names of inputs', () => {
  assert.equal(codeName('KeyQ'), 'Q')
  assert.equal(codeName('Digit7'), '7')
  assert.equal(codeName('Numpad7'), 'Num 7')
  assert.equal(codeName('ArrowLeft'), '←')
  assert.equal(codeName('Escape'), 'Esc')
  assert.equal(codeName('WheelUp'), 'Wheel up')
  assert.equal(codeName('AltLeft'), 'Left Alt')
  assert.equal(codeName('AltRight', true), 'Right ⌥')
  assert.equal(inputName(input('KeyW', { meta: true, shift: true }), true), '⇧⌘W')
  assert.equal(inputName(input('KeyW', { ctrl: true, shift: true })), 'Ctrl+Shift+W')
  assert.equal(inputName(input('KeyW', { meta: true })), 'Win+W')
})

test('reserved combos', () => {
  for (const code of ['KeyW', 'KeyQ', 'KeyT', 'KeyN', 'Tab', 'KeyH', 'KeyM'])
    assert.ok(reservedReason(input(code, { meta: true }), true), `meta ${code}`)
  for (const code of ['KeyW', 'KeyT', 'KeyN', 'Tab'])
    assert.ok(reservedReason(input(code, { ctrl: true })), `ctrl ${code}`)
  assert.ok(reservedReason(input('KeyW', { meta: true, shift: true })))
  assert.match(reservedReason(input('KeyW', { meta: true }), true), /⌘W/)
  assert.ok(reservedReason(input('WheelUp', { ctrl: true })))
  assert.equal(reservedReason(input('KeyW')), null)
  assert.equal(reservedReason(input('KeyQ', { ctrl: true })), null)
  assert.equal(reservedReason(input('WheelUp', { shift: true })), null)
})

test('which actions take the wheel', () => {
  assert.ok(acceptsInput('zoomIn', 'WheelUp'))
  assert.ok(!acceptsInput('zoomIn', 'KeyZ'))
  assert.ok(acceptsInput('rotateLeft', 'WheelUp'))
  assert.ok(acceptsInput('rotateLeft', 'KeyQ'))
  assert.ok(!acceptsInput('flip', 'WheelUp'))
  assert.ok(acceptsInput('flip', 'KeyG'))
})
