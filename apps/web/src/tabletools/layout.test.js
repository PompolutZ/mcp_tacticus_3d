import test from 'node:test'
import assert from 'node:assert/strict'
import { TABLE_DEPTH, TABLE_WIDTH } from '../table.js'
import { TEAMS } from '../setup/setup.js'
import {
  boardStrip,
  edgeControls,
  onRack,
  powerButton,
  rackPlate,
  rackSlots,
  rackYaw,
  squadPanel,
} from './layout.js'
import { crisisRowLayout, rosterLayout } from '../rosters/layout.js'
import {
  layoutTrays,
  TRAY_BG_WIDTH,
  trayGiveTokenPosition,
  trayPlate,
} from '../characters/trays.js'
import { KEYS_LIP, TRAYS } from '../dice/tray.js'
import { TOKEN_SIZE } from '../tokens/files.js'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CARD_Z,
  CRISIS_TOKEN_SIZE,
  supplyPilePosition,
} from '../crisis/layout.js'
import {
  BOARD_HALF_LENGTH,
  BOARD_HALF_WIDTH,
  BOARD_X,
  PRIORITY_MARKER_SIZE,
  priorityMarkerSpot,
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
    out[`slot ${slot.key}`] = rect(slot.x, slot.z, slot.sizeX, slot.sizeZ)
  return out
}

// What lies elsewhere on the table, for both sides: name -> rectangle
function others() {
  const out = {
    // Up to the outer edge of the keys lip (z 17.02)
    'blue dice tray': { x0: 20.25, x1: 33.75, z0: 1.7, z1: 17.02 },
    'red dice tray': { x0: 20.25, x1: 33.75, z0: -17.02, z1: -1.7 },
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

const plate2 = trayPlate(2)

test('every piece lies inside the table', () => {
  for (const side of TEAMS) {
    for (const [name, r] of Object.entries(pieces(side))) assert.ok(inside(r), `${side} ${name}`)
  }
})

// The keys lip low edge of the host dice tray in world z
const KEYS_LIP_Z = TRAYS.host.position.z - KEYS_LIP.low.z

test('the rack lies in front of the dice tray keys lip, centered on the tray', () => {
  for (const side of TEAMS) {
    const k = side === 'host' ? 1 : -1
    const plate = rackPlate(side)
    const tray = TRAYS[side].position
    assert.equal(plate.x, tray.x)
    const near = k * plate.z - plate.depth / 2
    assert.ok(Math.abs(near - (KEYS_LIP_Z + 0.3)) < 1e-9, `${side} ${near}`)
    assert.ok(plate.width <= KEYS_LIP.width)
  }
  assert.ok(Math.abs(KEYS_LIP_Z - 17.02) < 1e-9)
})

test('a row of 7 character trays does not touch the rack, with the Give sources', () => {
  for (const side of TEAMS) {
    const plate = rect(
      rackPlate(side).x,
      rackPlate(side).z,
      rackPlate(side).width,
      rackPlate(side).depth,
    )
    const characters = Array.from({ length: 7 }, (_, i) => ({ id: i, team: side }))
    for (const pos of layoutTrays(characters).values()) {
      const tray = rect(
        pos[0],
        pos[2] + plate2.z * (side === 'host' ? 1 : -1),
        TRAY_BG_WIDTH,
        plate2.depth,
      )
      assert.ok(!overlap(plate, tray), `${side} tray ${pos[0]}`)
      // Give sources lie in two rows past the plate
      const give = rect(
        pos[0],
        pos[2] + (side === 'host' ? 1 : -1) * (trayGiveTokenPosition(6, 2)[1] - 1),
        TRAY_BG_WIDTH,
        TOKEN_SIZE * 2,
      )
      assert.ok(!overlap(plate, give), `${side} give ${pos[0]}`)
    }
  }
})

test('a row of 8 trays reaches under the rack plate (the rack draws above it)', () => {
  // The plate is the only part of the rack that meets trays; 8 trays do overlap it, as the request accepts
  const characters = Array.from({ length: 8 }, (_, i) => ({ id: i, team: 'host' }))
  const plate = rect(
    rackPlate('host').x,
    rackPlate('host').z,
    rackPlate('host').width,
    rackPlate('host').depth,
  )
  const reaches = [...layoutTrays(characters).values()].some((pos) =>
    overlap(plate, rect(pos[0], pos[2] + plate2.z, TRAY_BG_WIDTH, plate2.depth)),
  )
  assert.ok(reaches)
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
      const r = rect(slot.x, slot.z, slot.sizeX, slot.sizeZ)
      assert.ok(
        r.x0 >= plate.x0 && r.x1 <= plate.x1 && r.z0 >= plate.z0 && r.z1 <= plate.z1,
        slot.key,
      )
    }
    const all = slots.map((s) => [s.key, rect(s.x, s.z, s.sizeX, s.sizeZ)])
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        assert.ok(!overlap(all[i][1], all[j][1]), `${side} ${all[i][0]} overlaps ${all[j][0]}`)
      }
    }
  }
})

