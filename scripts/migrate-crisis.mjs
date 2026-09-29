// Migrates the crisis cards of the TTS mod to src/assets/crisis/: the card faces, the Secure and Extract card backs,
// and the tokens that the mod places for each card. Writes the app data to src/crisis/cards.json and
// src/crisis/tokens.json, and the source URLs to scripts/crisis-manifest.json. See scripts/README.md.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { imageToWebp, TEXTURE_SIZE } from './lib/convert.mjs'
import { cachedFile, loadCrisisDatabase } from './lib/tts.mjs'
import { crisisCardBack, crisisCardFace, crisisToken } from '../src/crisis/files.js'

const USAGE = `Usage:
  node scripts/migrate-crisis.mjs --list   crisis cards of the mod and their status
  node scripts/migrate-crisis.mjs          convert every crisis card that has its files in the TTS cache
Options:
  --force       convert files again, even if crisis-manifest.json lists them
  --out <dir>   trial run: write assets to <dir>/assets, and the manifest, cards.json and tokens.json to <dir>, not to the repo`

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { list: { type: 'boolean' }, force: { type: 'boolean' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
})
if (opts.help || positionals.length) {
  console.log(USAGE)
  process.exit(opts.help ? 0 : 1)
}

const MANIFEST_FILE = path.join(import.meta.dirname, 'crisis-manifest.json')
const DATA_DIR = path.resolve(import.meta.dirname, '../src/crisis')
const JARVIS_FILE = path.join(DATA_DIR, 'jarvis-crisis-cards.json')
const OUT_DIR = opts.out ? path.resolve(opts.out) : null
const MANIFEST_OUT = OUT_DIR ? path.join(OUT_DIR, 'crisis-manifest.json') : MANIFEST_FILE
const CARDS_OUT = path.join(OUT_DIR ?? DATA_DIR, 'cards.json')
const TOKENS_OUT = path.join(OUT_DIR ?? DATA_DIR, 'tokens.json')
const ASSETS = OUT_DIR ? path.join(OUT_DIR, 'assets') : path.resolve(import.meta.dirname, '../src/assets')
const TYPES = { Secure: 'secure', Extract: 'extract' }
// The "Setup Crisis" button looks for a Secure card in the rows of crisisDatabase up to this row,
// and for an Extract card in the rows after it
const LAST_SECURE_ROW = 'SECURE - Drop Objectives at Every Location without Rotations'
// Token shapes that the mod spawns as a Custom_Tile. Condition and damage tokens have the shape "Other"
// and are spawned as a Custom_Token. They are character tokens, so this script does not migrate them.
const SHAPES = { Circle: 'circle', Square: 'square' }

const db = loadCrisisDatabase()
const tokenRows = new Map(db.tokens.map(t => [t.name, t]))
const lastSecureRow = db.crises.findIndex(c => c.crisisName === LAST_SECURE_ROW)
if (lastSecureRow < 0) throw new Error(`No "${LAST_SECURE_ROW}" row in crisisDatabase`)
// Released cards, without the test cards of the mod ("Test Snapping", "Test Zones")
const cards = db.cards.filter(c => c.released && !/^test\b/i.test(c.name))
const keys = cardKeys(cards)
// A trial run continues from its own manifest, if an earlier trial run into the same directory wrote it
const manifest = readJson(MANIFEST_OUT, MANIFEST_FILE)
const jarvis = fs.existsSync(JARVIS_FILE) ? JSON.parse(fs.readFileSync(JARVIS_FILE, 'utf8')).filter(c => c.replacedBy === null) : null

if (opts.list) listCards()
else process.exitCode = migrate()

function listCards() {
  console.log('Crisis cards of the mod. Missing: files that TTS has not downloaded.\n')
  const sorted = [...cards].sort((a, b) => a.tags.localeCompare(b.tags) || a.name.localeCompare(b.name))
  for (const card of sorted) {
    let status
    try {
      const { files } = planCard(card)
      const missing = files.filter(f => !available(f))
      status = missing.length ? `missing: ${missing.map(f => f.label).join(', ')}` : files.every(migrated) ? 'migrated' : 'all files cached'
    } catch (err) {
      status = `error: ${err.message}`
    }
    console.log(`${card.ID}  ${card.tags.padEnd(7)}  ${card.name.padEnd(62)} ${status}`)
  }
}

