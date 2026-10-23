import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keyAction, wheelState } from './keyboard.js'
import { effectiveBindings, resolve } from './input/bindings.js'

const field = { closest: (sel) => (sel.includes('input') ? {} : null) }
const plain = { closest: () => null }

// A keydown event. Modifiers and repeat are off unless given.
function key(k, extra = {}) {
  const code = extra.code ?? (/^\d$/.test(k) ? `Digit${k}` : k)
  return { key: k, code, target: plain, repeat: false, ...extra }
}

const idle = {
  tokenDrag: null,
  toolDrag: null,
  modelDrag: false,
  drag: false,
  popup: false,
  rosterOpen: false,
  diceMenu: null,
  libraryOpen: false,
  logOpen: false,
  diceTray: null,
}
const act = (e, s = {}) => keyAction(e, { ...idle, ...s })

test('Alt peeks with preventDefault, also during drags and popups', () => {
  const alt = key('Alt', { code: 'AltLeft', altKey: true })
  assert.deepEqual(act(alt), { action: 'peek', id: 'peek', preventDefault: true, blocked: false })
  assert.equal(act(alt, { tokenDrag: {} }).blocked, true)
  assert.equal(act(alt, { toolDrag: {} }).blocked, true)
  assert.equal(act(alt, { popup: true }).blocked, true)
  assert.equal(act(alt, { tokenDrag: {} }).preventDefault, true)
  assert.equal(act(alt, { popup: true, rosterOpen: true }).action, 'peek')
})

test('Alt peeks with repeat and in a text field, also with its own altKey flag', () => {
  const e = key('Alt', { code: 'AltRight', repeat: true, target: field, altKey: true })
  assert.equal(act(e).action, 'peek')
  // another modifier with it is another input
  assert.equal(act(key('Alt', { code: 'AltLeft', altKey: true, metaKey: true })), null)
})

test('a token drag: Escape cancels the drag, the camera keys work, others do nothing', () => {
  const s = { tokenDrag: {}, drag: true }
  assert.deepEqual(act(key('Escape'), s), { action: 'cancelDrag', id: 'cancel' })
  assert.equal(act(key('f', { code: 'KeyF' }), s), null)
  assert.equal(act(key('Delete'), s), null)
  assert.equal(act(key('1'), s), null)
  assert.equal(act(key('w', { code: 'KeyW' }), s).action, 'pan')
  assert.equal(act(key('ArrowLeft'), s).action, 'turn')
})

test('a tool drag: Escape cancels the drag, the camera keys work, others do nothing', () => {
  const s = { toolDrag: {}, drag: true }
  assert.deepEqual(act(key('Escape'), s), { action: 'cancelDrag', id: 'cancel' })
  assert.equal(act(key('w', { code: 'KeyW' }), s).action, 'pan')
  assert.equal(act(key('ArrowRight'), s).action, 'turn')
  assert.equal(act(key('1'), s), null)
  assert.equal(act(key(' ', { code: 'Space' }), s), null)
})

test('a model drag: Escape cancels the drag, Q / E and R still work', () => {
  const s = { modelDrag: true, drag: true }
  assert.deepEqual(act(key('Escape'), s), { action: 'cancelDrag', id: 'cancel' })
  assert.equal(act(key('q', { code: 'KeyQ' }), s).action, 'rotate')
  assert.equal(act(key('r', { code: 'KeyR' }), s).action, 'floor')
})

test('a tactic, crisis token or marker drag: Escape cancels the drag, not the selection', () => {
  assert.equal(act(key('Escape'), { drag: true }).action, 'cancelDrag')
  assert.equal(act(key('Escape'), { drag: false }).action, 'escape')
})

test('drags win over popups and Escape closes no popup then', () => {
  assert.equal(act(key('Escape'), { drag: true, popup: true }).action, 'cancelDrag')
})

