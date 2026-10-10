import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, ConvexHullCollider } from '@react-three/rapier'
import { D8_CORNERS, FACES } from '../dice/faces.js'
import { DIE_BODY } from '../dice/throw.js'
import { SHELF_SLOT_COUNT, shelfSlot, trayToWorld, trayToWorldRotation } from '../dice/tray.js'
import { SHELF_MOVE_TIME, flatRotation, shelfMovePose, sortShelfEntries } from '../dice/shelf.js'
import { trayCounts } from '../dice/stored.js'
import { OTHER_DICE_GROUPS } from '../physics.js'
import { useYField } from '../net/useY.js'
import { TrayBody, useDieLook } from './DiceTrayParts.jsx'

// The die's own vertices (faces.js), flattened for ConvexHullCollider's args.
const dieVertices = Float32Array.from(D8_CORNERS.flat())

const POSE_KEYS = ['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw']

function validPose(pose) {
  return Boolean(pose) && POSE_KEYS.every((key) => Number.isFinite(pose[key]))
}

function samePose(a, b) {
  return POSE_KEYS.every((key) => a[key] === b[key])
}

// The entries of the stored side that can be drawn. Others (a wrong place, a face or pose that is
// not valid) are left out, so a bad document cannot break the scene.
function readDice(side) {
  const list = []
  for (const [id, d] of Object.entries(side?.dice ?? {})) {
    if (!d || !Number.isFinite(d.order)) continue
    if (d.place === 'shelf') {
      if (FACES[d.face - 1])
        list.push({
          id,
          d,
          shelf: true,
          face: d.face,
          order: d.order,
          symbol: FACES[d.face - 1].symbol,
        })
    } else if ((d.place === 'well' || d.place === 'air') && validPose(d.pose)) {
      list.push({ id, d, shelf: false })
    }
  }
  return list.slice(0, SHELF_SLOT_COUNT)
}

// The world pose of shelf slot `slot` with `face` up
function shelfTarget(trayKey, slot, face) {
  return {
    position: trayToWorld(trayKey, shelfSlot(slot)),
    rotation: trayToWorldRotation(trayKey, flatRotation(face)),
  }
}

function spawnOf(position, rotation) {
  return {
    position: [position.x, position.y, position.z],
    quaternion: [rotation.x, rotation.y, rotation.z, rotation.w],
  }
}

// Makes one die follow its stored entry `e`. slot: its shelf slot, for a shelf entry.
function applyEntry(die, e, slot, trayKey) {
  const isNew = die.doc === null
  const rb = die.body
  if (e.shelf) {
    if (!isNew && die.slot === slot && die.face === e.face) {
      die.doc = e.d
      return
    }
    const to = shelfTarget(trayKey, slot, e.face)
    if (!rb) {
      // Not mounted yet (or new): stand at the slot, no slide
      die.spawn = spawnOf(to.position, to.rotation)
      die.moving = false
    } else {
      // A shelf die slides from where it is
      const t = rb.translation()
      const r = rb.rotation()
      die.moveFrom = {
        position: { x: t.x, y: t.y, z: t.z },
        rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
      }
      die.moveTo = to
      die.moveElapsed = 0
      die.moving = true
    }
    die.slot = slot
    die.face = e.face
  } else {
    if (!isNew && die.slot === undefined && samePose(die.doc.pose, e.d.pose)) {
      die.doc = e.d
      return
    }
    const p = e.d.pose
    die.slot = undefined
    die.face = null
    die.moving = false
    // The die moves to its stored pose at once
    if (rb) {
      rb.setTranslation({ x: p.x, y: p.y, z: p.z }, true)
      rb.setRotation({ x: p.qx, y: p.qy, z: p.qz, w: p.qw }, true)
    } else {
      die.spawn = spawnOf({ x: p.x, y: p.y, z: p.z }, { x: p.qx, y: p.qy, z: p.qz, w: p.qw })
    }
  }
  die.doc = e.d
}

