// Migrates the character tokens of the TTS mod (tokenDatabase rows of type Condition, Status, Personal and Only
// Status, plus the "1 Power" row) to src/assets/tokens/. Writes the app data to src/tokens/tokens.json, and the
// source URLs to scripts/token-manifest.json. See scripts/README.md and docs/characters-hud.md, "Tokens from
// the TTS mod".

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { imageToWebp } from './lib/convert.mjs'
import { cachedFile, loadCrisisDatabase } from './lib/tts.mjs'
import { characterToken } from '../src/tokens/files.js'

const USAGE = `Usage:
  node scripts/migrate-tokens.mjs --list   character tokens of the mod and their status
  node scripts/migrate-tokens.mjs          convert every token that has its file in the TTS cache
Options:
  --force       convert files again, even if token-manifest.json lists them
  --out <dir>   trial run: write assets to <dir>/assets, and the manifest and tokens.json to <dir>, not to the repo`

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { list: { type: 'boolean' }, force: { type: 'boolean' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
})
if (opts.help || positionals.length) {
  console.log(USAGE)
  process.exit(opts.help ? 0 : 1)
}

// Tokens are small icons, not card art: 256 is already larger than the mod's cached originals (225-375 px)
const TOKEN_SIZE = 256
const MANIFEST_FILE = path.join(import.meta.dirname, 'token-manifest.json')
const DATA_DIR = path.resolve(import.meta.dirname, '../src/tokens')
const OUT_DIR = opts.out ? path.resolve(opts.out) : null
const MANIFEST_OUT = OUT_DIR ? path.join(OUT_DIR, 'token-manifest.json') : MANIFEST_FILE
const TOKENS_OUT = path.join(OUT_DIR ?? DATA_DIR, 'tokens.json')
const ASSETS = OUT_DIR ? path.join(OUT_DIR, 'assets') : path.resolve(import.meta.dirname, '../src/assets')
// "1 Power" is the only Misc row the app uses: the icon of the tray's Power counter (see TrayControls.jsx).
// It lives in the mod at token/misc/tracker/, next to Activated and Dazed, but it is not a token players give
// to a character, so it gets its own "counter" group, kept out of the Tokens panel and out of drops.
const MISC_ROWS = ['1 Power']

const { tokens } = loadCrisisDatabase()
const rows = tokens.filter(selected)
const keys = rowKeys(rows)
// A trial run continues from its own manifest, if an earlier trial run into the same directory wrote it
const manifest = readJson(MANIFEST_OUT, MANIFEST_FILE)

if (opts.list) listTokens()
else process.exitCode = migrate()

// Which rows of tokenDatabase this script migrates, see docs/characters-hud.md, "Tokens from the TTS mod".
// A row with altName is a second art of the same token (the old round design); only the first art is migrated.
function selected(row) {
  if (row.altName) return false
  switch (row.tType) {
    case 'Condition': return groupPath(row) === 'condition' // not the dice results in token/dice/
    case 'Status': return true
    case 'Personal': return true
    case 'Only Status': return groupPath(row) === 'tactic' // not the 3 rows in token/misc/
    case 'Misc': return MISC_ROWS.includes(row.name)
    default: return false // Secure/Extract/Source/Objective/Affiliation/Use Tools/Pile/Unused/Experiment
  }
}

// group: condition, status (Activated, Dazed, 1 Power), character or tactic, from the folder of the mod's url,
// see docs/characters-hud.md, "Tokens from the TTS mod"
function groupPath(row) {
  return row.url.split('/token/')[1].replace(/\/[^/]+$/, '')
}

function group(row) {
  if (row.name === '1 Power') return 'counter'
  const g = { condition: 'condition', 'misc/tracker': 'status', character: 'character', tactic: 'tactic' }[groupPath(row)]
  if (!g) throw new Error(`the token "${row.name}" is in token/${groupPath(row)}/, which no group maps to`)
  return g
}

function listTokens() {
  console.log('Character tokens of the mod. Missing: files that TTS has not downloaded.\n')
  const sorted = [...rows].sort((a, b) => group(a).localeCompare(group(b)) || a.name.localeCompare(b.name))
  for (const row of sorted) {
    const f = { file: characterToken(keys.get(row)), url: row.url }
    const status = available(f) ? (migrated(f) ? 'migrated' : 'cached') : 'missing'
    console.log(`${keys.get(row).padEnd(28)} ${group(row).padEnd(9)} ${row.name.padEnd(28)} ${status}`)
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
  writeJson(TOKENS_OUT, Object.fromEntries(done.map(({ key, row }) => [key, tokenEntry(row)])))

  console.log('Tokens:')
  for (const { key, row, status } of results) console.log(`  ${key} (${row.name}): ${status}`)
  console.log(`\n${done.length} of ${rows.length} tokens migrated.\nApp data: ${TOKENS_OUT}\nAssets: ${path.join(ASSETS, 'tokens')}`)
  return results.some(r => r.status.startsWith('failed')) ? 1 : 0
}

// Entry of src/tokens/tokens.json. description and cleanup are left out when the mod row has none,
// the same way as the optional fields of src/crisis/cards.json.
function tokenEntry(row) {
  const entry = { name: row.name, group: group(row) }
  if (row.tDescr) entry.description = row.tDescr
  if (row.cleanup) entry.cleanup = true
  return entry
}

// Key of each token: its name as a slug, the same way as scripts/migrate-crisis.mjs keys a card
function rowKeys(list) {
  const keyMap = new Map(list.map(r => [r, slug(r.name)]))
  const seen = new Map()
  for (const [row, key] of keyMap) {
    if (seen.has(key)) throw new Error(`The tokens "${seen.get(key).name}" and "${row.name}" have the same key ${key}`)
    seen.set(key, row)
  }
  return keyMap
}

function slug(text) {
  return text.toLowerCase().normalize('NFKD').replace(/['‘’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// A file can be written when TTS has it in the cache, or when it is already migrated from the same URL
function available(f) {
  return Boolean(cachedFile(f.url)) || migrated(f)
}

function migrated(f) {
  return manifest[f.file] === f.url && fs.existsSync(path.join(ASSETS, f.file))
}

// Returns true when the file was converted
function convert(f) {
  if (migrated(f) && (!opts.force || !cachedFile(f.url))) return false
  fs.writeFileSync(assetPath(f.file), imageToWebp(cachedFile(f.url), TOKEN_SIZE))
  return true
}

function assetPath(file) {
  const full = path.join(ASSETS, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  return full
}

function readJson(file, fallback) {
  const found = [file, fallback].find(f => fs.existsSync(f))
  return found ? JSON.parse(fs.readFileSync(found, 'utf8')) : {}
}

// Keys in sorted order, so that a new token gives a small diff
function writeJson(file, data) {
  const sorted = Object.fromEntries(Object.keys(data).sort().map(k => [k, data[k]]))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`)
}
