import test from 'node:test'
import assert from 'node:assert/strict'
import { TABLE_DEPTH, TABLE_WIDTH } from '../table.js'
import { TEAMS } from '../setup/setup.js'
import { boardStrip, onRack, powerButton, rackPlate, rackSlots, rackYaw } from './layout.js'
import { crisisRowLayout, rosterLayout } from '../rosters/layout.js'
import {
  layoutTrays,
  TRAY_BG_WIDTH,
  trayGiveTokenPosition,
  trayPlate,
  trayPosition,
  traySpareModelPosition,
} from '../characters/trays.js'
import { TOKEN_SIZE } from '../tokens/files.js'
import { CARD_HEIGHT, CARD_WIDTH, CARD_Z } from '../crisis/layout.js'
import {
  BOARD_HALF_LENGTH,
  BOARD_HALF_WIDTH,
  BOARD_X,
  VP_MARKERS,
  VP_MARKER_SIZE,
} from '../scoreboard/board.js'
import { TACTIC_PLATE_DEPTH, TACTIC_PLATE_WIDTH, tacticTrayPosition } from '../tactics/layout.js'

// A rectangle { x0, x1, z0, z1 } from a center and a size
const rect = (x, z, width, depth) => ({
  x0: x - width / 2,
  x1: x + width / 2,
  z0: z - depth / 2,
  z1: z + depth / 2,
})
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1
const inside = (a) =>
  a.x0 >= -TABLE_WIDTH / 2 &&
  a.x1 <= TABLE_WIDTH / 2 &&
  a.z0 >= -TABLE_DEPTH / 2 &&
  a.z1 <= TABLE_DEPTH / 2

// The pieces of one side: name -> rectangle
function pieces(side) {
  const plate = rackPlate(side)
  const strip = boardStrip(side)
  const out = {
    'rack plate': rect(plate.x, plate.z, plate.width, plate.depth),
    'board strip': rect(strip.x, strip.z, strip.width, strip.length),
  }
  for (const slot of rackSlots(side))
    out[`slot ${slot.key}`] = rect(slot.x, slot.z, slot.length, slot.width)
  return out
}

// What lies elsewhere on the table, for both sides: name -> rectangle
function others() {
  const out = {
    'blue dice tray': { x0: 20.25, x1: 33.75, z0: 1.7, z1: 18.5 },
    'red dice tray': { x0: 20.25, x1: 33.75, z0: -18.5, z1: -1.7 },
    'scoring board': rect(BOARD_X, 0, BOARD_HALF_WIDTH * 2, BOARD_HALF_LENGTH * 2),
    // The drawn crisis cards and the deck rows of the setup: from the card place on to the far end
    'setup blue': { x0: -35, x1: -20.7, z0: 12.55, z1: 27.5 },
    'setup red': { x0: -35, x1: -20.7, z0: -27.5, z1: -12.55 },
  }
  for (const [type, z] of Object.entries(CARD_Z)) {
    out[`crisis card ${type}`] = rect(BOARD_X, z, CARD_HEIGHT, CARD_WIDTH)
  }
  for (const side of TEAMS) {
    const tray = tacticTrayPosition(side)
    out[`tactic tray ${side}`] = rect(tray.x, tray.z, TACTIC_PLATE_WIDTH, TACTIC_PLATE_DEPTH)
    const vp = VP_MARKERS[side].start
    out[`vp marker ${side}`] = rect(vp.x, vp.z, VP_MARKER_SIZE, VP_MARKER_SIZE)
  }
  return out
}

// The z of the deepest tray part of blue: the plate of a tray with two cards plus the Give sources
// in two rows
const trayPos = trayPosition('blue', 0, 1)
const plate2 = trayPlate(2)
const PLATE_END = trayPos[2] + plate2.z + plate2.depth / 2
const GIVE_END = trayPos[2] + trayGiveTokenPosition(6, 2)[1] + TOKEN_SIZE / 2

test('every piece lies inside the table', () => {
  for (const side of TEAMS) {
    for (const [name, r] of Object.entries(pieces(side))) assert.ok(inside(r), `${side} ${name}`)
  }
})

test('the rack starts past the deepest tray parts', () => {
  assert.ok(PLATE_END < GIVE_END)
  for (const [name, r] of Object.entries(pieces('blue'))) {
    if (name === 'board strip') continue
    assert.ok(r.z0 > GIVE_END, `${name}: ${r.z0} <= ${GIVE_END}`)
  }
  // A spare model after one row of Give sources (Hulkbuster, 1" radius) also ends before the rack
  const spare = traySpareModelPosition('blue', trayPos, 1, 6, 1)
  assert.ok(spare[2] + 1 < rackPlate('blue').z - rackPlate('blue').depth / 2)
})

test('the row of the character trays can be 12 trays wide without meeting the rack', () => {
  const characters = Array.from({ length: 12 }, (_, i) => ({ id: i, teamColor: 'blue' }))
  for (const pos of layoutTrays(characters).values()) {
    assert.ok(
      pos[2] + plate2.z + plate2.depth / 2 < rackPlate('blue').z - rackPlate('blue').depth / 2,
    )
  }
})

test('no piece overlaps another part of the table', () => {
  const rest = others()
  for (const side of TEAMS) {
    for (const [name, r] of Object.entries(pieces(side))) {
      for (const [otherName, o] of Object.entries(rest)) {
        assert.ok(!overlap(r, o), `${side} ${name} overlaps ${otherName}`)
      }
    }
  }
})

