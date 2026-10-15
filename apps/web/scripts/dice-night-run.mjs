// Night run of dice throws in the real app (docs/plans/dice-night-run.md, decisions 3-6).
// Needs the dev server running. Opens headed Chromium on #sandbox&dicetest, drives globalThis.__diceTest
// and writes one JSON line per throw to <out>/<scenario>.jsonl. See scripts/README.md, "Dice night run".
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CLICK_INTERVAL_MS = 200
const IDLE_TIMEOUT_MS = 15000
const RECORD_TIMEOUT_MS = 30000

const ALL = []
for (const dice of [5, 1])
  for (const [label, clicks] of [
    ['1c', 1],
    ['2c', 2],
    ['3c', 3],
    ['burst', 10],
  ])
    ALL.push({ name: `${dice}d-${label}`, dice, clicks })

function parseArgs(argv) {
  const o = {
    url: 'http://localhost:5173/#sandbox&dicetest',
    throws: 1000,
    scenarios: ALL.map((s) => s.name),
    out: join(WEB, 'dice-runs', new Date().toISOString().slice(0, 10)),
    resume: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--resume') o.resume = true
    else if (a === '--url') o.url = argv[++i]
    else if (a === '--throws') o.throws = Number(argv[++i])
    else if (a === '--out') o.out = resolve(argv[++i])
    else if (a === '--scenarios') o.scenarios = argv[++i].split(',')
    else throw new Error(`Unknown option ${a}`)
  }
  if (!Number.isInteger(o.throws) || o.throws < 1)
    throw new Error('--throws must be a positive integer')
  for (const n of o.scenarios)
    if (!ALL.some((s) => s.name === n)) throw new Error(`Unknown scenario ${n}`)
  return o
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stamp = () => new Date().toISOString()

async function main() {
  const opt = parseArgs(process.argv.slice(2))
  mkdirSync(opt.out, { recursive: true })
  const errLog = join(opt.out, 'errors.log')
  const logError = (msg) => {
    console.error(`[error] ${msg}`)
    appendFileSync(errLog, `${stamp()} ${msg}\n`)
  }

  try {
    const res = await fetch(opt.url.split('#')[0])
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (e) {
    console.error(
      `Dev server not reachable at ${opt.url}: ${e.message}\nStart it with: pnpm --filter web dev`,
    )
    process.exit(1)
  }

  // Keeps the Mac and its display awake while this process lives
  let caff = null
  if (process.platform === 'darwin') {
    caff = spawn('caffeinate', ['-dis', '-w', String(process.pid)], { stdio: 'ignore' })
    caff.on('error', () => {})
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  })
  let page = null

  const openPage = async () => {
    if (page) await page.close().catch(() => {})
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.on('console', (m) => {
      if (m.type() === 'error') logError(`console: ${m.text()}`)
    })
    page.on('pageerror', (e) => logError(`pageerror: ${e.message}`))
    page.on('crash', () => logError('page crash'))
    await page.goto(opt.url)
    await page.waitForFunction(() => globalThis.__diceTest, null, { timeout: 120000 })
  }

  // poll fn in the page until it returns truthy, or timeout (returns the value or null)
  const pollIdle = async (timeoutMs) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      if (await page.evaluate(() => globalThis.__diceTest.isIdle())) return true
      await sleep(100)
    }
    return false
  }
  const pollRecord = async (timeoutMs) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      const recs = await page.evaluate(() => globalThis.__diceTest.takeRecords())
      if (recs.length) return recs[recs.length - 1]
      await sleep(100)
    }
    return null
  }

  const oneThrow = async (s) => {
    await page.evaluate((n) => {
      globalThis.__diceTest.clear()
      globalThis.__diceTest.takeRecords()
      globalThis.__diceTest.add(n)
    }, s.dice)
    await sleep(300) // the dice entries appear a render after add()
    if (!(await pollIdle(IDLE_TIMEOUT_MS)))
      return { error: 'timeout: dice not at rest before the throw' }
    await page.evaluate(
      ([c, ms]) => globalThis.__diceTest.clicks(c, ms),
      [s.clicks, CLICK_INTERVAL_MS],
    )
    const rec = await pollRecord(RECORD_TIMEOUT_MS)
    return rec ?? { error: 'timeout: no record after the throw' }
  }

  let stopping = false
  process.on('SIGINT', () => {
    stopping = true
    console.log('\nStopping after this throw...')
  })

  await openPage()
  console.log(`Output: ${opt.out}`)

  for (const name of opt.scenarios) {
    const s = ALL.find((x) => x.name === name)
    const file = join(opt.out, `${name}.jsonl`)
    let done = 0
    if (existsSync(file)) {
      if (!opt.resume) {
        console.error(`${file} exists. Use --resume to continue, or another --out.`)
        process.exit(1)
      }
      done = readFileSync(file, 'utf8').split('\n').filter(Boolean).length
    }
    const t0 = Date.now()
    const start = done
    for (let i = done; i < opt.throws && !stopping; i++) {
      let rec
      try {
        if (page.isClosed() || !(await page.evaluate(() => !!globalThis.__diceTest)))
          throw new Error('hook gone')
        rec = await oneThrow(s)
      } catch (e) {
        logError(`${name} #${i}: ${e.message}; reloading`)
        rec = { error: e.message }
        try {
          await openPage()
        } catch (e2) {
          logError(`reload failed: ${e2.message}`)
          await sleep(5000)
        }
      }
      if (rec.error) logError(`${name} #${i}: ${rec.error}`)
      const line = { scenario: name, throw: i, time: stamp(), ...rec }
      appendFileSync(file, JSON.stringify(line) + '\n')
      const n = i + 1
      if (n % 50 === 0 || n === opt.throws) {
        const avg = (Date.now() - t0) / (n - start) / 1000
        const eta = ((opt.throws - n) * avg) / 60
        console.log(
          `${name}: ${n}/${opt.throws}, avg ${avg.toFixed(1)} s/throw, ETA ${eta.toFixed(0)} min`,
        )
      }
    }
    const avg = start < opt.throws ? (Date.now() - t0) / Math.max(1, opt.throws - start) / 1000 : 0
    console.log(`${name} finished, ${avg.toFixed(1)} s/throw`)
    if (stopping) break
  }

  await browser.close()
  caff?.kill()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
