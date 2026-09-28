// Migrates characters from the TTS mod to src/assets/characters/<key>/: 3D model or standee, stat cards and portrait.
// Writes the app data to src/characters/characters.json and the source URLs to scripts/character-manifest.json.
// See scripts/README.md.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { startAssetRipper } from './lib/assetripper.mjs'
import { readBundlePrefab } from './lib/bundle.mjs'
import { CHARACTER_TEXTURE_SIZE, compressMesh, imageToWebp, TEXTURE_SIZE, texturesToWebp, writeGlb } from './lib/convert.mjs'
import { cachedFile, loadCharacterDatabase } from './lib/tts.mjs'
import { BASE_DIAMETER, characterCard, characterModel, characterPortrait, characterStandee, transformModel, transformPortrait, transformStandee } from '../src/characters/files.js'

const USAGE = `Usage:
  node scripts/migrate-characters.mjs --list [affiliation]      characters with files in the TTS cache, and their status
  node scripts/migrate-characters.mjs <id|name|affiliation>...  convert the characters, for example: 00280101 "Lady Sif" asgard
Options:
  --force       convert files again, even if character-manifest.json lists them
  --out <dir>   trial run: write assets to <dir>/assets, and the manifest and characters.json to <dir>, not to the repo`

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: { list: { type: 'boolean' }, force: { type: 'boolean' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
})
if (opts.help || (!opts.list && !positionals.length) || (opts.list && positionals.length > 1)) {
  console.log(USAGE)
  process.exit(opts.help ? 0 : 1)
}

const MANIFEST_FILE = path.join(import.meta.dirname, 'character-manifest.json')
const DATA_FILE = path.resolve(import.meta.dirname, '../src/characters/characters.json')
const MANIFEST_OUT = opts.out ? path.resolve(opts.out, 'character-manifest.json') : MANIFEST_FILE
const DATA_OUT = opts.out ? path.resolve(opts.out, 'characters.json') : DATA_FILE
const ASSETS = opts.out ? path.resolve(opts.out, 'assets') : path.resolve(import.meta.dirname, '../src/assets')
// AssetRipper exports stay here after the run, so they can be inspected
const WORK_DIR = path.join(os.tmpdir(), 'mcp-assist-3d-characters')
// CharacterModel.jsx gives the material with this name the team color. angel.glb has the same name.
const BASE_MATERIAL = 'defaultMat'
// A base mesh whose radius is further than this from the base size gets a warning (inches)
const BASE_TOLERANCE = 0.03
// Fields of the character rows with data that the script does not convert
const IGNORED_FIELDS = {
  cModelAlt: 'an alternative model',
  twoModels: 'a second model',
  construct: 'construct images',
}

const db = loadCharacterDatabase()
const characters = db.characters.filter(r => r.ID && !/^0+$/.test(r.ID) && !r.customChar)
const keys = characterKeys(characters)
// A trial run continues from its own files, if an earlier trial run into the same directory wrote them
const manifest = readJson(MANIFEST_OUT, MANIFEST_FILE)
const appData = readJson(DATA_OUT, DATA_FILE)

if (opts.list) listCharacters(positionals[0])
else process.exitCode = await migrate(selectCharacters(positionals))

function listCharacters(affiliation) {
  const rows = affiliation ? affiliationCharacters(affiliation) : characters.filter(r => characterFiles(r).some(f => f.required && cachedFile(f.url)))
  console.log(`${affiliation ? `Characters of ${affiliation}` : 'Characters with files in the TTS cache'}. Missing: files that TTS has not downloaded.\n`)
  for (const row of rows.sort((a, b) => a.cName.localeCompare(b.cName))) {
    const files = characterFiles(row)
    const missing = files.filter(f => f.required && !cachedFile(f.url))
    const pending = files.filter(f => cachedFile(f.url) && manifest[keys.get(row)]?.sources[f.file] !== f.url)
    const figure = !hasFigure(files) ? 'none' : files.some(f => f.file.endsWith('.glb')) ? 'model' : 'standee'
    const status = !hasFigure(files) ? 'no model or standee in the mod' : missing.length ? `missing: ${missing.map(f => path.basename(f.file)).join(', ')}`
      : !manifest[keys.get(row)] ? 'all files cached' : pending.length ? `changed: ${pending.map(f => path.basename(f.file)).join(', ')}` : 'migrated'
    console.log(`${row.ID}  ${row.cName.padEnd(36)} ${String(row.cBase).padEnd(7)} ${figure.padEnd(8)} ${status}`)
  }
}