// Returns the process exit code
function migrate() {
  const results = []
  const done = []
  for (const card of [...cards].sort((a, b) => keys.get(a).localeCompare(keys.get(b)))) {
    const key = keys.get(card)
    try {
      const plan = planCard(card)
      const missing = plan.files.filter(f => !available(f))
      if (missing.length) {
        results.push({ key, card, status: `missing in TTS cache: ${missing.map(f => f.label).join(', ')}` })
        continue
      }
      const face = plan.files[0]
      results.push({ key, card, status: convert(face) ? 'converted' : 'already migrated', warnings: jarvisWarnings(plan.entry) })
      done.push(plan)
    } catch (err) {
      results.push({ key, card, status: `failed: ${err.message}` })
    }
  }

  // Tokens are shared by cards, so each one is converted once
  const tokenFiles = new Map(done.flatMap(p => p.files.slice(1)).map(f => [f.file, f]))
  const convertedTokens = [...tokenFiles.values()].filter(convert).length
  const backs = Object.values(TYPES).map(type => migrateBack(type, done.filter(p => p.entry.type === type)))

  const newManifest = {}
  for (const f of [...done.map(p => p.files[0]), ...tokenFiles.values(), ...backs.map(b => b.file).filter(Boolean)]) newManifest[f.file] = f.url
  writeJson(MANIFEST_OUT, newManifest)
  writeJson(CARDS_OUT, Object.fromEntries(done.map(p => [p.key, p.entry])))
  writeJson(TOKENS_OUT, Object.fromEntries(done.flatMap(p => [...p.tokens]).map(([key, row]) => [key, tokenEntry(row)])))

  console.log('\nCards:')
  for (const { key, card, status, warnings = [] } of results) {
    console.log(`  ${key} (${card.ID}): ${status}`)
    for (const w of warnings) console.log(`    warning: ${w}`)
  }
  console.log(`\nTokens: ${tokenFiles.size}, converted ${convertedTokens}`)
  for (const { type, status, warnings } of backs) {
    console.log(`Card back ${type}: ${status}`)
    for (const w of warnings) console.log(`  warning: ${w}`)
  }
  console.log(`\n${done.length} of ${cards.length} cards migrated.\nApp data: ${CARDS_OUT}, ${TOKENS_OUT}\nAssets: ${path.join(ASSETS, 'crisis')}`)
  return results.some(r => r.status.startsWith('failed')) ? 1 : 0
}

// App entry of a card and the files it needs: { key, entry, tokens: token key → token row, files, back: URL of the back }.
// files[0] is the card face, the other files are the token images. Throws when the mod data breaks a rule of the script.
function planCard(card) {
  const key = keys.get(card)
  const type = TYPES[card.tags]
  if (!type) throw new Error(`the card has the type "${card.tags}", expected Secure or Extract`)
  const crisis = crisisRow(card, type)
  const map = db.maps[crisis.crisisMap]
  if (!map) throw new Error(`there is no crisisMaps[${crisis.crisisMap}]`)
  const tokens = new Map()
  const useToken = row => {
    tokenEntry(row)
    tokens.set(slug(row.name), row)
    return slug(row.name)
  }
  const entry = { id: card.ID, name: card.name, type, threat: card.threat, tokens: map.tokenPos.map((_, i) => placement(crisis, map, i, useToken)) }
  const supply = supplyToken(card)
  if (supply) entry.supply = useToken(supply)
  const files = [
    { file: crisisCardFace(key), url: card.face, label: 'face' },
    ...[...tokens].map(([tokenKey, row]) => ({ file: crisisToken(tokenKey), url: row.url, label: `token ${tokenKey}` })),
  ]
  return { key, entry, tokens, files, back: card.back }
}

// The row of crisisDatabase for the card. The mod finds it by the card name.
function crisisRow(card, type) {
  const rows = type === 'secure' ? db.crises.slice(0, lastSecureRow + 1) : db.crises.slice(lastSecureRow + 1)
  const found = rows.filter(c => sameName(c.crisisName, card.name))
  if (found.length !== 1) throw new Error(`the ${type} rows of crisisDatabase have ${found.length} rows named "${card.name}", expected 1`)
  return found[0]
}

