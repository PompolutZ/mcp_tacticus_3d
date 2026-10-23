import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buttonSize, snapEndButtons } from './buttonLayout.js'
import { MOVE_TIP, RANGE_TIP, RANGE_HALF_WIDTH } from './toolTips.js'
import { MOVE_HALF_WIDTH } from './toolGeometry.js'

// Boxes { x, z, along, across } of the buttons at the snapped end of one tool
function boxes({ tip, halfWidth, side, across, bendable = false, rangeOne = false }) {
  const spots = snapEndButtons({ tip, halfWidth, side, across, bendable, rangeOne })
  const toolWidth = 2 * halfWidth
  const sizes = {
    unsnap: { toolWidth, alongTool: rangeOne },
    throwPush: { toolWidth, lines: 2 },
    placeOne: { toolWidth, alongTool: true },
  }
  return Object.entries(spots).map(([name, at]) => ({ name, ...at, ...buttonSize(sizes[name]) }))
}

const overlap = (a, b) =>
  Math.abs(a.x - b.x) < (a.along + b.along) / 2 && Math.abs(a.z - b.z) < (a.across + b.across) / 2

// The tool half-length ends at tip, and the half-width limits z
function check(tool) {
  const list = boxes(tool)
  const sign = tool.side === 'right' ? 1 : -1
  for (const b of list) {
    // On the tool, at the snapped end: the outer edge of the button is inside the tip
    assert.ok(b.x * sign + b.along / 2 <= tool.tip, `${b.name} past the tip`)
    assert.ok(b.x * sign - b.along / 2 >= 0, `${b.name} past the hinge`)
    assert.ok(Math.abs(b.z) + b.across / 2 <= tool.halfWidth + 1e-9, `${b.name} off the width`)
    // The snapped end is the half `side`
    assert.ok(b.x * sign > 0, `${b.name} on the other half`)
  }
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      assert.ok(!overlap(list[i], list[j]), `${list[i].name} overlaps ${list[j].name}`)
  return list
}

test('Unsnap does not overlap Throw / Push on a movement tool, both sides', () => {
  for (const tip of Object.values(MOVE_TIP))
    for (const side of ['right', 'left']) {
      const list = check({ tip, halfWidth: MOVE_HALF_WIDTH, side, bendable: true })
      assert.deepEqual(list.map((b) => b.name).sort(), ['throwPush', 'unsnap'])
    }
})

test('Unsnap on a movement tool stays off the hinge (Bend button) at the center', () => {
  const BEND_RADIUS = 0.28
  for (const tip of Object.values(MOVE_TIP)) {
    const unsnap = boxes({ tip, halfWidth: MOVE_HALF_WIDTH, side: 'right', bendable: true }).find(
      (b) => b.name === 'unsnap',
    )
    assert.ok(unsnap.x - unsnap.along / 2 > BEND_RADIUS)
  }
})

test('Unsnap on a range tool lies on the snapped end', () => {
  for (const tip of Object.values(RANGE_TIP))
    for (const side of ['right', 'left']) {
      const [b] = check({ tip, halfWidth: RANGE_HALF_WIDTH, side })
      assert.equal(b.name, 'unsnap')
    }
})

test('Unsnap does not overlap Place 1 on R1, whichever long side touches the base', () => {
  for (const across of [1, -1])
    for (const side of ['right', 'left']) {
      const list = check({
        tip: RANGE_TIP[2],
        halfWidth: RANGE_HALF_WIDTH,
        side,
        across,
        rangeOne: true,
      })
      assert.equal(list.length, 2)
    }
})