// Characters named by the arguments, in order, without duplicates
function selectCharacters(args) {
  const rows = new Set()
  for (const arg of args) {
    if (arg.toLowerCase() in db.affiliations) {
      affiliationCharacters(arg.toLowerCase()).forEach(r => rows.add(r))
      continue
    }
    const found = /^\d{8}$/.test(arg) ? characters.filter(r => r.ID === arg) : characters.filter(r => sameName(r.cName, arg) || keys.get(r) === arg)
    if (!found.length) throw new Error(`No character or affiliation "${arg}". Run with --list to see the characters.`)
    if (found.length > 1) throw new Error(`"${arg}" matches several characters. Use a key:\n${found.map(r => `  ${keys.get(r)}  ${r.ID}  ${r.cName}`).join('\n')}`)
    rows.add(found[0])
  }
  return [...rows]
}

function affiliationCharacters(affiliation) {
  const names = db.affiliations[affiliation]
  if (!names) throw new Error(`No affiliation "${affiliation}". The mod has: ${Object.keys(db.affiliations).join(', ')}`)
  return names.map(name => {
    const found = characters.filter(r => sameName(r.cName, name))
    if (found.length !== 1) console.log(`warning: affiliation ${affiliation} has "${name}", which matches ${found.length} characters. It is left out.`)
    return found.length === 1 ? found[0] : null
  }).filter(Boolean)
}

// "Loki, Prince of Lies" and "Loki (Prince of Lies)" are the same name
function sameName(a, b) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return norm(a) === norm(b)
}

// Returns the process exit code
async function migrate(rows) {
  const results = []
  let ripper = null
  const getRipper = async () => (ripper ??= await startAssetRipper())
  try {
    for (const row of rows) {
      try {
        results.push({ row, ...await migrateCharacter(row, getRipper) })
      } catch (err) {
        results.push({ row, status: `failed: ${err.stack}` })
      }
    }
  } finally {
    ripper?.stop()
  }

  console.log('\nCharacters:')
  for (const { row, status, warnings = [] } of results) {
    console.log(`  ${keys.get(row)} (${row.ID}): ${status}`)
    for (const w of warnings) console.log(`    warning: ${w}`)
  }
  console.log(`\nApp data: ${DATA_OUT}\nAssets: ${path.join(ASSETS, 'characters')}`)
  return results.some(r => r.status.startsWith('failed')) ? 1 : 0
}

async function migrateCharacter(row, getRipper) {
  const key = keys.get(row)
  const files = characterFiles(row)
  if (!hasFigure(files)) return { status: 'skipped: the mod has no model or standee for this character' }
  const missing = files.filter(f => f.required && !cachedFile(f.url))
  if (missing.length) return { status: `missing in TTS cache: ${missing.map(f => path.basename(f.file)).join(', ')}` }

  console.log(`${key}: ${row.cName}`)
  const warnings = Object.entries(IGNORED_FIELDS).filter(([field]) => row[field]).map(([field, what]) => `has ${what} (${field}), which the script ignores`)
  const sources = {}
  let converted = 0
  for (const f of files) {
    const source = cachedFile(f.url)
    if (!source) {
      warnings.push(`${path.basename(f.file)} is not in the TTS cache, so it is left out (${f.url})`)
      continue
    }
    sources[f.file] = f.url
    if (!opts.force && manifest[key]?.sources[f.file] === f.url && fs.existsSync(assetPath(f.file))) continue
    if (f.file.endsWith('.glb')) warnings.push(...await convertModel(source, f, await getRipper()))
    else fs.writeFileSync(assetPath(f.file), imageToWebp(source, TEXTURE_SIZE))
    converted++
  }
  manifest[key] = { id: row.ID, sources }
  appData[key] = appEntry(row, key, sources)
  writeJson(MANIFEST_OUT, manifest)
  writeJson(DATA_OUT, appData)
  return { status: converted ? `converted ${converted} of ${Object.keys(sources).length} files` : 'already migrated', warnings }
}

// Files of a character: { file, url, required, base }. file is relative to src/assets (see src/characters/files.js).
// The first card and the model (or the standee) are required. Other versions, the second form and the portrait are
// converted when TTS has them.
function characterFiles(row) {
  const key = keys.get(row)
  const files = []
  const add = (file, url, required, base = row.cBase) => url && files.push({ file, url, required, base })
  // A card list has one card per version (Mephisto) or per form (Ant-Man: normal and tiny)
  const injured = urls(row.cCard?.back)
  urls(row.cCard?.face).forEach((url, i) => {
    add(characterCard(key, 'healthy', i + 1), url, i === 0)
    add(characterCard(key, 'injured', i + 1), injured[i], i === 0)
  })
  // A model list has one model per card version. The mod spawns the model of the card on the table.
  const models = urls(row.cModel)
  models.forEach((url, i) => add(characterModel(key, i + 1), url, i === 0))
  if (!models.length) standee(row.cFigA, row.cFigB).forEach(([side, url]) => add(characterStandee(key, side), url, true))
  if (row.cTModel) add(transformModel(key), row.cTModel, false, row.cTBase ?? row.cBase)
  else standee(row.cTFigA, row.cTFigB).forEach(([side, url]) => add(transformStandee(key, side), url, false))
  add(characterPortrait(key), row.UIurl, false)
  add(transformPortrait(key), row.TUIurl, false)
  return files
}

