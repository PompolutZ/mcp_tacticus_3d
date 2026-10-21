import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Box3, Vector3 } from 'three'
import {
  boardIdFromName,
  boardPieces,
  newIdSuffix,
  editStoredPiece,
  unlockedView,
  validateBoard,
  movePlacement,
  newPlacement,
  pieceGroups,
  turnPlacement,
} from './builder.js'
import { MATS } from './catalog.js'
import { MAP_ID_PATTERN, exportMap } from './exportMap.js'
import { TERRAIN_PIECES } from './pieces.js'
import { MAPS } from './maps/index.js'
import { IMPORT_ROTATION, restY, toThreeTransform } from './placementMove.js'

// The lowest world y (relative to the mat top) of a box after the placement transform, by brute force
function bottomOnMat(box, placement) {
  const { position, quaternion } = toThreeTransform(placement)
  const [sx, sy, sz] = Array.isArray(placement.scale)
    ? placement.scale
    : Array(3).fill(placement.scale)
  const ys = []
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const v = new Vector3(x, y, z)
        v.applyAxisAngle(new Vector3(0, 1, 0), IMPORT_ROTATION[1])
        v.multiply(new Vector3(sx, sy, sz)).applyQuaternion(quaternion)
        ys.push(v.y + position[1])
      }
  return Math.min(...ys)
}

// A mesh with its origin in the middle: half of it is under y 0
const MIDDLE = new Box3(new Vector3(-1, -2, -1), new Vector3(1, 2, 1))
const PIECE = { key: 'p', size: 2, scale: 1.5, tint: undefined }

test('a new piece rests with the bottom of its mesh on the mat top', () => {
  const p = newPlacement(PIECE, 'a', MIDDLE)
  assert.ok(Math.abs(bottomOnMat(MIDDLE, p)) < 1e-9)
})

test('the rest height follows the scale and the turn', () => {
  for (const scale of [0.5, 1, [1, 2, 1]]) {
    for (const rotation of [
      [0, 0, 0],
      [90, 30, 0],
      [0, 0, 180],
    ]) {
      const p = { ...newPlacement({ ...PIECE, scale }, 'a', MIDDLE), rotation }
      p.position[1] = restY(MIDDLE, p)
      assert.ok(Math.abs(bottomOnMat(MIDDLE, p)) < 1e-9)
    }
  }
})

test('a mesh that starts at its origin rests lower than one centered on it', () => {
  const standing = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 4, 1))
  const a = newPlacement(PIECE, 'a', standing)
  const b = newPlacement(PIECE, 'b', MIDDLE)
  assert.ok(a.position[1] < b.position[1])
})

test('a move keeps the height and the other pieces', () => {
  const a = newPlacement(PIECE, 'a', MIDDLE)
  const b = newPlacement(PIECE, 'b', MIDDLE)
  const list = movePlacement([a, b], 'a', 3, 4)
  assert.equal(list[0].position[1], a.position[1])
  assert.equal(list[0].position[0], a.position[0] + 3)
  assert.notEqual(list[0].rev, a.rev)
  assert.equal(list[1], b)
  assert.equal(a.position[0], 0)
})

test('turn changes the Y rotation only', () => {
  const a = newPlacement(PIECE, 'a', MIDDLE)
  const b = newPlacement(PIECE, 'b', MIDDLE)
  const list = [a, b]
  const turned = turnPlacement(list, 'b', 1)
  assert.deepEqual(turned[1].rotation, [0, 345, 0])
  assert.deepEqual(turned[0], a)
})

test('the filter keeps the groups that have a match', () => {
  const all = pieceGroups('')
  assert.ok(all.length > 0)
  const none = pieceGroups('zzzzzz-no-piece')
  assert.equal(none.length, 0)
  const first = all[0].pieces[0].name
  for (const g of pieceGroups(` ${first.toUpperCase()} `)) {
    assert.ok(g.pieces.every((p) => p.name.toLowerCase().includes(first.toLowerCase())))
  }
})

const KEY = Object.keys(TERRAIN_PIECES)[0]
const good = () => ({
  id: 'x',
  name: 'X',
  mat: MATS[0].name,
  matRotation: 90,
  placements: [{ piece: KEY, position: [1, 2, 3], rotation: [0, 45, 0], scale: 1.5, size: 2 }],
})

test('import check: a good file gives the board', () => {
  const { board, error } = validateBoard(good())
  assert.equal(error, undefined)
  assert.equal(board.mat, MATS[0].name)
  assert.equal(board.matRotation, 90)
  assert.equal(board.placements.length, 1)
  const stored = boardPieces(board, () => 'new')
  assert.equal(stored[0].id, 'new')
  assert.equal(stored[0].piece, KEY)
  assert.equal(stored[0].locked, true)
})

