// Migrates the tactic cards (TTC) of the TTS mod to src/assets/tactics/: the face and the back of each card.
// Writes the app data to src/tactics/cards.json, and the source URLs to scripts/tactic-manifest.json. See scripts/README.md.

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { imageToWebp } from './lib/convert.mjs'
import { cachedFile, loadTacticCards } from './lib/tts.mjs'
import { tacticCardBack, tacticCardFace } from '../src/tactics/files.js'

const USAGE = `Usage:
  node scripts/migrate-tactics.mjs --list   tactic cards of the mod and their status
  node scripts/migrate-tactics.mjs          convert every tactic card that has its files in the TTS cache
Options:
  --force       convert files again, even if tactic-manifest.json lists them
  --out <dir>   trial run: write assets to <dir>/assets, and the manifest and cards.json to <dir>, not to the repo`

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { list: { type: 'boolean' }, force: { type: 'boolean' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
})
if (opts.help || positionals.length) {
  console.log(USAGE)
  process.exit(opts.help ? 0 : 1)
}

const MANIFEST_FILE = path.join(import.meta.dirname, 'tactic-manifest.json')
const DATA_DIR = path.resolve(import.meta.dirname, '../src/tactics')
const OUT_DIR = opts.out ? path.resolve(opts.out) : null
const MANIFEST_OUT = OUT_DIR ? path.join(OUT_DIR, 'tactic-manifest.json') : MANIFEST_FILE
const CARDS_OUT = path.join(OUT_DIR ?? DATA_DIR, 'cards.json')
const ASSETS = OUT_DIR ? path.join(OUT_DIR, 'assets') : path.resolve(import.meta.dirname, '../src/assets')
// Largest side of a card image. Most sources are about 720×1040, a few are 2048 px high or more.
const CARD_SIZE = 1040

// The mod spawns only released cards
const cards = loadTacticCards().filter(c => c.released)
const keys = cardKeys(cards)
// A trial run continues from its own manifest, if an earlier trial run into the same directory wrote it
const manifest = readJson(MANIFEST_OUT, MANIFEST_FILE)

if (opts.list) listCards()
else process.exitCode = migrate()

function listCards() {
  console.log('Tactic cards of the mod. Missing: files that TTS has not downloaded.\n')
  for (const card of [...cards].sort((a, b) => a.name.localeCompare(b.name))) {
    const files = cardFiles(card)
    const missing = files.filter(f => !available(f))
    const status = missing.length ? `missing: ${missing.map(f => f.label).join(', ')}` : files.every(migrated) ? 'migrated' : 'all files cached'
    console.log(`${card.ID}  ${card.name.padEnd(48)} ${status}`)
  }
}

// Returns the process exit code
function migrate() {
  const results = []
  const done = []
  for (const card of [...cards].sort((a, b) => keys.get(a).localeCompare(keys.get(b)))) {
    const key = keys.get(card)
    try {
      const files = cardFiles(card)
      const missing = files.filter(f => !available(f))
      if (missing.length) {
        results.push({ key, card, status: `missing in TTS cache: ${missing.map(f => f.label).join(', ')}` })
        continue
      }
      const converted = files.filter(convert).length
      results.push({ key, card, status: converted ? 'converted' : 'already migrated' })
      done.push({ key, card, files })
    } catch (err) {
      results.push({ key, card, status: `failed: ${err.message}` })
    }
  }

  writeJson(MANIFEST_OUT, Object.fromEntries(done.flatMap(d => d.files).map(f => [f.file, f.url])))
  writeJson(CARDS_OUT, Object.fromEntries(done.map(({ key, card }) => [key, { id: card.ID, name: card.name }])))

  console.log('\nCards:')
  for (const { key, card, status } of results) console.log(`  ${key} (${card.ID}): ${status}`)
  console.log(`\n${done.length} of ${cards.length} cards migrated.\nApp data: ${CARDS_OUT}\nAssets: ${path.join(ASSETS, 'tactics')}`)
  return results.some(r => r.status.startsWith('failed')) ? 1 : 0
}

// A card with several printed versions has a list of faces and backs. The mod spawns the first one (recSpawnCard() in Global).
function cardFiles(card) {
  const key = keys.get(card)
  const first = urls => (Array.isArray(urls) ? urls[0] : urls)
  return [
    { file: tacticCardFace(key), url: first(card.face), label: 'face' },
    { file: tacticCardBack(key), url: first(card.back), label: 'back' },
  ]
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
  fs.writeFileSync(assetPath(f.file), imageToWebp(cachedFile(f.url), CARD_SIZE))
  return true
}

// Key of each card: its name as a slug, without apostrophes and dots: "Freyja's Blessing" → freyjas-blessing
function cardKeys(rows) {
  const keyMap = new Map(rows.map(r => [r, slug(r.name)]))
  const seen = new Map()
  for (const [row, key] of keyMap) {
    if (seen.has(key)) throw new Error(`The cards "${seen.get(key).name}" and "${row.name}" have the same key ${key}`)
    seen.set(key, row)
  }
  return keyMap
}

function slug(text) {
  return text.toLowerCase().normalize('NFKD').replace(/['‘’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

// Keys in sorted order, so that a new card gives a small diff
function writeJson(file, data) {
  const sorted = Object.fromEntries(Object.keys(data).sort().map(k => [k, data[k]]))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`)
}