test('blue columns read (R1, L), (R2, M), (R3, S), (R4, T/A), (R5) from the owner left (-x), mat side first', () => {
  const slots = rackSlots('host')
  const columns = []
  for (const slot of [...slots].sort((a, b) => a.x - b.x || a.z - b.z)) {
    const last = columns.at(-1)
    if (last && Math.abs(last[0].x - slot.x) < 1e-9) last.push(slot)
    else columns.push([slot])
  }
  assert.deepEqual(
    columns.map((column) => column.map((s) => s.key)),
    [['r1', 'l'], ['r2', 'm'], ['r3', 's'], ['r4', 'ta'], ['r5']],
  )
})

test('the tools lie along z, the chips are 2" x 1" with the long side along x', () => {
  for (const slot of rackSlots('host')) {
    if (slot.kind === 'chip') {
      assert.equal(slot.sizeX, 2)
      assert.equal(slot.sizeZ, 1)
    } else {
      assert.equal(slot.sizeZ, slot.length)
      assert.equal(slot.sizeX, slot.width)
    }
  }
})

test('the gap in a column is 0.4" and the margin 0.3"', () => {
  const plate = rect(
    rackPlate('host').x,
    rackPlate('host').z,
    rackPlate('host').width,
    rackPlate('host').depth,
  )
  const slots = rackSlots('host')
  const r1 = slots.find((s) => s.key === 'r1')
  const l = slots.find((s) => s.key === 'l')
  assert.ok(Math.abs(r1.z - r1.sizeZ / 2 - (plate.z0 + 0.3)) < 1e-9)
  assert.ok(Math.abs(l.z - l.sizeZ / 2 - (r1.z + r1.sizeZ / 2 + 0.4)) < 1e-9)
  const r5 = slots.find((s) => s.key === 'r5')
  assert.ok(Math.abs(r5.z + r5.sizeZ / 2 + 0.3 - plate.z1) < 1e-9)
})

test('red is the blue rack mirrored in z (x stays on the dice tray), turned 180 deg', () => {
  const blue = rackSlots('host')
  const red = rackSlots('guest')
  const centerX = rackPlate('host').x
  assert.equal(rackPlate('guest').x, centerX)
  blue.forEach((slot, i) => {
    assert.equal(red[i].key, slot.key)
    assert.ok(Math.abs(red[i].x - centerX + (slot.x - centerX)) < 1e-9)
    assert.ok(Math.abs(red[i].z + slot.z) < 1e-9)
  })
  assert.equal(powerButton('guest').x, -powerButton('host').x)
  assert.equal(powerButton('guest').width, powerButton('host').width)
  assert.equal(powerButton('guest').z, -powerButton('host').z)
  const strip = boardStrip('guest')
  assert.equal(strip.x, boardStrip('host').x)
  assert.equal(strip.z, -boardStrip('host').z)
  assert.equal(rackYaw('host'), 0)
  assert.equal(rackYaw('guest'), Math.PI)
})

const powerRect = (side) => {
  const p = powerButton(side)
  return rect(p.x, p.z, p.width, p.depth)
}

