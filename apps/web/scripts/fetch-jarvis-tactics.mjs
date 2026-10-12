// Downloads the Team Tactic cards from Jarvis Protocol to src/tactics/jarvis-tactics-cards.json. See scripts/README.md.

import path from 'node:path'
import { writeJson } from './lib/files.mjs'
import { fetchJarvis } from './lib/jarvis.mjs'

const API = 'https://www.jarvis-protocol.com/api/team_tactics_cards'
const OUT_FILE = path.resolve(import.meta.dirname, '../src/tactics/jarvis-tactics-cards.json')
// The full response is 1 MB with the card text. The app needs only these fields.
const FIELDS = [
  'exportCode',
  'slug',
  'name',
  'isInfinityGem',
  'affiliation',
  'tags',
  'timelines',
  'standardTimelineStatus',
  'extendedTimelineStatus',
  'computedStatus',
  'latestComputedStatus',
]

const cards = (await fetchJarvis(API))
  .sort((a, b) => (a.slug < b.slug ? -1 : 1))
  .map((c) => Object.fromEntries(FIELDS.map((f) => [f, c[f] ?? null])))
writeJson(OUT_FILE, cards, { sortKeys: false })

const withCode = cards.filter((c) => c.exportCode).length
const gems = cards.filter((c) => c.isInfinityGem).length
console.log(`${cards.length} cards: ${withCode} with a code, ${gems} Infinity Gems`)
console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`)
