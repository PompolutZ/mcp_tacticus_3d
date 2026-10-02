import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import { RigidBody, TrimeshCollider, ConvexHullCollider, useRapier } from '@react-three/rapier'
import { Color, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { assetUrl } from '../assets/index.js'
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
  IMPORT_ROTATION,
  SHELF_SLOT_COUNT,
  TRAYS,
  TRAY_SCALE,
  aboveRollLimit,
  freeDropPoint,
  randomWellPoint,
  shelfSlot,
  trayColliderArrays,
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
import { CLEARED_TEXT, changeText, throwEntryText } from '../dice/history.js'
import { FRICTION } from '../physics.js'
import { FALL_LIMIT_Y } from '../table.js'

// A tray holds at most 42 dice, shelf and well together (design, "Roll flow"). SHELF_SLOT_COUNT
// is also 42 (one shelf place per die), so this reuses it instead of a second magic number.
const MAX_DICE = SHELF_SLOT_COUNT

const ZERO = { x: 0, y: 0, z: 0 }

// The die's own vertices (faces.js), flattened for ConvexHullCollider's args.
const dieVertices = Float32Array.from(D8_CORNERS.flat())

// Unique React key / Map key for a die, across both trays. Only used as an id, never as a seed.
let nextDieId = 1

// Unique id for a history entry, across both trays. Only used as a React key.
let nextHistoryId = 1

// One die: a RigidBody with a convex hull collider (the die shape) and a shared mesh. Starts
// dynamic; startShelfMove below switches it to kinematicPosition the first time it reaches the
// shelf. The RigidBody ref is written into the die's entry in the parent's `dice` map (see
// DiceTray), not kept as React state, so a physics step never has to re-render this component.
function Die({ id, dice, geometry, material }) {
  const entry = dice.current.get(id)
  function setBody(rb) {
    const e = dice.current.get(id)
    if (e) e.body = rb ?? null
  }
  return (
    <RigidBody
      ref={setBody}
      type="dynamic"
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

// One dice tray: the tray body, the dice bodies, and the roll flow. trayKey: 'blue' | 'red'.
// actionsRef(trayKey, actions | null): registers this tray's actions in the parent's ref map,
// the same pattern as bodyRef in Scene.jsx. onChange(trayKey, state): reported after every frame
// that changes it, { well, shelf, rolling, critsAvailable, history }.
export default function DiceTray({ trayKey, actionsRef, onChange }) {
  const tray = TRAYS[trayKey]
  const { rapier } = useRapier()

  const trayGltf = useGLTF(assetUrl('dice/tray.glb'))
  const trayTexture = useTexture(assetUrl('dice/tray.webp'))
  const dieGltf = useGLTF(assetUrl('dice/d8.glb'))
  const dieTexture = useTexture(assetUrl('dice/d8.webp'))

  // Every die lives here: id -> { id, body, state, symbol, face, source, rerollFrom, stillTime,
  // throwTime, spawn, slot, moveFrom, moveTo, moveElapsed, moving }. state: 'well' (resting, done
  // or not yet thrown) | 'thrown' (in the air) | 'shelf'. A die keeps its `symbol` (and `face`,
  // the exact face number it landed on) once it settles, even while it still sits in 'well'
  // waiting for the rest of the throw to finish. `source` is 'roll' | 'crits' | 'reroll' and is
  // only meaningful until the die reaches the shelf; `rerollFrom` is the symbol it had before a
  // reroll, used to write "Reroll: X → Y" once the die settles again. React state (`ids`) holds
  // only the ordered list of ids, so mounting/unmounting a RigidBody is the only thing that
  // re-renders this component; the roll flow itself lives in this ref and never touches React
  // state.
  const dice = useRef(new Map())
  const idsRef = useRef([])
  const [ids, setIds] = useState([])
  const lastReported = useRef(null)

  // History for this tray, newest entry first. Kept in a ref (not React state), like `dice`;
  // onChange hands the array itself to the parent, so it only needs a reference check to see it
  // changed. Lasts until the page reloads (design, "History"); nothing here persists it further.
  const historyRef = useRef([])
  // True once addCrits has added dice this roll; reset by clear() (design, "Roll flow" step 7 /
  // the rulebook's "once per roll, not per Crit" rule).
  const critsUsedRef = useRef(false)

  // Tray collider, in tray space, from the loaded mesh — the same function scripts/dice-sim.mjs
  // uses in Node, so the app and the headless sim build the exact identical trimesh.
  const { vertices: trayVertices, indices: trayIndices } = useMemo(() => {
    const mesh = trayGltf.scene.getObjectByProperty('type', 'Mesh')
    return trayColliderArrays(mesh.geometry.attributes.position.array, mesh.geometry.index.array)
  }, [trayGltf.scene])

  const trayMaterial = useMemo(() => {
    trayTexture.colorSpace = SRGBColorSpace
    trayTexture.flipY = false
    const color = new Color().setRGB(...tray.color, SRGBColorSpace)
    return new MeshStandardMaterial({ map: trayTexture, color, roughness: 0.8, metalness: 0 })
  }, [trayTexture, tray.color])

  // Visible tray mesh: a clone of the loaded scene with the tinted material, IMPORT_ROTATION and
  // TRAY_SCALE (same mirror-and-scale fix as Terrain.jsx; the collider above already bakes both
  // into its vertices, so it needs no extra transform of its own).
  const trayVisual = useMemo(() => {
    const clone = trayGltf.scene.clone()
    clone.traverse(child => {
      if (!child.isMesh) return
      child.material = trayMaterial
      child.castShadow = true
      child.receiveShadow = true
    })
    return clone
  }, [trayGltf.scene, trayMaterial])

  const dieMaterial = useMemo(() => {
    dieTexture.colorSpace = SRGBColorSpace
    dieTexture.flipY = false
    return new MeshStandardMaterial({ map: dieTexture, roughness: 0.5, metalness: 0 })
  }, [dieTexture])
  const dieGeometry = useMemo(
    () => dieGltf.scene.getObjectByProperty('type', 'Mesh').geometry,
    [dieGltf.scene],
  )

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

  // Appends one history entry, newest first (design, "History").
  function pushHistory(text) {
    historyRef.current = [{ id: nextHistoryId++, text }, ...historyRef.current]
  }

  // Every thrown die of one throw has a final result (design, "Roll flow" step 5): move them all
  // onto the shelf, re-sort it, and write one history entry grouped by where each die came from.
  function finalizeThrow(finishedIds) {
    const shelfBefore = shelfCounts()
    const roll = {}
    const crits = {}
    const reroll = []
    for (const id of finishedIds) {
      const entry = dice.current.get(id)
      if (!entry) continue
      if (entry.source === 'roll') roll[entry.symbol] = (roll[entry.symbol] ?? 0) + 1
      else if (entry.source === 'crits') crits[entry.symbol] = (crits[entry.symbol] ?? 0) + 1
      else if (entry.source === 'reroll') reroll.push({ from: entry.rerollFrom, to: entry.symbol })
      entry.state = 'shelf'
      entry.source = null
      entry.rerollFrom = null
    }
    resortShelf()
    const shelfAfter = shelfCounts()
    pushHistory(throwEntryText({ roll, crits, reroll, shelfBefore, shelfAfter }))
  }

  // Adds one die with the given source ('roll' | 'crits'), at a free point above the well. Does
  // nothing once the tray holds MAX_DICE. Returns whether it added one.
  function addDie(source) {
    if (dice.current.size >= MAX_DICE) return false
    const point = freeDropPoint(trayKey, wellOccupiedPoints())
    const q = randomRotation()
    const id = nextDieId++
    dice.current.set(id, {
      id,
      body: null,
      state: 'well',
      symbol: null,
      face: null,
      source,
      rerollFrom: null,
      stillTime: 0,
      throwTime: 0,
      spawn: { position: [point.x, point.y, point.z], quaternion: [q.x, q.y, q.z, q.w] },
    })
    idsRef.current.push(id)
    return true
  }

  // add/remove/roll/clear/addCrits/reroll/change read and write `dice` and `idsRef` directly (not
  // React state), so they stay correct no matter how long ago this component last rendered.
  // Defined once at mount and registered with the parent through actionsRef; see the effect below.
  function add() {
    if (addDie('roll')) setIds(idsRef.current.slice())
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
      return
    }
  }

  // Throws every die that is not on the shelf, from where it is. A die of the current throw that is
  // still high in the air only gets a new spin, as in TTS (ROLL_HEIGHT_LIMIT in tray.js).
  function roll() {
    for (const entry of dice.current.values()) {
      if (entry.state === 'shelf') continue
      if (entry.state === 'thrown' && entry.body && aboveRollLimit(trayKey, entry.body.translation())) {
        entry.body.setAngvel(randomSpin(), true)
        continue
      }
      throwDie(entry)
    }
  }

  // Removes every die and adds a "Cleared" entry. History stays (design, "Roll flow" step 9).
  function clear() {
    idsRef.current = []
    dice.current.clear()
    setIds([])
    critsUsedRef.current = false
    pushHistory(CLEARED_TEXT)
  }

  // Adds one die per Crit on the shelf, with source 'crits'. Does nothing when there are no Crits
  // on the shelf, or once used already this roll (design, "Roll flow" step 7 / the rulebook's
  // "once per roll" rule) — clear() is what allows it again.
  function addCrits() {
    if (critsUsedRef.current) return
    const n = shelfCounts().crit
    if (n <= 0) return
    let added = 0
    for (let i = 0; i < n; i++) {
      if (!addDie('crits')) break
      added++
    }
    if (added > 0) {
      critsUsedRef.current = true
      setIds(idsRef.current.slice())
    }
  }

  // Moves one shelf die showing `symbol` back into the well, dynamic again, at a free drop point.
  // Its old symbol is kept as `rerollFrom`, for the "Reroll: X → Y" history line once it settles
  // again. Does nothing when the shelf has no die with that symbol.
  function reroll(symbol) {
    const entry = shelfEntries().find(e => e.symbol === symbol)
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
    entry.rerollFrom = entry.symbol
    entry.symbol = null
    entry.face = null
    entry.source = 'reroll'
    entry.state = 'well'
    entry.slot = undefined
    entry.moving = false
    entry.stillTime = 0
    entry.throwTime = 0
    resortShelf() // close the gap this die left on the shelf
  }

  // Turns one shelf die showing `symbol` to `toSymbol` in place, re-sorts the shelf and records
  // the change. Does nothing when the shelf has no die with that symbol.
  function change(symbol, toSymbol) {
    const entry = shelfEntries().find(e => e.symbol === symbol)
    if (!entry) return
    entry.symbol = toSymbol
    entry.face = defaultFaceForSymbol(toSymbol)
    resortShelf(new Set([entry.id]))
    pushHistory(changeText(symbol, toSymbol))
  }

  // Register once. These functions close only over refs and the stable setIds, so they never go
  // stale — this effect intentionally runs only on mount/unmount, like bodyRef in Scene.jsx.
  useEffect(() => {
    actionsRef?.(trayKey, { add, remove, roll, clear, addCrits, reroll, change })
    return () => actionsRef?.(trayKey, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reports { well, shelf, rolling, critsAvailable, history } to the parent, only when at least
  // one field changed since the last report (so a rolling or moving tray does not flood the
  // parent with identical updates every frame).
  function reportChange(well, rolling) {
    const shelf = shelfCounts()
    const critsAvailable = critsUsedRef.current ? 0 : shelf.crit
    const history = historyRef.current
    const last = lastReported.current
    const changed =
      !last ||
      last.well !== well ||
      last.rolling !== rolling ||
      last.critsAvailable !== critsAvailable ||
      last.history !== history ||
      SYMBOLS.some(symbol => last.shelf[symbol] !== shelf[symbol])
    if (!changed) return
    lastReported.current = { well, rolling, critsAvailable, shelf, history }
    onChange?.(trayKey, { well, shelf, rolling, critsAvailable, history })
  }

  // The roll flow: read faces once a thrown die rests (in the well or outside it, as in TTS),
  // throw a tilted die again, move a lost die (fell off the table, non-finite) back above the well,
  // slide shelf dice to their slot, move a finished throw's dice onto the shelf, and report.
  useFrame((_state, dt) => {
    const rethrows = []
    let well = 0
    for (const entry of dice.current.values()) {
      if (entry.state !== 'shelf') well++
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
        // die, or one that did not rest in time, is thrown again from where it is. A flat die
        // counts, in the well or outside it (design, "Tilted dice").
        const lost = !finite || t.y < FALL_LIMIT_Y
        const { face, dot } = topFace(rot)
        if (lost || timedOut || isTilted(dot)) {
          rethrows.push({ entry, respawn: lost })
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

    // Nothing left in the air? Move every die that just got a result onto the shelf, as one
    // throw (design, "Roll flow" step 5) — a die stays in 'well' with its symbol set until then.
    let rolling = false
    const finishedIds = []
    for (const entry of dice.current.values()) {
      if (entry.state === 'thrown') rolling = true
      else if (entry.state === 'well' && entry.symbol != null) finishedIds.push(entry.id)
    }
    if (!rolling && finishedIds.length > 0) {
      finalizeThrow(finishedIds)
      well -= finishedIds.length
    }

    reportChange(well, rolling)
  })

  return (
    <>
      <RigidBody
        type="fixed"
        position={[tray.position.x, tray.position.y, tray.position.z]}
        rotation={[0, tray.yaw, 0]}
        colliders={false}
      >
        <TrimeshCollider args={[trayVertices, trayIndices, rapier.TriMeshFlags.FIX_INTERNAL_EDGES]} friction={FRICTION} />
        <group scale={TRAY_SCALE}>
          <primitive object={trayVisual} rotation={IMPORT_ROTATION} />
        </group>
      </RigidBody>
      {ids.map(id => (
        <Die key={id} id={id} dice={dice} geometry={dieGeometry} material={dieMaterial} />
      ))}
    </>
  )
}
