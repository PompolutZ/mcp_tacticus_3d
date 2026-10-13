// Downloads the Team Tactic cards from Jarvis Protocol to src/tactics/jarvis-tactics-cards.json and
// src/tactics/jarvis-tactics-text.json. See scripts/README.md.

import fs from 'node:fs'
import path from 'node:path'
import { writeJson } from './lib/files.mjs'
import { fetchJarvis } from './lib/jarvis.mjs'

const API = 'https://www.jarvis-protocol.com/api/team_tactics_cards'
const OUT_FILE = path.resolve(import.meta.dirname, '../src/tactics/jarvis-tactics-cards.json')
const TEXT_FILE = path.resolve(import.meta.dirname, '../src/tactics/jarvis-tactics-text.json')
const OUR_CARDS = path.resolve(import.meta.dirname, '../src/tactics/cards.json')
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

const rows = (await fetchJarvis(API)).sort((a, b) => (a.slug < b.slug ? -1 : 1))
const cards = rows.map((c) => Object.fromEntries(FIELDS.map((f) => [f, c[f] ?? null])))
writeJson(OUT_FILE, cards, { sortKeys: false })

const withCode = cards.filter((c) => c.exportCode).length
const gems = cards.filter((c) => c.isInfinityGem).length
console.log(`${cards.length} cards: ${withCode} with a code, ${gems} Infinity Gems`)
console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`)

// The text of the face of each card, by our card key (decisions of docs/plans/tactic-faces.md).
const compact = (o, fields) =>
  Object.fromEntries(fields.filter((f) => o[f] != null && o[f] !== '').map((f) => [f, o[f]]))
const byRank = (a, b) => (a.rank ?? 0) - (b.rank ?? 0)
const faceOf = (c) => ({
  ...compact(c, ['type', 'body', 'secondaryBody', 'intermediaryBody']),
  ...(c.affiliation?.name && { affiliation: c.affiliation.name }),
  ...(c.superPowers?.length && {
    superPowers: [...c.superPowers]
      .sort(byRank)
      .map((p) => compact(p, ['form', 'type', 'name', 'powerCost', 'body'])),
  }),
  ...(c.attacks?.length && {
    attacks: [...c.attacks].sort(byRank).map((a) => ({
      ...compact(a, ['form', 'type', 'name', 'range', 'strength', 'powerCost']),
      steps: a.steps ?? [],
    })),
  }),
  ...compact(c, ['artist']),
  ...(c.biggerIcons && { biggerIcons: true }),
})
const byCode = new Map()
const bySlug = new Map()
for (const r of rows) {
  if (r.isInfinityGem) continue
  if (r.exportCode && !byCode.has(r.exportCode)) byCode.set(r.exportCode, r)
  if (!bySlug.has(r.slug)) bySlug.set(r.slug, r)
}
const ours = JSON.parse(fs.readFileSync(OUR_CARDS, 'utf8'))
const text = {}
const n = { code: 0, slug: 0 }
const missing = []
for (const [key, { id }] of Object.entries(ours)) {
  // 3 of our ids lost their leading zero (1430205 for 01430205)
  let row = byCode.get(id.padStart(8, '0'))
  if (row) n.code++
  else if ((row = bySlug.get(key))) n.slug++
  if (row) text[key] = faceOf(row)
  else missing.push(key)
}
writeJson(TEXT_FILE, text)
console.log(
  `Face text: ${n.code} by code, ${n.slug} by slug, ${missing.length} not at all${missing.length ? ` (${missing.join(', ')})` : ''}`,
)
console.log(`Wrote ${path.relative(process.cwd(), TEXT_FILE)}`)
