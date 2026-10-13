// The actions that a key or the mouse wheel triggers, their default bindings, and the resolver that
// picks the action of an input (docs/features/key-shortcuts.md). No React. keyboard.js (keyAction)
// uses it for every key. The user's changes are in the settings (settings/settings.js, `bindings`).
//
// A binding is { code, shift, ctrl, alt, meta, when }. code: a KeyboardEvent.code, or WheelUp /
// WheelDown. The modifiers match exactly. when: one of CONDITIONS.

// Where a binding works. At an input, the binding whose condition is true now and comes first in this
// list wins. So Digit1 over the own dice tray adds a die, else it spawns Range 1.
// popup: a popup is open. dragging: a piece or tool is dragged. modelDrag: a model is dragged (it is not
// `dragging`, so keys such as Q / E and R still work). overDiceTray: the pointer is over the
// own dice tray. overPiece: the pointer is over a piece. anywhere: always.
export const CONDITIONS = [
  'popup',
  'dragging',
  'modelDrag',
  'overDiceTray',
  'overPiece',
  'anywhere',
]

export const WHEEL_CODES = ['WheelUp', 'WheelDown']
const MODIFIER_CODES = {
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
  ControlLeft: 'ctrl',
  ControlRight: 'ctrl',
  AltLeft: 'alt',
  AltRight: 'alt',
  MetaLeft: 'meta',
  MetaRight: 'meta',
}

// Conditions that make sense for the actions of a group
const TABLE = ['anywhere', 'overPiece', 'overDiceTray']
const WHEN_PIECE = ['anywhere', 'overPiece', 'dragging']
const WHEN_DICE = ['overDiceTray']
const WHEN_CARD = ['popup']
const WHEN_MODEL_DRAG = ['modelDrag']
const WHEN_CANCEL = ['anywhere', 'popup', 'dragging']

const bind = (code, when = 'anywhere', mods = {}) => ({
  code,
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
  ...mods,
  when,
})
// The number row and the number pad both give the key
const digit = (n, when) => [bind(`Digit${n}`, when), bind(`Numpad${n}`, when)]

// Every action. id; label (for the Settings popup); group; when: allowed conditions; keys: default
// bindings. action + the other fields make the result of keyAction (see keyAction in keyboard.js).
// held: the action lasts until the keyup of its key. repeats: acts again on key repeat. first: the
// result says if this is the first press. preventDefault: the browser's own action of the key is stopped.
const A = (id, label, group, when, keys, result) => ({ id, label, group, when, keys, ...result })

