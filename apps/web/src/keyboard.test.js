import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PAN_KEYS,
  PRESS_KEYS,
  RESET_VIEW_KEY,
  ROTATE_KEYS,
  TURN_KEYS,
  keyAction,
} from './keyboard.js'

const field = { closest: (sel) => (sel.includes('input') ? {} : null) }
const plain = { closest: () => null }

// A keydown event. Modifiers and repeat are off unless given.
function key(k, extra = {}) {
  return { key: k, code: extra.code ?? k, target: plain, repeat: false, ...extra }
}

const idle = {
  tokenDrag: null,
  toolDrag: null,
  popup: false,
  rosterOpen: false,
  diceMenu: null,
  libraryOpen: false,
  logOpen: false,
  diceTray: null,
}
const act = (e, s = {}) => keyAction(e, { ...idle, ...s })

test('Alt peeks with preventDefault, also during drags and popups', () => {
  const alt = key('Alt', { code: 'AltLeft' })
  assert.deepEqual(act(alt), { action: 'peek', preventDefault: true, blocked: false })
  assert.equal(act(alt, { tokenDrag: {} }).blocked, true)
  assert.equal(act(alt, { toolDrag: {} }).blocked, true)
  assert.equal(act(alt, { popup: true }).blocked, true)
  assert.equal(act(alt, { tokenDrag: {} }).preventDefault, true)
  assert.equal(act(alt, { popup: true, rosterOpen: true }).action, 'peek')
})

test('Alt peeks with repeat, in a text field and with other modifiers', () => {
  const e = key('Alt', { repeat: true, target: field, metaKey: true })
  assert.equal(act(e).action, 'peek')
})

test('a token drag: only Escape, which cancels it', () => {
  const s = { tokenDrag: {} }
  assert.deepEqual(act(key('Escape'), s), { action: 'cancelTokenDrag' })
  assert.equal(act(key('f', { code: 'KeyF' }), s), null)
  assert.equal(act(key('Delete'), s), null)
  assert.equal(act(key('1'), s), null)
  assert.equal(act(key('ArrowLeft'), s), null)
})

test('a tool drag: only Escape, which cancels it', () => {
  const s = { toolDrag: {} }
  assert.deepEqual(act(key('Escape'), s), { action: 'cancelToolDrag' })
  assert.equal(act(key('w', { code: 'KeyW' }), s), null)
  assert.equal(act(key(' ', { code: 'Space' }), s), null)
})

test('a token drag wins over a tool drag', () => {
  const s = { tokenDrag: {}, toolDrag: {} }
  assert.deepEqual(act(key('Escape'), s), { action: 'cancelTokenDrag' })
})

test('drags win over popups and Escape closes no popup then', () => {
  assert.equal(act(key('Escape'), { tokenDrag: {}, popup: true }).action, 'cancelTokenDrag')
  assert.equal(act(key('Escape'), { toolDrag: {}, popup: true }).action, 'cancelToolDrag')
})

test('a popup: Escape closes the popups, also with a modifier or in a text field', () => {
  assert.deepEqual(act(key('Escape'), { popup: true }), { action: 'closePopups' })
  assert.equal(
    act(key('Escape', { metaKey: true, target: field }), { popup: true }).action,
    'closePopups',
  )
  // before the dice menu, the Library and the Log
  const s = { popup: true, diceMenu: {}, libraryOpen: true, logOpen: true }
  assert.equal(act(key('Escape'), s).action, 'closePopups')
})

