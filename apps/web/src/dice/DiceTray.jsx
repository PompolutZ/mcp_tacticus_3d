import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { OccludedHtml } from '../scene/LabelOcclusion.jsx'
import { RigidBody, ConvexHullCollider, useAfterPhysicsStep, useRapier } from '@react-three/rapier'
import { DIE_USER_DATA, liveBody, setDynamic, setKinematic } from '../physics.js'
import { D8_CORNERS, D8_DENSITY, FACES, SYMBOLS } from './faces.js'
import {
  DIE_BODY,
  DIE_GRAVITY,
  DIE_GRAVITY_SCALE,
  DIE_SOLVER_ITERATIONS,
  SETTLE_TIME,
  SETTLE_TIMEOUT,
  isFinitePoint,
  isFiniteQuat,
  isTilted,
  randomRotation,
  addedSpin,
  throwLinvel,
  stillTime,
  throwVelocities,
  topFace,
} from './throw.js'
import {
  aboveRollLimit,
  freeDropPoint,
  inWell,
  randomWellPoint,
  shelfSlot,
  trayToWorld,
  trayToWorldRotation,
} from './tray.js'
import {
  SHELF_MOVE_TIME,
  defaultFaceForSymbol,
  flatRotation,
  shelfMovePose,
  sortShelfEntries,
} from './shelf.js'
import { changeEntry, clearEntry, throwEntry } from './history.js'
import { MAX_DICE, shelfFromDocument } from './shelfStart.js'
import { contactStep, flowStage, restOutcome, rollBlocked } from './rollFlow.js'
import { buildRunRecord } from './runRecord.js'
import { dieEntry, dieId, nextOrder, roundPose, trayCounts } from './stored.js'
import { FALL_LIMIT_Y } from '../table.js'
import { DieMenu } from './DiceKeys.jsx'
import { TrayBody, useDieLook } from './DiceTrayParts.jsx'
import { outlineMode, useOutline } from '../scene/SelectionOutlines.jsx'
import { useHoverCursor } from '../scene/useHoverCursor.js'
import { useLatest, useOnMount } from '../scene/useLatest.js'
import { createBumpFinder } from '../bumps.js'
import { playShake, playSound } from '../sound.js'
import { useRenderCount } from '../debug/renderCount.js'
import { useTableStore } from '../table/TableStoreContext.jsx'

// A pointer that moved more than this many pixels between down and up was a camera drag, not a
// click on a die.
const CLICK_MOVE = 4

const ZERO = { x: 0, y: 0, z: 0 }

// The die's own vertices (faces.js), flattened for ConvexHullCollider's args.
const dieVertices = Float32Array.from(D8_CORNERS.flat())

