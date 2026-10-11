import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, ConvexHullCollider, useRapier } from '@react-three/rapier'
import { D8_CORNERS, D8_DENSITY, FACES, SYMBOLS } from '../dice/faces.js'
import {
  DIE_BODY,
  DIE_GRAVITY_SCALE,
  DIE_SOLVER_ITERATIONS,
  SETTLE_TIME,
  SETTLE_TIMEOUT,
  isFinitePoint,
  isFiniteQuat,
  isTilted,
  randomRotation,
  randomSpin,
  stillTime,
  throwVelocities,
  topFace,
} from '../dice/throw.js'
import {
  SHELF_SLOT_COUNT,
  aboveRollLimit,
  freeDropPoint,
  randomWellPoint,
  shelfSlot,
  trayToWorld,
  trayToWorldRotation,
} from '../dice/tray.js'
import {
  SHELF_MOVE_TIME,
  defaultFaceForSymbol,
  flatRotation,
  shelfMovePose,
  sortShelfEntries,
} from '../dice/shelf.js'
import { changeEntry, clearEntry, throwEntry } from '../dice/history.js'
import { dieEntry, dieId, nextOrder, roundPose, trayCounts } from '../dice/stored.js'
import { FALL_LIMIT_Y } from '../table.js'
import { TrayBody, useDieLook } from './DiceTrayParts.jsx'

// A tray holds at most 42 dice, shelf and well together (design, "Roll flow"). SHELF_SLOT_COUNT
// is also 42 (one shelf place per die), so this reuses it instead of a second magic number.
const MAX_DICE = SHELF_SLOT_COUNT

const ZERO = { x: 0, y: 0, z: 0 }

// The die's own vertices (faces.js), flattened for ConvexHullCollider's args.
const dieVertices = Float32Array.from(D8_CORNERS.flat())

// The dice of a tray at mount: the shelf dice of its side of the document, each at its slot, so they
// start kinematic with no slide. side: the stored side, or undefined. docDice: the stored entries,
// for the first counts of the keys.
function shelfFromDocument(trayKey, side) {
  const docDice = side?.dice ?? {}
  const shelf = Object.entries(docDice)
    .filter(([, d]) => d.place === 'shelf' && FACES[d.face - 1] && Number.isFinite(d.order))
    .slice(0, MAX_DICE)
    .map(([id, d]) => ({ id, order: d.order, face: d.face, symbol: FACES[d.face - 1].symbol }))
  const dice = new Map()
  const ids = []
  sortShelfEntries(shelf).forEach((d, index) => {
    const q = trayToWorldRotation(trayKey, flatRotation(d.face))
    const p = trayToWorld(trayKey, shelfSlot(index))
    dice.set(d.id, {
      ...d,
      doc: dieEntry(d.order, 'shelf', { face: d.face }),
      body: null,
      state: 'shelf',
      waiting: false,
      settling: false,
      stillTime: 0,
      throwTime: 0,
      slot: index,
      moving: false,
      spawn: { position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w] },
    })
    ids.push(d.id)
  })
  return { dice, ids, docDice, critsUsed: side?.critsUsed === true }
}

// One die: a RigidBody with a convex hull collider (the die shape) and a shared mesh. A new die
// starts dynamic; startShelfMove below switches it to kinematicPosition the first time it reaches
// the shelf. A die that starts on the shelf (from the document) is kinematic at once, and has its
// `slot` set. The RigidBody ref is written into the die's entry in the parent's `dice` map (see
// DiceTray), not kept as React state, so a physics step never has to re-render this component.
function Die({ id, dice, geometry, material }) {
  const entry = dice.current.get(id)
  // Read once: a body type that changes with a re-render would fight startShelfMove
  const [type] = useState(() => (entry.slot === undefined ? 'dynamic' : 'kinematicPosition'))
  function setBody(rb) {
    const e = dice.current.get(id)
    if (e) e.body = rb ?? null
  }
  return (
    <RigidBody
      ref={setBody}
      type={type}
      position={entry.spawn.position}
      quaternion={entry.spawn.quaternion}
      colliders={false}
      ccd
      additionalSolverIterations={DIE_SOLVER_ITERATIONS}
      gravityScale={DIE_GRAVITY_SCALE}
      linearDamping={DIE_BODY.linearDamping}
      angularDamping={DIE_BODY.angularDamping}
    >
      <ConvexHullCollider
        args={[dieVertices]}
        friction={DIE_BODY.friction}
        frictionCombineRule={DIE_BODY.frictionCombineRule}
        restitution={DIE_BODY.restitution}
        restitutionCombineRule={DIE_BODY.restitutionCombineRule}
        density={D8_DENSITY}
      />
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
    </RigidBody>
  )
}

