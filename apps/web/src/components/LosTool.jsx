import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { RigidBody, useRapier } from '@react-three/rapier'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { BASE_HALF_H } from './CharacterModel.jsx'
import { losCast, losLength, terrainSize } from './losLength.js'
import { losBlock, standingTerrainSize } from './losBlock.js'
import { TOUCH_MARGIN, standingColliders } from './terrainUnder.js'
import {
  ToolFootprint,
  toolPose,
  turnAround,
  useDragTool,
  useRestStore,
  yawQuat,
  yawTo,
} from './RulerTool.jsx'
import { useHoverCursor } from './useHoverCursor.js'
import { followPart, lerpAngle } from '../net/livePose.js'
import { losFields, sameLos } from './storedTool.js'
import { onRack } from '../tabletools/layout.js'

// The Line of Sight tool (docs/features/line-of-sight.md): a line as wide as the base of the looking character,
// from its base center along a yaw, painted on the table and terrain by the footprint of the tool. The line is
// a kinematic body at the base center of the looker with no collider: its yaw is the direction, and it carries
// the hit surface of the pointer and the label. Both players work out its length from their own physics, so
// the entry holds only the looker, the target and the pose.

// The models must stand still this long (s) before the length is worked out again. A turn is worked out at once.
const LOS_REST = 0.15
// The footprint of the line: light grey (the free tool color), half transparent
const LOS_OPACITY = 0.5
// The pointer surface lies this far (inches) above the base bottom
const HIT_Y = 0.08
// The label hangs this far above the end of the line
const LABEL_Y = 0.3
const NO_TURN = { right: 0, left: 0 }
const NO_POINTER = { pointerEvents: 'none' }
const round3 = (v) => Math.round(v * 1e3) / 1e3

// The model of a character with this model id, or null. models: the tool models (Scene.jsx).
const findCharacter = (models, id) =>
  (id && models.find((model) => model.kind === 'character' && model.id === id)) || null

// { distance, label } of the line of the body in rigidRef, from the physics: the looker's base center, the yaw
// of the body, and the block Size of the target (or of the looker when there is no target). It is worked out
// again when the yaw changes at once, and when a model has not moved for LOS_REST, or when a Size changes.
function useLosLine(rigidRef, looker, target) {
  const { world, rapier } = useRapier()
  const [line, setLine] = useState({ distance: 0, label: '' })
  const latest = useRef({ looker, target })
  useEffect(() => {
    latest.current = { looker, target }
  })
  const seen = useRef({ key: null, time: 0, yaw: null, dirty: true })

  useFrame((_, dt) => {
    const rb = rigidRef.current
    const { looker, target } = latest.current
    if (!rb || !looker) return
    const c = looker.getCenter()
    const t = target?.getCenter()
    const yaw = toolPose(rb).yaw
    const key = [c.x, c.y, c.z, t?.x, t?.y, t?.z, looker.size(), target?.size()]
      .map((v) => (typeof v === 'number' ? round3(v) : v))
      .join()
    const st = seen.current
    if (st.key === null) {
      st.time = LOS_REST
      st.key = key
    } else if (key !== st.key) {
      st.key = key
      st.time = 0
      st.dirty = true
    } else st.time += dt
    const turned = st.yaw !== null && yaw !== st.yaw
    st.yaw = yaw
    if (turned) st.dirty = true
    if (!st.dirty || (st.time < LOS_REST && !turned)) return
    st.dirty = false

    const stand = (model) => {
      const at = model.getCenter()
      return standingColliders(world, rapier, at, at.y, model.radius - TOUCH_MARGIN, BASE_HALF_H)
    }
    const skipped = stand(looker)
    const lead = target ?? looker
    const under = target ? stand(target) : skipped
    const block = losBlock({
      size: lead.size(),
      terrain: standingTerrainSize([...under].map((h) => terrainSize(world.getCollider(h)))),
      name: lead.name,
      own: !target,
    })
    const { distance } = losLength({
      start: { x: c.x, z: c.z },
      yaw,
      width: looker.radius * 2,
      blockSize: block.size,
      skipped,
      cast: losCast(world, rapier),
    })
    const next = { distance: round3(distance), label: block.label }
    setLine((prev) => (prev.distance === next.distance && prev.label === next.label ? prev : next))
  })

  return line
}

