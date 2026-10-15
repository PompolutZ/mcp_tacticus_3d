// Downloads the character data from Jarvis Protocol to src/characters/jarvis-characters.json.
// A character is downloaded again only when its `version` changed. See scripts/README.md.

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { writeJson } from './lib/files.mjs'
import { fetchJarvis } from './lib/jarvis.mjs'
import { trimCharacters } from './lib/jarvis-trim.mjs'

const USAGE = `Usage:
  node scripts/fetch-jarvis-characters.mjs   download new and changed characters
Options:
  --force   download every character again`

const { values: opts } = parseArgs({
  options: { force: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
})
if (opts.help) {
  console.log(USAGE)
  process.exit(0)
}

const API = 'https://www.jarvis-protocol.com/api/characters'
const OUT_FILE = path.resolve(import.meta.dirname, '../src/characters/jarvis-characters.json')
// Jarvis sets no Crawl-delay. The earlier crawl in mcp_assist used 3 s.
const TRIMMED_FILE = path.resolve(import.meta.dirname, '../src/characters/jarvis-rows.json')
const DELAY_MS = 3000

const stored = new Map(readStored().map((c) => [c.slug, c]))
// The list has the stats and the version of every character, but no stat card
const list = await fetchJarvis(API)
const slugs = new Set(list.map((c) => c.slug))
const removed = [...stored.keys()].filter((slug) => !slugs.has(slug))
const records = new Map([...stored].filter(([slug]) => slugs.has(slug)))
const added = []
const changed = []

try {
  for (const { slug, version } of list) {
    const old = stored.get(slug)
    if (!opts.force && old?.version === version) continue
    await sleep(DELAY_MS)
    records.set(slug, await fetchJarvis(`${API}/${encodeURIComponent(slug)}`))
    if (old) changed.push(slug)
    else added.push(slug)
    console.log(`${old ? 'changed' : 'new    '}  ${slug}`)
  }
} finally {
  // Also runs when a request fails, so the next run continues from the characters downloaded so far
  const sorted = [...records.values()].sort((a, b) => (a.slug < b.slug ? -1 : 1))
  writeJson(OUT_FILE, sorted, { sortKeys: false })
  writeJson(TRIMMED_FILE, trimCharacters(sorted), { sortKeys: false })
}

const unchanged = list.length - added.length - changed.length
console.log(
  `\n${list.length} characters: ${added.length} new, ${changed.length} changed, ${unchanged} unchanged`,
)
if (removed.length)
  console.log(`Removed, because Jarvis no longer lists them: ${removed.join(', ')}`)
console.log(
  `Wrote ${path.relative(process.cwd(), OUT_FILE)} and ${path.relative(process.cwd(), TRIMMED_FILE)}`,
)

function readStored() {
  return fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : []
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