// One die: a RigidBody with a convex hull collider (the die shape) and a shared mesh. A new die
// starts dynamic; startShelfMove below switches it to kinematicPosition the first time it reaches
// the shelf. A die that starts on the shelf (from the document) is kinematic at once, and has its
// `slot` set. The RigidBody ref is written into the die's entry in the parent's `dice` map (see
// DiceTray), not kept as React state, so a physics step never has to re-render this component.
// A click on a die on the shelf calls onOpen(id). menuOpen: this die's "Change to" menu is open.
// onChange(id, toSymbol), onMenuClose(), onHover(over): see DiceTray.
function Die({
  id,
  dice,
  geometry,
  material,
  menuOpen,
  onOpen,
  onChange,
  onMenuClose,
  onHover,
  trayBodyRef,
}) {
  const entry = dice.current.get(id)
  // Read once: a body type that changes with a re-render would fight startShelfMove
  const [type] = useState(() => (entry.slot === undefined ? 'dynamic' : 'kinematicPosition'))
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef()
  useHoverCursor(hovered, 'pointer')
  // Only a shelf die is hovered, so a die in the well or in the air has no outline
  useOutline(meshRef, outlineMode(false, hovered))
  function setBody(rb) {
    const e = dice.current.get(id)
    if (e) e.body = rb ?? null
  }
  // RigidBody never passes null when it removes the body, so forget it here
  useEffect(
    () => () => {
      const e = dice.current.get(id)
      if (e) e.body = null
    },
    [dice, id],
  )
  // A die in the well or in the air gets no click. A camera drag that starts on the die is not a
  // click.
  function handleClick(e) {
    if (e.delta > CLICK_MOVE || dice.current.get(id)?.state !== 'shelf') return
    e.stopPropagation()
    onOpen(id)
  }
  // Whether the pointer is over this die, so the tray hover ends when the die goes away
  const over = useRef(false)
  const hoverRef = useLatest(onHover)
  useEffect(
    () => () => {
      if (over.current) hoverRef.current(false)
    },
    [hoverRef],
  )
  function handleOver() {
    over.current = true
    onHover(true)
    if (dice.current.get(id)?.state === 'shelf') setHovered(true)
  }
  function handleOut() {
    over.current = false
    onHover(false)
    setHovered(false)
  }
  return (
    <RigidBody
      ref={setBody}
      type={type}
      position={entry.spawn.position}
      quaternion={entry.spawn.quaternion}
      colliders={false}
      userData={DIE_USER_DATA}
      ccd={type === 'dynamic'}
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
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      />
      {menuOpen && entry.symbol && (
        <OccludedHtml skip={() => trayBodyRef?.current ?? undefined}>
          <DieMenu
            symbol={entry.symbol}
            onChange={(toSymbol) => onChange(id, toSymbol)}
            onClose={onMenuClose}
          />
        </OccludedHtml>
      )}
    </RigidBody>
  )
}

// A die body has DIE_USER_DATA (physics.js), own and the other tray's: a contact with it is a die-to-die touch.
const isDie = (collider) => collider.parent()?.userData?.die === true

// Does the body touch a collider that is not a die now (a contact manifold with a point, also a
// gentle touch)? Touches between dice do not count.
function touchesNonDie(world, rb) {
  let touching = false
  for (let i = 0; i < rb.numColliders() && !touching; i++) {
    world.contactPairsWith(rb.collider(i), (other) => {
      if (touching || isDie(other)) return
      world.contactPair(rb.collider(i), other, (manifold) => {
        if (manifold.numContacts() > 0) touching = true
      })
    })
  }
  return touching
}

