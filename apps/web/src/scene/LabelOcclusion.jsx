import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CHECK_INTERVAL, checkDue, pointMoved, rayToAnchor, turned } from './labelOcclusion.js'

// Hides a drei <Html> label while terrain is between the camera and the label. drei's own `occlude`
// raycasts the three.js scene for each label and changes the canvas pointer events, so it is not used.
// Instead, about every CHECK_INTERVAL (and only when the camera, a label or the terrain changed), one
// Rapier ray goes from the camera to each label. A fixed collider on the way hides the label. The label
// element gets visibility: hidden (a style change, not React state), so it takes no pointer events either.
// The pure part is in labelOcclusion.js. See docs/features/table-tools.md, "Labels".
//
// Scene wraps the table in LabelOcclusionProvider and mounts LabelOcclusionLoop inside <Physics>. A label
// is an OccludedHtml. Outside a provider it is a plain <Html>.

const LabelContext = createContext(null)

// The registry: the labels, and the flag that the next check must run. Plain object, not state.
export function createLabelRegistry() {
  return { labels: new Set(), dirty: true }
}

export function LabelOcclusionProvider({ registry, children }) {
  return <LabelContext.Provider value={registry}>{children}</LabelContext.Provider>
}

// Asks for a check at the next interval. For a change that moves no label: terrain added, removed or
// moved. Call it from an effect.
export function useLabelsDirty(key) {
  const registry = useContext(LabelContext)
  useEffect(() => {
    if (registry) registry.dirty = true
    return () => {
      if (registry) registry.dirty = true
    }
  }, [registry, key])
}

// drei <Html> at `position` (local to the parent) that hides behind terrain. Other props go to <Html>.
// skip: () => RigidBody or undefined, the body of the label's own terrain piece, which does not hide it.
export function OccludedHtml({ position, skip, ...props }) {
  const registry = useContext(LabelContext)
  const anchorRef = useRef(null)
  const elRef = useRef(null)
  const skipRef = useRef(skip)
  skipRef.current = skip

  useEffect(() => {
    if (!registry) return undefined
    const label = {
      anchor: anchorRef,
      el: elRef,
      skip: () => skipRef.current?.(),
      hidden: false,
      pos: new THREE.Vector3(Infinity, 0, 0),
    }
    registry.labels.add(label)
    registry.dirty = true
    return () => {
      registry.labels.delete(label)
    }
  }, [registry])

  return (
    <group ref={anchorRef} position={position}>
      <Html ref={elRef} {...props} />
    </group>
  )
}

// The check loop. Mount it inside <Physics>.
export function LabelOcclusionLoop({ registry }) {
  const { world, rapier } = useRapier()
  const camera = useThree((s) => s.camera)
  const state = useMemo(
    () => ({
      last: -Infinity,
      camPos: new THREE.Vector3(Infinity, 0, 0),
      camQuat: new THREE.Quaternion(),
      world: new THREE.Vector3(),
      ray: new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
      out: { origin: null, dir: null, maxToi: 0 },
      flags: rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    }),
    [rapier],
  )
  state.out.origin = state.ray.origin
  state.out.dir = state.ray.dir

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    if (now - state.last < CHECK_INTERVAL) return
    state.last = now
    if (registry.labels.size === 0) {
      registry.dirty = false
      return
    }

    const cameraMoved =
      pointMoved(camera.position, state.camPos) || turned(camera.quaternion, state.camQuat)
    state.camPos.copy(camera.position)
    state.camQuat.copy(camera.quaternion)
    let anchorMoved = false
    for (const label of registry.labels) {
      const anchor = label.anchor.current
      if (!anchor) continue
      anchor.getWorldPosition(state.world)
      if (pointMoved(state.world, label.pos)) anchorMoved = true
      label.pos.copy(state.world)
    }
    if (!checkDue({ now, last: -Infinity, cameraMoved, dirty: registry.dirty, anchorMoved })) return
    registry.dirty = false

    for (const label of registry.labels) {
      const el = label.el.current
      if (!el || !label.anchor.current) {
        registry.dirty = true // drei mounts the element a little later
        continue
      }
      let hidden = false
      if (rayToAnchor(camera.position, label.pos, state.out)) {
        hidden = Boolean(
          world.castRay(
            state.ray,
            state.out.maxToi,
            true,
            state.flags,
            undefined,
            undefined,
            label.skip(),
          ),
        )
      }
      if (hidden !== label.hidden) {
        label.hidden = hidden
        el.style.visibility = hidden ? 'hidden' : ''
      }
    }
  })
  return null
}
