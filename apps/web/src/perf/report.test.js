import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, refreshHint } from './report.js'
import { browserName, osName } from './browser.js'

const stats = {
  fps: 58,
  worstMs: 40,
  cpuMs: 6,
  gpuMs: 4.2,
  calls: 100,
  triangles: 5000,
  width: 2000,
  height: 1000,
  dpr: 2,
}
const info = {
  gpuName: 'ANGLE (Test GPU)',
  software: false,
  browser: 'Chrome 140',
  os: 'Windows',
  composer: true,
  pieces: 31,
}

test('the report has every field of the plan', () => {
  const text = buildReport(stats, info)
  for (const name of [
    'FPS',
    'Slowest frame',
    'CPU per frame',
    'GPU per frame',
    'GPU',
    'Software renderer',
    'Browser',
    'OS',
    'Pixel ratio',
    'Canvas',
    'Screen refresh',
    'Faster drawing',
    'Pieces on table',
  ])
    assert.match(text, new RegExp(`^${name}: .+`, 'm'), name)
  assert.ok(text.includes(info.gpuName))
  assert.ok(text.includes(info.browser))
  assert.ok(text.includes(info.os))
  assert.ok(text.includes('2000x1000'))
})

test('a missing gpuMs or GPU name is "not available"', () => {
  const text = buildReport({ ...stats, gpuMs: null }, { ...info, gpuName: null })
  assert.match(text, /^GPU per frame: not available$/m)
  assert.match(text, /^GPU: not available$/m)
})

test('the software renderer and the setting show as yes / on', () => {
  const text = buildReport(stats, { ...info, software: true, composer: false })
  assert.match(text, /^Software renderer: yes$/m)
  assert.match(text, /^Faster drawing: on$/m)
})

test('refresh hint: 30 names the limit, common rates are told, others are not', () => {
  assert.match(refreshHint(29.5), /30/)
  assert.match(refreshHint(59), /60/)
  assert.match(refreshHint(119), /120/)
  assert.match(refreshHint(45), /no common rate/)
})

test('browser name: Chrome and Edge from brands, Brave from navigator.brave', () => {
  const grease = { brand: 'Not.A/Brand', version: '99' }
  const chromium = { brand: 'Chromium', version: '140' }
  const chrome = { brand: 'Google Chrome', version: '140' }
  assert.equal(browserName({ brands: [grease, chromium, chrome] }), 'Google Chrome 140')
  assert.equal(
    browserName({ brands: [grease, chromium, { brand: 'Microsoft Edge', version: '140' }] }),
    'Microsoft Edge 140',
  )
  assert.equal(browserName({ brands: [grease, chromium, chrome], brave: true }), 'Brave 140')
})

test('browser name: user agent when there are no brands', () => {
  assert.equal(
    browserName({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
    }),
    'Firefox 130.0',
  )
  assert.equal(
    browserName({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    }),
    'Safari 17.5',
  )
  assert.equal(
    browserName({ userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0' }),
    'Edge 140.0.0.0',
  )
  assert.equal(browserName({}), 'unknown')
})

test('OS from the platform, else from the user agent', () => {
  assert.equal(osName({ platform: 'Windows' }), 'Windows')
  assert.equal(osName({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }), 'macOS')
  assert.equal(osName({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }), 'Linux')
  assert.equal(osName({}), 'unknown')
})
