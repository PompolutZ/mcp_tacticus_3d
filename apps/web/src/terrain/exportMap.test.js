import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { MAPS } from './maps/index.js'
import { MATS } from './catalog.js'
import { exportMap, exportMapText, mapToState, MAP_ID_PATTERN } from './exportMap.js'

const DIR = path.join(import.meta.dirname, 'maps')

test('load then export without changes gives the file of each map, byte for byte', () => {
  for (const map of Object.values(MAPS)) {
    let n = 0
    const state = mapToState(map, () => `id${n++}`)
    const file = fs.readFileSync(path.join(DIR, `${map.id}.json`), 'utf8')
    assert.equal(exportMapText(state), file, map.id)
  }
})

test('page-only fields are dropped, values are rounded, empty fields are left out', () => {
  const out = exportMap({
    id: 'x',
    name: 'X',
    mat: MATS[0].name,
    matRotation: MATS[0].rotation,
    placements: [
      {
        id: 'a',
        rev: 2,
        locked: false,
        piece: 'p',
        position: [1.23456, 2, 3],
        rotation: [0, 14.999, 0],
        scale: 1,
      },
    ],
  })
  assert.deepEqual(Object.keys(out), ['id', 'name', 'mat', 'matRotation', 'placements'])
  assert.deepEqual(out.placements[0], {
    piece: 'p',
    position: [1.235, 2, 3],
    rotation: [0, 15, 0],
    scale: 1,
  })
})

test('map id pattern is kebab-case', () => {
  for (const id of Object.keys(MAPS)) assert.match(id, MAP_ID_PATTERN)
  for (const bad of ['', 'A-b', 'a--b', '-a', 'a_b', 'a b'])
    assert.doesNotMatch(bad, MAP_ID_PATTERN)
})
