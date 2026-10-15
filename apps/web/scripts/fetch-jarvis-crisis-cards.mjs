// Downloads the crisis cards from Jarvis Protocol to scripts/jarvis/crisis-cards.json. See scripts/README.md.

import path from 'node:path'
import { writeJson } from './lib/files.mjs'
import { fetchJarvis } from './lib/jarvis.mjs'
import { trimCrisis } from './lib/jarvis-trim.mjs'

const API = 'https://www.jarvis-protocol.com/api/crisis_cards'
const OUT_FILE = path.resolve(import.meta.dirname, 'jarvis/crisis-cards.json')
const TRIMMED_FILE = path.resolve(import.meta.dirname, '../src/crisis/jarvis-rows.json')

// One request returns every printing of every card, with the text
const cards = (await fetchJarvis(API)).sort((a, b) => (a.slug < b.slug ? -1 : 1))
writeJson(OUT_FILE, cards, { sortKeys: false })
writeJson(TRIMMED_FILE, trimCrisis(cards), { sortKeys: false })

const current = cards.filter((c) => c.replacedBy === null).length
console.log(`${cards.length} cards: ${current} current, ${cards.length - current} older printings`)
console.log(
  `Wrote ${path.relative(process.cwd(), OUT_FILE)} and ${path.relative(process.cwd(), TRIMMED_FILE)}`,
)
