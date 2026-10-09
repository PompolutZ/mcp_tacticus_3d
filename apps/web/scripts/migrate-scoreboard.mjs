// Migrates the scoring board of the TTS mod to src/assets/: the board mesh and texture, the round marker mesh,
// and the 34 affiliation token images that the VP markers show. Writes the affiliation list to
// src/scoreboard/affiliations.json. See scripts/README.md, "TTS scoring board".
//
// All files together are about 1 MB, so the script always converts all of them, the same as migrate-dice.mjs.

import fs from 'node:fs'
import path from 'node:path'
import { compressMesh, imageToWebp, readObj, TEXTURE_SIZE, writeGlb } from './lib/convert.mjs'
import { cachedFile, loadCrisisDatabase, modObject } from './lib/tts.mjs'
import { affiliationToken, BOARD_MESH, BOARD_TEXTURE, ROUND_MESH } from '../src/scoreboard/files.js'

const ASSETS = path.resolve(import.meta.dirname, '../src/assets')
const AFFILIATIONS_OUT = path.resolve(import.meta.dirname, '../src/scoreboard/affiliations.json')
// Same as the character tokens (migrate-tokens.mjs). The mod's images are 225 px, so they keep their size.
const TOKEN_SIZE = 256

await writeMesh(BOARD_MESH, modObject('Tracker').CustomMesh.MeshURL)
writeImage(BOARD_TEXTURE, modObject('Tracker').CustomMesh.DiffuseURL, TEXTURE_SIZE)
await writeMesh(ROUND_MESH, modObject('Round Tracker').CustomMesh.MeshURL)
writeAffiliations()

// The mod's Tray Spawner gives the VP marker the image of the affiliation that the player chooses
// (updateScoreTracker). The choices are the tokenDatabase rows of type Affiliation.
function writeAffiliations() {
  const rows = loadCrisisDatabase().tokens.filter((t) => t.tType === 'Affiliation')
  const entries = {}
  for (const row of rows) {
    const key = slug(row.name)
    if (entries[key])
      throw new Error(
        `The affiliations "${entries[key].name}" and "${row.name}" have the same key ${key}`,
      )
    writeImage(affiliationToken(key), row.url, TOKEN_SIZE)
    entries[key] = { name: row.name }
  }
  // Keys in sorted order, so that a new affiliation gives a small diff
  const sorted = Object.fromEntries(
    Object.keys(entries)
      .sort()
      .map((k) => [k, entries[k]]),
  )
  fs.writeFileSync(AFFILIATIONS_OUT, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(
    `Wrote ${rows.length} affiliation tokens and ${path.relative(process.cwd(), AFFILIATIONS_OUT)}`,
  )
}

async function writeMesh(file, url) {
  await writeGlb(
    assetPath(file),
    await compressMesh(await readObj(source(url)), { singleMaterial: true }),
  )
  console.log(`Wrote src/assets/${file}`)
}

function writeImage(file, url, maxSize) {
  fs.writeFileSync(assetPath(file), imageToWebp(source(url), maxSize))
}

function source(url) {
  const file = cachedFile(url)
  if (!file) throw new Error(`Not in the TTS cache: ${url}`)
  return file
}

function assetPath(file) {
  const full = path.join(ASSETS, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  return full
}

// The same slug as migrate-tokens.mjs: "S.H.I.E.L.D." → shield, "Onslaught's Grip" → onslaughts-grip
function slug(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['‘’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
