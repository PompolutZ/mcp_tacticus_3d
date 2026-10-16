// Report for a dice night run (docs/plans/dice-night-run.md, decision 7).
// Reads <folder>/<scenario>.jsonl, writes <folder>/report.md and prints it.
// Usage: pnpm --filter web dice-night-report [folder] [--no-sim]
// Folder default: the newest folder in apps/web/dice-runs/.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FACES } from '../src/dice/faces.js'
import {
  average,
  chiTest,
  expectedCounts,
  faceCounts,
  max,
  percentile,
  symbolCounts,
  symbolShares,
} from './lib/diceStats.mjs'

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RUNS = join(WEB, 'dice-runs')
const ORDER = ['5d-1c', '5d-2c', '5d-3c', '5d-burst', '1d-1c', '1d-2c', '1d-3c', '1d-burst']
const SIM_ARGS = ['--throws', '1000', '--multi-throws', '1000', '--dice', '5']

function newestFolder() {
  if (!existsSync(RUNS)) return null
  const dirs = readdirSync(RUNS)
    .map((n) => join(RUNS, n))
    .filter((p) => statSync(p).isDirectory())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  return dirs[0] ?? null
}

function readLines(file) {
  const out = []
  for (const text of readFileSync(file, 'utf8').split('\n')) {
    if (!text.trim()) continue
    try {
      out.push(JSON.parse(text))
    } catch {
      out.push({ error: 'unreadable line' })
    }
  }
  return out
}

const f1 = (x) => x.toFixed(1)
const f2 = (x) => x.toFixed(2)
const pct = (n, total) => (total ? `${f1((100 * n) / total)}%` : '-')
const sign = (x) => (x >= 0 ? `+${f1(x)}` : f1(x))

function analyze(name, lines) {
  const ok = lines.filter((l) => !l.error && Array.isArray(l.dice))
  const dice = ok.flatMap((l) => l.dice)
  const results = dice.length
  const shares = symbolShares()
  const symbolNames = Object.keys(shares)

  const faces = faceCounts(dice.map((d) => d.face))
  const faceExp = expectedCounts(
    results,
    FACES.map(() => 1 / FACES.length),
  )
  const syms = symbolCounts(dice.map((d) => d.symbol))
  const symObs = symbolNames.map((s) => syms[s])
  const symExp = expectedCounts(
    results,
    symbolNames.map((s) => shares[s]),
  )
  const rest = dice.map((d) => d.restTime).filter(Number.isFinite)
  const throwTimes = ok.map((l) => l.throwTime).filter(Number.isFinite)
  return {
    name,
    throwsOk: ok.length,
    throwsError: lines.length - ok.length,
    results,
    faces,
    faceExp,
    faceTest: results ? chiTest(faces, faceExp) : null,
    symbolNames,
    symObs,
    symExp,
    symTest: results ? chiTest(symObs, symExp) : null,
    tilted: dice.filter((d) => d.tilted).length,
    timedOut: dice.filter((d) => d.timedOut).length,
    outOfWell: dice.filter((d) => d.outOfWell).length,
    lost: dice.reduce((a, d) => a + (d.lost ?? 0), 0),
    restAvg: average(rest),
    restP95: percentile(rest, 95),
    restMax: max(rest),
    throwAvg: average(throwTimes),
    throwP95: percentile(throwTimes, 95),
    sent: average(ok.map((l) => l.clicksSent ?? 0)),
    acted: average(ok.map((l) => l.clicksActed ?? 0)),
    blocked: average(ok.map((l) => l.clicksBlocked ?? 0)),
  }
}

const verdict = (t) =>
  t ? `${t.pass ? 'PASS' : 'FAIL'} (chi2 ${f2(t.chi)}, limit ${t.limit}, p ${f2(t.p)})` : '-'

function scenarioSection(a) {
  const L = []
  L.push(`## ${a.name}`, '')
  L.push(
    `Throws ok: ${a.throwsOk}, error lines: ${a.throwsError}, results (dice): ${a.results}`,
    '',
  )
  if (!a.results) return [...L, 'No results.', ''].join('\n')
  L.push('| Face | Symbol | Count | Expected | Diff |', '|---|---|---|---|---|')
  FACES.forEach((face, i) =>
    L.push(
      `| ${face.number} | ${face.symbol} | ${a.faces[i]} | ${f1(a.faceExp[i])} | ${sign(a.faces[i] - a.faceExp[i])} |`,
    ),
  )
  L.push('', `Faces, 7 df: ${verdict(a.faceTest)}`, '')
  L.push('| Symbol | Count | Expected | Diff |', '|---|---|---|---|')
  a.symbolNames.forEach((s, i) =>
    L.push(`| ${s} | ${a.symObs[i]} | ${f1(a.symExp[i])} | ${sign(a.symObs[i] - a.symExp[i])} |`),
  )
  L.push('', `Symbols, 5 df: ${verdict(a.symTest)}`, '')
  L.push(
    `- Tilted: ${pct(a.tilted, a.results)}, timed out: ${pct(a.timedOut, a.results)}, out of well: ${pct(a.outOfWell, a.results)}, lost: ${f2(a.lost / a.throwsOk)} per throw`,
    `- Rest time (s): avg ${f2(a.restAvg)}, p95 ${f2(a.restP95)}, max ${f2(a.restMax)}`,
    `- Throw time (s): avg ${f2(a.throwAvg)}, p95 ${f2(a.throwP95)}`,
    `- Clicks per throw: sent ${f1(a.sent)}, acted ${f1(a.acted)}, blocked ${f1(a.blocked)}`,
    '',
  )
  return L.join('\n')
}