export const ACTIONS = [
  A('panUp', 'Pan up', 'Camera', TABLE, [bind('KeyW')], {
    action: 'pan',
    dir: [0, 1],
    held: true,
    repeats: true,
  }),
  A('panDown', 'Pan down', 'Camera', TABLE, [bind('KeyS')], {
    action: 'pan',
    dir: [0, -1],
    held: true,
    repeats: true,
  }),
  A('panLeft', 'Pan left', 'Camera', TABLE, [bind('KeyA')], {
    action: 'pan',
    dir: [-1, 0],
    held: true,
    repeats: true,
  }),
  A('panRight', 'Pan right', 'Camera', TABLE, [bind('KeyD')], {
    action: 'pan',
    dir: [1, 0],
    held: true,
    repeats: true,
  }),
  A('turnUp', 'Turn view up', 'Camera', TABLE, [bind('ArrowUp')], {
    action: 'turn',
    dir: [0, 1],
    held: true,
    repeats: true,
  }),
  A('turnDown', 'Turn view down', 'Camera', TABLE, [bind('ArrowDown')], {
    action: 'turn',
    dir: [0, -1],
    held: true,
    repeats: true,
  }),
  A('turnLeft', 'Turn view left', 'Camera', TABLE, [bind('ArrowLeft')], {
    action: 'turn',
    dir: [-1, 0],
    held: true,
    repeats: true,
  }),
  A('turnRight', 'Turn view right', 'Camera', TABLE, [bind('ArrowRight')], {
    action: 'turn',
    dir: [1, 0],
    held: true,
    repeats: true,
  }),
  A('resetView', 'Reset view', 'Camera', TABLE, [bind('Space')], {
    action: 'reset',
    repeats: true,
    first: true,
    preventDefault: true,
  }),
  // The mouse wheel (WheelCamera.jsx). No key does this today.
  A('zoomIn', 'Zoom in', 'Camera', TABLE, [bind('WheelUp')], { action: 'zoom', dir: 1 }),
  A('zoomOut', 'Zoom out', 'Camera', TABLE, [bind('WheelDown')], { action: 'zoom', dir: -1 }),

  // dir 1 turns the piece counter-clockwise seen from above (turnPiece in Scene.jsx). The wheel turns
  // a dragged piece, as in TTS. Wheel up = left like Q, wheel down = right like E: picked by look, the
  // sources do not say which way TTS turns.
  A(
    'rotateLeft',
    'Turn piece left',
    'Pieces',
    WHEN_PIECE,
    [bind('KeyQ'), bind('WheelUp', 'dragging')],
    {
      action: 'rotate',
      dir: 1,
      held: true,
      repeats: true,
      first: true,
    },
  ),
  A(
    'rotateRight',
    'Turn piece right',
    'Pieces',
    WHEN_PIECE,
    [bind('KeyE'), bind('WheelDown', 'dragging')],
    {
      action: 'rotate',
      dir: -1,
      held: true,
      repeats: true,
      first: true,
    },
  ),
  A('flip', 'Flip', 'Pieces', TABLE, [bind('KeyF')], { action: 'flip' }),
  A('lift', 'Lift', 'Pieces', TABLE, [bind('KeyR')], { action: 'lift' }),
  // R during a model drag: top floor or lower floor under an overhang (CharacterModel.jsx, toggleFloor)
  A('floor', 'Lower floor (model drag)', 'Pieces', WHEN_MODEL_DRAG, [bind('KeyR', 'modelDrag')], {
    action: 'floor',
  }),
  A('lock', 'Lock', 'Pieces', TABLE, [bind('KeyL')], { action: 'lock' }),
  A('delete', 'Delete', 'Pieces', TABLE, [bind('Delete'), bind('Backspace')], {
    action: 'delete',
    repeats: true,
  }),
  A('ping', 'Ping', 'Pieces', TABLE, [bind('KeyP')], { action: 'ping' }),
  // Windows moves the focus to the browser menu on a bare Alt
  A('peek', 'Card peek', 'Pieces', TABLE, [bind('AltLeft'), bind('AltRight')], {
    action: 'peek',
    held: true,
    repeats: true,
    preventDefault: true,
  }),

  ...[1, 2, 3, 4, 5].map((n) =>
    A(`range${n}`, `Range ${n}`, 'Tools', TABLE, digit(n), { action: 'range', value: n }),
  ),
  // Toward / Away, key 6 as in the mod
  A('angle', 'Toward / Away', 'Tools', TABLE, digit(6), { action: 'angle' }),
  A('moveShort', 'Short move', 'Tools', TABLE, digit(7), { action: 'move', value: 'short' }),
  A('moveMedium', 'Medium move', 'Tools', TABLE, digit(8), { action: 'move', value: 'medium' }),
  A('moveLong', 'Long move', 'Tools', TABLE, digit(9), { action: 'move', value: 'long' }),
  A('clearTools', 'Clear tools', 'Tools', TABLE, digit(0), { action: 'clear' }),

  // Over the own dice tray, the number keys add dice. See addDice in DiceTray.jsx.
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
    A(
      `dice${n}`,
      `Add ${n} ${n === 1 ? 'die' : 'dice'}`,
      'Dice',
      WHEN_DICE,
      digit(n, 'overDiceTray'),
      {
        action: 'dice',
        count: n,
      },
    ),
  ),
  A('dice10', 'Add 10 dice', 'Dice', WHEN_DICE, digit(0, 'overDiceTray'), {
    action: 'dice',
    count: 10,
  }),

  A('cancel', 'Cancel / close', 'Other', WHEN_CANCEL, [bind('Escape')], {
    action: 'cancel',
    repeats: true,
  }),
  A('cardPrev', 'Previous card', 'Other', WHEN_CARD, [bind('ArrowLeft', 'popup')], {
    action: 'cardStep',
    step: -1,
    repeats: true,
  }),
  A('cardNext', 'Next card', 'Other', WHEN_CARD, [bind('ArrowRight', 'popup')], {
    action: 'cardStep',
    step: 1,
    repeats: true,
  }),
]

