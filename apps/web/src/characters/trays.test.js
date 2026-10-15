import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GRUNT_CARD_HEIGHT,
  GRUNT_CARD_LOCAL_Z,
  GRUNT_CARD_WIDTH,
  GRUNT_CONTROLS_LOCAL_Z,
  TRAY_BG_WIDTH,
  gruntsByHost,
  inTrayArea,
  layoutTrays,
  onTray,
  trayControlsLocalZ,
  trayGiveTokenPosition,
  trayGruntHeldCardPoint,
  trayGruntHeldClamp,
  trayGruntHeldLocal,
  trayGruntModelPosition,
  trayGruntOnTokenPosition,
  trayGruntSlot,
  trayHeldWorld,
  trayPlate,
  trayPosition,
  trayShapeOf,
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

test('the grunt card is portrait, the aspect of its 808x1404 image, at the width of a crisis card', () => {
  assert.equal(GRUNT_CARD_WIDTH, 2.75)
  assert.ok(Math.abs(GRUNT_CARD_WIDTH / GRUNT_CARD_HEIGHT - 808 / 1404) < 1e-9)
  assert.ok(GRUNT_CARD_HEIGHT > GRUNT_CARD_WIDTH)
})

test('a grunt unit lies below the host card and controls strip, toward the owner', () => {
  const [x, z] = trayGruntSlot(1, 0)
  assert.equal(x, 0)
  // The grunt card starts past the host controls strip
  const hostEnd = trayControlsLocalZ(1) + 0.75
  assert.ok(GRUNT_CARD_LOCAL_Z + z - GRUNT_CARD_HEIGHT / 2 > hostEnd)
  // Two host cards push the grunt block on by one card
  assert.ok(trayGruntSlot(2, 0)[1] > z)
  // The unit has the grunt card, then its controls strip
  assert.ok(GRUNT_CONTROLS_LOCAL_Z > GRUNT_CARD_LOCAL_Z + GRUNT_CARD_HEIGHT / 2)
})

test('Sandman: two portrait grunt cards side by side, with a gap', () => {
  const [x0, z0] = trayGruntSlot(1, 0)
  const [x1, z1] = trayGruntSlot(1, 1)
  assert.equal(z0, z1)
  assert.ok(x1 - x0 > GRUNT_CARD_WIDTH)
})

test('the plate grows toward the owner with a grunt; only two grunts make it wider', () => {
  const none = trayPlate(1)
  const one = trayPlate(1, 1)
  const two = trayPlate(1, 2)
  assert.equal(none.width, TRAY_BG_WIDTH)
  assert.equal(none.x, 0)
  assert.ok(one.depth > none.depth + GRUNT_CARD_HEIGHT)
  assert.equal(one.width, TRAY_BG_WIDTH)
  assert.equal(one.x, 0)
  assert.ok(two.width > TRAY_BG_WIDTH)
  assert.ok(two.x > 0)
  // The host's left edge stays at the same place
  assert.ok(Math.abs(two.x - two.width / 2 + TRAY_BG_WIDTH / 2) < 1e-9)
  // The second grunt card lies on the plate
  const [x1] = trayGruntSlot(1, 1)
  assert.ok(x1 + GRUNT_CARD_WIDTH / 2 <= two.x + two.width / 2)
})

test('the Give sources move past the grunt block', () => {
  const plain = trayGiveTokenPosition(0, 1)
  const withGrunt = trayGiveTokenPosition(0, 1, 1)
  assert.equal(withGrunt[0], plain[0])
  assert.ok(withGrunt[1] > plain[1] + GRUNT_CARD_HEIGHT)
  // Past the last grunt controls strip, so not on the plate
  const plate = trayPlate(1, 1)
  assert.ok(withGrunt[1] > plate.z + plate.depth / 2)
})