test('the slots of a rack lie on the plate and do not overlap each other ', () => {
  for (const side of TEAMS) {
    const plate = pieces(side)['rack plate']
    const slots = rackSlots(side)
    for (const slot of slots) {
      const r = rect(slot.x, slot.z, slot.length, slot.width)
      assert.ok(
        r.x0 >= plate.x0 && r.x1 <= plate.x1 && r.z0 >= plate.z0 && r.z1 <= plate.z1,
        slot.key,
      )
    }
    const all = slots.map((s) => [s.key, rect(s.x, s.z, s.length, s.width)])
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        assert.ok(!overlap(all[i][1], all[j][1]), `${side} ${all[i][0]} overlaps ${all[j][0]}`)
      }
    }
  }
})

test('blue row 1 reads R1, R2..R5 from the owner left (-x), row 2 S, M, L, T/A', () => {
  const slots = rackSlots('blue')
  const row1 = slots.filter((s) => s.z < 35.5).sort((a, b) => a.x - b.x)
  assert.deepEqual(
    row1.map((s) => s.key),
    ['r1', 'r2', 'r3', 'r4', 'r5'],
  )
  const row2 = slots.filter((s) => s.z > 35.5).sort((a, b) => a.x - b.x)
  assert.deepEqual(
    row2.map((s) => s.key),
    ['s', 'm', 'l', 'ta'],
  )
})

test('red is the mirror of blue, turned 180 deg', () => {
  const blue = rackSlots('blue')
  const red = rackSlots('red')
  blue.forEach((slot, i) => {
    assert.equal(red[i].key, slot.key)
    assert.ok(Math.abs(red[i].x + slot.x) < 1e-9)
    assert.ok(Math.abs(red[i].z + slot.z) < 1e-9)
  })
  assert.equal(powerButton('red').x, -powerButton('blue').x)
  assert.equal(powerButton('red').width, powerButton('blue').width)
  assert.equal(powerButton('red').z, -powerButton('blue').z)
  const strip = boardStrip('red')
  assert.equal(strip.x, boardStrip('blue').x)
  assert.equal(strip.z, -boardStrip('blue').z)
  assert.equal(rackYaw('blue'), 0)
  assert.equal(rackYaw('red'), Math.PI)
})

const powerRect = (side) => {
  const p = powerButton(side)
  return rect(p.x, p.z, p.width, p.depth)
}

test('the Power button lies inside the table, left of the tactic tray (blue: -x)', () => {
  for (const side of TEAMS) assert.ok(inside(powerRect(side)), side)
  const power = powerButton('blue')
  const tray = tacticTrayPosition('blue')
  assert.equal(power.z, tray.z)
  assert.ok(power.x + power.width / 2 < tray.x - TACTIC_PLATE_WIDTH / 2)
  assert.ok(powerButton('red').x > 0)
})

test('the Power button does not overlap the rest of the table or the setup', () => {
  // The roster cards of a full roster (10 characters, 5 tactics, 5 + 5 crisis cards), and the crisis rows
  const parsed = {
    characters: Array.from({ length: 12 }, (_, i) => ({ code: `c${i}`, gems: [] })),
    tactics: Array.from({ length: 5 }, (_, i) => `t${i}`),
  }
  const codes = ['a', 'b', 'c', 'd', 'e']
  for (const side of TEAMS) {
    const mine = powerRect(side)
    const rest = { ...others() }
    delete rest[`tactic tray ${side}`]
    rest[`tactic plate ${side}`] = (() => {
      const t = tacticTrayPosition(side)
      return rect(t.x, t.z, TACTIC_PLATE_WIDTH, TACTIC_PLATE_DEPTH)
    })()
    for (const card of rosterLayout(side, parsed))
      rest[`roster ${card.code}`] = rect(card.x, card.z, card.width, card.height)
    for (const type of ['secure', 'extract'])
      for (const drawn of [false, true])
        for (const card of crisisRowLayout(side, type, codes, drawn))
          rest[`crisis ${type} ${drawn} ${card.code}`] = rect(
            card.x,
            card.z,
            Math.abs(Math.cos(card.yaw)) > 0.5 ? card.width : card.height,
            Math.abs(Math.cos(card.yaw)) > 0.5 ? card.height : card.width,
          )
    // The board strip, the dice trays, the rack, the character trays (12 per row)
    const strip = boardStrip(side)
    rest['board strip'] = rect(strip.x, strip.z, strip.width, strip.length)
    const plate = rackPlate(side)
    rest['rack plate'] = rect(plate.x, plate.z, plate.width, plate.depth)
    for (const pos of layoutTrays(
      Array.from({ length: 12 }, (_, i) => ({ id: i, teamColor: side })),
    ).values()) {
      const p2 = trayPlate(2)
      rest[`tray ${pos[0]}`] = rect(
        pos[0],
        pos[2] + p2.z * (side === 'blue' ? 1 : -1),
        TRAY_BG_WIDTH,
        p2.depth,
      )
    }
    for (const [name, o] of Object.entries(rest))
      assert.ok(!overlap(mine, o), `${side} power overlaps ${name}`)
  }
})

test('onRack: a point on the plate of a side is on that rack only', () => {
  assert.ok(onRack('blue', { x: 0, z: 35 }))
  assert.ok(!onRack('red', { x: 0, z: 35 }))
  assert.ok(onRack('red', { x: 5, z: -36 }))
  assert.ok(!onRack('blue', { x: 16, z: 35 }))
  assert.ok(!onRack('blue', { x: 0, z: 33.9 }))
  assert.ok(!onRack('blue', { x: 0, z: 37 }))
})