const BY_ID = new Map(ACTIONS.map((a) => [a.id, a]))
export const getAction = (id) => BY_ID.get(id)

// The default bindings: action id → [binding]. A fresh copy.
export function defaultBindings() {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, a.keys.map((b) => ({ ...b }))]))
}

// The bindings in use: the defaults, with the actions the user changed ("overrides": action id →
// [binding]) replaced. An action that is not in overrides keeps its defaults, also a new one.
export function effectiveBindings(overrides) {
  const bindings = defaultBindings()
  for (const id of Object.keys(overrides ?? {})) if (BY_ID.has(id)) bindings[id] = overrides[id]
  return bindings
}

const MODS = ['shift', 'ctrl', 'alt', 'meta']

export function sameInput(a, b) {
  return a.code === b.code && MODS.every((m) => !!a[m] === !!b[m])
}
const sameBinding = (a, b) => sameInput(a, b) && a.when === b.when

export function sameBindings(a, b) {
  return a.length === b.length && a.every((x, i) => sameBinding(x, b[i]))
}

// The overrides to store for bindings in use: only the actions that differ from their defaults
export function changedBindings(bindings) {
  const changed = {}
  for (const a of ACTIONS) {
    const list = bindings[a.id]
    if (list && !sameBindings(list, a.keys)) changed[a.id] = list
  }
  return changed
}

// Other actions that already use the input of `binding` with the same condition: [{ id, index }]. The
// Settings popup removes these and says which action lost the input (decision 6 of the plan).
export function findConflicts(bindings, binding, exceptId) {
  const found = []
  for (const [id, list] of Object.entries(bindings)) {
    if (id === exceptId) continue
    list.forEach((b, index) => {
      if (sameBinding(b, binding)) found.push({ id, index })
    })
  }
  return found
}

// Whether the code is one that a keyboard or the wheel sends
const CODE_PATTERN =
  /^(Key[A-Z]|Digit\d|Numpad(\d|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal)|F([1-9]|1\d|2[0-4])|Arrow(Up|Down|Left|Right)|Space|Enter|Escape|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|IntlBackslash|CapsLock)$/
export function isKnownCode(code) {
  return (
    typeof code === 'string' &&
    (CODE_PATTERN.test(code) || code in MODIFIER_CODES || WHEEL_CODES.includes(code))
  )
}

// A binding from stored data, or null when it is not valid for the action
export function cleanBinding(raw, id) {
  const action = BY_ID.get(id)
  if (!action || !raw || !isKnownCode(raw.code) || !action.when.includes(raw.when)) return null
  return {
    code: raw.code,
    shift: raw.shift === true,
    ctrl: raw.ctrl === true,
    alt: raw.alt === true,
    meta: raw.meta === true,
    when: raw.when,
  }
}

// The input of a keydown event: { code, shift, ctrl, alt, meta }. A modifier key on its own is an input
// too (AltLeft). The browser sets the flag of that modifier on its own keydown (altKey is true when Alt
// goes down), so the flag is cleared: Alt alone is `AltLeft` with no modifier.
export function inputFromEvent(e) {
  const input = {
    code: e.code,
    shift: !!e.shiftKey,
    ctrl: !!e.ctrlKey,
    alt: !!e.altKey,
    meta: !!e.metaKey,
  }
  const own = MODIFIER_CODES[e.code]
  if (own) input[own] = false
  return input
}