// One dice tray: the tray body, the dice bodies, the roll flow, and the keys on the tray (see
// DiceKeys.jsx). trayKey: 'blue' | 'red'. openMenuSymbol, onMenuToggle, onMenuClose: the face
// menu of this tray, lifted to App so Escape can close it.
// store: the dice record store of the table (net/doc.js). The tray reads its side at mount and
// writes it when a die changes its place or face (dice/stored.js).
// rolls: the roll history list of the table. transact(fn): fn writes several stores as one change.
// The tray adds a history entry in the same change as the dice (dice/history.js).
// onHover(over): the pointer moved onto (true) or off (false) the tray, for the number keys.
// addRef(addDice): gets addDice, for the number keys, and null on unmount. Both are only given
// for the player's tray (Scene.jsx).
// diceLives: a ref to { side: getter }. The tray registers a getter for LiveSync with the live pose of each
// die that is not on the shelf (net/livePose.js, kind die).
export default function DiceTray({
  trayKey,
  store,
  rolls,
  transact,
  onThrowEnd,
  openMenuSymbol = null,
  onMenuToggle,
  onMenuClose,
  onHover,
  addRef,
  diceLives,
}) {
  const { rapier } = useRapier()

  // Every die lives here: id -> { id, order, source, was, doc, body, state, symbol, face, settling, stillTime,
  // throwTime, spawn, slot, moveFrom, moveTo, moveElapsed, moving }. source: 'roll' | 'crits' | 'reroll',
  // where the die came from until its throw ends, and was: the old symbol of a reroll (history). doc: the die entry of the
  // document (dice/stored.js); it changes only when the die's place or face changes, and a write
  // builds the side from these. settling: a new or rerolled die that falls to rest, 'air' in the
  // document until it rests. state: 'well' (resting, done or not yet thrown)
  // | 'thrown' (in the air) | 'shelf'. waiting: a die that rests tilted (or did not rest in time)
  // waits in 'well', still 'air' in the document, with no symbol; rested: it was still when it
  // began to wait, so a later move means a hit. A die keeps its `symbol` (and `face`, the exact face number
  // it landed on) once it settles, even while it still sits in 'well' waiting for the rest of the
  // throw to finish. React state holds only the ordered list of ids (`ids`) and what the keys show
  // (`keys`); the roll flow itself lives in this ref.
  // At mount only the shelf dice come back from the document (decision 3 of the step 10 plan);
  // dice in the well and in the air are temporary.
  const [initial] = useState(() => shelfFromDocument(trayKey, store.get(trayKey)))
  const dice = useRef(initial.dice)
  const idsRef = useRef(initial.ids)
  const [ids, setIds] = useState(initial.ids)
  // What the keys show: { well, shelf, critsAvailable }, see reportChange.
  const [keys, setKeys] = useState(() => trayCounts(initial.docDice, initial.critsUsed))
  const lastReported = useRef(null)

  // True once addCrits has added dice this roll; reset by clear() (design, "Roll flow" step 7 /
  // the rulebook's "once per roll, not per Crit" rule).
  const critsUsedRef = useRef(initial.critsUsed)
  // A change of a die entry waits for the end of the frame, so dice that change together are one write
  const dirtyRef = useRef(false)

  // History entries that wait for the next commit
  const pendingRolls = useRef([])

  // Where the dice of the running throw came from, kept until the last of them reaches the shelf:
  // a throw with tilted dice has several parts, and the history has one entry for it.
  const throwFrom = useRef({ roll: [], crits: [], reroll: [] })

  // Makes this side of the document equal to the dice in memory, and adds the waiting history
  // entries: one change.
  function commit() {
    dirtyRef.current = false
    const side = { critsUsed: critsUsedRef.current, dice: {} }
    for (const entry of dice.current.values()) side.dice[entry.id] = entry.doc
    const entries = pendingRolls.current
    pendingRolls.current = []
    transact(() => {
      store.setField(trayKey, side)
      if (entries.length > 0) rolls.set((prev) => [...prev, ...entries])
    })
    // The history wrote a throw: this browser's throw ended, so it reads the roll off (App.jsx)
    if (entries.some((entry) => entry.kind === 'throw')) onThrowEnd?.(trayKey)
  }

  // The stored pose of a body now, or null when it is not finite or the body is not there yet
  function bodyPose(entry) {
    const rb = entry.body
    return rb ? roundPose(rb.translation(), rb.rotation()) : null
  }

  const { geometry: dieGeometry, material: dieMaterial } = useDieLook()

  // Throws (or re-throws) one die from where it is now. respawn: first move the die to a free
  // point above the well, as a new die (a die that fell off the table or went non-finite). See the
  // "Tilted dice" rule: a tilted die throws again from where it is, a lost die from above the well.
  // The point is above the well, not on its floor, so the die does not start inside the tray or
  // inside a die that rests there.
  function throwDie(entry, { respawn = false } = {}) {
    const rb = entry.body
    if (!rb) return
    rb.wakeUp() // a sleeping body's pose is not synced to its mesh until it wakes (Pitfalls)
    if (respawn) {
      // setTranslation moves the body at once, so a later respawn in the same frame sees this die
      rb.setTranslation(freeDropPoint(trayKey, wellOccupiedPoints(entry.id)), true)
      rb.setLinvel(ZERO, true)
      rb.setAngvel(ZERO, true)
    }
    const from = rb.translation()
    const target = randomWellPoint(trayKey)
    const { linvel, angvel } = throwVelocities(from, target)
    const q = randomRotation()
    rb.setRotation(q, true)
    rb.setLinvel(linvel, true)
    rb.setAngvel(angvel, true)
    entry.state = 'thrown'
    entry.waiting = false
    entry.settling = false
    entry.stillTime = 0
    entry.throwTime = 0
  }

  // Every point a new or rerolled die must stay away from: every die not on the shelf, whether
  // its RigidBody has mounted yet or not. A die added in the same commit as another one has no
  // `body` yet, so its `spawn` point (the one it will actually appear at) stands in for it — the
  // gap 4a left open, now that addCrits can add several dice in one call.
  // exceptId: a die that is about to move, so it does not block its own new point.
  function wellOccupiedPoints(exceptId) {
    const points = []
    for (const entry of dice.current.values()) {
      if (entry.state === 'shelf' || entry.id === exceptId) continue
      if (entry.body) {
        const p = entry.body.translation()
        points.push({ x: p.x, y: p.y, z: p.z })
      } else if (entry.spawn) {
        const [x, y, z] = entry.spawn.position
        points.push({ x, y, z })
      }
    }
    return points
  }

  // Every die currently on the shelf.
  function shelfEntries() {
    const entries = []
    for (const entry of dice.current.values()) if (entry.state === 'shelf') entries.push(entry)
    return entries
  }

  // Shelf counts, one key per symbol, 0 when empty.
  function shelfCounts() {
    const counts = {}
    for (const symbol of SYMBOLS) counts[symbol] = 0
    for (const entry of dice.current.values()) if (entry.state === 'shelf') counts[entry.symbol]++
    return counts
  }

  // Starts (or restarts) a die's slide to shelf slot `index`, from wherever it actually is now.
  // The first time a die reaches the shelf this also switches its body to kinematicPosition, so
  // thrown dice bounce off it but cannot move it or change its face (design, "Roll flow").
  function startShelfMove(entry, index) {
    const rb = entry.body
    if (!rb) return
    rb.wakeUp()
    if (entry.slot === undefined) rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
    entry.slot = index
    const t = rb.translation()
    const rot = rb.rotation()
    entry.moveFrom = {
      position: { x: t.x, y: t.y, z: t.z },
      rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
    }
    entry.moveTo = {
      position: trayToWorld(trayKey, shelfSlot(index)),
      rotation: trayToWorldRotation(trayKey, flatRotation(entry.face)),
    }
    entry.moveElapsed = 0
    entry.moving = true
  }

  // Re-sorts the shelf by symbol (design, "Roll flow") and moves every die whose slot changed.
  // `forceIds`: also move these even if their slot number did not change (change() turns a die to
  // a new face in place; its position on the shelf can land on the same slot index by chance, but
  // its rotation still needs to update).
  function resortShelf(forceIds) {
    const sorted = sortShelfEntries(shelfEntries())
    sorted.forEach((entry, index) => {
      if (entry.slot === index && !(forceIds && forceIds.has(entry.id))) return
      startShelfMove(entry, index)
    })
  }

  // Dice that rest flat have a result (design, "Roll flow" step 5): move them onto the shelf and
  // re-sort it, in one change of the document. Their results wait in throwFrom for the history.
  function moveToShelf(finishedEntries) {
    // Where the dice came from: new (roll), Crits, or reroll with the old symbol
    const from = throwFrom.current
    for (const entry of finishedEntries) {
      if (entry.source === 'reroll') from.reroll.push([entry.was, entry.symbol])
      else from[entry.source ?? 'roll'].push(entry.symbol)
      entry.source = null
      entry.was = null
      entry.state = 'shelf'
      entry.doc = dieEntry(entry.order, 'shelf', { face: entry.face })
    }
    resortShelf()
    dirtyRef.current = true
  }

  // The last die of the throw is on the shelf: one history entry with all the results of the throw
  function endThrow() {
    const from = throwFrom.current
    throwFrom.current = { roll: [], crits: [], reroll: [] }
    const logged = throwEntry(trayKey, Date.now(), from)
    if (logged) pendingRolls.current.push(logged)
    dirtyRef.current = true
  }

  // Adds one die at a free point above the well. Does nothing once the tray holds MAX_DICE.
  // Returns whether it added one.
  function addDie(source = 'roll') {
    if (dice.current.size >= MAX_DICE) return false
    const point = freeDropPoint(trayKey, wellOccupiedPoints())
    const q = randomRotation()
    const id = dieId(dice.current)
    const order = nextOrder(dice.current.values())
    dice.current.set(id, {
      id,
      order,
      source,
      was: null,
      doc: dieEntry(order, 'air', { pose: roundPose(point, q) }),
      body: null,
      state: 'well',
      waiting: false,
      symbol: null,
      face: null,
      settling: true,
      stillTime: 0,
      throwTime: 0,
      spawn: { position: [point.x, point.y, point.z], quaternion: [q.x, q.y, q.z, q.w] },
    })
    idsRef.current.push(id)
    return true
  }

  // Adds `count` dice, fewer when the tray reaches MAX_DICE. Returns how many it added. It does not
  // write the document: the caller does (commit).
  function addMany(count, source) {
    let added = 0
    while (added < count && addDie(source)) added++
    if (added > 0) setIds(idsRef.current.slice())
    return added
  }

  function addDice(count) {
    const added = addMany(count)
    if (added > 0) commit()
    return added
  }

  // add/remove/roll/clear/addCrits/reroll/change read and write `dice` and `idsRef` directly (not
  // React state), so they stay correct no matter how long ago this component last rendered. The
  // keys on the tray call them (DiceKeys.jsx).
  function add() {
    addDice(1)
  }

  // Removes the last added die that is not on the shelf. Does nothing when every die is on the
  // shelf, or the tray is empty.
  function remove() {
    for (let i = idsRef.current.length - 1; i >= 0; i--) {
      const id = idsRef.current[i]
      const entry = dice.current.get(id)
      if (!entry || entry.state === 'shelf') continue
      dice.current.delete(id)
      idsRef.current.splice(i, 1)
      setIds(idsRef.current.slice())
      commit()
      return
    }
  }

  // Throws every die that is not on the shelf, from where it is. A die of the current throw that is
  // still high in the air only gets a new spin, as in TTS (ROLL_HEIGHT_LIMIT in tray.js).
  function roll() {
    for (const entry of dice.current.values()) {
      if (entry.state === 'shelf') continue
      // Every die that is not on the shelf moves now. A die that is 'air' already keeps its entry.
      if (entry.doc.place !== 'air') {
        const pose = bodyPose(entry)
        if (pose) entry.doc = dieEntry(entry.order, 'air', { pose })
      }
      if (
        entry.state === 'thrown' &&
        entry.body &&
        aboveRollLimit(trayKey, entry.body.translation())
      ) {
        entry.body.setAngvel(randomSpin(), true)
        continue
      }
      throwDie(entry)
    }
    commit()
  }

  // Removes every die (design, "Roll flow" step 9).
  function clear() {
    if (dice.current.size > 0) pendingRolls.current.push(clearEntry(trayKey, Date.now()))
    idsRef.current = []
    dice.current.clear()
    throwFrom.current = { roll: [], crits: [], reroll: [] }
    setIds([])
    critsUsedRef.current = false
    commit()
  }

  // Adds one die per Crit on the shelf. Does nothing when there are no Crits on the shelf, or once
  // used already this roll (design, "Roll flow" step 7 / the rulebook's "once per roll" rule) —
  // clear() is what allows it again.
  function addCrits() {
    if (critsUsedRef.current) return
    if (addMany(shelfCounts().crit, 'crits') > 0) {
      critsUsedRef.current = true
      commit()
    }
  }

  // Moves one shelf die showing `symbol` back into the well, dynamic again, at a free drop point.
  // Does nothing when the shelf has no die with that symbol.
  function reroll(symbol) {
    const entry = shelfEntries().find((e) => e.symbol === symbol)
    if (!entry) return
    const rb = entry.body
    if (!rb) return
    rb.wakeUp()
    rb.setBodyType(rapier.RigidBodyType.Dynamic, true)
    const point = freeDropPoint(trayKey, wellOccupiedPoints())
    const q = randomRotation()
    rb.setTranslation(point, true)
    rb.setRotation(q, true)
    rb.setLinvel(ZERO, true)
    rb.setAngvel(ZERO, true)
    entry.source = 'reroll'
    entry.was = symbol
    entry.symbol = null
    entry.face = null
    entry.state = 'well'
    entry.waiting = false
    entry.settling = true
    entry.doc = dieEntry(entry.order, 'air', { pose: roundPose(point, q) })
    entry.slot = undefined
    entry.moving = false
    entry.stillTime = 0
    entry.throwTime = 0
    resortShelf() // close the gap this die left on the shelf
    commit()
  }

  // Turns one shelf die showing `symbol` to `toSymbol` in place and re-sorts the shelf. Does
  // nothing when the shelf has no die with that symbol.
  function change(symbol, toSymbol) {
    const entry = shelfEntries().find((e) => e.symbol === symbol)
    if (!entry) return
    pendingRolls.current.push(changeEntry(trayKey, Date.now(), symbol, toSymbol))
    entry.symbol = toSymbol
    entry.face = defaultFaceForSymbol(toSymbol)
    entry.doc = dieEntry(entry.order, 'shelf', { face: entry.face })
    resortShelf(new Set([entry.id]))
    commit()
  }

  // Sets what the keys show, { well, shelf, critsAvailable }, only when a value changed since the
  // last frame, so a rolling or moving tray does not re-render this component every frame.
  function reportChange(well) {
    const shelf = shelfCounts()
    const critsAvailable = critsUsedRef.current ? 0 : shelf.crit
    const last = lastReported.current
    const changed =
      !last ||
      last.well !== well ||
      last.critsAvailable !== critsAvailable ||
      SYMBOLS.some((symbol) => last.shelf[symbol] !== shelf[symbol])
    if (!changed) return
    lastReported.current = { well, critsAvailable, shelf }
    setKeys(lastReported.current)
  }

  // At mount, writes the side: the dice in the well and in the air go away from the document
  useEffect(() => {
    commit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Registered on every render, the same as the turn of a tool (RulerTool.jsx)
  useEffect(() => {
    addRef?.(addDice)
    return () => addRef?.(null)
  })

  // The live poses for LiveSync: the dice that are not on the shelf, read when asked
  useEffect(() => {
    if (!diceLives) return undefined
    const lives = diceLives.current
    lives[trayKey] = () => {
      const out = []
      for (const entry of dice.current.values()) {
        const rb = entry.body
        if (entry.state === 'shelf' || !rb) continue
        const t = rb.translation()
        const r = rb.rotation()
        out.push({
          key: `die:${entry.id}`,
          pose: { x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w },
        })
      }
      return out
    }
    return () => {
      delete lives[trayKey]
    }
  }, [diceLives, trayKey])

  // The roll flow: read faces once a thrown die rests (in the well or outside it, as in TTS),
  // let a tilted die wait, move a lost die (fell off the table, non-finite) back above the well,
  // slide shelf dice to their slot, move the flat dice onto the shelf, throw the waiting dice
  // again when the slide ends, and report.
  useFrame((_state, dt) => {
    const rethrows = []
    let well = 0
    for (const entry of dice.current.values()) {
      if (entry.state !== 'shelf') well++
      // A waiting die that moves again (another die hit it) is a moving die of the throw again
      if (entry.state === 'well' && entry.waiting && entry.rested && entry.body) {
        const rb = entry.body
        if (stillTime(0, rb.linvel(), rb.angvel(), dt) === 0) {
          entry.state = 'thrown'
          entry.waiting = false
          entry.stillTime = 0
          entry.throwTime = 0
        }
      }
      if (entry.state !== 'thrown') continue
      const rb = entry.body
      if (!rb) continue
      const t = rb.translation()
      const rot = rb.rotation()
      const linvel = rb.linvel()
      const angvel = rb.angvel()
      const finite = isFinitePoint(t) && isFinitePoint(linvel) && isFiniteQuat(rot)
      entry.stillTime = stillTime(entry.stillTime, linvel, angvel, dt)
      entry.throwTime += dt
      const settled = entry.stillTime >= SETTLE_TIME
      const timedOut = entry.throwTime >= SETTLE_TIMEOUT
      if (!finite || settled || timedOut) {
        // A lost die (non-finite, or below the table) is thrown again from above the well. A tilted
        // die, or one that did not rest in time, waits for the other dice. A flat die counts, in
        // the well or outside it (design, "Tilted dice").
        const lost = !finite || t.y < FALL_LIMIT_Y
        const { face, dot } = topFace(rot)
        if (lost) {
          rethrows.push({ entry, respawn: true })
        } else if (timedOut || isTilted(dot)) {
          entry.state = 'well'
          entry.waiting = true
          entry.rested = settled
          entry.symbol = null
          entry.face = null
          entry.stillTime = 0
          entry.throwTime = 0
        } else {
          entry.symbol = FACES[face - 1].symbol
          entry.face = face
          entry.state = 'well'
          entry.stillTime = 0
          entry.throwTime = 0
        }
      }
    }
    for (const { entry, respawn } of rethrows) throwDie(entry, { respawn })

    // A new or rerolled die rests: 'well' with its rest pose. Same settle rule, no face read and no
    // new throw. A pose that is not finite is not written.
    for (const entry of dice.current.values()) {
      if (!entry.settling || !entry.body) continue
      const rb = entry.body
      entry.stillTime = stillTime(entry.stillTime, rb.linvel(), rb.angvel(), dt)
      entry.throwTime += dt
      if (entry.stillTime < SETTLE_TIME && entry.throwTime < SETTLE_TIMEOUT) continue
      entry.settling = false
      const pose = bodyPose(entry)
      if (!pose) continue
      entry.doc = dieEntry(entry.order, 'well', { pose })
      dirtyRef.current = true
    }

    // Slide every shelf die that is still moving to its slot (startShelfMove/resortShelf above).
    for (const entry of dice.current.values()) {
      if (entry.state !== 'shelf' || !entry.moving) continue
      const rb = entry.body
      if (!rb) continue
      entry.moveElapsed += dt
      const t = Math.min(1, entry.moveElapsed / SHELF_MOVE_TIME)
      const pose = shelfMovePose(entry.moveFrom, entry.moveTo, t)
      rb.setNextKinematicTranslation(pose.position)
      rb.setNextKinematicRotation(pose.rotation)
      if (t >= 1) entry.moving = false
    }

    // Nothing left in the air? Move the flat dice onto the shelf (design, "Roll flow" step 5) — a
    // die stays in 'well' with its symbol set until then. When their slide ends, the waiting dice
    // are thrown again. When none waits, the throw is over.
    let rolling = false
    let sliding = false
    const flat = []
    const waiting = []
    for (const entry of dice.current.values()) {
      if (entry.state === 'thrown') rolling = true
      else if (entry.state === 'well' && entry.symbol != null) flat.push(entry)
      else if (entry.state === 'well' && entry.waiting) waiting.push(entry)
      else if (entry.state === 'shelf' && entry.moving) sliding = true
    }
    if (!rolling) {
      if (flat.length > 0) {
        moveToShelf(flat)
        well -= flat.length
        sliding = true
      }
      if (waiting.length > 0) {
        if (!sliding) for (const entry of waiting) throwDie(entry)
      } else {
        const from = throwFrom.current
        if (from.roll.length + from.crits.length + from.reroll.length > 0) endThrow()
      }
    }
    if (dirtyRef.current) commit()

    reportChange(well)
  })

  return (
    <>
      <TrayBody
        trayKey={trayKey}
        onHover={onHover}
        keysProps={{
          state: keys,
          actions: { add, remove, roll, clear, addCrits, reroll, change },
          openMenuSymbol,
          onMenuToggle,
          onMenuClose,
        }}
      />
      {ids.map((id) => (
        <Die key={id} id={id} dice={dice} geometry={dieGeometry} material={dieMaterial} />
      ))}
    </>
  )
}