// One dice tray: the tray body, the dice bodies, the roll flow, and the keys on the tray (see
// DiceKeys.jsx). trayKey: 'host' | 'guest'. openDieId, onDieOpen(dieId), onMenuClose: the "Change to"
// menu of a shelf die of this tray, lifted to App so Escape can close it. It closes when its die
// leaves the shelf (reroll, clear, roll).
// The tray reads the dice record store, the roll history list and transact from the table store
// (table/tableStore.js). It reads its side at mount and writes it when a die changes its place or face
// (dice/stored.js). It adds a history entry in the same change as the dice (dice/history.js).
// onHover(over): the pointer moved onto (true) or off (false) the tray, for the number keys.
// addRef(addAfterClear): gets a function that clears the tray, then adds that many dice, for the
// number keys, and null on unmount. Both are only given
// for the player's tray (Scene.jsx).
// diceLives: a ref to { side: getter }. The tray registers a getter for LiveSync with the live pose of each
// die that is not on the shelf (net/livePose.js, kind die).
export default function DiceTray({
  trayKey,
  openDieId = null,
  onDieOpen,
  onMenuClose,
  onHover,
  addRef,
  diceLives,
  rethrowTilted = false,
  testHook = false,
}) {
  useRenderCount('DiceTray')
  const { dice: store, rolls, transact } = useTableStore((s) => s.table)
  const { world } = useRapier()
  // The setting as the frame loop reads it: a change needs no new subscription
  const rethrowTiltedRef = useRef(rethrowTilted)
  rethrowTiltedRef.current = rethrowTilted

  // Test only (docs/plans/dice-night-run.md): with testHook, the dev URL #sandbox&dicetest, it
  // collects one record per throw: { start, sent, acted, blocked, dice: id -> data }. null when off.
  const [testOn] = useState(
    () =>
      import.meta.env.DEV &&
      testHook &&
      /(^|[#&])sandbox(&|=|$)/.test(window.location.hash) &&
      /(^|[#&])dicetest(&|=|$)/.test(window.location.hash),
  )
  const testRec = useRef(null)
  const testRecords = useRef([])
  const testApi = useRef(null)

  // Every die lives here: id -> { id, order, source, was, doc, body, state, symbol, face, settling, stillTime,
  // throwTime, bump, spawn, slot, moveFrom, moveTo, moveElapsed, moving }. source: 'roll' | 'crits' | 'reroll',
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
  // At mount only the shelf dice come back from the document (docs/features/dice-rolling.md);
  // dice in the well and in the air are temporary.
  const [initial] = useState(() => shelfFromDocument(trayKey, store.get(trayKey)))
  const trayBodyRef = useRef(null)
  const dice = useRef(initial.dice)
  const idsRef = useRef(initial.ids)
  const [ids, setIds] = useState(initial.ids)
  // What the keys show: { well, shelf, critsAvailable, rollBlocked }, see reportChange.
  const [keys, setKeys] = useState(() => trayCounts(initial.docDice, initial.critsUsed))
  const lastReported = useRef(null)
  // True once a thrown die of the running throw touched something (docs/features/dice-rolling.md,
  // "Roll flow" step 3). While it is true and the throw runs, roll() does nothing.
  const contactedRef = useRef(false)

  // The pointer is over the tray body or over a die: onHover(true) at the first, onHover(false) at
  // the last, whatever the order of the over and out events.
  const hoverCount = useRef(0)
  function hover(over) {
    const before = hoverCount.current
    hoverCount.current = Math.max(0, before + (over ? 1 : -1))
    if (before === 0 && hoverCount.current > 0) onHover?.(true)
    else if (before > 0 && hoverCount.current === 0) onHover?.(false)
  }

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
    // A rested die (kinematic, see the rest code in useFrame) moves again. A shelf die is never thrown.
    if (entry.slot === undefined && liveBody(world, rb) && !rb.isDynamic()) setDynamic(rb)
    entry.bump?.reset() // the throw sets the speed: it is no bump
    entry.airborne = false // a touch counts once the die was off every contact (contactStep)
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
    if (!liveBody(world, rb)) return
    rb.wakeUp()
    if (entry.slot === undefined) setKinematic(rb)
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
    if (testRec.current) finishTestRecord()
    const logged = throwEntry(trayKey, Date.now(), from)
    if (logged) pendingRolls.current.push(logged)
    dirtyRef.current = true
  }

  // Test only: stores the record of the throw that just ended
  function finishTestRecord() {
    const rec = testRec.current
    testRec.current = null
    testRecords.current.push(
      buildRunRecord({
        clicks: rec,
        throwTime: (performance.now() - rec.start) / 1000,
        dice: [...rec.dice.values()],
      }),
    )
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

  // Throws every die that is not on the shelf, from where it is. A die of the current throw gets
  // more spin, and below ROLL_HEIGHT_LIMIT (tray.js) a new up and sideways speed, but keeps its rotation.
  // Returns whether the click acted (false: blocked).
  function roll() {
    const { rolling, waiting } = flowStage(dice.current.values())
    if (rollBlocked({ contacted: contactedRef.current, rolling, waiting: waiting.length > 0 })) {
      if (testRec.current) {
        testRec.current.sent++
        testRec.current.blocked++
      }
      return false
    }
    contactedRef.current = false
    let thrown = false
    for (const entry of dice.current.values()) {
      if (entry.state === 'shelf') continue
      // Every die that is not on the shelf moves now. A die that is 'air' already keeps its entry.
      if (entry.doc.place !== 'air') {
        const pose = bodyPose(entry)
        if (pose) entry.doc = dieEntry(entry.order, 'air', { pose })
      }
      if (entry.state === 'thrown' && entry.body) {
        // Repeat click on a die of the current throw: keeps its rotation, adds spin; below the
        // roll limit it also gets a new upward and sideways speed.
        const rb = entry.body
        if (!aboveRollLimit(trayKey, rb.translation())) {
          rb.wakeUp()
          entry.bump?.reset() // the new speed is no bump
          entry.airborne = false // a touch counts once the die was off every contact (contactStep)
          entry.settling = false
          entry.stillTime = 0
          entry.throwTime = 0
          rb.setLinvel(throwLinvel(rb.translation(), randomWellPoint(trayKey)), true)
        }
        rb.setAngvel(addedSpin(rb.angvel()), true)
        thrown = true
        continue
      }
      throwDie(entry)
      thrown = true
    }
    if (thrown) playShake()
    if (testOn && thrown) {
      testRec.current ??= {
        start: performance.now(),
        sent: 0,
        acted: 0,
        blocked: 0,
        dice: new Map(),
        lost: new Map(),
      }
      testRec.current.sent++
      testRec.current.acted++
    }
    onMenuClose?.()
    commit()
    return true
  }

  // Removes every die (design, "Roll flow" step 9).
  function clear() {
    if (dice.current.size > 0) pendingRolls.current.push(clearEntry(trayKey, Date.now()))
    idsRef.current = []
    dice.current.clear()
    throwFrom.current = { roll: [], crits: [], reroll: [] }
    testRec.current = null
    contactedRef.current = false
    setIds([])
    critsUsedRef.current = false
    onMenuClose?.()
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
    if (!liveBody(world, rb)) return
    rb.wakeUp()
    setDynamic(rb)
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
    onMenuClose?.()
    commit()
  }

  // Turns the shelf die `dieId` to `toSymbol` in place and re-sorts the shelf. Does nothing when
  // that die is not on the shelf or already shows `toSymbol`.
  function change(dieId, toSymbol) {
    const entry = dice.current.get(dieId)
    if (!entry || entry.state !== 'shelf' || entry.symbol === toSymbol) return
    pendingRolls.current.push(changeEntry(trayKey, Date.now(), entry.symbol, toSymbol))
    entry.symbol = toSymbol
    entry.face = defaultFaceForSymbol(toSymbol)
    entry.doc = dieEntry(entry.order, 'shelf', { face: entry.face })
    resortShelf(new Set([entry.id]))
    commit()
  }

  // The number keys over the tray: removes every die, then adds `count` dice, as in TTS.
  function clearAndAdd(count) {
    clear()
    addDice(count)
  }

  // Sets what the keys show, { well, shelf, critsAvailable, rollBlocked }, only when a value changed since the
  // last frame, so a rolling or moving tray does not re-render this component every frame.
  function reportChange(well, rollIsBlocked) {
    const shelf = shelfCounts()
    const critsAvailable = critsUsedRef.current ? 0 : shelf.crit
    const last = lastReported.current
    const changed =
      !last ||
      last.well !== well ||
      last.rollBlocked !== rollIsBlocked ||
      last.critsAvailable !== critsAvailable ||
      SYMBOLS.some((symbol) => last.shelf[symbol] !== shelf[symbol])
    if (!changed) return
    lastReported.current = { well, critsAvailable, shelf, rollBlocked: rollIsBlocked }
    setKeys(lastReported.current)
  }

  // At mount, writes the side: the dice in the well and in the air go away from the document
  useOnMount(commit)

  // Registered on every render, the same as the turn of a tool (RulerTool.jsx)
  useEffect(() => {
    addRef?.(clearAndAdd)
    return () => addRef?.(null)
  })

  // Test only (docs/plans/dice-night-run.md): window.__diceTest, same functions as the keys
  testApi.current = { addDice, roll, clear, dice }
  useEffect(() => {
    if (!import.meta.env.DEV || !testOn) return undefined
    const api = testApi
    // No die thrown, in the well, settling, waiting or sliding; a new die still falling is not idle
    const isIdle = () => {
      for (const e of api.current.dice.current.values()) {
        if (!e.body) return false
        if (e.state === 'shelf') {
          if (e.moving) return false
        } else if (e.state !== 'well' || e.settling || e.waiting || e.symbol != null) return false
      }
      return true
    }
    // count rolls, intervalMs apart, the first at once
    const clicks = (count, intervalMs) =>
      new Promise((resolve) => {
        let i = 0
        const tick = () => {
          api.current.roll()
          if (++i >= count) resolve()
          else setTimeout(tick, intervalMs)
        }
        tick()
      })
    window.__diceTest = {
      add: (n) => api.current.addDice(n),
      roll: () => api.current.roll(),
      clear: () => api.current.clear(),
      isIdle,
      takeRecords: () => testRecords.current.splice(0),
      clicks,
    }
    return () => {
      delete window.__diceTest
    }
  }, [testOn])

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

  // A hit on each bump of a dynamic die (docs/features/sounds.md). A die that is kinematic or
  // asleep is not fed, so its finder starts fresh when it moves again.
  useAfterPhysicsStep((world) => {
    for (const entry of dice.current.values()) {
      const rb = entry.body
      if (!rb) continue
      entry.bump ??= createBumpFinder({ gravity: DIE_GRAVITY })
      if (!rb.isDynamic() || rb.isSleeping()) {
        entry.bump.reset()
        continue
      }
      const strength = entry.bump.feed(rb.linvel(), world.timestep)
      if (entry.state === 'thrown' && !contactedRef.current) {
        // The first touch of a non-die blocks Roll. Only contact pairs tell the source (the bump
        // finder cannot), so it is not a trigger here.
        const step = contactStep({ airborne: entry.airborne, touching: touchesNonDie(world, rb) })
        entry.airborne = step.airborne
        if (step.contact) contactedRef.current = true
      }
      if (strength > 0) playSound('die', { volume: strength, key: `${trayKey}:${entry.id}` })
    }
  })

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
        // A lost die (non-finite, or below the table) is thrown again from above the well. With
        // the setting "Throw tilted dice again", a tilted die, or one that did not rest in time,
        // waits for the other dice. Otherwise it reads its top face now and counts like a flat die.
        // A flat die counts, in the well or outside it (design, "Tilted dice").
        const lost = !finite || t.y < FALL_LIMIT_Y
        const { face, dot } = topFace(rot)
        const outcome = restOutcome({
          lost,
          timedOut,
          tilted: isTilted(dot),
          rethrowTilted: rethrowTiltedRef.current,
        })
        if (outcome === 'lost') {
          const rec = testRec.current
          if (rec) rec.lost.set(entry.id, (rec.lost.get(entry.id) ?? 0) + 1)
          rethrows.push({ entry, respawn: true })
        } else if (outcome === 'wait') {
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
          const rec = testRec.current
          if (rec)
            rec.dice.set(entry.id, {
              face,
              dot,
              tilted: isTilted(dot),
              timedOut,
              outOfWell: !inWell(trayKey, t),
              lost: rec.lost.get(entry.id) ?? 0,
              restTime: (performance.now() - rec.start) / 1000,
            })
          // Rested with a symbol: kinematic, so another die cannot knock it over and leave the
          // symbol stale. A rolling die bounces off it. throwDie makes it dynamic again.
          if (liveBody(world, rb)) {
            rb.setLinvel(ZERO, true)
            rb.setAngvel(ZERO, true)
            setKinematic(rb)
          }
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
    const stage = flowStage(dice.current.values())
    const { rolling, flat, waiting } = stage
    let sliding = stage.sliding
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
        contactedRef.current = false // the throw is over: Roll works again
      }
    }
    if (dirtyRef.current) commit()

    reportChange(
      well,
      rollBlocked({
        contacted: contactedRef.current,
        rolling: stage.rolling,
        waiting: waiting.length > 0,
      }),
    )
  })

  return (
    <>
      <TrayBody
        bodyRef={trayBodyRef}
        trayKey={trayKey}
        onHover={hover}
        keysProps={{
          state: keys,
          actions: { add, remove, roll, clear, addCrits, reroll },
        }}
      />
      {ids.map((id) => (
        <Die
          key={id}
          id={id}
          dice={dice}
          geometry={dieGeometry}
          material={dieMaterial}
          menuOpen={openDieId === id}
          onOpen={onDieOpen}
          onChange={change}
          onMenuClose={onMenuClose}
          onHover={hover}
          trayBodyRef={trayBodyRef}
        />
      ))}
    </>
  )
}
