// Migrates the scoring board of the TTS mod to src/assets/: the board mesh and texture, the round marker mesh,
// the 36 affiliation token images that the VP markers show, and the face of the Priority marker. Writes the affiliation list to
// src/scoreboard/affiliations.json. See scripts/README.md, "TTS scoring board".
//
// All files together are about 1 MB, so the script always converts all of them, the same as migrate-dice.mjs.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { compressMesh, imageToWebp, readObj, TEXTURE_SIZE, writeGlb } from './lib/convert.mjs'
import { outputPath, writeJson } from './lib/files.mjs'
import { slug } from './lib/keys.mjs'
import { cachedFile, loadCrisisDatabase, modObject } from './lib/tts.mjs'
import {
  affiliationToken,
  BOARD_MESH,
  BOARD_TEXTURE,
  PRIORITY_TEXTURE,
  ROUND_MESH,
} from '../src/scoreboard/files.js'

const ASSETS = path.resolve(import.meta.dirname, '../src/assets')
const AFFILIATIONS_OUT = path.resolve(import.meta.dirname, '../src/scoreboard/affiliations.json')
// Same as the character tokens (migrate-tokens.mjs). The mod's images are 225 px, so they keep their size.
const TOKEN_SIZE = 256

await writeMesh(BOARD_MESH, modObject('Tracker').CustomMesh.MeshURL)
writeImage(BOARD_TEXTURE, modObject('Tracker').CustomMesh.DiffuseURL, TEXTURE_SIZE)
await writeMesh(ROUND_MESH, modObject('Round Tracker').CustomMesh.MeshURL)
writeAffiliations()
writePriorityFace()

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
  writeJson(AFFILIATIONS_OUT, entries)
  console.log(
    `Wrote ${rows.length} affiliation tokens and ${path.relative(process.cwd(), AFFILIATIONS_OUT)}`,
  )
}

// The "Priority Token" of the mod is a coin mesh. Its 1024 x 1024 texture has two equal faces in the bottom
// half (a yellow star on blue, round, with transparent corners) and black in the top half. The marker of the
// app is a flat token, so it needs one face: the left one, cropped and scaled like the other tokens.
function writePriorityFace() {
  const file = source(modObject('Priority Token').CustomMesh.DiffuseURL)
  const face = execFileSync('magick', [file, '-crop', '512x512+0+512', '+repage', 'png:-'], {
    maxBuffer: 64 * 1024 * 1024,
  })
  fs.writeFileSync(outputPath(ASSETS, PRIORITY_TEXTURE), imageToWebp(face, TOKEN_SIZE))
  console.log(`Wrote src/assets/${PRIORITY_TEXTURE}`)
}

async function writeMesh(file, url) {
  await writeGlb(
    outputPath(ASSETS, file),
    await compressMesh(await readObj(source(url)), { singleMaterial: true }),
  )
  console.log(`Wrote src/assets/${file}`)
}

function writeImage(file, url, maxSize) {
  fs.writeFileSync(outputPath(ASSETS, file), imageToWebp(source(url), maxSize))
}

function source(url) {
  const file = cachedFile(url)
  if (!file) throw new Error(`Not in the TTS cache: ${url}`)
  return file
}
