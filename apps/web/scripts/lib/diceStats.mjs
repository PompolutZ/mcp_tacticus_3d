// Pure helpers for scripts/dice-night-report.mjs: counts, chi-squared, percentiles, averages.
import { FACES } from '../../src/dice/faces.js'

// Chi-squared limit at 5% by degrees of freedom (only the ones the report uses)
export const CHI_LIMIT_5 = { 5: 11.07, 7: 14.07 }

// Expected share of each symbol, from the face table: Hit and Blank 2/8, the others 1/8
export function symbolShares() {
  const shares = {}
  for (const f of FACES) shares[f.symbol] = (shares[f.symbol] ?? 0) + 1 / FACES.length
  return shares
}

// Count of each face number 1..8 (array index = number - 1)
export function faceCounts(numbers) {
  const counts = Array.from({ length: FACES.length }, () => 0)
  for (const n of numbers) if (n >= 1 && n <= FACES.length) counts[n - 1]++
  return counts
}

// Count of each symbol name, every symbol present (0 if missing)
export function symbolCounts(symbols) {
  const counts = Object.fromEntries(Object.keys(symbolShares()).map((s) => [s, 0]))
  for (const s of symbols) if (s in counts) counts[s]++
  return counts
}

// Expected counts for a total, in the order of `shares`
export function expectedCounts(total, shares) {
  return shares.map((s) => total * s)
}

// Pearson chi-squared of observed against expected (parallel arrays)
export function chiSquared(observed, expected) {
  let sum = 0
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] > 0) sum += (observed[i] - expected[i]) ** 2 / expected[i]
  }
  return sum
}

// ln Gamma, Lanczos approximation
function lnGamma(x) {
  const c = [
    76.18009172947146, -86.5053203294168, 24.01409824083091, -1.23173957245015,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.00000000019001
  for (const k of c) ser += k / ++y
  return -tmp + Math.log((2.506628274631 * ser) / x)
}

// Regularized upper incomplete gamma Q(a, x)
function gammaQ(a, x) {
  if (x <= 0) return 1
  if (x < a + 1) {
    // series for P, then Q = 1 - P
    let ap = a
    let sum = 1 / a
    let del = sum
    for (let n = 0; n < 500; n++) {
      ap++
      del *= x / ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - lnGamma(a))
  }
  // continued fraction for Q
  const tiny = 1e-300
  let b = x + 1 - a
  let c = 1 / tiny
  let d = 1 / b
  let h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < tiny) d = tiny
    c = b + an / c
    if (Math.abs(c) < tiny) c = tiny
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h
}

// P-value of a chi-squared statistic: chance of a spread at least this uneven for a fair die
export function chiPValue(chi, df) {
  return gammaQ(df / 2, chi / 2)
}

// Chi-squared test against expected counts. pass = p-value above 5%.
export function chiTest(observed, expected, df = observed.length - 1) {
  const chi = chiSquared(observed, expected)
  const p = chiPValue(chi, df)
  return { chi, df, p, limit: CHI_LIMIT_5[df] ?? null, pass: p > 0.05 }
}

export function average(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

export function max(values) {
  return values.length ? values.reduce((a, b) => (b > a ? b : a), -Infinity) : 0
}

// Percentile p (0..100), linear interpolation between the closest ranks
export function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = ((sorted.length - 1) * p) / 100
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}
