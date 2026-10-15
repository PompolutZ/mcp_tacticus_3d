// Migrates the character tokens of the TTS mod (tokenDatabase rows of type Condition, Status, Personal and Only
// Status, plus the "1 Power" row, plus every token that a released tactic card names) to src/assets/tokens/. Writes the app data to src/tokens/tokens.json, and the
// source URLs to scripts/token-manifest.json. See scripts/README.md and docs/features/character-trays.md, "Tokens from
// the TTS mod".

import path from 'node:path'
import { parseMigrateArgs } from './lib/cli.mjs'
import { readJson, writeJson } from './lib/files.mjs'
import { uniqueKeys } from './lib/keys.mjs'
import { createImageStore } from './lib/manifest.mjs'
import { loadCrisisDatabase, loadTacticCards } from './lib/tts.mjs'
import { characterToken } from '../src/tokens/files.js'

const USAGE = `Usage:
  node scripts/migrate-tokens.mjs --list   character tokens of the mod and their status
  node scripts/migrate-tokens.mjs          convert every token that has its file in the TTS cache
Options:
  --force       convert files again, even if token-manifest.json lists them
  --out <dir>   trial run: write assets to <dir>/assets, and the manifest and tokens.json to <dir>, not to the repo`

const { opts } = parseMigrateArgs(USAGE)

// Width of a token on the table that the mod gives no size for, in inches (TOKEN_SIZE of src/tokens/files.js)
const DEFAULT_SIZE = 0.75
// Tokens are small icons, not card art: 256 is already larger than the mod's cached originals (225-375 px)
const TOKEN_SIZE = 256
// Tokens that a tactic card collects in a number on the card or on the table (not on a character): they get
// collect: true and build a counted pile, see docs/features/team-tactic-cards.md, "Collected tokens". Keys.
const COLLECT_KEYS = [
  'sleuthevidence',
  'sleuthconfession',
  'memory',
  'genetic-sample',
  '1-damage',
  '1-power',
  // The 6 dice results: Cosmic Awareness holds a token of each result
  'hit',
  'crit',
  'fail',
  'wild',
  'shield',
  'blank',
]
const MANIFEST_FILE = path.join(import.meta.dirname, 'token-manifest.json')
const DATA_DIR = path.resolve(import.meta.dirname, '../src/tokens')
const OUT_DIR = opts.out ? path.resolve(opts.out) : null
const MANIFEST_OUT = OUT_DIR ? path.join(OUT_DIR, 'token-manifest.json') : MANIFEST_FILE
const TOKENS_OUT = path.join(OUT_DIR ?? DATA_DIR, 'tokens.json')
const ASSETS = OUT_DIR
  ? path.join(OUT_DIR, 'assets')
  : path.resolve(import.meta.dirname, '../src/assets')
// "1 Power" is the only Misc row the app uses: the icon of the tray's Power counter (see TrayControls.jsx).
// It lives in the mod at token/misc/tracker/, next to Activated and Dazed, but it is not a token players give
// to a character, so it gets its own "counter" group, kept out of the Tokens panel and out of drops.
const MISC_ROWS = ['1 Power']
// Misc rows in token/misc/tracker/ that are counters, not tokens for a character. "1 Damage" is here because the
// card Steal the Future names it: it gets a pile like the tokens of other tactic cards.
const COUNTER_ROWS = ['1 Power', '1 Damage']

const { tokens } = loadCrisisDatabase()
// Names are compared in lower case: a card row says "KickEm" or "Kickem" where the token row has its own spelling
const tacticTokenNames = new Set(
  loadTacticCards()
    .filter((c) => c.released)
    .flatMap((c) => c.tokens ?? [])
    .map((n) => n.toLowerCase()),
)
const rows = tokens.filter(selected)
const keys = uniqueKeys(rows, { noun: 'tokens' })
// A trial run continues from its own manifest, if an earlier trial run into the same directory wrote it
const manifest = readJson(MANIFEST_OUT, MANIFEST_FILE)
const { available, migrated, convert } = createImageStore({
  assets: ASSETS,
  manifest,
  force: opts.force,
  maxSize: TOKEN_SIZE,
})

if (opts.list) listTokens()
else process.exitCode = migrate()

// Which rows of tokenDatabase this script migrates, see docs/features/character-trays.md, "Tokens from the TTS mod".
// A row with altName is a second art of the same token (the old round design); only the first art is migrated.
function selected(row) {
  if (row.altName) return false
  // The tokens of a Team Tactic card, of any type (Misc, Use Tools, Pile, ...): the app puts a pile of them on the
  // table with the card, see docs/features/team-tactic-cards.md, "Token piles"
  if (tacticTokenNames.has(row.name.toLowerCase())) return true
  switch (row.tType) {
    case 'Condition':
      return ['condition', 'dice'].includes(groupPath(row)) // dice: the 6 results, token/dice/
    case 'Status':
      return true
    case 'Personal':
      return true
    case 'Only Status':
      return groupPath(row) === 'tactic' // not the 3 rows in token/misc/
    case 'Misc':
      return MISC_ROWS.includes(row.name)
    default:
      return false // Secure/Extract/Source/Objective/Affiliation/Use Tools/Pile/Unused/Experiment
  }
}

