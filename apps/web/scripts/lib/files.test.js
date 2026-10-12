import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { outputPath, readJson, writeJson } from './files.mjs'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'files-test-'))

test('writeJson sorts the keys of an object, adds a newline and keeps arrays', () => {
  const file = path.join(dir, 'a', 'sorted.json')
  writeJson(file, { b: [3, 1, 2], a: 1 })
  const text = fs.readFileSync(file, 'utf8')
  assert.equal(text, '{\n  "a": 1,\n  "b": [\n    3,\n    1,\n    2\n  ]\n}\n')
})

test('writeJson keeps an array and, with sortKeys false, the key order', () => {
  const file = path.join(dir, 'plain.json')
  writeJson(file, [{ b: 1, a: 2 }], { sortKeys: false })
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), [{ b: 1, a: 2 }])
  writeJson(file, [{ b: 1, a: 2 }])
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), [{ b: 1, a: 2 }])
  writeJson(file, { b: 1, a: 2 }, { sortKeys: false })
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, 'utf8'))), ['b', 'a'])
})

test('readJson reads the first file that exists, else {}', () => {
  const file = path.join(dir, 'plain.json')
  assert.deepEqual(readJson(path.join(dir, 'none.json'), file), { b: 1, a: 2 })
  assert.deepEqual(readJson(path.join(dir, 'none.json')), {})
})

test('outputPath creates the folder', () => {
  const full = outputPath(dir, 'x/y/z.bin')
  assert.equal(full, path.join(dir, 'x/y/z.bin'))
  assert.ok(fs.statSync(path.join(dir, 'x/y')).isDirectory())
})