test('a popup: Escape closes the popups, also with a modifier or in a text field', () => {
  assert.deepEqual(act(key('Escape'), { popup: true }), { action: 'closePopups', id: 'cancel' })
  assert.equal(act(key('Escape', { target: field }), { popup: true }).action, 'closePopups')
  // before the dice menu, the Library and the Log
  const s = { popup: true, diceMenu: {}, libraryOpen: true, logOpen: true }
  assert.equal(act(key('Escape'), s).action, 'closePopups')
})

test('a popup: arrow keys step roster cards only with the roster popup', () => {
  const roster = { popup: true, rosterOpen: true }
  assert.deepEqual(act(key('ArrowLeft'), roster), { action: 'cardStep', id: 'cardPrev', step: -1 })
  assert.deepEqual(act(key('ArrowRight'), roster), { action: 'cardStep', id: 'cardNext', step: 1 })
  // with a card or tray popup open: nothing, no pan or turn
  const other = { popup: true, rosterOpen: false }
  assert.equal(act(key('ArrowLeft'), other), null)
  assert.equal(act(key('ArrowRight'), other), null)
  // up and down do not step
  assert.equal(act(key('ArrowUp'), roster), null)
  assert.equal(act(key('ArrowDown'), roster), null)
})

test('a popup: every other key does nothing', () => {
  const s = { popup: true, rosterOpen: true }
  for (const [k, code] of [
    ['Delete', 'Delete'],
    ['w', 'KeyW'],
    [' ', 'Space'],
    ['q', 'KeyQ'],
    ['f', 'KeyF'],
    ['1', 'Digit1'],
    ['0', 'Digit0'],
  ])
    assert.equal(act(key(k, { code }), s), null, k)
})

test('Escape chain: dice menu, Library, Log, table Escape', () => {
  const esc = key('Escape')
  assert.equal(act(esc, { diceMenu: {}, libraryOpen: true, logOpen: true }).action, 'closeDiceMenu')
  assert.equal(act(esc, { libraryOpen: true, logOpen: true }).action, 'closeLibrary')
  assert.equal(act(esc, { logOpen: true }).action, 'closeLog')
  assert.equal(act(esc, {}).action, 'escape')
})

test('Escape skips the text field guard and acts on repeat', () => {
  assert.equal(act(key('Escape', { target: field })).action, 'escape')
  assert.equal(act(key('Escape', { repeat: true })).action, 'escape')
})

test('Escape with a modifier is not bound: nothing', () => {
  assert.equal(act(key('Escape', { metaKey: true })), null)
  assert.equal(act(key('Escape', { ctrlKey: true }), { logOpen: true }), null)
})

test('a combo with no binding does nothing, also a text field', () => {
  const keys = [
    ['Delete', 'Delete'],
    ['w', 'KeyW'],
    ['ArrowLeft', 'ArrowLeft'],
    [' ', 'Space'],
    ['q', 'KeyQ'],
    ['f', 'KeyF'],
    ['Tab', 'Tab'],
    ['1', 'Digit1'],
    ['6', 'Digit6'],
    ['0', 'Digit0'],
  ]
  for (const [k, code] of keys) {
    assert.ok(act(key(k, { code })), k)
    assert.equal(act(key(k, { code, metaKey: true })), null, 'meta ' + k)
    assert.equal(act(key(k, { code, ctrlKey: true })), null, 'ctrl ' + k)
    assert.equal(act(key(k, { code, altKey: true })), null, 'alt ' + k)
    assert.equal(act(key(k, { code, shiftKey: true })), null, 'shift ' + k)
    assert.equal(act(key(k, { code, target: field }), { diceTray: 'host' }), null, 'field ' + k)
  }
})

