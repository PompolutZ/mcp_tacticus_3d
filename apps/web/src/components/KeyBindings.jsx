import { useEffect, useRef, useState } from 'react'
import {
  ACTIONS,
  acceptsInput,
  changedBindings,
  detectMac,
  findConflicts,
  getAction,
  inputFromEvent,
  inputName,
  isModifierCode,
  reservedReason,
  sameBindings,
  boundElsewhere,
} from '../input/bindings.js'

const MAC = detectMac()
const CONDITION_LABELS = {
  anywhere: 'anywhere',
  popup: 'in a popup',
  dragging: 'while dragging',
  overDiceTray: 'over dice tray',
  overPiece: 'over a piece',
}
const GROUPS = [...new Set(ACTIONS.map((a) => a.group))]

// The key table of the Settings popup: one row for each action with its bindings as chips (docs/features/
// key-shortcuts.md, "Changing the keys"). bindings: the bindings in use. onChange(changed): the actions
// that differ from the defaults (changedBindings in input/bindings.js); the settings store them.
export function KeyBindings({ bindings, onChange }) {
  // The action that takes a new binding: { id, stage: 'listen' | 'when', input }
  const [capture, setCapture] = useState(null)
  const [when, setWhen] = useState('anywhere')
  const [message, setMessage] = useState('')
  const boxRef = useRef(null)
  const latest = useRef(null)

  // Removes from the other actions the bindings that take the input of `list` with the same condition.
  // Returns { next, lost }: the new bindings and the labels of the actions that lost one.
  function withoutConflicts(id, list) {
    const next = { ...bindings }
    const lost = []
    for (const binding of list) {
      // The indexes shift after a removal, so look for the next conflict again
      for (let hit = findConflicts(next, binding, id)[0]; hit;) {
        next[hit.id] = next[hit.id].filter((_, i) => i !== hit.index)
        const label = getAction(hit.id).label
        if (!lost.includes(label)) lost.push(label)
        hit = findConflicts(next, binding, id)[0]
      }
    }
    return { next, lost }
  }

  function apply(id, list) {
    const { next, lost } = withoutConflicts(id, list)
    next[id] = list
    onChange(changedBindings(next))
    setMessage(lost.length ? `Removed from ${lost.join(', ')}` : '')
  }

  function add(id, input, condition) {
    const binding = { ...input, when: condition }
    const own = bindings[id]
    setCapture(null)
    if (own.some((b) => sameBindings([b], [binding]))) {
      setMessage('Already bound')
      return
    }
    apply(id, [...own, binding])
  }

  // An input was captured: refuse it, or ask for the condition, or add it
  function finish(input) {
    const reason = reservedReason(input, MAC)
    if (reason) return setMessage(`${reason} Press another key.`)
    if (!acceptsInput(capture.id, input.code))
      return setMessage(
        input.code.startsWith('Wheel')
          ? 'The wheel works only for zoom and for turning a dragged piece. Press a key.'
          : 'This action works only with the wheel. Turn the wheel.',
      )
    const allowed = getAction(capture.id).when
    const first = allowed.includes('anywhere') ? 'anywhere' : allowed[0]
    if (allowed.length === 1) return add(capture.id, input, first)
    setWhen(first)
    setMessage('')
    setCapture({ id: capture.id, stage: 'when', input })
  }
  useEffect(() => {
    latest.current = finish
  })

  // While listening, every key and wheel step is the input. The listeners stop the event, so the keys
  // of the table and the Escape of the popup do not run (App listens on the window, later).
  const listening = capture?.stage === 'listen'
  useEffect(() => {
    if (!listening) return
    // A modifier key alone counts when it is released with no other key pressed meanwhile
    let alone = null
    const stop = (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    const down = (e) => {
      stop(e)
      if (e.repeat) return
      if (isModifierCode(e.code)) {
        const input = inputFromEvent(e)
        alone = input.shift || input.ctrl || input.alt || input.meta ? null : e.code
        return
      }
      alone = null
      latest.current(inputFromEvent(e))
    }
    const up = (e) => {
      stop(e)
      if (alone && alone === e.code) {
        alone = null
        latest.current(inputFromEvent(e))
      }
    }
    const wheel = (e) => {
      stop(e)
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
      if (delta === 0) return
      latest.current({
        code: delta < 0 ? 'WheelUp' : 'WheelDown',
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
      })
    }
    const box = boxRef.current
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    box?.addEventListener('wheel', wheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      box?.removeEventListener('wheel', wheel)
    }
  }, [listening])

  function startCapture(id) {
    setMessage('')
    setCapture({ id, stage: 'listen' })
  }
  function remove(id, index) {
    setMessage('')
    onChange(changedBindings({ ...bindings, [id]: bindings[id].filter((_, i) => i !== index) }))
  }
  function reset(id) {
    apply(
      id,
      getAction(id).keys.map((b) => ({ ...b })),
    )
  }
  function resetAll() {
    setCapture(null)
    setMessage('')
    onChange({})
  }

  return (
    <section className="settings-section">
      <h3>Keys</h3>
      <div className="key-bindings-head">
        <span className="key-bindings-note">
          Click + and press a key or turn the wheel. A key or wheel step can do one thing in one
          place.
        </span>
        <button type="button" className="chip" onClick={resetAll}>
          Reset all keys
        </button>
      </div>
      <div className="key-bindings-message" role="status">
        {message}
      </div>
      {GROUPS.map((group) => (
        <div key={group} className="key-group">
          <h4>{group}</h4>
          {ACTIONS.filter((a) => a.group === group).map((a) => {
            const list = bindings[a.id]
            const active = capture?.id === a.id
            return (
              <div key={a.id} className="key-row">
                <span className="key-label">{a.label}</span>
                <span className="key-chips">
                  {list.map((b, i) => {
                    const name = inputName(b, MAC)
                    const where =
                      b.when !== 'anywhere'
                        ? ` · ${CONDITION_LABELS[b.when]}`
                        : boundElsewhere(bindings, b)
                          ? ' · elsewhere'
                          : ''
                    return (
                      <span key={`${name}-${b.when}`} className="key-chip">
                        {name}
                        {where}
                        <button
                          type="button"
                          aria-label={`Remove ${name}${where} from ${a.label}`}
                          onClick={() => remove(a.id, i)}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  {active && capture.stage === 'listen' && (
                    <span className="key-capture" ref={boxRef}>
                      Press a key or turn the wheel
                    </span>
                  )}
                  {active && capture.stage === 'when' && (
                    <span className="key-capture">
                      {inputName(capture.input, MAC)}
                      <select
                        aria-label={`Where ${inputName(capture.input, MAC)} works`}
                        value={when}
                        onChange={(e) => setWhen(e.target.value)}
                      >
                        {a.when.map((w) => (
                          <option key={w} value={w}>
                            {CONDITION_LABELS[w]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => add(a.id, capture.input, when)}
                      >
                        Add
                      </button>
                    </span>
                  )}
                  {active ? (
                    <button type="button" className="chip" onClick={() => setCapture(null)}>
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="key-add"
                      aria-label={`Add a key to ${a.label}`}
                      onClick={() => startCapture(a.id)}
                    >
                      +
                    </button>
                  )}
                  {!sameBindings(list, a.keys) && (
                    <button type="button" className="chip" onClick={() => reset(a.id)}>
                      Reset
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}