// The action of an input: { id, binding } or null. input: { code, shift, ctrl, alt, meta }. now:
// which conditions are true now, { popup, dragging, modelDrag, overDiceTray, overPiece } (anywhere always is).
// bindings: the bindings in use. Modifiers match exactly. Among the bindings of the input that fit,
// the first condition in CONDITIONS wins; within one condition, the first action in ACTIONS.
export function match(input, now, bindings = defaultBindings()) {
  let best = null
  let bestRank = CONDITIONS.length
  for (const a of ACTIONS) {
    for (const b of bindings[a.id] ?? []) {
      if (!sameInput(b, input)) continue
      if (b.when !== 'anywhere' && !now[b.when]) continue
      const rank = CONDITIONS.indexOf(b.when)
      if (rank < bestRank) {
        best = { id: a.id, binding: b }
        bestRank = rank
      }
    }
  }
  return best
}

// The id of the action of an input, or null
export function resolve(input, now, bindings) {
  return match(input, now, bindings)?.id ?? null
}

// Whether an action can take an input. The wheel only zooms or turns a dragged piece (WheelCamera.jsx),
// and zoom has no key handler, so zoom takes the wheel only and only the turn takes both.
export function acceptsInput(id, code) {
  const action = BY_ID.get(id)
  if (!action) return false
  const wheel = WHEEL_CODES.includes(code)
  if (action.action === 'zoom') return wheel
  if (wheel) return action.action === 'rotate'
  return true
}

// Combos that the browser or the system keeps: the page never gets them. Shift and Alt do not matter.
export const RESERVED = [
  ...['KeyW', 'KeyQ', 'KeyT', 'KeyN', 'Tab', 'KeyH', 'KeyM'].map((code) => ({ code, meta: true })),
  ...['KeyW', 'KeyT', 'KeyN', 'Tab'].map((code) => ({ code, ctrl: true })),
]

// The reason why an input cannot be bound, or null. Ctrl + wheel is the pinch zoom (decision 9).
export function reservedReason(input, mac = false) {
  const wheel = WHEEL_CODES.includes(input.code)
  if (wheel && input.ctrl) return 'Ctrl + wheel is the pinch zoom of the browser.'
  const hit = RESERVED.some(
    (r) => r.code === input.code && !!r.meta === input.meta && !!r.ctrl === input.ctrl,
  )
  return hit ? `${inputName(input, mac)} is kept by the browser or the system.` : null
}

const NAMED_CODES = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Enter: 'Enter',
  Tab: 'Tab',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page up',
  PageDown: 'Page down',
  CapsLock: 'Caps lock',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .',
  NumpadEnter: 'Num Enter',
  NumpadEqual: 'Num =',
  WheelUp: 'Wheel up',
  WheelDown: 'Wheel down',
}

const MOD_NAMES = {
  mac: { shift: '⇧', ctrl: '⌃', alt: '⌥', meta: '⌘' },
  other: { shift: 'Shift', ctrl: 'Ctrl', alt: 'Alt', meta: 'Win' },
}

// Whether this is a Mac (the modifier symbols). Read once by the caller.
export function detectMac() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')
}

// The name of a key code, for a chip: KeyQ → Q, Digit1 → 1, Numpad1 → Num 1, AltLeft → Left Alt
export function codeName(code, mac = false) {
  if (NAMED_CODES[code]) return NAMED_CODES[code]
  let m = /^Key([A-Z])$/.exec(code) ?? /^Digit(\d)$/.exec(code)
  if (m) return m[1]
  m = /^Numpad(\d)$/.exec(code)
  if (m) return `Num ${m[1]}`
  m = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code)
  if (m) {
    const mod = { Shift: 'shift', Control: 'ctrl', Alt: 'alt', Meta: 'meta' }[m[1]]
    return `${m[2] === 'Left' ? 'Left' : 'Right'} ${MOD_NAMES[mac ? 'mac' : 'other'][mod]}`
  }
  return code
}

// The name of an input with its modifiers: ⌘W on a Mac, Ctrl+W elsewhere
export function inputName(input, mac = false) {
  const names = MOD_NAMES[mac ? 'mac' : 'other']
  const order = ['ctrl', 'alt', 'shift', 'meta']
  const mods = order.filter((m) => input[m]).map((m) => names[m])
  const key = codeName(input.code, mac)
  return mac ? mods.join('') + key : [...mods, key].join('+')
}

// A modifier key on its own is an input too (AltLeft). True for the codes of the modifier keys.
export function isModifierCode(code) {
  return code in MODIFIER_CODES
}
