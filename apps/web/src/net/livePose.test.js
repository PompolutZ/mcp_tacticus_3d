import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cursorStep,
  dragPose,
  followPart,
  isLiveKind,
  lerpAngle,
  numbersToPose,
  poseToNumbers,
  sameNumbers,
  sameSideQuat,
  SUPPLY_YAW,
  tokenDragKey,
} from './livePose.js'

test('followPart: 0 for no time, 1 - e^-1 for one time constant, below 1 always', () => {
  assert.equal(followPart(0), 0)
  assert.ok(Math.abs(followPart(0.05) - (1 - Math.exp(-1))) < 1e-12)
  assert.ok(followPart(10) < 1.0000001)
  assert.ok(followPart(0.02) < followPart(0.04))
})

test('lerpAngle takes the short way across π', () => {
  const a = Math.PI - 0.1
  const b = -Math.PI + 0.1
  const mid = lerpAngle(a, b, 0.5)
  assert.ok(Math.abs(Math.cos(mid) + 1) < 1e-9)
  assert.equal(lerpAngle(1, 2, 0), 1)
  assert.ok(Math.abs(lerpAngle(1, 2, 1) - 2) < 1e-12)
})

test('a model pose goes to numbers, rounded, and back', () => {
  const pose = { x: 1.23456, y: 0.00049, z: -2, qx: 0.123456, qy: 0, qz: 0, qw: 0.99234 }
  const numbers = poseToNumbers('character:a', pose)
  assert.deepEqual(numbers, [1.235, 0, -2, 0.1235, 0, 0, 0.9923])
  assert.deepEqual(numbersToPose('character:a', numbers), {
    x: 1.235,
    y: 0,
    z: -2,
    qx: 0.1235,
    qy: 0,
    qz: 0,
    qw: 0.9923,
  })
})

test('a tool pose goes to numbers, rounded, and back', () => {
  const pose = { x: 1.00049, y: 0.5, z: 3, yaw: 1.234567, right: 0.00004, left: -0.5 }
  const numbers = poseToNumbers('tool:move', pose)
  assert.deepEqual(numbers, [1, 0.5, 3, 1.2346, 0, -0.5])
  assert.deepEqual(numbersToPose('tool:move', numbers), {
    x: 1,
    y: 0.5,
    z: 3,
    yaw: 1.2346,
    right: 0,
    left: -0.5,
  })
})

test('an unknown kind gives null', () => {
  assert.equal(poseToNumbers('dice:a', { x: 1 }), null)
  assert.equal(numbersToPose('dice:a', [1]), null)
  assert.equal(isLiveKind('dice:a'), false)
  assert.equal(isLiveKind('tool:range'), true)
  assert.equal(isLiveKind('character:x'), true)
})

test('sameNumbers: equal after rounding means not moved', () => {
  const a = poseToNumbers('tool:range', { x: 1.0001, y: 0, z: 2, yaw: 0.5, right: 0, left: 0 })
  const b = poseToNumbers('tool:range', { x: 1.0004, y: 0, z: 2, yaw: 0.5, right: 0, left: 0 })
  const c = poseToNumbers('tool:range', { x: 1.002, y: 0, z: 2, yaw: 0.5, right: 0, left: 0 })
  assert.equal(sameNumbers(a, b), true)
  assert.equal(sameNumbers(a, c), false)
  assert.equal(sameNumbers(a, null), false)
  assert.equal(sameNumbers([1], [1, 2]), false)
})

test('sameSideQuat flips a quaternion that points away from the reference', () => {
  assert.equal(sameSideQuat([0, 0, 0, -1], [0, 0, 0, 1])[3], 1)
  assert.deepEqual(sameSideQuat([0, 0, 0, 1], [0, 0, 0, 1]), [0, 0, 0, 1])
})

test('a crisis token pose goes to [x, z, yaw], rounded, and back', () => {
  const numbers = poseToNumbers('token:t1', { x: 1.23456, z: -2.00049, yaw: 1.234567 })
  assert.deepEqual(numbers, [1.235, -2, 1.2346])
  assert.deepEqual(numbersToPose('token:t1', numbers), { x: 1.235, z: -2, yaw: 1.2346 })
})

for (const key of ['loose:a', 'pile:a', 'tactic:a', 'marker:blue', 'marker:red', 'marker:round']) {
  test(`${key}: a flat pose goes to [x, z], rounded, and back`, () => {
    assert.equal(isLiveKind(key), true)
    const numbers = poseToNumbers(key, { x: 3.14159, z: -2.0004 })
    assert.deepEqual(numbers, [3.142, -2])
    assert.deepEqual(numbersToPose(key, numbers), { x: 3.142, z: -2 })
  })
}

test('a wrong count of numbers for a new kind gives no pose', () => {
  assert.equal(poseToNumbers('unknown:a', { x: 1, z: 2 }), null)
  assert.equal(numbersToPose('token:a', null), null)
})

test('cursorStep: hidden gives null without the moved check', () => {
  assert.equal(cursorStep({ hide: true, moved: false }), 'null')
  assert.equal(cursorStep({ hide: true, moved: true }), 'null')
  assert.equal(cursorStep({ hide: false, moved: true }), 'read')
  assert.equal(cursorStep({ hide: false, moved: false }), 'skip')
})

test('tokenDragKey: the key by the kind of token drag', () => {
  const none = { looseId: null, pileId: null, supplyCard: null, pile: false }
  assert.equal(tokenDragKey({ ...none, looseId: 'a' }, null), 'loose:a')
  assert.equal(tokenDragKey({ ...none, pileId: 'b' }, null), 'pile:b')
  assert.equal(tokenDragKey({ ...none, supplyCard: 'c' }, 'n'), 'token:n')
  assert.equal(tokenDragKey({ ...none, pile: true }, 'n'), 'pile:n')
  assert.equal(tokenDragKey(none, 'n'), 'loose:n')
})

test('dragPose: a supply token sends the yaw of its preview, the others only x and z', () => {
  assert.equal(dragPose('loose:a', null), null)
  assert.deepEqual(dragPose('loose:a', { x: 1, y: 2, z: 3 }), { x: 1, z: 3 })
  assert.deepEqual(dragPose('pile:a', { x: 1, y: 2, z: 3 }), { x: 1, z: 3 })
  assert.deepEqual(dragPose('token:a', { x: 1, y: 2, z: 3 }), { x: 1, z: 3, yaw: SUPPLY_YAW })
  assert.notEqual(poseToNumbers('token:a', dragPose('token:a', { x: 1, z: 3 })), null)
})