// Makes `map` (die id -> die) equal to the stored side. Returns true when dice were added or removed.
function syncDice(map, side, trayKey) {
  const list = readDice(side)
  const slots = new Map(sortShelfEntries(list.filter((e) => e.shelf)).map((e, i) => [e.id, i]))
  const keep = new Set(list.map((e) => e.id))
  let idsChanged = false
  for (const id of map.keys()) {
    if (keep.has(id)) continue
    map.delete(id)
    idsChanged = true
  }
  for (const e of list) {
    let die = map.get(e.id)
    if (!die) {
      die = {
        id: e.id,
        doc: null,
        body: null,
        spawn: null,
        slot: undefined,
        face: null,
        moving: false,
      }
      map.set(e.id, die)
      idsChanged = true
    }
    applyEntry(die, e, slots.get(e.id), trayKey)
  }
  return idsChanged
}

// One die of the other tray: a kinematic body. OTHER_DICE_GROUPS: it passes through models. The
// body goes into the die's entry in the parent's `dice` Map, not into React state.
function OtherDie({ id, dice, geometry, material }) {
  const entry = dice.get(id)
  function setBody(rb) {
    const e = dice.get(id)
    if (e) e.body = rb ?? null
  }
  return (
    <RigidBody
      ref={setBody}
      type="kinematicPosition"
      position={entry.spawn.position}
      quaternion={entry.spawn.quaternion}
      colliders={false}
    >
      <ConvexHullCollider
        args={[dieVertices]}
        collisionGroups={OTHER_DICE_GROUPS}
        friction={DIE_BODY.friction}
        frictionCombineRule={DIE_BODY.frictionCombineRule}
        restitution={DIE_BODY.restitution}
        restitutionCombineRule={DIE_BODY.restitutionCombineRule}
      />
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
    </RigidBody>
  )
}

// The tray of the other player. It draws the stored side (dice/stored.js) and never writes the
// document. trayKey: 'blue' | 'red'. store: the dice record store of the table.
// A well or air die stands at its stored pose, and moves there at once when the pose changes. A shelf
// die slides to its slot when its slot or face changes (as DiceTray.startShelfMove). A die on the
// shelf at mount stands at its slot. The keys show the stored counts and are turned off.
export default function OtherDiceTray({ trayKey, store }) {
  const [side] = useYField(store, trayKey)
  const { geometry, material } = useDieLook()

  // dice: id -> { id, doc, body, spawn, slot, face, moving, moveFrom, moveTo, moveElapsed }. doc: the stored
  // die entry now. body: the RigidBody. A later phase moves the body of an air die from the useFrame below.
  // The Map is made once and changed in place; the React state is only the list of ids.
  const [dice] = useState(() => {
    const map = new Map()
    syncDice(map, side, trayKey)
    return map
  })
  const [ids, setIds] = useState(() => [...dice.keys()])

  // A change of the stored side
  useEffect(() => {
    if (syncDice(dice, side, trayKey)) setIds([...dice.keys()])
  }, [dice, side, trayKey])

  const keys = useMemo(() => trayCounts(side?.dice, side?.critsUsed === true), [side])

  // Slide the shelf dice that are moving to their slot
  useFrame((_state, dt) => {
    for (const die of dice.values()) {
      if (!die.moving || !die.body) continue
      die.moveElapsed += dt
      const t = Math.min(1, die.moveElapsed / SHELF_MOVE_TIME)
      const pose = shelfMovePose(die.moveFrom, die.moveTo, t)
      die.body.setNextKinematicTranslation(pose.position)
      die.body.setNextKinematicRotation(pose.rotation)
      if (t >= 1) die.moving = false
    }
  })

  return (
    <>
      <TrayBody trayKey={trayKey} keysProps={{ state: keys, actions: {}, disabled: true }} />
      {ids.map((id) => (
        <OtherDie key={id} id={id} dice={dice} geometry={geometry} material={material} />
      ))}
    </>
  )
}
