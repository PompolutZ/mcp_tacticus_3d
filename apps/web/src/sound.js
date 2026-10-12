// Sounds (docs/features/sounds.md). One AudioContext, made at the first click or key: a browser blocks sound
// before that, so a sound before it is skipped. No React.

import { assetUrl } from './assets/index.js'
import { createBumpGate } from './soundGate.js'

const range = (name, count) => Array.from({ length: count }, (_, i) => `${name}-${i + 1}`)

// A group is a list of files. playSound picks one at random.
const GROUPS = {
  shake: range('shake', 16),
  die: range('die-hit', 16),
  modelMat: ['model-mat-1'],
  modelTerrain: range('model-terrain', 11),
  token: ['chip-lay-1', 'chip-lay-2', 'chip-lay-3'],
  activated: ['chips-stack-1', 'chips-stack-2', 'chips-stack-3'],
  ping: ['ping-bing'],
  notice: ['question_001'],
}

// The same group plays at most once in this time. Not for the groups below: 5 dice bump at the same time.
const GROUP_GAP_MS = 80
const NO_GAP_GROUPS = new Set(['shake', 'die', 'modelMat', 'modelTerrain'])

// The Roll shake: one file at each time (ms after the start) with this part of the volume
const SHAKE_TIMES_MS = [0, 260, 430, 540]
const SHAKE_VOLUMES = [1, 0.55, 0.3, 0.15]

let context = null
let volume = 0.6
const buffers = new Map()
const lastPlayed = new Map()
const bumpGate = createBumpGate()

// volume: 0 to 1
export function setVolume(value) {
  volume = Math.min(1, Math.max(0, value))
}

// Fetches and decodes a file once. The promise is kept, so two calls share one fetch.
function load(name) {
  if (!buffers.has(name)) {
    const promise = fetch(assetUrl(`sounds/${name}.mp3`))
      .then((response) => response.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .catch(() => null)
    buffers.set(name, promise)
  }
  return buffers.get(name)
}

function start() {
  if (context || typeof AudioContext === 'undefined') return
  context = new AudioContext()
  for (const names of Object.values(GROUPS)) for (const name of names) load(name)
}

// The first pointerdown or keydown makes the context
if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown'])
    window.addEventListener(type, start, { once: true })
}

// group: a key of GROUPS. Does nothing before the first click or key, or with volume 0.
// volume: 0 to 1, multiplies the setting. key: the piece that bumps, for the bump limits
// (docs/features/sounds.md). With a key the group gap does not apply.
export function playSound(group, { volume: part = 1, key } = {}) {
  const names = GROUPS[group]
  if (!context || !names || volume <= 0 || part <= 0) return
  const now = performance.now()
  if (key !== undefined) {
    if (!bumpGate(key, now)) return
  } else if (!NO_GAP_GROUPS.has(group)) {
    if (now - (lastPlayed.get(group) ?? -Infinity) < GROUP_GAP_MS) return
    lastPlayed.set(group, now)
  }
  const name = names[Math.floor(Math.random() * names.length)]
  load(name).then((buffer) => {
    if (!buffer) return
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = volume * Math.min(1, part)
    source.connect(gain).connect(context.destination)
    source.start()
  })
}

// The sound of dice shaken in a hand. Every call starts a new pattern, so fast clicks sound like shaking.
export function playShake() {
  SHAKE_TIMES_MS.forEach((time, i) => {
    if (time === 0) playSound('shake', { volume: SHAKE_VOLUMES[i] })
    else setTimeout(() => playSound('shake', { volume: SHAKE_VOLUMES[i] }), time)
  })
}
