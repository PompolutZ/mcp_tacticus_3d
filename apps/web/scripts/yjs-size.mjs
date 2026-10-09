// Measures the size of a full game as a Yjs document, for the 1 MB limit of a stored table snapshot and the
// write interval of step 7 (docs/feature-auth.md, open question 5). It builds a table with the stores of
// src/net/doc.js and plays rounds through them, the way App.jsx writes: `set` with updater functions on
// lists and records, `setField` for poses, one transaction for a handler that writes several names.
// Snapshot size = Y.encodeStateAsUpdate(doc).byteLength, the same bytes as encodeGame and Save game.
//
// Run with `pnpm --filter web yjs-size`. Options:
//   --rounds <n>   rounds of the first game (default 6). The second game has 3 times as many.
//   --pose-writes <n>  pose writes per move (default 2). 0 shows the size without poses.
//   --seed <n>     seed of the random numbers (default 1)
//
// startTable (src/rooms/table.js) does not import in Node: it needs affiliations.json, which Node does not
// load without an import attribute. So the start state is built by hand, with the same fields. The entities
// have the shape of App.jsx (newCharacter, buildMatTokens, the tactic card and the loose token).

import * as Y from 'yjs'
import { createTable, fillTable, encodeGame } from '../src/net/doc.js'
import { NEW_SETUP } from '../src/setup/setup.js'
import { START_MARKERS } from '../src/scoreboard/board.js'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? fallback : Number(args[i + 1])
}
const ROUNDS = option('rounds', 6)
const SEED = option('seed', 1)

// The game, from the plan
const TERRAIN = 30
const CHARACTERS_PER_SIDE = 6
const TACTICS = 10
const CRISIS_TOKENS = 8

// Per round
const MOVES = 2
const POSE_WRITES_PER_MOVE = option('pose-writes', 2)
const DAMAGE_CHANGES = 3
const POWER_CHANGES = 2
const TOKEN_KEYS = ['stun', 'bleed', 'activated', 'focus', 'slow', 'weakened']
const CRISIS_MOVES = 10
const LOOSE_ADDED = 5
const LOOSE_REMOVED = 3
const TACTIC_FLIPS = 2

// Mulberry32: a small seeded PRNG, so two runs print the same numbers
function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Same rounding as poseOf in src/rooms/table.js
const round4 = (v) => Math.round(v * 1e4) / 1e4

// Mat area in inches, a little inside the mat edge
const MAT_X = 30
const MAT_Z = 20