test('the Power button lies inside the table, left of the tactic tray (host: -x)', () => {
  for (const side of TEAMS) assert.ok(inside(powerRect(side)), side)
  const power = powerButton('host')
  const tray = tacticTrayPosition('host')
  assert.equal(power.z, tray.z)
  assert.ok(power.x + power.width / 2 < tray.x - TACTIC_PLATE_WIDTH / 2)
  assert.ok(powerButton('guest').x > 0)
})

// Everything else that lies near the table edge of `side`, with the setup rows and full rosters: name ->
// rectangle. The roster cards of a full roster (12 characters, 5 tactics, 5 + 5 crisis cards), the crisis
// rows, the board strip, the dice trays, the rack, the character trays (12 per row).
function crowded(side) {
  const parsed = {
    characters: Array.from({ length: 12 }, (_, i) => ({ code: `c${i}`, gems: [] })),
    tactics: Array.from({ length: 5 }, (_, i) => `t${i}`),
  }
  const codes = ['a', 'b', 'c', 'd', 'e']
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
  const strip = boardStrip(side)
  rest['board strip'] = rect(strip.x, strip.z, strip.width, strip.length)
  const plate = rackPlate(side)
  rest['rack plate'] = rect(plate.x, plate.z, plate.width, plate.depth)
  for (const pos of layoutTrays(
    Array.from({ length: 12 }, (_, i) => ({ id: i, team: side })),
  ).values()) {
    const p2 = trayPlate(2)
    rest[`tray ${pos[0]}`] = rect(
      pos[0],
      pos[2] + p2.z * (side === 'host' ? 1 : -1),
      TRAY_BG_WIDTH,
      p2.depth,
    )
  }
  return rest
}

test('the Power button does not overlap the rest of the table or the setup', () => {
  for (const side of TEAMS) {
    const mine = powerRect(side)
    for (const [name, o] of Object.entries(crowded(side)))
      assert.ok(!overlap(mine, o), `${side} power overlaps ${name}`)
  }
})

const edgeRect = (side) => {
  const e = edgeControls(side)
  return rect(e.x, e.z, e.width, e.depth)
}

test('the edge controls lie inside the table, on the owner side, and mirror for red', () => {
  for (const side of TEAMS) assert.ok(inside(edgeRect(side)), side)
  const blue = edgeControls('host')
  const red = edgeControls('guest')
  assert.ok(blue.z > 0 && red.z < 0)
  assert.equal(red.x, -blue.x)
  assert.equal(red.z, -blue.z)
  assert.equal(red.width, blue.width)
})

test('the edge controls lie in the start view, right of the tactic tray (host: +x)', () => {
  // The start view meets the table at z 37.47 with half width 23.4" (docs/plans/table-tools.md)
  for (const side of TEAMS) {
    const r = edgeRect(side)
    const k = side === 'host' ? 1 : -1
    assert.ok(Math.abs(r.x0) <= 20 && Math.abs(r.x1) <= 20, side)
    assert.ok(Math.abs(r.z0) <= 34 && Math.abs(r.z1) <= 34, side)
    const tray = tacticTrayPosition(side)
    assert.ok(k * (edgeControls(side).x - tray.x) > TACTIC_PLATE_WIDTH / 2, side)
    assert.equal(edgeControls(side).z, tray.z)
    // Between the mat edge (18) and the tactic plate's outer z, on the owner's side
    assert.ok(k * (k > 0 ? r.z0 : r.z1) > 18, side)
  }
})

test('the edge controls do not overlap the rest of the table, the Power button or the setup', () => {
  for (const side of TEAMS) {
    const mine = edgeRect(side)
    const rest = { ...crowded(side), 'power button': powerRect(side) }
    for (const [name, o] of Object.entries(rest))
      assert.ok(!overlap(mine, o), `${side} edge controls overlap ${name}`)
    // The other side's pieces too
    const far = side === 'host' ? 'guest' : 'host'
    for (const [name, o] of Object.entries(crowded(far)))
      assert.ok(!overlap(mine, o), `${side} edge controls overlap ${far} ${name}`)
  }
})

test('onRack: a point on the plate of a side is on that rack only', () => {
  assert.ok(onRack('host', { x: 27, z: 22 }))
  assert.ok(!onRack('guest', { x: 27, z: 22 }))
  assert.ok(onRack('guest', { x: 30, z: -25 }))
  assert.ok(!onRack('host', { x: 0, z: 22 }))
  assert.ok(!onRack('host', { x: 27, z: 17 }))
  assert.ok(!onRack('host', { x: 27, z: 28.5 }))
})

