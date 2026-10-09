// Downloads the character data from Jarvis Protocol to src/characters/jarvis-characters.json.
// A character is downloaded again only when its `version` changed. See scripts/README.md.

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

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
const DELAY_MS = 3000
// Jarvis returns 403 for an unusual User-Agent or a Referer from another site
const HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://www.jarvis-protocol.com/',
}

const stored = new Map(readStored().map((c) => [c.slug, c]))
// The list has the stats and the version of every character, but no stat card
const list = await getJson(API)
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
    records.set(slug, await getJson(`${API}/${encodeURIComponent(slug)}`))
    if (old) changed.push(slug)
    else added.push(slug)
    console.log(`${old ? 'changed' : 'new    '}  ${slug}`)
  }
} finally {
  // Also runs when a request fails, so the next run continues from the characters downloaded so far
  const sorted = [...records.values()].sort((a, b) => (a.slug < b.slug ? -1 : 1))
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(sorted, null, 2) + '\n')
}

const unchanged = list.length - added.length - changed.length
console.log(
  `\n${list.length} characters: ${added.length} new, ${changed.length} changed, ${unchanged} unchanged`,
)
if (removed.length)
  console.log(`Removed, because Jarvis no longer lists them: ${removed.join(', ')}`)
console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`)

function readStored() {
  return fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : []
}

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return res.json()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