test('a popup: arrow keys step roster cards only with the roster popup', () => {
  const roster = { popup: true, rosterOpen: true }
  assert.deepEqual(act(key('ArrowLeft'), roster), { action: 'cardStep', step: -1 })
  assert.deepEqual(act(key('ArrowRight'), roster), { action: 'cardStep', step: 1 })
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

test('Escape skips the modifier and text field guard', () => {
  assert.equal(act(key('Escape', { target: field })).action, 'escape')
  assert.equal(act(key('Escape', { metaKey: true })).action, 'escape')
  assert.equal(act(key('Escape', { ctrlKey: true, repeat: true })).action, 'escape')
  assert.equal(act(key('Escape', { altKey: true }), { logOpen: true }).action, 'closeLog')
})

test('Cmd, Ctrl, Alt held, or a text field: nothing', () => {
  const keys = [
    ['Delete', 'Delete'],
    ['w', 'KeyW'],
    ['ArrowLeft', 'ArrowLeft'],
    [' ', 'Space'],
    ['q', 'KeyQ'],
    ['f', 'KeyF'],
    ['p', 'KeyP'],
    ['1', 'Digit1'],
    ['6', 'Digit6'],
    ['0', 'Digit0'],
  ]
  for (const [k, code] of keys) {
    assert.ok(act(key(k, { code })), k)
    assert.equal(act(key(k, { code, metaKey: true })), null, 'meta ' + k)
    assert.equal(act(key(k, { code, ctrlKey: true })), null, 'ctrl ' + k)
    assert.equal(act(key(k, { code, altKey: true })), null, 'alt ' + k)
    assert.equal(act(key(k, { code, target: field }), { diceTray: 'host' }), null, 'field ' + k)
  }
})

test('Delete and Backspace delete, also on repeat', () => {
  assert.deepEqual(act(key('Delete')), { action: 'delete' })
  assert.deepEqual(act(key('Backspace', { repeat: true })), { action: 'delete' })
})

test('pan and turn keys are by key code, and also on repeat', () => {
  assert.deepEqual(act(key('w', { code: 'KeyW' })), { action: 'pan', code: 'KeyW' })
  assert.deepEqual(act(key('ц', { code: 'KeyW', repeat: true })), { action: 'pan', code: 'KeyW' })
  assert.deepEqual(act(key('ArrowUp')), { action: 'turn', code: 'ArrowUp' })
  assert.deepEqual(act(key('ArrowLeft', { repeat: true })), { action: 'turn', code: 'ArrowLeft' })
})

test('Space resets the view with preventDefault, on repeat it only prevents the default', () => {
  const first = act(key(' ', { code: 'Space' }))
  assert.deepEqual(first, { action: 'reset', preventDefault: true, first: true })
  const again = act(key(' ', { code: 'Space', repeat: true }))
  assert.deepEqual(again, { action: 'reset', preventDefault: true, first: false })
})

test('Q / E: the held part on repeat, the piece turn on the first press only', () => {
  assert.deepEqual(act(key('q', { code: 'KeyQ' })), { action: 'rotate', code: 'KeyQ', first: true })
  assert.deepEqual(act(key('e', { code: 'KeyE', repeat: true })), {
    action: 'rotate',
    code: 'KeyE',
    first: false,
  })
})

test('first-press keys: F, R, L, P act once, nothing on repeat', () => {
  for (const [code, action] of [
    ['KeyF', 'flip'],
    ['KeyR', 'lift'],
    ['KeyL', 'lock'],
    ['KeyP', 'ping'],
  ]) {
    assert.deepEqual(act(key('x', { code })), { action })
    assert.equal(act(key('x', { code, repeat: true })), null, code)
  }
})

test('tool keys act once: range 1-5, move 7-9, angle 6, clear 0', () => {
  assert.deepEqual(act(key('1')), { action: 'range', value: 1 })
  assert.deepEqual(act(key('5')), { action: 'range', value: 5 })
  assert.deepEqual(act(key('7')), { action: 'move', value: 'short' })
  assert.deepEqual(act(key('8')), { action: 'move', value: 'medium' })
  assert.deepEqual(act(key('9')), { action: 'move', value: 'long' })
  assert.deepEqual(act(key('6')), { action: 'angle' })
  assert.deepEqual(act(key('0')), { action: 'clear' })
  for (const k of ['1', '5', '7', '9', '6', '0'])
    assert.equal(act(key(k, { repeat: true })), null, k)
})

test('dice keys over an own tray win over the tools, also 6 and 0', () => {
  const s = { diceTray: 'guest' }
  assert.deepEqual(act(key('1'), s), { action: 'dice', side: 'guest', count: 1 })
  assert.deepEqual(act(key('5'), s), { action: 'dice', side: 'guest', count: 5 })
  assert.deepEqual(act(key('6'), s), { action: 'dice', side: 'guest', count: 6 })
  assert.deepEqual(act(key('9'), s), { action: 'dice', side: 'guest', count: 9 })
  assert.deepEqual(act(key('0'), s), { action: 'dice', side: 'guest', count: 10 })
  assert.equal(act(key('6', { repeat: true }), s), null)
})

test('other keys do nothing', () => {
  assert.equal(act(key('z', { code: 'KeyZ' })), null)
  assert.equal(act(key('Tab')), null)
  assert.equal(act(key('Enter')), null)
  assert.equal(act(key('8', { code: 'Digit8' }), { diceTray: null }).action, 'move')
})

test('the code tables PAN, TURN, ROTATE, RESET and PRESS do not overlap', () => {
  const tables = {
    PAN: Object.keys(PAN_KEYS),
    TURN: Object.keys(TURN_KEYS),
    ROTATE: Object.keys(ROTATE_KEYS),
    RESET: [RESET_VIEW_KEY],
    PRESS: Object.keys(PRESS_KEYS),
  }
  const seen = new Map()
  for (const [name, codes] of Object.entries(tables)) {
    assert.ok(codes.length > 0, name)
    for (const code of codes) {
      assert.equal(seen.get(code), undefined, `${code} in ${seen.get(code)} and ${name}`)
      seen.set(code, name)
    }
  }
})
