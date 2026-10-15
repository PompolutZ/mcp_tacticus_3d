// Writes the trimmed Jarvis files that the app imports, from the raw files. No network.
// Run it after a change to src/characters/{immunity,power,size,dropPlacer}.js. See scripts/README.md.

import path from 'node:path'
import { readJson, writeJson } from './lib/files.mjs'
import { trimCharacters, trimCrisis, trimTactics } from './lib/jarvis-trim.mjs'

const src = path.resolve(import.meta.dirname, '../src')

// [raw file, trimmed file, trim function]. The raw files move in the next step.
const JARVIS_FILES = [
  ['characters/jarvis-characters.json', 'characters/jarvis-rows.json', trimCharacters],
  ['tactics/jarvis-tactics-cards.json', 'tactics/jarvis-rows.json', trimTactics],
  ['crisis/jarvis-crisis-cards.json', 'crisis/jarvis-rows.json', trimCrisis],
]

for (const [raw, out, trim] of JARVIS_FILES) {
  const rows = trim(readJson(path.join(src, raw), []))
  writeJson(path.join(src, out), rows, { sortKeys: false })
  console.log(`${out}: ${rows.length} rows`)
}
