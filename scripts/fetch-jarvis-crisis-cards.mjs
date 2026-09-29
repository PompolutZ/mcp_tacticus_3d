// Downloads the crisis cards from Jarvis Protocol to src/crisis/jarvis-crisis-cards.json. See scripts/README.md.

import fs from 'node:fs'
import path from 'node:path'

const API = 'https://www.jarvis-protocol.com/api/crisis_cards'
const OUT_FILE = path.resolve(import.meta.dirname, '../src/crisis/jarvis-crisis-cards.json')
// Jarvis returns 403 for an unusual User-Agent or a Referer from another site
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://www.jarvis-protocol.com/',
}

// One request returns every printing of every card, with the text
const res = await fetch(API, { headers: HEADERS })
if (!res.ok) throw new Error(`${API} returned ${res.status}`)
const cards = (await res.json()).sort((a, b) => (a.slug < b.slug ? -1 : 1))
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(OUT_FILE, JSON.stringify(cards, null, 2) + '\n')

const current = cards.filter(c => c.replacedBy === null).length
console.log(`${cards.length} cards: ${current} current, ${cards.length - current} older printings`)
console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`)
