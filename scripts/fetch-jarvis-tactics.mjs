// Downloads the Team Tactic cards from Jarvis Protocol to src/tactics/jarvis-tactics-cards.json. See scripts/README.md.

import fs from 'node:fs'
import path from 'node:path'

const API = 'https://www.jarvis-protocol.com/api/team_tactics_cards'
const OUT_FILE = path.resolve(import.meta.dirname, '../src/tactics/jarvis-tactics-cards.json')
// Jarvis returns 403 for an unusual User-Agent or a Referer from another site
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://www.jarvis-protocol.com/',
}
// The full response is 1 MB with the card text. The app needs only these fields.
const FIELDS = [
  'exportCode', 'slug', 'name', 'isInfinityGem', 'affiliation', 'tags',
  'timelines', 'standardTimelineStatus', 'extendedTimelineStatus', 'computedStatus', 'latestComputedStatus',
]

const res = await fetch(API, { headers: HEADERS })
if (!res.ok) throw new Error(`${API} returned ${res.status}`)
const cards = (await res.json())
  .sort((a, b) => (a.slug < b.slug ? -1 : 1))
  .map(c => Object.fromEntries(FIELDS.map(f => [f, c[f] ?? null])))
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(OUT_FILE, JSON.stringify(cards, null, 2) + '\n')

const withCode = cards.filter(c => c.exportCode).length
const gems = cards.filter(c => c.isInfinityGem).length
console.log(`${cards.length} cards: ${withCode} with a code, ${gems} Infinity Gems`)
console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`)