test('a bound Cmd or Ctrl combo calls preventDefault, a bound Shift combo does not', () => {
  const bindings = effectiveBindings({
    flip: [
      { code: 'KeyF', shift: false, ctrl: false, alt: false, meta: true, when: 'anywhere' },
      { code: 'KeyG', shift: true, ctrl: false, alt: false, meta: false, when: 'anywhere' },
    ],
  })
  const meta = act(key('f', { code: 'KeyF', metaKey: true }), { bindings })
  assert.deepEqual(meta, { action: 'flip', id: 'flip', preventDefault: true })
  const shift = act(key('g', { code: 'KeyG', shiftKey: true }), { bindings })
  assert.deepEqual(shift, { action: 'flip', id: 'flip' })
  assert.equal(act(key('f', { code: 'KeyF' }), { bindings }), null)
})

test('the bindings in the state replace the defaults', () => {
  const bindings = effectiveBindings({
    ping: [{ code: 'KeyZ', shift: false, ctrl: false, alt: false, meta: false, when: 'overPiece' }],
  })
  assert.equal(act(key('z', { code: 'KeyZ' }), { bindings }), null)
  assert.equal(act(key('z', { code: 'KeyZ' }), { bindings, overPiece: true }).action, 'ping')
  assert.equal(act(key('p', { code: 'KeyP' }), { bindings }), null)
})

test('Delete and Backspace delete, also on repeat', () => {
  assert.deepEqual(act(key('Delete')), { action: 'delete', id: 'delete' })
  assert.deepEqual(act(key('Backspace', { repeat: true })), { action: 'delete', id: 'delete' })
})

test('pan and turn keys are by key code, and also on repeat', () => {
  assert.deepEqual(act(key('w', { code: 'KeyW' })), { action: 'pan', id: 'panUp', dir: [0, 1] })
  assert.deepEqual(act(key('ц', { code: 'KeyW', repeat: true })), {
    action: 'pan',
    id: 'panUp',
    dir: [0, 1],
  })
  assert.deepEqual(act(key('ArrowUp')), { action: 'turn', id: 'turnUp', dir: [0, 1] })
  assert.deepEqual(act(key('ArrowLeft', { repeat: true })), {
    action: 'turn',
    id: 'turnLeft',
    dir: [-1, 0],
  })
})

test('Space resets the view with preventDefault, on repeat it only prevents the default', () => {
  const first = act(key(' ', { code: 'Space' }))
  assert.deepEqual(first, { action: 'reset', id: 'resetView', first: true, preventDefault: true })
  const again = act(key(' ', { code: 'Space', repeat: true }))
  assert.deepEqual(again, { action: 'reset', id: 'resetView', first: false, preventDefault: true })
})

test('Q / E: the held part on repeat, the piece turn on the first press only', () => {
  assert.deepEqual(act(key('q', { code: 'KeyQ' })), {
    action: 'rotate',
    id: 'rotateLeft',
    dir: 1,
    first: true,
  })
  assert.deepEqual(act(key('e', { code: 'KeyE', repeat: true })), {
    action: 'rotate',
    id: 'rotateRight',
    dir: -1,
    first: false,
  })
})

test('first-press keys: F, R, L, P act once, nothing on repeat', () => {
  for (const [code, action] of [
    ['KeyF', 'flip'],
    ['KeyR', 'lift'],
    ['KeyL', 'lock'],
  ]) {
    assert.deepEqual(act(key('x', { code })), { action, id: action })
    assert.equal(act(key('x', { code, repeat: true })), null, code)
  }
})

test('a key that stops the browser focus move does it only when it acts', () => {
  const tab = key('Tab', { code: 'Tab' })
  assert.deepEqual(act(tab), { action: 'ping', id: 'ping', preventDefault: true })
  assert.equal(act(key('Tab', { code: 'Tab', repeat: true })), null)
  assert.equal(act(key('Tab', { code: 'Tab', target: field })), null)
  assert.equal(act(tab, { popup: true }), null)
})

