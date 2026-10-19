// Turns a GLB model around the vertical line through its origin (the base center). See
// docs/features/custom-models.md, "Front".
//
// A character key of scripts/custom-models.json turns its file in src/assets/characters/ and updates the
// command in the list. A path to a .glb (a candidate) turns that file only.

import fs from 'node:fs'
import path from 'node:path'
import { getBounds } from '@gltf-transform/functions'
import { compressMesh, readGlb, writeGlb } from './lib/convert.mjs'
import { turnSumOf, withTurn } from './lib/custom-models.mjs'
import { turnRoots } from './lib/turn-model.mjs'

const USAGE = `Usage:
  node scripts/turn-model.mjs <character key | file.glb> <degrees>
Turns the model around the vertical line through the base center. Positive is counterclockwise,
seen from above. A character key must be in scripts/custom-models.json: its file is turned and the
sum of its turns is saved in the command there. A TTS model is not turned, because the next
migration would overwrite it.`

const MM_PER_INCH = 25.4
const LIST_FILE = path.join(import.meta.dirname, 'custom-models.json')
const ASSETS = path.resolve(import.meta.dirname, '../src/assets')

const [target, angle, ...extra] = process.argv.slice(2)
const degrees = Number(angle)
if (
  !target ||
  target === '--help' ||
  target === '-h' ||
  extra.length ||
  !Number.isFinite(degrees)
) {
  console.log(USAGE)
  process.exit(target === '--help' || target === '-h' ? 0 : 1)
}

const isPath = target.endsWith('.glb') || target.includes('/')
const list = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'))
const listedFile = `characters/${target}/model.glb`
if (!isPath && !list[target]?.[listedFile]) {
  console.error(
    `"${target}" is not in scripts/custom-models.json. A TTS model would be overwritten by the next migration.`,
  )
  process.exit(1)
}
const file = isPath ? path.resolve(target) : path.join(ASSETS, listedFile)
if (!fs.existsSync(file)) {
  console.error(`No file ${file}`)
  process.exit(1)
}

const doc = await readGlb(file)
turnRoots(doc, degrees)
await compressMesh(doc, { singleMaterial: false })
await writeGlb(file, doc)

const { min, max } = getBounds(doc.getRoot().listScenes()[0])
const size = [0, 2].map((i) => ((max[i] - min[i]) * MM_PER_INCH).toFixed(1))
const rel = path.relative(process.cwd(), file)
const shown = rel.startsWith('..') ? file : rel
console.log(`Turned ${shown} by ${degrees}°: ${size.join(' × ')} mm (width × depth)`)

if (!isPath) {
  const command = list[target][listedFile]
  list[target][listedFile] = withTurn(command, target, degrees)
  fs.writeFileSync(LIST_FILE, `${JSON.stringify(list, null, 2)}\n`)
  console.log(
    `Sum of the turns in custom-models.json: ${turnSumOf(list[target][listedFile], target)}°`,
  )
}