// group: condition, dice (Hit, Crit, ...), status (Activated, Dazed, 1 Power), character or tactic, from the folder of the mod's url,
// see docs/features/character-trays.md, "Tokens from the TTS mod"
function groupPath(row) {
  return row.url.split('/token/')[1].replace(/\/[^/]+$/, '')
}

function group(row) {
  if (COUNTER_ROWS.includes(row.name)) return 'counter'
  const g = {
    condition: 'condition',
    dice: 'dice',
    'misc/tracker': 'status',
    character: 'character',
    tactic: 'tactic',
  }[groupPath(row)]
  if (!g)
    throw new Error(
      `the token "${row.name}" is in token/${groupPath(row)}/, which no group maps to`,
    )
  return g
}

function listTokens() {
  console.log('Character tokens of the mod. Missing: files that TTS has not downloaded.\n')
  const sorted = [...rows].sort(
    (a, b) => group(a).localeCompare(group(b)) || a.name.localeCompare(b.name),
  )
  for (const row of sorted) {
    const f = { file: characterToken(keys.get(row)), url: row.url }
    const status = available(f) ? (migrated(f) ? 'migrated' : 'cached') : 'missing'
    console.log(
      `${keys.get(row).padEnd(28)} ${group(row).padEnd(9)} ${row.name.padEnd(28)} ${status}`,
    )
  }
}

// Returns the process exit code
function migrate() {
  const results = []
  const done = []
  for (const row of [...rows].sort((a, b) => keys.get(a).localeCompare(keys.get(b)))) {
    const key = keys.get(row)
    const f = { file: characterToken(key), url: row.url }
    if (!available(f)) {
      results.push({ key, row, status: 'missing in TTS cache' })
      continue
    }
    results.push({ key, row, status: convert(f) ? 'converted' : 'already migrated' })
    done.push({ key, row, f })
  }

  const newManifest = {}
  for (const { f } of done) newManifest[f.file] = f.url
  writeJson(MANIFEST_OUT, newManifest)
  writeJson(TOKENS_OUT, Object.fromEntries(done.map(({ key, row }) => [key, tokenEntry(row, key)])))

  console.log('Tokens:')
  for (const { key, row, status } of results) console.log(`  ${key} (${row.name}): ${status}`)
  warnTacticTokens(done)
  const sized = done.filter(({ row }) => tokenSize(row) !== DEFAULT_SIZE)
  console.log(`\nTokens that are not ${DEFAULT_SIZE}" wide:`)
  for (const { key, row } of sized) console.log(`  ${key} (${row.name}): ${tokenSize(row)}"`)
  console.log(
    `\n${done.length} of ${rows.length} tokens migrated.\nApp data: ${TOKENS_OUT}\nAssets: ${path.join(ASSETS, 'tokens')}`,
  )
  return results.some((r) => r.status.startsWith('failed')) ? 1 : 0
}

// A token name of a released tactic card that has no migrated token: no row, or no image in the TTS cache
function warnTacticTokens(done) {
  const migratedNames = new Set(done.map(({ row }) => row.name.toLowerCase()))
  for (const name of [...tacticTokenNames].sort()) {
    if (!migratedNames.has(name)) console.warn(`Warning: tactic token "${name}" is not migrated`)
  }
}

// Width of a token on the table, in inches, see docs/features/character-trays.md, "Real-size tokens". The mod spawns a
// Circle token as a tile with scale tSize, and a tile with scale 1 is 2" wide. A token with another tShape
// ("Other") keeps the default, because its real size was never measured.
function tokenSize(row) {
  if (row.tShape !== 'Circle') return DEFAULT_SIZE
  if (!(row.tSize > 0)) throw new Error(`the Circle token "${row.name}" has no tSize`)
  return row.tSize * 2
}

// Entry of src/tokens/tokens.json. size, description, cleanup and collect are left out when the mod row has none (size:
// when it is the default), the same way as the optional fields of src/crisis/cards.json.
function tokenEntry(row, key) {
  const entry = { name: row.name, group: group(row) }
  if (tokenSize(row) !== DEFAULT_SIZE) entry.size = tokenSize(row)
  if (row.tDescr) entry.description = row.tDescr
  if (row.cleanup) entry.cleanup = true
  if (COLLECT_KEYS.includes(key)) entry.collect = true
  return entry
}