test('tool keys act once: range 1-5, move 7-9, angle 6, clear 0', () => {
  assert.deepEqual(act(key('1')), { action: 'range', id: 'range1', value: 1 })
  assert.deepEqual(act(key('5')), { action: 'range', id: 'range5', value: 5 })
  assert.deepEqual(act(key('7')), { action: 'move', id: 'moveShort', value: 'short' })
  assert.deepEqual(act(key('8')), { action: 'move', id: 'moveMedium', value: 'medium' })
  assert.deepEqual(act(key('9')), { action: 'move', id: 'moveLong', value: 'long' })
  assert.deepEqual(act(key('6')), { action: 'angle', id: 'angle' })
  assert.deepEqual(act(key('0')), { action: 'clear', id: 'clearTools' })
  assert.deepEqual(act(key('1', { shiftKey: true }), { overPiece: true }), {
    action: 'los',
    id: 'los',
  })
  for (const k of ['1', '5', '7', '9', '6', '0'])
    assert.equal(act(key(k, { repeat: true })), null, k)
})

test('dice keys over an own tray win over the tools, also 6 and 0', () => {
  const s = { diceTray: 'guest' }
  assert.deepEqual(act(key('1'), s), { action: 'dice', id: 'dice1', side: 'guest', count: 1 })
  assert.deepEqual(act(key('5'), s), { action: 'dice', id: 'dice5', side: 'guest', count: 5 })
  assert.deepEqual(act(key('6'), s), { action: 'dice', id: 'dice6', side: 'guest', count: 6 })
  assert.deepEqual(act(key('9'), s), { action: 'dice', id: 'dice9', side: 'guest', count: 9 })
  assert.deepEqual(act(key('0'), s), { action: 'dice', id: 'dice10', side: 'guest', count: 10 })
  assert.equal(act(key('6', { repeat: true }), s), null)
})

test('other keys do nothing', () => {
  assert.equal(act(key('z', { code: 'KeyZ' })), null)
  assert.equal(act(key('p', { code: 'KeyP' })), null)
  assert.equal(act(key('Enter')), null)
  assert.equal(act(key('8', { code: 'Digit8' }), { diceTray: null }).action, 'move')
})

test('number pad keys act as the number row', () => {
  assert.equal(act(key('1', { code: 'Numpad1' })).id, 'range1')
  assert.equal(act(key('0', { code: 'Numpad0' }), { diceTray: 'host' }).id, 'dice10')
})

test('R: lower floor during a model drag, Lift otherwise', () => {
  const r = key('r', { code: 'KeyR' })
  assert.deepEqual(act(r, { modelDrag: true }), { action: 'floor', id: 'floor' })
  assert.deepEqual(act(r, { modelDrag: false }), { action: 'lift', id: 'lift' })
  assert.equal(act(key('r', { code: 'KeyR', repeat: true }), { modelDrag: true }), null)
  // A tool or token drag still blocks every key
  assert.equal(act(r, { toolDrag: {}, modelDrag: true }), null)
})

test("Build mode: Q / E and Delete are the builder's, only while it is on", () => {
  for (const code of ['KeyQ', 'KeyE', 'Delete', 'Backspace']) {
    assert.ok(act(key(code, { code })), `${code} acts outside Build mode`)
    assert.equal(act(key(code, { code }), { building: true }), null, `${code} in Build mode`)
  }
  // The other keys work as always
  assert.equal(act(key('KeyL', { code: 'KeyL' }), { building: true }).action, 'lock')
  assert.equal(act(key('KeyW', { code: 'KeyW' }), { building: true }).action, 'pan')
})

test('the wheel turns the piece during any drag (model, placed tool, token), else it zooms', () => {
  const at = (code, s) =>
    resolve({ code, shift: false, ctrl: false, alt: false, meta: false }, wheelState(s))
  assert.equal(at('WheelUp', {}), 'zoomIn')
  for (const s of [
    { drag: true },
    { modelDrag: true, drag: true },
    { tokenDrag: {} },
    { toolDrag: {} },
  ]) {
    assert.equal(at('WheelUp', s), 'rotateLeft')
    assert.equal(at('WheelDown', s), 'rotateRight')
  }
})