function makeGame(seed) {
  const random = prng(seed)
  // The app uses crypto.randomUUID. A seeded id of the same length keeps the sizes the same on each run.
  const id = () => {
    const hex = () =>
      Math.floor(random() * 0x10000)
        .toString(16)
        .padStart(4, '0')
    return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`
  }
  const between = (lo, hi) => lo + random() * (hi - lo)
  const pick = (list) => list[Math.floor(random() * list.length)]

  // A rest pose of a model: a random place on the mat, a turn about the vertical axis, a little noise
  const pose = () => {
    const angle = between(0, Math.PI * 2)
    return {
      x: round4(between(-MAT_X, MAT_X)),
      y: round4(1.06 + between(0, 0.002)),
      z: round4(between(-MAT_Z, MAT_Z)),
      qx: round4(between(-0.001, 0.001)),
      qy: round4(Math.sin(angle / 2)),
      qz: round4(between(-0.001, 0.001)),
      qw: round4(Math.cos(angle / 2)),
    }
  }

  const character = (n, teamColor) => ({
    id: id(),
    key: `character-${n}`,
    figure: 'model',
    base: 'medium',
    rotation: 0,
    transform: null,
    teamColor,
    side: 'healthy',
    damage: 0,
    power: 0,
    tokens: {},
  })

  const crisisToken = (n) => ({
    id: id(),
    cardKey: n < CRISIS_TOKENS / 2 ? 'secure-card' : 'extract-card',
    frontKey: `crisis-front-${n}`,
    backKey: n % 2 ? `crisis-back-${n}` : null,
    up: 'front',
    x: round4(between(-MAT_X, MAT_X)),
    z: round4(between(-MAT_Z, MAT_Z)),
    yaw: round4(between(0, Math.PI * 2)),
    canMove: true,
    canFlip: n % 2 === 1,
    hasArc: false,
    hasMarkers: false,
    canHold: n >= CRISIS_TOKENS / 2,
    heldBy: null,
    heldAt: null,
    control: null,
    damage: false,
  })

  const tacticCard = (n) => ({
    id: id(),
    key: `tactic-${n}`,
    team: n < TACTICS / 2 ? 'blue' : 'red',
    x: round4(between(-MAT_X, MAT_X)),
    z: round4(between(-MAT_Z, MAT_Z)),
    up: 'face',
  })

  const looseToken = () => ({
    id: id(),
    key: pick(TOKEN_KEYS),
    x: round4(between(-MAT_X, MAT_X)),
    z: round4(between(-MAT_Z, MAT_Z)),
  })

  const table = createTable()
  const updates = []
  table.doc.on('update', (update) => updates.push(update.byteLength))

  const characters = [
    ...Array.from({ length: CHARACTERS_PER_SIDE }, (_, n) => character(n, 'blue')),
    ...Array.from({ length: CHARACTERS_PER_SIDE }, (_, n) =>
      character(CHARACTERS_PER_SIDE + n, 'red'),
    ),
  ]
  const tactics = Array.from({ length: TACTICS }, (_, n) => tacticCard(n))
  const setup = {
    ...NEW_SETUP,
    deck: { team: 'blue', type: 'secure' },
    picks: { secure: '1234567', extract: '7654321' },
    threat: 8,
    edge: true,
    ready: { blue: true, red: true },
    squads: {
      blue: { characters: [0, 1, 2, 3, 4, 5], tactics: [0, 1, 2, 3, 4] },
      red: { characters: [0, 1, 2, 3, 4, 5], tactics: [0, 1, 2, 3, 4] },
    },
    placed: { characters: characters.map((c) => c.id), tactics: tactics.map((c) => c.id) },
  }
  // A roster is a Jarvis code of about 90 characters
  const code = () =>
    Array.from({ length: 90 }, () => pick('abcdefghijklmnopqrstuvwxyz0123456789')).join('')

  // Setup is one write, the same as Table.jsx and the squads button
  fillTable(table, {
    mapId: 'vibranium-heist',
    matTurns: 0,
    deployLine: false,
    crisis: { secure: 'secure-card', extract: 'extract-card' },
    scoreMarkers: START_MARKERS,
    affiliations: { blue: 'shield', red: 'hydra' },
    rosters: { blue: { code: code() }, red: { code: code() } },
    setup,
    terrain: Array.from({ length: TERRAIN }, (_, index) => ({ id: id(), index, locked: true })),
    characters,
    tokens: Array.from({ length: CRISIS_TOKENS }, (_, n) => crisisToken(n)),
    tactics,
    looseTokens: [],
    tokenPiles: [],
  })
  // The models fall asleep on the mat once
  table.transact(() => {
    for (const ch of characters) table.poses.setField(ch.id, pose())
  })

  function playRound() {
    const characterIds = table.characters.read().map((ch) => ch.id)
    for (const characterId of characterIds) {
      // handleCharacterDamage, handleCharacterPower: the new value is clamped, and differs from the old one
      for (let i = 0; i < MOVES; i++)
        for (let j = 0; j < POSE_WRITES_PER_MOVE; j++) table.poses.setField(characterId, pose())
      for (let i = 0; i < DAMAGE_CHANGES; i++) {
        const damage = Math.floor(random() * 9)
        table.characters.set((prev) =>
          prev.map((ch) => (ch.id === characterId ? { ...ch, damage } : ch)),
        )
      }
      for (let i = 0; i < POWER_CHANGES; i++) {
        const power = Math.floor(random() * 11)
        table.characters.set((prev) =>
          prev.map((ch) => (ch.id === characterId ? { ...ch, power } : ch)),
        )
      }
      // handleCharacterTokenGive
      const tokenKey = pick(TOKEN_KEYS)
      table.characters.set((prev) =>
        prev.map((ch) =>
          ch.id === characterId
            ? { ...ch, tokens: { ...ch.tokens, [tokenKey]: (ch.tokens[tokenKey] ?? 0) + 1 } }
            : ch,
        ),
      )
    }
    for (let i = 0; i < CRISIS_MOVES; i++) {
      const tokenId = pick(table.tokens.read()).id
      if (i % 2 === 0) {
        // handleTokenMove
        const x = round4(between(-MAT_X, MAT_X))
        const z = round4(between(-MAT_Z, MAT_Z))
        table.tokens.set((prev) =>
          prev.map((t) => (t.id === tokenId ? { ...t, x, z, heldBy: null, heldAt: null } : t)),
        )
      } else {
        // handleTokenFlip
        table.tokens.set((prev) =>
          prev.map((t) =>
            t.id === tokenId ? { ...t, up: t.up === 'front' ? 'back' : 'front' } : t,
          ),
        )
      }
    }
    for (let i = 0; i < LOOSE_ADDED; i++) {
      const token = looseToken()
      table.looseTokens.set((prev) => [...prev, token])
    }
    for (let i = 0; i < LOOSE_REMOVED; i++) {
      const removedId = table.looseTokens.read()[0].id
      table.looseTokens.set((prev) => prev.filter((t) => t.id !== removedId))
    }
    for (let i = 0; i < TACTIC_FLIPS; i++) {
      const cardId = pick(table.tactics.read()).id
      table.tactics.set((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, up: c.up === 'face' ? 'back' : 'face' } : c)),
      )
    }
  }

  return { table, updates, playRound }
}

// The same table as JSON: the snapshot of every store
function jsonSize(table) {
  const snapshot = Object.fromEntries(
    Object.entries(table)
      .filter(([name]) => name !== 'doc' && name !== 'transact')
      .map(([name, store]) => [name, store.read()]),
  )
  return Buffer.byteLength(JSON.stringify(snapshot))
}

const snapshotSize = (table) => Y.encodeStateAsUpdate(table.doc).byteLength
const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0)

function play(rounds, verbose) {
  const { table, updates, playRound } = makeGame(SEED)
  const setupSize = snapshotSize(table)
  if (verbose) console.log(`setup: ${setupSize} bytes`)
  const afterSetup = updates.length
  for (let round = 1; round <= rounds; round++) {
    playRound()
    if (verbose) console.log(`round ${round}: ${snapshotSize(table)} bytes`)
  }
  const size = snapshotSize(table)
  if (size !== encodeGame(table).byteLength) throw new Error('encodeGame differs from the snapshot')
  const roundUpdates = updates.slice(afterSetup)
  return { setupSize, size, json: jsonSize(table), updates, roundUpdates }
}

const first = play(ROUNDS, true)
console.log(`\n${ROUNDS} rounds`)
console.log(`  snapshot: ${first.size} bytes`)
console.log(`  JSON:     ${first.json} bytes`)
console.log(
  `  updates:  ${first.updates.length} (average ${average(first.updates).toFixed(1)} bytes)`,
)
console.log(
  `  updates after setup: ${first.roundUpdates.length} (average ${average(first.roundUpdates).toFixed(1)} bytes)`,
)

const long = play(ROUNDS * 3, false)
console.log(`\n${ROUNDS * 3} rounds`)
console.log(`  snapshot: ${long.size} bytes`)
console.log(`  JSON:     ${long.json} bytes`)
console.log(
  `  updates:  ${long.updates.length} (average ${average(long.updates).toFixed(1)} bytes)`,
)
console.log(
  `\n1 MB limit: ${((first.size / 1048576) * 100).toFixed(1)}% used after ${ROUNDS} rounds`,
)
