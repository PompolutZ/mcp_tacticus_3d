// Sounds (docs/features/sounds.md). One AudioContext, made at the first click or key: a browser blocks sound
// before that, so a sound before it is skipped. No React.

import { assetUrl } from './assets/index.js'

// A group is a list of files. playSound picks one at random.
const GROUPS = {
  dice: ['dice-throw-1', 'dice-throw-2', 'dice-throw-3'],
  token: ['chip-lay-1', 'chip-lay-2', 'chip-lay-3'],
  activated: ['chips-stack-1', 'chips-stack-2', 'chips-stack-3'],
  ping: ['bong_001'],
  notice: ['question_001'],
}

// The same group plays at most once in this time (a throw of 5 dice is one sound)
const GROUP_GAP_MS = 80

let context = null
let volume = 0.6
const buffers = new Map()
const lastPlayed = new Map()

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
export function playSound(group) {
  const names = GROUPS[group]
  if (!context || !names || volume <= 0) return
  const now = performance.now()
  if (now - (lastPlayed.get(group) ?? -Infinity) < GROUP_GAP_MS) return
  lastPlayed.set(group, now)
  const name = names[Math.floor(Math.random() * names.length)]
  load(name).then((buffer) => {
    if (!buffer) return
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = volume
    source.connect(gain).connect(context.destination)
    source.start()
  })
}
