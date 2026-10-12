// Migrates the tactic cards (TTC) and the Infinity Gem cards of the TTS mod to src/assets/tactics/: the face and the back of each card.
// Writes the app data (with the keys of the card's tokens) to src/tactics/cards.json, and the source URLs to scripts/tactic-manifest.json. See scripts/README.md.

import path from 'node:path'
import { parseMigrateArgs } from './lib/cli.mjs'
import { readJson, writeJson } from './lib/files.mjs'
import { createImageStore } from './lib/manifest.mjs'
import { slug, uniqueKeys } from './lib/keys.mjs'
import { loadTacticCards } from './lib/tts.mjs'
import { tacticCardBack, tacticCardFace } from '../src/tactics/files.js'

const USAGE = `Usage:
  node scripts/migrate-tactics.mjs --list   tactic cards of the mod and their status
  node scripts/migrate-tactics.mjs          convert every tactic card that has its files in the TTS cache
Options:
  --force       convert files again, even if tactic-manifest.json lists them
  --out <dir>   trial run: write assets to <dir>/assets, and the manifest and cards.json to <dir>, not to the repo`

const { opts } = parseMigrateArgs(USAGE)

const TOKENS_FILE = path.resolve(import.meta.dirname, '../src/tokens/tokens.json')
const MANIFEST_FILE = path.join(import.meta.dirname, 'tactic-manifest.json')
const DATA_DIR = path.resolve(import.meta.dirname, '../src/tactics')
const OUT_DIR = opts.out ? path.resolve(opts.out) : null
const MANIFEST_OUT = OUT_DIR ? path.join(OUT_DIR, 'tactic-manifest.json') : MANIFEST_FILE
const CARDS_OUT = path.join(OUT_DIR ?? DATA_DIR, 'cards.json')
const ASSETS = OUT_DIR
  ? path.join(OUT_DIR, 'assets')
  : path.resolve(import.meta.dirname, '../src/assets')
// Largest side of a card image. Most sources are about 720×1040, a few are 2048 px high or more.
const CARD_SIZE = 1040

// The mod spawns only released cards
const cards = loadTacticCards().filter((c) => c.released)
const keys = uniqueKeys(cards)
// A trial run continues from its own manifest, if an earlier trial run into the same directory wrote it
const manifest = readJson(MANIFEST_OUT, MANIFEST_FILE)
const { available, migrated, convert } = createImageStore({
  assets: ASSETS,
  manifest,
  force: opts.force,
  maxSize: CARD_SIZE,
})
// Keys of the tokens that migrate-tokens.mjs migrated
const tokenKeys = new Set(Object.keys(readJson(TOKENS_FILE, TOKENS_FILE)))

if (opts.list) listCards()
else process.exitCode = migrate()

function listCards() {
  console.log('Tactic cards of the mod. Missing: files that TTS has not downloaded.\n')
  for (const card of [...cards].sort((a, b) => a.name.localeCompare(b.name))) {
    const files = cardFiles(card)
    const missing = files.filter((f) => !available(f))
    const status = missing.length
      ? `missing: ${missing.map((f) => f.label).join(', ')}`
      : files.every(migrated)
        ? 'migrated'
        : 'all files cached'
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
      const missing = files.filter((f) => !available(f))
      if (missing.length) {
        results.push({
          key,
          card,
          status: `missing in TTS cache: ${missing.map((f) => f.label).join(', ')}`,
        })
        continue
      }
      const converted = files.filter(convert).length
      results.push({ key, card, status: converted ? 'converted' : 'already migrated' })
      done.push({ key, card, files })
    } catch (err) {
      results.push({ key, card, status: `failed: ${err.message}` })
    }
  }

  writeJson(
    MANIFEST_OUT,
    Object.fromEntries(done.flatMap((d) => d.files).map((f) => [f.file, f.url])),
  )
  writeJson(CARDS_OUT, Object.fromEntries(done.map(({ key, card }) => [key, cardEntry(card)])))

  console.log('\nCards:')
  for (const { key, card, status } of results) console.log(`  ${key} (${card.ID}): ${status}`)
  console.log(
    `\n${done.length} of ${cards.length} cards migrated.\nApp data: ${CARDS_OUT}\nAssets: ${path.join(ASSETS, 'tactics')}`,
  )
  return results.some((r) => r.status.startsWith('failed')) ? 1 : 0
}

// Entry of src/tactics/cards.json. tokens is left out when the card has none. The key of a token is its name as a
// slug, as in migrate-tokens.mjs; a name without a migrated token is left out with a warning.
function cardEntry(card) {
  const entry = { id: card.ID, name: card.name }
  const found = []
  for (const name of card.tokens ?? []) {
    const tokenKey = slug(name)
    if (!tokenKeys.has(tokenKey)) {
      console.warn(
        `Warning: the card "${card.name}" names the token "${name}", which is not migrated`,
      )
    } else if (!found.includes(tokenKey)) found.push(tokenKey)
  }
  if (found.length) entry.tokens = found
  return entry
}

// A card with several printed versions has a list of faces and backs. The mod spawns the first one (recSpawnCard() in Global).
function cardFiles(card) {
  const key = keys.get(card)
  const first = (urls) => (Array.isArray(urls) ? urls[0] : urls)
  return [
    { file: tacticCardFace(key), url: first(card.face), label: 'face' },
    { file: tacticCardBack(key), url: first(card.back), label: 'back' },
  ]
}