// The body, the label and the footprint of a line. position: where the body starts. yaw: its first direction.
// children: what the own tool adds in the body (the pointer surface).
function LosView({ rigidRef, line, radius, selected, position, yaw, children }) {
  return (
    <>
      <RigidBody
        ref={rigidRef}
        type="kinematicPosition"
        position={position}
        rotation={[0, yaw, 0]}
        colliders={false}
      >
        {children}
        {line.label && (
          <Html position={[line.distance, LABEL_Y, 0]} center style={NO_POINTER}>
            <div className="token-face-label">
              <strong>{line.label}</strong>
            </div>
          </Html>
        )}
      </RigidBody>
      <ToolFootprint
        rigidRef={rigidRef}
        turn={NO_TURN}
        halfLength={line.distance}
        halfWidth={radius}
        selected={selected}
        target={null}
        oneSided
        opacity={LOS_OPACITY}
      />
    </>
  )
}

// The own Line of Sight tool. entry: { looker, target, pose? } (storedTool.js, losEntry). models: the tool models of
// Scene.jsx. side: the own side. onStore(fields): writes into the entry (the pose when it rests, target: null when the
// target is gone). onReturn(): a turn drag ended on the own rack, the tool goes back (undefined: it does not).
// onRemove(): the looker is gone, the tool is removed.
// selected, onSelect, onDragSelect, onSpawn, onHover, onDrag, turnRef, liveRef: as in Tool (RulerTool.jsx).
export function LosTool({
  entry,
  side: ownSide,
  models,
  selected = false,
  onSelect,
  onDragSelect,
  onSpawn,
  onStore,
  onReturn,
  onRemove,
  onHover,
  onDrag,
  turnRef,
  liveRef,
}) {
  const looker = findCharacter(models, entry.looker)
  const target = findCharacter(models, entry.target)
  const [start] = useState(entry)
  const restored = Boolean(start.pose)
  const [first] = useState(() => {
    const c = looker?.getCenter()
    return restored ? start.pose : { x: c?.x ?? 0, y: c?.y ?? 0, z: c?.z ?? 0, yaw: 0 }
  })
  const rigidRef = useRef()
  const [hovered, setHovered] = useState(false)
  // The drag in progress: 'turn' or null
  const dragKind = useRef(null)
  // The turn that Q / E, or the wheel, added during a turn drag
  const extraYaw = useRef(0)
  // The last point of the pointer on the table during a turn drag, for a release on the own rack
  const dragPoint = useRef(null)
  const line = useLosLine(rigidRef, looker, target)
  const latest = useRef(null)
  useEffect(() => {
    latest.current = { entry, onStore, onReturn, looker, onSpawn }
  })

  const onPointerDown = useDragTool(
    rigidRef,
    () => null,
    0,
    (kind) => {
      dragKind.current = kind
      onDrag?.(true)
    },
    undefined,
    () => {
      dragKind.current = null
      onDrag?.(false)
      const point = dragPoint.current
      dragPoint.current = null
      if (point && onRack(ownSide, point)) latest.current?.onReturn?.()
    },
  )

  // A drag always turns the line around the base center of the looker (turnAround). Never a move.
  function plan() {
    const rb = rigidRef.current
    const c = latest.current?.looker?.getCenter() ?? rb.translation()
    const pivot = { x: c.x, z: c.z }
    const y = rb.translation().y
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y)
    const hit = new THREE.Vector3()
    extraYaw.current = 0
    return {
      pivot,
      refresh: true,
      onTurn(d, pose) {
        const turned = turnAround(pose, pivot, d)
        return { ...turned, yaw: turned.yaw + extraYaw.current }
      },
      onPointer(raycaster) {
        dragPoint.current =
          raycaster && raycaster.ray.intersectPlane(ground, hit) ? { x: hit.x, z: hit.z } : null
      },
    }
  }

  // Q / E and the wheel: turn the line around the base center, also during a turn drag
  function turnBy(angle) {
    const rb = rigidRef.current
    if (!rb) return
    if (dragKind.current === 'turn') extraYaw.current += angle
    else rb.setRotation(yawQuat(toolPose(rb).yaw + angle), true)
  }
  useEffect(() => {
    turnRef?.(turnBy)
    return () => turnRef?.(null)
  })

  // The line stays on the base center of the looker. A turn drag sets the pose itself (useDragTool).
  useFrame(() => {
    const rb = rigidRef.current
    const c = looker?.getCenter()
    if (!rb || !c || dragKind.current) return
    rb.setTranslation({ x: c.x, y: c.y, z: c.z }, true)
  })

  // A new line points at the mat center, as a free tool does
  useEffect(() => {
    if (restored) return
    onSpawn?.()
    const rb = rigidRef.current
    const c = looker?.getCenter()
    if (rb && c && Math.hypot(c.x, c.z) > 0.01)
      rb.setRotation(yawQuat(yawTo(c, { x: 0, z: 0 })), true)
    // Only at spawn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A new target turns the line to point at it. The first value (a restored line) does not.
  const lastTarget = useRef(entry.target)
  useEffect(() => {
    if (entry.target && entry.target !== lastTarget.current) {
      const rb = rigidRef.current
      const c = looker?.getCenter()
      const t = target?.getCenter()
      if (rb && c && t) rb.setRotation(yawQuat(yawTo(c, t)), true)
    }
    lastTarget.current = entry.target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.target])

  // A removed looker removes the line, a removed target clears the target. models is empty before the
  // characters load: a model that was never seen counts as gone only when there are models.
  const seenModels = useRef({ looker: false, target: false })
  useEffect(() => {
    const seen = seenModels.current
    if (looker) seen.looker = true
    else if (seen.looker || models.length > 0) onRemove?.()
    if (target) seen.target = true
    else if (entry.target && (seen.target || models.length > 0)) onStore?.({ target: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looker, target])

  useEffect(() => {
    if (!hovered) return undefined
    onHover?.(true)
    return () => onHover?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered])
  // A removed line does not stay dragged
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onDrag?.(false), [])
  useHoverCursor(hovered, 'grab')

  useEffect(() => {
    liveRef?.(() => {
      const rb = rigidRef.current
      if (!rb) return null
      const t = rb.translation()
      return { x: t.x, y: t.y, z: t.z, yaw: toolPose(rb).yaw, right: 0, left: 0 }
    })
    return () => liveRef?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useRestStore(() => {
    const rb = rigidRef.current
    const now = latest.current
    if (!rb || !now?.onStore) return null
    const pose = { ...toolPose(rb), y: rb.translation().y }
    return { cur: losFields({ pose }), entry: now.entry, onStore: now.onStore }
  }, sameLos)

  return (
    <LosView
      rigidRef={rigidRef}
      line={line}
      radius={looker?.radius ?? 0.5}
      selected={selected}
      position={[first.x, first.y, first.z]}
      yaw={first.yaw}
    >
      <mesh
        position={[line.distance / 2, HIT_Y, 0]}
        rotation-x={-Math.PI / 2}
        onPointerDown={(e) => onPointerDown(e, onSelect, onDragSelect, plan)}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[Math.max(line.distance, 0.01), (looker?.radius ?? 0.5) * 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </LosView>
  )
}

// The other player's Line of Sight tool: the line follows their looker, and turns to their yaw, from the live
// channel or from the entry, whichever came last (as OtherToolBody in RulerTool.jsx). No pointer.
// entry: { looker, target, pose }. getLive(): { pose: [x, y, z, yaw, right, left], time } or null.
export function OtherLos({ entry, models, getLive, selected = false }) {
  const looker = findCharacter(models, entry.looker)
  const target = findCharacter(models, entry.target)
  const rigidRef = useRef()
  const line = useLosLine(rigidRef, looker, target)
  const { pose } = entry
  const [start] = useState(() => pose)
  const shownYaw = useRef(pose.yaw)
  const entryTime = useRef(0)
  const latest = useRef(null)
  useEffect(() => {
    latest.current = { yaw: pose.yaw, getLive, looker }
  })
  useEffect(() => {
    entryTime.current = performance.now()
  }, [pose.yaw])

  useFrame((_, dt) => {
    const rb = rigidRef.current
    const now = latest.current
    const c = now?.looker?.getCenter()
    if (!rb || !c) return
    const live = now.getLive?.()
    const goal = live && live.time > entryTime.current ? live.pose[3] : now.yaw
    shownYaw.current = lerpAngle(shownYaw.current, goal, followPart(dt))
    rb.setTranslation({ x: c.x, y: c.y, z: c.z }, true)
    rb.setRotation(yawQuat(shownYaw.current), true)
  })

  return (
    <LosView
      rigidRef={rigidRef}
      line={line}
      radius={looker?.radius ?? 0.5}
      selected={selected}
      position={[start.x, start.y, start.z]}
      yaw={start.yaw}
    />
  )
}
