// Writes the trimmed Jarvis files that the app imports, from the raw files. No network.
// Run it after a change to src/characters/{immunity,power,size,dropPlacer}.js. See scripts/README.md.

import path from 'node:path'
import { readJson, writeJson } from './lib/files.mjs'
import { trimCharacters, trimCrisis, trimTactics } from './lib/jarvis-trim.mjs'

const here = import.meta.dirname

// [raw file, trimmed file, trim function].
const JARVIS_FILES = [
  ['jarvis/characters.json', '../src/characters/jarvis-rows.json', trimCharacters],
  ['jarvis/tactics-cards.json', '../src/tactics/jarvis-rows.json', trimTactics],
  ['jarvis/crisis-cards.json', '../src/crisis/jarvis-rows.json', trimCrisis],
]

for (const [raw, out, trim] of JARVIS_FILES) {
  const rows = trim(readJson(path.join(here, raw), []))
  writeJson(path.join(here, out), rows, { sortKeys: false })
  console.log(
    `${path.relative(path.resolve(here, '..'), path.join(here, out))}: ${rows.length} rows`,
  )
}
