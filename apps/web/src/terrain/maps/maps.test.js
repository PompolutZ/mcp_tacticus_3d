import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { matImage } from '../files.js'
import { TERRAIN_PIECES } from '../pieces.js'
import { MAPS } from './index.js'

const FILES = fs.readdirSync(import.meta.dirname).filter((f) => f.endsWith('.json'))
const vec = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite)

function checkPlacement(where, p, known) {
  assert.ok(known(p.piece), `${where}: unknown piece ${p.piece}`)
  assert.ok(vec(p.position, 3), `${where}: position`)
  assert.ok(vec(p.rotation, 3), `${where}: rotation`)
  assert.ok(Number.isFinite(p.scale) || vec(p.scale, 3), `${where}: scale`)
  if (p.size !== undefined) assert.ok(Number.isInteger(p.size), `${where}: size`)
  if (p.tint !== undefined) assert.ok(vec(p.tint, 3), `${where}: tint`)
  if (p.note !== undefined) assert.equal(typeof p.note, 'string', `${where}: note`)
}

test('every JSON file is in MAPS, under its id', () => {
  assert.deepEqual(Object.keys(MAPS).sort(), FILES.map((f) => f.replace(/\.json$/, '')).sort())
  for (const [key, map] of Object.entries(MAPS)) assert.equal(map.id, key)
})

test('every map has the fields of the format', () => {
  for (const map of Object.values(MAPS)) {
    assert.equal(typeof map.name, 'string', map.id)
    assert.equal(typeof map.mat, 'string', map.id)
    assert.ok(Number.isFinite(map.matRotation), `${map.id}: matRotation`)
    assert.ok(Array.isArray(map.placements) && map.placements.length > 0, `${map.id}: placements`)
    if (map.ttsMap !== undefined) assert.ok(Number.isInteger(map.ttsMap), `${map.id}: ttsMap`)
    if (map.note !== undefined) assert.equal(typeof map.note, 'string', `${map.id}: note`)
    map.placements.forEach((p, i) =>
      checkPlacement(`${map.id} placement ${i}`, p, (k) => k in TERRAIN_PIECES),
    )
    // A skipped placement has no piece in the app, so its key is free
    ;(map.skipped ?? []).forEach((p, i) => checkPlacement(`${map.id} skipped ${i}`, p, Boolean))
  }
})

test('every mat has an image', () => {
  const assets = new URL('../../assets/', import.meta.url)
  for (const map of Object.values(MAPS))
    assert.ok(fs.existsSync(new URL(matImage(map.mat), assets)), `${map.id}: ${map.mat}`)
})