// Token i of the crisis map, by the rules of spawnToken() in "Automatic Crisis Deployment"
function placement(crisis, map, i, useToken) {
  const name = pick(crisis.crisisToken, i)
  const token = tokenRows.get(name)
  if (!token) throw new Error(`the crisis token "${name}" is not in tokenDatabase`)
  const side = map.tokenSide[i]
  if (side !== 'front' && side !== 'back') throw new Error(`token ${i + 1} has the side ${JSON.stringify(side)}, expected front or back`)
  // frontName and backName are the images of the two sides. A name that is not in tokenDatabase shows the crisis token.
  const frontName = crisis.frontName ?? name
  const image = n => tokenRows.get(n) ?? token
  const front = image(frontName)
  const back = image(crisis.backName ?? frontName)
  const [up, down] = side === 'front' ? [front, back] : [back, front]
  const [x, , z] = map.tokenPos[i]
  const p = { token: useToken(up) }
  if (down !== up) p.back = useToken(down)
  p.position = [x, z]
  if (map.tokenRot) p.rotation = map.tokenRot[i]
  if (pick(crisis.lock, i) === 'true') p.locked = true
  else if (crisis.flipLock === 'true') p.flipOnly = true
  return p
}

// crisisToken and lock are one value for every token, or a list with one value per token.
// For a token without its own list item, the mod uses the first item.
function pick(value, i) {
  return Array.isArray(value) ? value[i] ?? value[0] : value
}

// The token that the mod places next to the card, so that players can take copies of it during the game.
// For example, the Extract Source Asset of a Source card. Null for a condition or damage token (see SHAPES).
function supplyToken(card) {
  const name = card.token?.[0]
  if (!name) return null
  const row = tokenRows.get(name)
  if (!row) throw new Error(`the token "${name}" of the card is not in tokenDatabase`)
  return SHAPES[row.tShape] ? row : null
}

// Entry of src/crisis/tokens.json. The mod spawns a token as a tile with scale tSize, and a tile with scale 1 is 2" wide.
function tokenEntry(row) {
  const shape = SHAPES[row.tShape]
  if (!shape) throw new Error(`the token "${row.name}" has the shape "${row.tShape}", expected Circle or Square`)
  // spawnToken() gives a token with tSize 2.5 (Mutant Masterworks) another tile type
  if (row.tSize === 2.5) throw new Error(`the token "${row.name}" has tSize 2.5, which the script does not support`)
  return { name: row.name, shape, size: row.tSize * 2 }
}

// Every card of a type has the same back, so the app has one back file per type. The file is converted from the image
// that most cards of the type have in the TTS cache, because the mod gives a few cards the back of the other type.
function migrateBack(type, plans) {
  const backs = plans.map(p => ({ key: p.key, file: crisisCardBack(type), url: p.back }))
  const groups = new Map()
  for (const b of backs.filter(b => cachedFile(b.url))) {
    const hash = crypto.createHash('md5').update(fs.readFileSync(cachedFile(b.url))).digest('hex')
    groups.set(hash, [...(groups.get(hash) ?? []), b])
  }
  const [common = [], ...others] = [...groups.values()].sort((a, b) => b.length - a.length)
  const file = common[0] ?? backs.find(migrated)
  if (!file) return { type, status: plans.length ? 'missing in TTS cache' : 'no cards', warnings: [] }
  const different = others.flat().map(b => b.key)
  const warnings = different.length ? [`in the mod, ${different.join(', ')} has another back image than ${common.length} other ${type} cards. The app shows the back of the ${common.length} cards.`] : []
  return { type, file, status: convert(file) ? `converted from ${file.key}` : 'already migrated', warnings }
}

// Jarvis has the text and the legality of the cards. The app joins it by id, so the script checks the ids here.
function jarvisWarnings(entry) {
  if (!jarvis) return []
  const found = jarvis.find(c => c.exportCode === entry.id)
  if (!found) return [`Jarvis has no current card with the id ${entry.id}`]
  const warnings = []
  if ((found.type === 'Extraction' ? 'extract' : 'secure') !== entry.type) warnings.push(`Jarvis has the type ${found.type}`)
  if (found.threatLevel !== entry.threat) warnings.push(`Jarvis has the threat ${found.threatLevel}`)
  return warnings
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
  fs.writeFileSync(assetPath(f.file), imageToWebp(cachedFile(f.url), TEXTURE_SIZE))
  return true
}

// Key of each card: its name as a slug, without apostrophes and dots, as in Jarvis: "M'Kraan" → mkraan, "S.W.O.R.D." → sword
function cardKeys(rows) {
  const keyMap = new Map(rows.map(r => [r, slug(r.name)]))
  const seen = new Map()
  for (const [row, key] of keyMap) {
    if (seen.has(key)) throw new Error(`The cards "${seen.get(key).name}" and "${row.name}" have the same key ${key}`)
    seen.set(key, row)
  }
  return keyMap
}

// "Strike Team Secures Sheild Relay!" and "Strike Team Secures Sheild Relay" are the same name
function sameName(a, b) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return norm(a) === norm(b)
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
