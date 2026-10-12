import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { tablePoint } from '../drag/tablePoint.js'
import { modelIdOfKey } from '../characters/claims.js'
import { cursorStep, isLiveKind, poseToNumbers, sameNumbers } from '../net/livePose.js'

// Packets at most every 33 ms, the cursor at most every 100 ms (plan 09, "Names", decisions 14 and 15)
const SEND_MS = 33
const CURSOR_MS = 100

// Tools and dice need no claim
const isClaimFree = (key) => key.startsWith('tool:') || key.startsWith('die:')

const round3 = (v) => Math.round(v * 1e3) / 1e3

// Sends the own live poses and the cursor, and keeps the latest poses of the other player. It lives inside
// Physics, because it reads the bodies and the world. It renders nothing. Never log a packet.
// live: the hub (net/live.js). ownership: net/ownership.js.
// getBody(id): the Rapier body of a model id, or undefined.
// toolLives: a ref to { range, move, angle }, each a function that gives the pose of the own tool
// { x, y, z, yaw, right, left }, or null (Tool in RulerTool.jsx registers it, the same way as turnRef).
// diceLives: a ref to { <tray side>: getter }. A getter gives [{ key: 'die:<id>', pose }] of the own dice that
// are not on the shelf (DiceTray registers it). Dice need no claim.
// pieceLives: a Map, piece key → getter of the live pose { x, z, yaw? } of a dragged piece without a body, or
// null. The drag code fills it from the claim to the end of the drag (drag/pointerDrag.js, Phase 6).
// hideCursor: true while the own side's Select squad is on; no cursor point is sent (decision 21).
// liveRef: filled with { pose(key), poseTime(key), tool(kind), die(key), cursor() }, for the pieces that follow. State is in refs,
// because it changes every frame. pose(key): the numbers of a piece while the other player claims it, else
// null. poseTime(key): when that pose arrived, in performance.now() ms, or null. tool(kind): { pose, time } of the other player's tool, time in performance.now() ms. die(key):
// { numbers, time } of the other player's die, or null. cursor():
// { point: [x, y, z], time } or null.
export default function LiveSync({
  live,
  ownership,
  getBody,
  toolLives,
  diceLives,
  pieceLives,
  liveRef,
  hideCursor = false,
}) {
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()
  // key → the numbers of the last sent pose
  const sent = useRef(new Map())
  const last = useRef({ packet: 0, cursor: 0 })
  // Read inside useFrame, so a change does not rebuild the callback
  const hideRef = useRef(hideCursor)
  useEffect(() => {
    hideRef.current = hideCursor
  }, [hideCursor])
  // The own pointer: where it was last (client pixels), whether it moved since the last cursor send, and
  // whether it is over the canvas
  const pointer = useRef({ x: 0, y: 0, inside: false, moved: false })
  // The last sent cursor: undefined (nothing yet), null, or the rounded point
  const sentCursor = useRef(undefined)
  // key → { numbers, time } of the other player's last poses
  const received = useRef(new Map())
  const cursor = useRef(null)

  useEffect(() => {
    const canvas = gl.domElement
    const move = (e) => {
      pointer.current = { x: e.clientX, y: e.clientY, inside: true, moved: true }
    }
    const leave = () => {
      pointer.current.inside = false
      pointer.current.moved = true
    }
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerleave', leave)
    return () => {
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerleave', leave)
    }
  }, [gl])

  // Receiving (decision 9): the pose of a piece counts only while the other player claims the key. A tool
  // pose and a die pose always count.
  useEffect(() => {
    const store = received.current
    liveRef.current = {
      pose: (key) => store.get(key)?.numbers ?? null,
      poseTime: (key) => store.get(key)?.time ?? null,
      tool: (kind) => {
        const item = store.get(`tool:${kind}`)
        return item ? { pose: item.numbers, time: item.time } : null
      },
      die: (key) => {
        const item = store.get(key)
        return item ? { numbers: item.numbers, time: item.time } : null
      },
      cursor: () => cursor.current,
    }
    const prune = () => {
      const owned = ownership.otherOwned()
      for (const key of store.keys()) {
        if (!isClaimFree(key) && !owned.has(key)) store.delete(key)
      }
    }
    const offOwnership = ownership.subscribe(prune)
    const off = live.subscribe(({ p, c }) => {
      const now = performance.now()
      const owned = ownership.otherOwned()
      for (const key of Object.keys(p)) {
        if (!isLiveKind(key)) continue
        if (!isClaimFree(key) && !owned.has(key)) continue
        store.set(key, { numbers: p[key], time: now })
      }
      if (c !== undefined) cursor.current = c && { point: c, time: now }
    })
    return () => {
      off()
      offOwnership?.()
      store.clear()
      cursor.current = null
      liveRef.current = null
    }
  }, [live, ownership, liveRef])

  // The cursor (decision 15): the point under the last pointer position, when it moved. null once when the
  // pointer leaves the canvas or the table. undefined: send nothing.
  function cursorUpdate(now) {
    if (now - last.current.cursor < CURSOR_MS) return undefined
    const ptr = pointer.current
    const step = cursorStep({ hide: hideRef.current, moved: ptr.moved })
    if (step === 'skip') return undefined
    let point = null
    // While hidden, the pointer counts as not moved, so the first move after the end sends the cursor again
    if (step === 'read' && ptr.inside) {
      const found = tablePoint({ camera, canvas: gl.domElement, world, rapier }, ptr.x, ptr.y, {
        offTable: 'null',
      })
      if (found) point = [round3(found.x), round3(found.y), round3(found.z)]
    }
    ptr.moved = false
    const before = sentCursor.current
    if (point === null ? before === null || before === undefined : sameNumbers(point, before)) {
      return undefined
    }
    sentCursor.current = point
    last.current.cursor = now
    return point
  }

  // Sending
  useFrame(() => {
    const now = performance.now()
    if (now - last.current.packet < SEND_MS) return
    const p = {}
    let any = false
    const keep = new Set()
    const add = (key, numbers) => {
      keep.add(key)
      if (!numbers || sameNumbers(numbers, sent.current.get(key))) return
      sent.current.set(key, numbers)
      p[key] = numbers
      any = true
    }
    for (const key of ownership.mine()) {
      const id = modelIdOfKey(key)
      const body = id === null ? null : getBody(id)
      if (!body) continue
      const t = body.translation()
      const r = body.rotation()
      add(key, poseToNumbers(key, { x: t.x, y: t.y, z: t.z, qx: r.x, qy: r.y, qz: r.z, qw: r.w }))
    }
    for (const kind of ['range', 'move', 'angle']) {
      const key = `tool:${kind}`
      const pose = toolLives.current?.[kind]?.()
      add(key, pose && poseToNumbers(key, pose))
    }
    for (const get of Object.values(diceLives.current)) {
      for (const { key, pose } of get()) add(key, poseToNumbers(key, pose))
    }
    for (const [key, get] of pieceLives) {
      const pose = get()
      add(key, pose && poseToNumbers(key, pose))
    }
    // A key that is not sent any more is forgotten, so a new claim sends its first pose
    for (const key of sent.current.keys()) if (!keep.has(key)) sent.current.delete(key)

    const packet = {}
    if (any) packet.p = p
    const c = cursorUpdate(now)
    if (c !== undefined) packet.c = c
    if (!packet.p && packet.c === undefined) return
    last.current.packet = now
    live.send(packet)
  })

  return null
}
