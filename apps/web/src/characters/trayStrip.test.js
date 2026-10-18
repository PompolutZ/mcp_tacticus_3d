import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripLayout } from './trayStrip.js'
import { GRUNT_CARD_WIDTH, TRAY_CONTROLS_DEPTH, TRAY_WIDTH } from './trays.js'

const overlap = (a, b) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-9 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 1e-9

function check(layout, width) {
  const { elements } = layout
  for (const e of elements) {
    assert.ok(Math.abs(e.x) + e.w / 2 <= width / 2 + 1e-9, `${e.id} inside the width`)
    assert.ok(Math.abs(e.y) + e.h / 2 <= TRAY_CONTROLS_DEPTH / 2 + 1e-9, `${e.id} inside the depth`)
  }
  for (let i = 0; i < elements.length; i++)
    for (let j = i + 1; j < elements.length; j++)
      assert.ok(!overlap(elements[i], elements[j]), `${elements[i].id} and ${elements[j].id}`)
}

test('the strip of a character fits the tray, with and without gems', () => {
  check(stripLayout({}), TRAY_WIDTH)
  check(stripLayout({ gems: ['Soul Gem'] }), TRAY_WIDTH)
  check(stripLayout({ gems: ['Soul Gem', 'Power Gem'] }), TRAY_WIDTH)
})

test('the strip of a grunt fits the grunt card and has Damage and Remove only', () => {
  const layout = stripLayout({ grunt: true })
  check(layout, GRUNT_CARD_WIDTH)
  assert.deepEqual(
    layout.elements.map((e) => e.id),
    ['damage', 'remove'],
  )
})

test('Flip is on the left and Remove on the right', () => {
  const byId = Object.fromEntries(stripLayout({}).elements.map((e) => [e.id, e]))
  assert.ok(byId.flip.x < 0 && byId.remove.x > 0)
  assert.ok(byId.damage.x < byId.power.x)
})