function hasFigure(files) {
  return files.some(f => f.required && /\/(model\.glb|standee-front\.webp)$/.test(f.file))
}

// Card and model fields are a URL or a list of URLs
function urls(value) {
  return (Array.isArray(value) ? value : [value]).filter(Boolean)
}

// The mod spawns a standee only when it has a front image. Without a back image, it uses the front image twice.
function standee(front, back) {
  return front ? [['front', front], ['back', back || front]] : []
}

// Entry of src/characters/characters.json. Counts and optional parts come from the files that were converted.
function appEntry(row, key, sources) {
  const has = file => file in sources
  const count = test => {
    let n = 0
    while (test(n + 1)) n++
    return n
  }
  const entry = { id: row.ID, name: row.cName, base: row.cBase }
  const models = count(n => has(characterModel(key, n)))
  if (models) {
    entry.figure = 'model'
    entry.rotation = row.cModelRot ?? 0
    if (models > 1) entry.models = models
  } else entry.figure = 'standee'
  const cards = count(n => has(characterCard(key, 'healthy', n)) && has(characterCard(key, 'injured', n)))
  if (cards > 1) entry.cards = cards
  const transform = has(transformModel(key)) ? { figure: 'model', rotation: row.cTModelRot ?? 0 } : has(transformStandee(key, 'front')) ? { figure: 'standee' } : null
  if (transform) {
    if (row.cTName) transform.name = row.cTName
    if (row.cTBase) transform.base = row.cTBase
    if (has(transformPortrait(key))) transform.portrait = true
    entry.transform = transform
  }
  if (!has(characterPortrait(key))) entry.portrait = false
  return entry
}

// Unity bundle → GLB as angel.glb: the prefab with WebP textures of at most CHARACTER_TEXTURE_SIZE, Draco compression,
// and the base material named BASE_MATERIAL. Returns warnings.
async function convertModel(source, { file, base }, ripper) {
  const out = path.join(WORK_DIR, file.replace(/^characters\//, '').replace(/\.glb$/, ''))
  await ripper.exportBundle(source, out)
  const { doc, warnings } = await readBundlePrefab(out)
  warnings.push(...markBase(doc, base))
  texturesToWebp(doc, CHARACTER_TEXTURE_SIZE)
  await writeGlb(assetPath(file), await compressMesh(doc, { singleMaterial: false }))
  return warnings.map(w => `${path.basename(file)}: ${w}`)
}

// In every model bundle of the mod, the base is the only material without a color texture.
// It gets the name BASE_MATERIAL. Returns warnings.
function markBase(doc, base) {
  const materials = doc.getRoot().listMaterials()
  for (const m of materials) if (m.getName() === BASE_MATERIAL && m.getBaseColorTexture()) m.setName('figure')
  const untextured = materials.filter(m => !m.getBaseColorTexture())
  if (untextured.length !== 1) return [`has ${untextured.length} materials without a texture, expected 1 (the base). No material gets the team color.`]
  untextured[0].setName(BASE_MATERIAL)
  const { min, max } = materialBounds(doc, untextured[0])
  const radius = Math.max(-min[0], max[0], -min[2], max[2])
  const expected = BASE_DIAMETER[base] / 2
  const warnings = []
  if (!(Math.abs(radius - expected) <= BASE_TOLERANCE)) warnings.push(`the base mesh has radius ${radius.toFixed(3)}, but a ${base} base has ${expected.toFixed(3)}`)
  if (Math.abs(min[1]) > 0.01) warnings.push(`the base mesh bottom is at y = ${min[1].toFixed(3)}, not 0`)
  return warnings
}

// Box around the primitives with this material, in scene space
function materialBounds(doc, material) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const v = []
  for (const node of doc.getRoot().listNodes()) {
    const m = node.getWorldMatrix()
    for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      if (prim.getMaterial() !== material) continue
      const position = prim.getAttribute('POSITION')
      for (let i = 0; i < position.getCount(); i++) {
        const [x, y, z] = position.getElement(i, v)
        const world = [0, 1, 2].map(r => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r])
        world.forEach((c, r) => {
          min[r] = Math.min(min[r], c)
          max[r] = Math.max(max[r], c)
        })
      }
    }
  }
  return { min, max }
}

// Key of each character row: its name as a slug. Names that give the same slug (grunts in the mod have
// copies with other ids) get the id added.
function characterKeys(rows) {
  const slugs = rows.map(r => slug(r.cName))
  return new Map(rows.map((r, i) => [r, slugs.indexOf(slugs[i]) === slugs.lastIndexOf(slugs[i]) ? slugs[i] : `${slugs[i]}-${r.ID}`]))
}

function slug(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

// Keys in sorted order, so that a new character gives a small diff
function writeJson(file, data) {
  const sorted = Object.fromEntries(Object.keys(data).sort().map(k => [k, data[k]]))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`)
}
