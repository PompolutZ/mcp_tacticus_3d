import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TRAY_BG_WIDTH,
  TRAY_CARD_HEIGHT,
  gruntsByHost,
  inTrayArea,
  layoutTrays,
  onTray,
  trayCardLocalZ,
  trayControlsLocalZ,
  trayGiveTokenPosition,
  trayGruntSlot,
  trayHeldLocal,
  trayHeldWorld,
  trayModelPosition,
  trayPlate,
  trayPosition,
} from './trays.js'

const near = (actual, expected) =>
  assert.ok(
    actual.every((v, i) => Math.abs(v - expected[i]) < 1e-9),
    `${actual} != ${expected}`,
  )
const char = (id, team = 'host', host) => ({ id, team, ...(host && { host }) })

test('gruntsByHost: grunts in spawn order; a grunt without its host is left out', () => {
  const list = [
    char('h'),
    char('a', 'host', 'h'),
    char('o'),
    char('b', 'host', 'h'),
    char('x', 'host', 'gone'),
  ]
  const map = gruntsByHost(list)
  assert.deepEqual(
    map.get('h').map((c) => c.id),
    ['a', 'b'],
  )
  assert.equal(map.has('gone'), false)
})

test('a grunt card lies below the host card and controls strip, toward the owner', () => {
  const [x, z] = trayGruntSlot(1, 0)
  assert.equal(x, 0)
  // The grunt card is past the host controls strip
  assert.ok(trayCardLocalZ(1) + z > trayControlsLocalZ(1))
  // Two host cards push the grunt block on by one card
  assert.ok(trayGruntSlot(2, 0)[1] > z)
})

test('Sandman: two grunt cards side by side, the second to the owner right', () => {
  const [x0, z0] = trayGruntSlot(1, 0)
  const [x1, z1] = trayGruntSlot(1, 1)
  assert.equal(z0, z1)
  assert.ok(x1 - x0 > 4.5)
})

test('the plate grows toward the owner with a grunt; only two grunts make it wider', () => {
  const none = trayPlate(1)
  const one = trayPlate(1, 1)
  const two = trayPlate(1, 2)
  assert.equal(none.width, TRAY_BG_WIDTH)
  assert.equal(none.x, 0)
  assert.ok(one.depth > none.depth + TRAY_CARD_HEIGHT)
  assert.equal(one.width, TRAY_BG_WIDTH)
  assert.equal(one.x, 0)
  assert.ok(two.width > TRAY_BG_WIDTH + 4.5)
  assert.ok(two.x > 0)
  // The host's left edge stays at the same place
  assert.equal(two.x - two.width / 2, -TRAY_BG_WIDTH / 2)
})

test('the Give sources move past the grunt cards', () => {
  const plain = trayGiveTokenPosition(0, 1)
  const withGrunt = trayGiveTokenPosition(0, 1, 1)
  assert.equal(withGrunt[0], plain[0])
  assert.ok(withGrunt[1] > plain[1] + TRAY_CARD_HEIGHT)
  // Past the last grunt controls strip, so not on the plate
  const plate = trayPlate(1, 1)
  assert.ok(withGrunt[1] > plate.z + plate.depth / 2)
})

test('the grunt model spawns on its card', () => {
  const pos = trayPosition('host', 0, 1)
  const [slotX, slotZ] = trayGruntSlot(1, 1)
  const [x, , z] = trayModelPosition('host', pos, 1, [slotX, slotZ])
  near([x, z], [pos[0] + slotX, pos[2] + trayCardLocalZ(1) + slotZ])
  // Guest tray is turned by 180 degrees
  const guest = trayPosition('guest', 0, 1)
  const [gx, , gz] = trayModelPosition('guest', guest, 1, [slotX, slotZ])
  near([gx, gz], [guest[0] - slotX, guest[2] - (trayCardLocalZ(1) + slotZ)])
})

test('onTray and inTrayArea cover the grunt cards', () => {
  const pos = trayPosition('host', 0, 1)
  const [slotX, slotZ] = trayGruntSlot(1, 1)
  const onGrunt2 = { x: pos[0] + slotX, z: pos[2] + trayCardLocalZ(1) + slotZ }
  assert.equal(onTray('host', pos, onGrunt2, 1, 0), false)
  assert.equal(onTray('host', pos, onGrunt2, 1, 2), true)
  assert.equal(inTrayArea('host', pos, onGrunt2, 0), false)
  assert.equal(inTrayArea('host', pos, onGrunt2, 2), true)
})

test('a token held by a grunt lies on the grunt card', () => {
  const pos = trayPosition('host', 0, 1)
  const slot = trayGruntSlot(1, 0)
  const point = { x: pos[0] + slot[0], z: pos[2] + trayCardLocalZ(1) + slot[1] }
  const local = trayHeldLocal('host', pos, point, slot)
  assert.ok(Math.abs(local[0]) < 0.01)
  const [wx, wz] = trayHeldWorld('host', pos, local, slot)
  assert.ok(Math.abs(wx - point.x) < 0.01 && Math.abs(wz - point.z) < 0.01)
})

test('layoutTrays: a grunt has the position of its host and takes no place in the row', () => {
  const list = [char('a'), char('g', 'host', 'a'), char('b')]
  const pos = layoutTrays(list)
  assert.deepEqual(pos.get('g'), pos.get('a'))
  near(pos.get('a'), trayPosition('host', 0, 2))
  near(pos.get('b'), trayPosition('host', 1, 2))
})

test('layoutTrays: the wide tray of Sandman moves the trays after it, and the row stays centered', () => {
  const list = [char('s'), char('g1', 'host', 's'), char('g2', 'host', 's'), char('b')]
  const pos = layoutTrays(list)
  const plain = layoutTrays([char('s'), char('b')])
  const wide = trayPlate(1, 2).width
  // The next tray starts past the wide plate, with the same gap as between two plates
  const gap = plain.get('b')[0] - plain.get('s')[0] - TRAY_BG_WIDTH
  const right = pos.get('s')[0] - TRAY_BG_WIDTH / 2 + wide
  assert.ok(Math.abs(pos.get('b')[0] - TRAY_BG_WIDTH / 2 - (right + gap)) < 1e-9)
  // The middle of the whole row, plate edges and gaps, is x = 0
  const left = pos.get('s')[0] - TRAY_BG_WIDTH / 2 - gap / 2
  const end = pos.get('b')[0] + TRAY_BG_WIDTH / 2 + gap / 2
  assert.ok(Math.abs(left + end) < 1e-9)
})

test('layoutTrays: the guest row mirrors the host row', () => {
  const mk = (team) => [
    char('s', team),
    char('g1', team, 's'),
    char('g2', team, 's'),
    char('b', team),
  ]
  const host = layoutTrays(mk('host'))
  const guest = layoutTrays(mk('guest'))
  for (const id of ['s', 'b']) {
    assert.ok(Math.abs(host.get(id)[0] + guest.get(id)[0]) < 1e-9)
    assert.ok(Math.abs(host.get(id)[2] + guest.get(id)[2]) < 1e-9)
  }
})

test('layoutTrays: trays without grunts are unchanged', () => {
  const pos = layoutTrays([char('a'), char('b'), char('c'), char('d', 'guest')])
  near(pos.get('a'), trayPosition('host', 0, 3))
  near(pos.get('c'), trayPosition('host', 2, 3))
  near(pos.get('d'), trayPosition('guest', 0, 1))
})