const squadRect = (side, compact = false) => {
  const q = squadPanel(side, compact)
  return rect(q.x, q.z, q.width, q.depth)
}

test('the squad panel lies under the roster rows, in the start view, and mirrors for red', () => {
  const blue = squadPanel('host')
  const red = squadPanel('guest')
  assert.equal(red.z, -blue.z)
  assert.equal(red.width, blue.width)
  assert.equal(blue.x, 0)
  for (const side of TEAMS) {
    for (const compact of [false, true]) {
      const r = squadRect(side, compact)
      const k = side === 'host' ? 1 : -1
      assert.ok(inside(r), side)
      // Start view: bottom edge at z 37.47, half width 23.4 (docs/plans/table-tools.md)
      assert.ok(Math.max(Math.abs(r.z0), Math.abs(r.z1)) <= 37.4, side)
      assert.ok(Math.abs(r.x0) <= 23 && Math.abs(r.x1) <= 23, side)
      // Past the Team Tactic row (host: larger z)
      assert.ok(k * (k > 0 ? r.z0 : r.z1) >= 29.5, side)
    }
  }
})

test('the squad panel does not overlap the full roster rows, the rack, the Power button or the edge controls', () => {
  for (const side of TEAMS) {
    const base = { 'power button': powerRect(side), 'edge controls': edgeRect(side) }
    // The largest roster: 10 characters, 10 tactics
    const parsed = {
      characters: Array.from({ length: 10 }, (_, i) => ({ code: `c${i}`, gems: [] })),
      tactics: Array.from({ length: 10 }, (_, i) => `t${i}`),
    }
    for (const card of rosterLayout(side, parsed))
      base[`big roster ${card.code}`] = rect(card.x, card.z, card.width, card.height)
    // The full panel shows before the squad is placed: no character trays yet
    const full = { ...crowded(side), ...base }
    for (const name of Object.keys(full)) if (name.startsWith('tray ')) delete full[name]
    for (const [name, o] of Object.entries(full))
      assert.ok(!overlap(squadRect(side), o), `${side} squad panel overlaps ${name}`)
    // The compact panel (placed squad, other player) also clears the trays
    for (const [name, o] of Object.entries({ ...crowded(side), ...base }))
      assert.ok(!overlap(squadRect(side, true), o), `${side} compact squad panel overlaps ${name}`)
  }
})

const priorityRect = (side) => {
  const spot = priorityMarkerSpot(side)
  return rect(spot.x, spot.z, PRIORITY_MARKER_SIZE, PRIORITY_MARKER_SIZE)
}

test('the Priority marker spots lie inside the table and mirror each other', () => {
  const host = priorityMarkerSpot('host')
  const guest = priorityMarkerSpot('guest')
  assert.equal(guest.x, host.x)
  assert.equal(guest.z, -host.z)
  for (const side of TEAMS) assert.ok(inside(priorityRect(side)), side)
})

test('the Priority marker spots are by the end of the scoring board, on its own side', () => {
  assert.ok(priorityMarkerSpot('host').z > BOARD_HALF_LENGTH)
  assert.ok(priorityMarkerSpot('guest').z < -BOARD_HALF_LENGTH)
})

test('no Priority marker spot overlaps another part of the table', () => {
  const rest = { ...others() }
  for (const type of Object.keys(CARD_Z)) {
    const pile = supplyPilePosition(type)
    rest[`supply pile ${type}`] = rect(pile.x, pile.z, CRISIS_TOKEN_SIZE, CRISIS_TOKEN_SIZE)
  }
  for (const side of TEAMS) {
    const marker = priorityRect(side)
    for (const [name, r] of Object.entries(rest)) {
      assert.ok(!overlap(marker, r), `${side} marker overlaps ${name}`)
    }
    for (const owner of TEAMS) {
      for (const [name, r] of Object.entries(pieces(owner))) {
        assert.ok(!overlap(marker, r), `${side} marker overlaps ${owner} ${name}`)
      }
    }
  }
})