function summaryTable(all) {
  const rows = [
    ['Throws ok / error', (a) => `${a.throwsOk} / ${a.throwsError}`],
    ['Results', (a) => a.results],
    [
      'Faces',
      (a) => (a.faceTest ? `${a.faceTest.pass ? 'PASS' : 'FAIL'} ${f2(a.faceTest.chi)}` : '-'),
    ],
    ['Faces p', (a) => (a.faceTest ? f2(a.faceTest.p) : '-')],
    [
      'Symbols',
      (a) => (a.symTest ? `${a.symTest.pass ? 'PASS' : 'FAIL'} ${f2(a.symTest.chi)}` : '-'),
    ],
    ['Symbols p', (a) => (a.symTest ? f2(a.symTest.p) : '-')],
    ['Tilted', (a) => pct(a.tilted, a.results)],
    ['Timed out', (a) => pct(a.timedOut, a.results)],
    ['Out of well', (a) => pct(a.outOfWell, a.results)],
    ['Lost / throw', (a) => (a.throwsOk ? f2(a.lost / a.throwsOk) : '-')],
    ['Rest avg (s)', (a) => f2(a.restAvg)],
    ['Rest p95 (s)', (a) => f2(a.restP95)],
    ['Rest max (s)', (a) => f2(a.restMax)],
    ['Throw avg (s)', (a) => f2(a.throwAvg)],
    ['Throw p95 (s)', (a) => f2(a.throwP95)],
    ['Clicks sent', (a) => f1(a.sent)],
    ['Clicks acted', (a) => f1(a.acted)],
    ['Clicks blocked', (a) => f1(a.blocked)],
  ]
  const L = [
    `| | ${all.map((a) => a.name).join(' | ')} |`,
    `|---|${all.map(() => '---').join('|')}|`,
  ]
  for (const [label, fn] of rows) L.push(`| ${label} | ${all.map(fn).join(' | ')} |`)
  return L.join('\n')
}

// Runs dice-sim.mjs and keeps its result lines as text. No parsing, so a changed sim output
// cannot break the report. On any failure, returns the command for the user to run.
function simSection() {
  const cmd = `pnpm --filter web dice-sim ${SIM_ARGS.join(' ')}`
  const r = spawnSync(process.execPath, [join(WEB, 'scripts', 'dice-sim.mjs'), ...SIM_ARGS], {
    encoding: 'utf8',
    cwd: WEB,
    timeout: 120000,
  })
  const lines = (r.stdout ?? '').split('\n').filter((l) => l.trim() && !/perf:/.test(l))
  if (r.status !== 0 || !lines.length) return `Sim did not run here. Run it yourself: \`${cmd}\``
  return ['```', ...lines, '```'].join('\n')
}

const HEADER = `# Dice night run report

How to read this, in plain words.

- **Chi-squared** (chi2) says how uneven the face counts are compared with a fair die. A fair die gives each of the 8 faces 1 time in 8. Even a fair die never gives exact counts, so the test asks: is this spread bigger than random noise would make? **PASS** = no sign of bias (p above 5%). **FAIL** = the spread is too uneven to be luck (p below 5%). Limits at 5%: 14.07 for 8 faces (7 degrees of freedom), 11.07 for 6 symbols (5 df).
- **Size of noise.** With 1000 throws of 1 die, each face expects 125. A random spread of about +-11 per face is normal. The test can see a bias of about 3-4% per face, not a smaller one. With 5 dice there are 5 times more results (5000 per scenario), so a smaller bias shows.
- **Even a fair die fails 1 test in 20.** One FAIL among 16 tests is not proof. Look for the same face high in several scenarios.
- **Dice of one throw are not fully independent.** They hit each other. The test ignores this and treats every die as its own throw.
- Symbols: Hit and Blank are on 2 faces each (expect 2/8), Crit, Wild, Block and Skull on 1 face each (expect 1/8).
- Times are in seconds, counted from the first click.
`

function main() {
  const args = process.argv.slice(2)
  const noSim = args.includes('--no-sim')
  const given = args.find((a) => !a.startsWith('--'))
  const folder = given ? resolve(given) : newestFolder()
  if (!folder || !existsSync(folder)) {
    console.error(`No run folder found${given ? `: ${given}` : ` in ${RUNS}`}`)
    process.exit(1)
  }
  const files = readdirSync(folder).filter((f) => f.endsWith('.jsonl'))
  const names = [
    ...ORDER.filter((n) => files.includes(`${n}.jsonl`)),
    ...files.map((f) => f.slice(0, -6)).filter((n) => !ORDER.includes(n)),
  ]
  if (!names.length) {
    console.error(`No .jsonl files in ${folder}`)
    process.exit(1)
  }
  const all = names.map((n) => analyze(n, readLines(join(folder, `${n}.jsonl`))))

  const out = [HEADER, `Folder: \`${folder}\``, '']
  out.push('## All scenarios', '', summaryTable(all), '')
  out.push('## dice-sim (headless, for comparison)', '')
  out.push(
    noSim
      ? 'Skipped (--no-sim).'
      : 'Same fairness count without the real app (no repeat clicks). Single die first, then 5 dice at once.\n\n' +
          simSection(),
    '',
  )
  for (const a of all) out.push(scenarioSection(a))
  const text = out.join('\n')
  writeFileSync(join(folder, 'report.md'), text)
  console.log(text)
  console.log(`Written: ${join(folder, 'report.md')}`)
}

main()