test('the grunt model spawns on the center of its card', () => {
  const pos = trayPosition('host', 0, 1)
  const [slotX, slotZ] = trayGruntSlot(1, 1)
  const [x, , z] = trayGruntModelPosition('host', pos, 1, 1)
  near([x, z], [pos[0] + slotX, pos[2] + GRUNT_CARD_LOCAL_Z + slotZ])
  // Guest tray is turned by 180 degrees
  const guest = trayPosition('guest', 0, 1)
  const [gx, , gz] = trayGruntModelPosition('guest', guest, 1, 1)
  near([gx, gz], [guest[0] - slotX, guest[2] - (GRUNT_CARD_LOCAL_Z + slotZ)])
})

test('onTray and inTrayArea cover the grunt cards', () => {
  const pos = trayPosition('host', 0, 1)
  const [x, , z] = trayGruntModelPosition('host', pos, 1, 1)
  const onGrunt2 = { x, z }
  assert.equal(onTray('host', pos, onGrunt2, 1, 0), false)
  assert.equal(onTray('host', pos, onGrunt2, 1, 2), true)
  assert.equal(inTrayArea('host', pos, onGrunt2, 0), false)
  assert.equal(inTrayArea('host', pos, onGrunt2, 2), true)
  // The edge of the second card is on the plate too
  assert.equal(onTray('host', pos, { x: x + GRUNT_CARD_WIDTH / 2 - 0.01, z }, 1, 2), true)
})

test('a token held by a grunt is clamped to the portrait grunt card', () => {
  const pos = trayPosition('host', 0, 1)
  const slot = trayGruntSlot(1, 0)
  const center = trayGruntModelPosition('host', pos, 1, 0)
  const local = trayGruntHeldLocal('host', pos, { x: center[0], z: center[2] }, slot)
  near(local, [0, GRUNT_CARD_LOCAL_Z])
  const [wx, wz] = trayHeldWorld('host', pos, local, slot)
  near([wx, wz], [center[0], center[2]])
  // Far off the card: inside the card edges, with the radius of the token
  const far = trayGruntHeldClamp([50, GRUNT_CARD_LOCAL_Z + 50])
  near(far, [GRUNT_CARD_WIDTH / 2 - 0.5, GRUNT_CARD_LOCAL_Z + GRUNT_CARD_HEIGHT / 2 - 0.5])
  // The card point of the center is the middle of the image
  const { u, v } = trayGruntHeldCardPoint(local)
  near([u, v], [0.5, 0.5])
})

test('the On row of a grunt is as wide as its card', () => {
  const [x0] = trayGruntOnTokenPosition(0, 1)
  assert.ok(Math.abs(x0 + GRUNT_CARD_WIDTH / 2 - 0.375) < 1e-9)
  const [last] = trayGruntOnTokenPosition(5, 6)
  assert.ok(last + 0.375 <= GRUNT_CARD_WIDTH / 2 + 1e-9)
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

test('trayShapeOf: a host, a grunt (slot and index), a grunt whose host is gone', () => {
  const h = { ...char('h'), transform: { card: true } }
  const a = char('a', 'host', 'h')
  const b = char('b', 'host', 'h')
  const x = char('x', 'host', 'gone')
  const list = [h, a, b, x]
  const grunts = gruntsByHost(list)
  assert.deepEqual(trayShapeOf(h, list, grunts), { cards: 2, grunts: 2, index: 0, slot: [0, 0] })
  assert.deepEqual(trayShapeOf(a, list, grunts), {
    cards: 2,
    grunts: 2,
    index: 0,
    slot: trayGruntSlot(2, 0),
  })
  assert.deepEqual(trayShapeOf(b, list, grunts), {
    cards: 2,
    grunts: 2,
    index: 1,
    slot: trayGruntSlot(2, 1),
  })
  // The host is not in the list: the grunt is taken as its own host, with no grunt list
  assert.deepEqual(trayShapeOf(x, list, grunts), {
    cards: 1,
    grunts: 0,
    index: 0,
    slot: trayGruntSlot(1, 0),
  })
})
