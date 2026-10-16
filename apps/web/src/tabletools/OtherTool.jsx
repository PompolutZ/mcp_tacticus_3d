import { useFrame } from '@react-three/fiber'
import { RigidBody, ConvexHullCollider } from '@react-three/rapier'
import { useMemo, useRef, useState, useEffect } from 'react'
import { useBodyRef } from '../useBodyRef.js'
import { followPart, lerpAngle } from '../net/livePose.js'
import { MOVE_TIP, RANGE_TIP } from './toolTips.js'
import { ToolFootprint } from './ToolFootprint.jsx'
import { useRangeParts, useMovementParts, hullPoints } from './ToolParts.jsx'
import { RANGE_HALF_WIDTH, MOVE_HALF_WIDTH, STRAIGHT, ANGLE_TURN, yawQuat } from './toolGeometry.js'

const noRaycast = () => {}

// The other player's tool (docs/features/peer-to-peer.md, "What each player controls"): the shape of Tool without its controls. The side's
// tint, the footprint with the other player's target (selected, target, rangeFrom), no buttons, no hover, no outline, no range mark. The pointer does
// not hit it, so a click goes to the piece below. A kinematic sensor, the same as Tool.
// It goes to its latest pose, from the live channel or from the entry, whichever came last: the part
// 1 − e^(−dt / 0.05) of the way each frame, for the position, the yaw and the bend. A live pose that came
// before the tool mounted or before the last change of the entry does not count.
// parts, tip, halfWidth: as in Tool. defaultTurn: the bend when the entry has none.
// getLive(): { pose: [x, y, z, yaw, right, left], time } of the tool from LiveSync, or null. time: performance.now() ms.
function OtherToolBody({
  parts,
  tip,
  halfWidth,
  defaultTurn,
  entry,
  getLive,
  selected = false,
  target = null,
  rangeFrom = null,
}) {
  const groups = useRef([])
  const colliders = useRef([])
  const { rigidRef, liveRb } = useBodyRef(groups, colliders)
  const { pose } = entry
  const entryTurn = entry.turn ?? defaultTurn
  const hulls = useMemo(() => parts.map((part) => hullPoints(part.obj)), [parts])
  // The start values. The body, the groups and the colliders are moved by the follow after that.
  const [start] = useState(() => ({ pose, turn: entryTurn }))
  // The shown pose and bend. The footprint reads turn each frame, so the object stays the same.
  const shown = useRef({
    x: pose.x,
    y: pose.y,
    z: pose.z,
    yaw: pose.yaw,
    turn: { right: entryTurn.right, left: entryTurn.left },
  })
  // When the entry came (performance.now() ms), set on mount and after each change
  const entryTime = useRef(0)
  const latest = useRef(null)
  useEffect(() => {
    latest.current = { pose, turn: entryTurn, getLive }
  })

  useEffect(() => {
    for (const part of parts) part.obj.traverse((child) => (child.raycast = noRaycast))
  }, [parts])

  useEffect(() => {
    entryTime.current = performance.now()
  }, [pose.x, pose.y, pose.z, pose.yaw, entryTurn.right, entryTurn.left])

  useFrame((_, dt) => {
    const rb = liveRb()
    const now = latest.current
    if (!rb || !now) return
    const live = now.getLive?.()
    const target =
      live && live.time > entryTime.current
        ? live.pose
        : [now.pose.x, now.pose.y, now.pose.z, now.pose.yaw, now.turn.right, now.turn.left]
    const part = followPart(dt)
    const cur = shown.current
    cur.x += (target[0] - cur.x) * part
    cur.y += (target[1] - cur.y) * part
    cur.z += (target[2] - cur.z) * part
    cur.yaw = lerpAngle(cur.yaw, target[3], part)
    cur.turn.right += (target[4] - cur.turn.right) * part
    cur.turn.left += (target[5] - cur.turn.left) * part
    rb.setTranslation({ x: cur.x, y: cur.y, z: cur.z }, true)
    rb.setRotation(yawQuat(cur.yaw), true)
    parts.forEach((p, i) => {
      if (!p.side) return
      const angle = cur.turn[p.side]
      if (groups.current[i]) groups.current[i].rotation.y = angle
      colliders.current[i]?.setRotationWrtParent(yawQuat(angle))
    })
  })

  return (
    <>
      <RigidBody
        ref={rigidRef}
        type="kinematicPosition"
        position={[start.pose.x, start.pose.y, start.pose.z]}
        rotation={[0, start.pose.yaw, 0]}
        colliders={false}
        sensor
      >
        {parts.map((part, i) => (
          <group
            key={part.obj.uuid}
            ref={(g) => {
              groups.current[i] = g
            }}
            rotation-y={part.side ? start.turn[part.side] : 0}
          >
            <primitive object={part.obj} />
          </group>
        ))}
        {parts.map((part, i) => (
          <ConvexHullCollider
            key={part.obj.uuid}
            ref={(c) => {
              colliders.current[i] = c
            }}
            args={[hulls[i]]}
            rotation={[0, part.side ? start.turn[part.side] : 0, 0]}
          />
        ))}
      </RigidBody>
      <ToolFootprint
        rigidRef={rigidRef}
        turn={shown.current.turn}
        halfLength={tip}
        halfWidth={halfWidth}
        selected={selected}
        target={target}
        rangeFrom={rangeFrom}
      />
    </>
  )
}

function OtherRange({ number, team, entry, getLive, ...look }) {
  const mesh = number === 1 ? 2 : number
  const parts = useRangeParts(mesh, team)
  return (
    <OtherToolBody
      parts={parts}
      tip={RANGE_TIP[mesh] ?? 1.501}
      halfWidth={RANGE_HALF_WIDTH}
      defaultTurn={STRAIGHT}
      entry={entry}
      getLive={getLive}
      {...look}
    />
  )
}

function OtherMovement({ type, team, entry, getLive, ...look }) {
  const parts = useMovementParts(type, team)
  return (
    <OtherToolBody
      parts={parts}
      tip={MOVE_TIP[type] ?? 1.574}
      halfWidth={MOVE_HALF_WIDTH}
      defaultTurn={STRAIGHT}
      entry={entry}
      getLive={getLive}
      {...look}
    />
  )
}

function OtherAngle({ team, entry, getLive, ...look }) {
  const parts = useMovementParts('long', team)
  return (
    <OtherToolBody
      parts={parts}
      tip={MOVE_TIP.long}
      halfWidth={MOVE_HALF_WIDTH}
      defaultTurn={ANGLE_TURN}
      entry={entry}
      getLive={getLive}
      {...look}
    />
  )
}

// kind: 'range', 'move' or 'angle'. entry: a tool entry of the other side that has a pose.
// team: the other side, for the tint. Scene keys it by kind, which, and spawn.
// getLive(): the live pose of this tool from LiveSync (see OtherToolBody), or null.
// selected: the other player has this tool selected. target: their tool target (a tool model), or null.
// rangeFrom: on their range 1 tool while snapped, the snapped model, else null (see ToolFootprint).
export function OtherTool({ kind, entry, team, getLive, ...look }) {
  if (kind === 'range')
    return <OtherRange number={entry.which} team={team} entry={entry} getLive={getLive} {...look} />
  if (kind === 'move')
    return (
      <OtherMovement type={entry.which} team={team} entry={entry} getLive={getLive} {...look} />
    )
  return <OtherAngle team={team} entry={entry} getLive={getLive} {...look} />
}