test('import check: an export of a map is a good file', () => {
  const map = Object.values(MAPS)[0]
  assert.equal(validateBoard(JSON.parse(JSON.stringify(map))).error, undefined)
})

test('import check: bad shapes are refused with a message', () => {
  for (const data of [null, [], 'x', 5]) assert.ok(validateBoard(data).error)
  const bad = (change) => validateBoard(change(good())).error
  assert.ok(bad((d) => ({ ...d, placements: 'no' })))
  assert.ok(bad((d) => ({ ...d, matRotation: 'x' })))
  assert.ok(bad((d) => ({ ...d, placements: [null] })))
  assert.ok(bad((d) => ({ ...d, placements: [{ ...d.placements[0], position: [1, 2] }] })))
  assert.ok(bad((d) => ({ ...d, placements: [{ ...d.placements[0], rotation: [0, NaN, 0] }] })))
  assert.ok(bad((d) => ({ ...d, placements: [{ ...d.placements[0], scale: 'big' }] })))
})

test('import check: an unknown piece key or mat is refused', () => {
  assert.match(
    validateBoard({ ...good(), placements: [{ ...good().placements[0], piece: 'no-such' }] }).error,
    /unknown piece/,
  )
  assert.ok(
    validateBoard({ ...good(), placements: [{ ...good().placements[0], piece: 'toString' }] })
      .error,
  )
  assert.match(validateBoard({ ...good(), mat: 'No such mat' }).error, /Unknown mat/)
  assert.ok(validateBoard({ ...good(), mat: undefined }).error)
})

test('a move of a map piece makes a custom piece with the same id and lock; the rest stays', () => {
  const mapId = Object.keys(MAPS)[0]
  const other = { id: 'b', index: 1, locked: true }
  const stored = [{ id: 'a', index: 0, locked: true, y: 0.5 }, other]
  const out = editStoredPiece(mapId, stored, 'a', (l) => movePlacement(l, 'a', 2, 0))
  const base = MAPS[mapId].placements[0].position
  assert.equal(out[0].id, 'a')
  assert.equal(out[0].locked, true)
  assert.equal(out[0].index, undefined)
  assert.equal(out[0].y, undefined)
  assert.deepEqual(out[0].position, [base[0] + 2, 0.5, base[2]])
  assert.equal(out[1], other)
})

test('Build mode unlocks the view only: the stored pieces keep their lock', () => {
  const locked = { ...newPlacement(PIECE, 'a', MIDDLE), locked: true }
  const open = { ...newPlacement(PIECE, 'b', MIDDLE), locked: false }
  const view = unlockedView([locked, open])
  assert.equal(view[0].locked, false)
  assert.equal(view[1], open)
  assert.equal(locked.locked, true)
  assert.equal(unlockedView([locked])[0], view[0])
})

test('boardIdFromName: slug, hyphen runs, trimmed, cut, suffix kept', () => {
  assert.equal(boardIdFromName('My  Cool Map!', 'k3x9'), 'my-cool-map-k3x9')
  assert.equal(boardIdFromName('  --Ünï--  ', 'k3x9'), 'n-k3x9')
  assert.equal(boardIdFromName('!!!', 'k3x9'), 'k3x9')
  assert.equal(boardIdFromName('', 'k3x9'), 'k3x9')
  const long = boardIdFromName('a'.repeat(39) + ' bbbbbb', 'k3x9')
  assert.equal(long, `${'a'.repeat(39)}-k3x9`)
  // Same suffix: renaming changes the slug only
  assert.ok(boardIdFromName('One', 'ab12').endsWith('-ab12'))
  assert.ok(boardIdFromName('Two', 'ab12').endsWith('-ab12'))
  assert.equal(boardIdFromName('One', 'ab12'), boardIdFromName('One', 'ab12'))
})

test('ids from boardIdFromName and newIdSuffix match MAP_ID_PATTERN', () => {
  for (const name of ['x', 'Hello World', '123', '---', 'Ab_Cd', 'z'.repeat(100)]) {
    const suffix = newIdSuffix()
    assert.match(suffix, /^[a-z0-9]{4}$/)
    assert.match(boardIdFromName(name, suffix), MAP_ID_PATTERN)
  }
})

test('validateBoard keeps a string author, else empty', () => {
  const base = { mat: MATS[0].name, placements: [] }
  assert.equal(validateBoard({ ...base, author: 'Al' }).board.author, 'Al')
  assert.equal(validateBoard({ ...base, author: 5 }).board.author, '')
})

test('exportMap writes author after name, only when set', () => {
  const state = { id: 'a', name: 'A', author: 'Al', mat: 'm', matRotation: 0, placements: [] }
  assert.deepEqual(Object.keys(exportMap(state)), [
    'id',
    'name',
    'author',
    'mat',
    'matRotation',
    'placements',
  ])
  assert.equal('author' in exportMap({ ...state, author: '' }), false)
})
