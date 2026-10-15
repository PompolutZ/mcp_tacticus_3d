import { useGLTF } from '@react-three/drei'
import { RigidBody, CylinderCollider, useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import {
  Box3,
  CylinderGeometry,
  FrontSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import {
  FRICTION,
  MODEL_GROUPS,
  SOLVER_ALL,
  SOLVER_NONE,
  castDown,
  liveBody,
  lowerFloor,
} from '../physics.js'
import { startPointerDrag } from '../drag/pointerDrag.js'
import { tablePoint } from '../drag/tablePoint.js'
import DragFootprint from './DragFootprint.jsx'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import { useColorTexture } from './useColorTexture.js'
import { assetUrl } from '../assets/index.js'
import { useHoverCursor } from './useHoverCursor.js'
import { useModelLift } from './useModelLift.js'
import { useLandingSound } from './useLandingSound.js'
import { useModelFollow } from './useModelFollow.js'
import { useFigureMaterials } from './useFigureMaterials.js'

// While dragged, the base hangs this far above the table or terrain below it
const DRAG_HOVER = 0.3
// How fast the dragged model moves to the new hover height, per second
const HOVER_RATE = 25
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
const ZERO = { x: 0, y: 0, z: 0 }
// A model that stays within SETTLE_MOVE inches and SETTLE_TURN of one pose for SETTLE_TIME seconds is put
// to sleep, as PhysX does in TTS. Without it, a model resting on a curved hull (made of many small faces)
// shakes and creeps down it, and Rapier never puts it to sleep because of the shaking.
const SETTLE_TIME = 0.5
const SETTLE_MOVE = 0.05
const SETTLE_TURN = (2 * Math.PI) / 180
// Base disk dims from angel.glb mesh0: radius≈0.983, height≈0.118
const BASE_RADIUS = 0.983
export const BASE_HALF_H = 0.059
// Same density for every model, so the mass follows the base size
const BASE_DENSITY = 5
// TTS drag of every object
const LINEAR_DAMPING = 0.1
// TTS angular drag is 0.1, but the TTS base is a 32-sided prism. It loses energy each time it rolls over
// an edge of the prism. This base is a round cylinder, which rolls on its rim without losing energy,
// so a model that leans on terrain rocks for a long time. The higher damping stops that.
// A 32-sided hull like the TTS base is not used because in Rapier it sinks into terrain hulls.
const ANGULAR_DAMPING = 5

// Same heading, but standing upright: keeps only the turn around the vertical axis
export function upright({ y, w }) {
  const len = Math.hypot(y, w)
  return len < 1e-6 ? NO_ROTATION : { x: 0, y: y / len, z: 0, w: w / len }
}

const UP = new Vector3(0, 1, 0)
const turnQuat = new Quaternion()
const bodyQuat = new Quaternion()

// Turns the body by angle (yaw) around the vertical line through its origin, the base center, as
// Q / E do in TTS. Scene.jsx calls it on every frame of a smoothed turn. The base is round, so the
// turn does not push an upright model into anything.
// While the model is dragged, the drag keeps the new heading (see upright).
export function turnBody(body, angle) {
  const r = body.rotation()
  turnQuat.setFromAxisAngle(UP, angle).multiply(bodyQuat.set(r.x, r.y, r.z, r.w))
  body.setRotation(turnQuat, true)
}

// Top of the table or terrain under the whole base at (x, z), or null when nothing is under it.
// A cast of the base shape, not a ray, so terrain under any part of the base counts.
// The body origin is the base bottom, so this is also the body Y that puts the base on the ground.
// from: height of the base bottom where the cast starts, when it is not above everything.
export function baseGroundY(world, rapier, x, z, radius = BASE_RADIUS, from = undefined) {
  return castDown(
    world,
    rapier,
    new rapier.Cylinder(BASE_HALF_H, radius),
    NO_ROTATION,
    x,
    z,
    BASE_HALF_H,
    from,
  )
}

// Height of the model top above its origin (the base bottom), in inches. Measured in the model's own
// space, so it does not depend on where the model stands.
function modelTop(scene) {
  scene.updateMatrixWorld(true)
  const toModel = new Matrix4().copy(scene.matrixWorld).invert()
  const box = new Box3()
  const meshBox = new Box3()
  const toMesh = new Matrix4()
  scene.traverse((obj) => {
    if (!obj.isMesh) return
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox()
    box.union(
      meshBox
        .copy(obj.geometry.boundingBox)
        .applyMatrix4(toMesh.multiplyMatrices(toModel, obj.matrixWorld)),
    )
  })
  return box.isEmpty() ? 0 : box.max.y
}

// Angle between two rotations, in radians
function turnBetween(a, b) {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
  return 2 * Math.acos(Math.min(1, dot))
}

// The files of a model (characters/models.js), as its component loads them: the GLB of a 3D model, or the
// front and back images of a standee, in this order. Scene passes them to the component, and Preload.jsx
// loads the same before a table shows (docs/features/rooms.md, "Loading").
export function modelUrls(model) {
  return model.figure === 'standee'
    ? { standee: [assetUrl(model.standeeFiles[0]), assetUrl(model.standeeFiles[1])] }
    : { gltf: assetUrl(model.file) }
}

// url: the GLB of the model. The other props: see CharacterFigure below.
export default function CharacterModel({ url, ...props }) {
  // useGLTF caches one scene per url. Each model needs its own copy: two characters with the same
  // model (both players take Mephisto) would share one object, and it can stand in one place only.
  const { scene: source } = useGLTF(url)
  const scene = useMemo(() => source.clone(), [source])
  return <CharacterFigure scene={scene} {...props} />
}

// A standee: a character without a 3D model (Valkyrie and Elendil). The mod spawns it as a TTS custom
// figurine with the two images (scripts/README.md, "TTS character migration"). Here it is a base of
// the game size with the images on it, so it works the same as a 3D model: select, drag, Q / E, R,
// the tools and token drops. The base material is named defaultMat, so it gets the team color, the
// same as the base of a 3D model.
// The image is as wide as the base, and its height follows the image. Not measured in TTS: the mod
// scales the figurine by 0.75, 1.1 and 1.4 for a small, medium and large base, so its size follows
// the base, but the image size of a TTS figurine at scale 1 is not known yet.
// urls: [front, back], the two images (modelUrls). The other props: see CharacterFigure below.
export function StandeeModel({ urls, ...props }) {
  const [front, back] = useColorTexture(urls)
  const radius = props.baseRadius ?? BASE_RADIUS
  const scene = useMemo(() => standeeScene(front, back, radius), [front, back, radius])
  useEffect(
    () => () =>
      scene.traverse((obj) => {
        if (!obj.isMesh) return
        obj.geometry.dispose()
        obj.material.dispose()
      }),
    [scene],
  )
  return <CharacterFigure scene={scene} {...props} />
}

// Back image this far behind the front one, so the two do not z-fight
const STANDEE_GAP = 0.005

function standeeScene(front, back, radius) {
  const scene = new Group()
  const baseHeight = BASE_HALF_H * 2
  const base = new Mesh(
    new CylinderGeometry(radius, radius, baseHeight, 48),
    new MeshStandardMaterial({ name: 'defaultMat', roughness: 0.6 }),
  )
  base.position.y = baseHeight / 2
  scene.add(base)
  const width = radius * 2
  const height = (width * front.image.height) / front.image.width
  for (const [map, turn, z] of [
    [front, 0, 0],
    [back, Math.PI, -STANDEE_GAP],
  ]) {
    const image = new Mesh(
      new PlaneGeometry(width, height),
      new MeshStandardMaterial({ map, roughness: 1, side: FrontSide }),
    )
    image.position.set(0, baseHeight + height / 2, z)
    image.rotation.y = turn
    scene.add(image)
  }
  return scene
}

// The body of a character model on the table: the base collider, the figure (scene, its own copy),
// and everything a player does with it.
// bodyRef, objectRef: get the Rapier body and the 3D object of the model (figure and base)
// onRest(): the body fell asleep, so the model rests. Scene.jsx stores its pose.
// liftRef: gets { toggle(), toggleFloor(), down(), cancel() } for the R key (see liftPiece in Scene.jsx), isUp() for a Throw
// (a lifted model does not stop it), isBusy() (a drag or lift is going on), and restPosition() for the stored pose: the body position before the
// lift, or null when the model is not lifted. Gets null on unmount.
// claimKey, ownership: the piece key `character:<id>` and the claims (net/ownership.js). A drag claims the key and
// leaves the release to Scene, which releases when the body is at rest (plan 09, decision 5).
// otherDragging: the other player drags this model now (ownership.otherDrag). Only then the remote model shows the
// drag footprint, not during their lift, turn, Throw or Place (decision 23).
// remote: the other player moves this model (decision 9). The body is kinematic and its colliders give no
// contact forces, so it pushes nothing. It stays where it is. A click still selects it. Scene sets the pose
// when this goes false (decision 8), and this puts the contact forces back.
// getLivePose(key): the latest live pose [x, y, z, qx, qy, qz, qw] of the model, or null (LiveSync.jsx). In the
// remote mode the model follows it each frame (decision 14) and shows the drag footprint while otherDragging (decision 18).
// getLiveTime(key): when that pose arrived, in performance.now() ms, or null. The remote model makes the sound of its
// landing from the poses and their times (docs/features/sounds.md).
// baseRadius: radius of the base in the model file, which has the game size
// onHover(over): called when the pointer moves onto the model (true) and off it (false)
// overlap: the model shows the overlap mark (overlap.js): a red outline and a red tint
// overlapsAt(x, y, z): true when a base of this model at that body position overlaps another model.
// A drag uses it for the mark and for the drop (see freePlace).
// rangeMark: 'inRange' or 'outOfRange' while a range tool marks the model (RangeMark in ToolFootprint.jsx)
// otherSelected: the side of the other player who has the model selected, or null
// onSelect(): a click. onDragSelect(): a drag starts, the model is selected and stays selected.
// position: where the body starts. Read only on mount: RigidBody moves its body when its position
// prop changes, and the spawn position follows the tray (Scene.jsx), which can move later.
// quaternion: the rotation the body starts with, [x, y, z, w], or undefined for none. Read only on mount,
// the same as position. A model of a saved room starts at its saved pose, asleep (docs/features/rooms.md).
// overlay(top): optional, what moves with the model above it (SpectatorBadge.jsx). top: height of the
// model top above the base bottom, in inches.
function CharacterFigure({
  scene,
  position = [0, 0, 0],
  quaternion,
  baseRadius = BASE_RADIUS,
  rotation = [0, 0, 0],
  team = 'guest',
  selected = false,
  rangeMark,
  otherSelected = null,
  overlap = false,
  overlapsAt,
  onSelect,
  onDragSelect,
  onHover,
  bodyRef,
  onRest,
  objectRef,
  liftRef,
  onDragStart,
  onDragEnd,
  constrainDrag,
  overlay,
  claimKey,
  ownership,
  remote = false,
  otherDragging = false,
  getLivePose,
  getLiveTime,
}) {
  const [startPosition] = useState(position)
  const [startQuaternion] = useState(quaternion)
  const top = useMemo(() => modelTop(scene), [scene])
  const { camera, gl, controls } = useThree()
  const { world, rapier } = useRapier()
  const [hovered, setHovered] = useState(false)
  const rigidRef = useRef()
  // The body if it is still in the world, else null. For listeners, effects and drag callbacks, which can
  // run after the body is removed (physics.js, liveBody).
  function liveRb() {
    const rb = rigidRef.current
    return liveBody(world, rb) ? rb : null
  }
  // The handle of the running pointer drag, so an unmount can cancel it
  const dragHandle = useRef(null)
  const figureRef = useRef()
  const isDragging = useRef(false)
  // Last body position of this drag where the base overlapped no model: { x, y, z }. Starts at the
  // position of the drag start. A drop inside a model goes back here.
  const freePlace = useRef(null)
  // The pose of the body when this drag started: { t: {x, y, z}, r: {x, y, z, w} }. Esc puts the body back to it.
  const startPose = useRef(null)
  // The dragged base overlaps a model now. Shows the mark without the 100 ms delay of Scene.
  const [dragOverlap, setDragOverlap] = useState(false)
  const showOverlap = overlap || dragOverlap
  // Mounts the footprint of the base during a drag
  const [dragging, setDragging] = useState(false)
  // Pose the model has stayed close to, and for how long: { t, r, time }. See SETTLE_TIME.
  const rest = useRef(null)
  // The remote prop for the closures that are made once (toggleLift)
  const remoteRef = useRef(remote)
  const { lift, toggleLift, lowerLift, moveLift } = useModelLift({
    liveRb,
    groundY,
    isDragging,
    remoteRef,
    clearRest: () => {
      rest.current = null
    },
  })
  const wasRemote = useRef(false)
  const { follow, following, setFollowing, followLive } = useModelFollow({ getLivePose, claimKey })
  // The last pointer position of a drag, in screen pixels
  const pointer = useRef({ x: 0, y: 0 })

  function groundY(x, z) {
    return baseGroundY(world, rapier, x, z, baseRadius)
  }

  // Which floor the drag uses: 'top' (the top of the terrain, default) or 'lower' (under an overhang, R).
  // Resets at the start and the end of a drag.
  const floorMode = useRef('top')

  // The lower floor under the base at (x, z), { floor, limit }, or null (physics.js, lowerFloor)
  function lowerBaseFloor(x, z, topY) {
    return lowerFloor(
      world,
      rapier,
      new rapier.Cylinder(BASE_HALF_H, baseRadius),
      NO_ROTATION,
      x,
      z,
      BASE_HALF_H,
      topY,
    )
  }

  // Table or terrain point under the pointer, so the model stays under the cursor on raised terrain
  function pointerPoint() {
    const scene = { camera, canvas: gl.domElement, world, rapier }
    return tablePoint(scene, pointer.current.x, pointer.current.y)
  }

  const { listenLanding, remoteBump, livePlace } = useLandingSound({
    groundBelow: (x, z, from) => baseGroundY(world, rapier, x, z, baseRadius, from),
    rigidRef,
    remoteRef,
    claimKey,
    otherDragging,
    getLivePose,
    getLiveTime,
  })

  // Puts the body to sleep once it has stayed close to one pose for SETTLE_TIME
  function settle(rb, dt) {
    if (rb.isSleeping()) {
      rest.current = null
      return
    }
    const t = rb.translation()
    const r = rb.rotation()
    const ref = rest.current
    if (
      ref &&
      Math.hypot(t.x - ref.t.x, t.y - ref.t.y, t.z - ref.t.z) < SETTLE_MOVE &&
      turnBetween(r, ref.r) < SETTLE_TURN
    ) {
      ref.time += dt
      if (ref.time >= SETTLE_TIME) {
        rb.sleep()
        rest.current = null
      }
      return
    }
    rest.current = { t, r, time: 0 }
  }

  // R during a drag: switches between the top floor and the lower floor. Returns the HUD message, or null
  // when no model is dragged. The message says "No space under" when the lower floor is chosen and the
  // base has no lower floor at the pointer now (the model stays on top until there is one).
  function toggleFloor() {
    if (!isDragging.current || remoteRef.current) return null
    floorMode.current = floorMode.current === 'top' ? 'lower' : 'top'
    if (floorMode.current === 'top') return 'Top floor'
    const p = pointerPoint()
    const ground = p && groundY(p.x, p.z)
    const found = ground != null && lowerBaseFloor(p.x, p.z, ground)
    return found ? 'Lower floor' : 'Lower floor: no space under here'
  }

  // A model of a saved room starts asleep at its pose, the same as it was when the room saved. So it
  // does not move before the terrain under it has its colliders. A touch, a drag or a removed terrain
  // piece wakes it. RigidBody creates and places the body in its own effects, which run before this one.
  useEffect(() => {
    if (startQuaternion) rigidRef.current?.sleep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    liftRef?.({
      toggle: toggleLift,
      toggleFloor,
      down: lowerLift,
      // Ends the lift without a move: the caller puts the body elsewhere (Scene.jsx, returnModels)
      cancel: () => {
        lift.current = null
      },
      isUp: () => lift.current?.up === true,
      isBusy: () => isDragging.current || lift.current !== null,
      restPosition: () =>
        lift.current && { x: lift.current.x, y: lift.current.y, z: lift.current.z },
    })
    return () => {
      liftRef?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const rb = rigidRef.current
    if (!rb) return
    if (!remoteRef.current && follow.current) {
      follow.current = null
      setFollowing(false)
    }
    // The other player moves this model. Nothing here moves or settles the body, except the follow.
    if (remoteRef.current) {
      listenLanding()
      followLive(rb, dt)
      return
    }
    if (!isDragging.current) {
      if (lift.current) moveLift(rb, dt)
      else settle(rb, dt)
      return
    }
    rest.current = null
    const p = pointerPoint()
    if (!p) return
    if (constrainDrag) constrainDrag(p)
    const t = rb.translation()
    // Off the table there is no ground, so keep the current height.
    // Never below the ground: a base released inside terrain can be pushed out through the bottom of it.
    let ground = groundY(p.x, p.z)
    // Lower floor mode (R): the floor under an overhang, where there is one. The hover stays below it.
    let hover = DRAG_HOVER
    if (ground !== null && floorMode.current === 'lower') {
      const low = lowerBaseFloor(p.x, p.z, ground)
      if (low) {
        ground = low.floor
        hover = Math.min(DRAG_HOVER, low.limit - low.floor)
      }
    }
    const y =
      ground === null
        ? t.y
        : Math.max(ground, t.y + (ground + hover - t.y) * Math.min(1, dt * HOVER_RATE))
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x: p.x, y, z: p.z })
    const inside = overlapsAt?.(p.x, y, p.z) ?? false
    if (!inside) freePlace.current = { x: p.x, y, z: p.z }
    setDragOverlap(inside)
    // Picking the model up stands it upright again if it tipped over, as a TTS figurine does
    rb.setNextKinematicRotation(upright(rb.rotation()))
  })

  // The remote mode (decision 9). A lift or a drag of this browser stops moving the body, with no drop
  // and no write. Back from it, Scene sets the body type and the pose, and the contact forces come back here.
  useEffect(() => {
    remoteRef.current = remote
    const rb = liveRb()
    if (!rb || remote === wasRemote.current) return
    wasRemote.current = remote
    // The pose set when the remote mode ends is a jump, and no bump
    remoteBump.current?.reset()
    livePlace.current = null
    for (let i = 0; i < rb.numColliders(); i++) {
      rb.collider(i).setSolverGroups(remote ? SOLVER_NONE : SOLVER_ALL)
    }
    if (remote) {
      lift.current = null
      rest.current = null
      rb.setBodyType(2, true)
    }
  }, [remote])

  useFigureMaterials(scene, team, showOverlap)

  useOutline(figureRef, outlineMode(selected, hovered, rangeMark, showOverlap, otherSelected))
  // A click toggles the selection. A drag moves the model at once and selects it.
  useHoverCursor(hovered, 'grab')

  // onHover(true) while the pointer is over the model, onHover(false) after. The cleanup also runs
  // on unmount, so a removed model does not stay hovered.
  useEffect(() => {
    if (!hovered) return undefined
    onHover?.(true)
    return () => onHover?.(false)
  }, [hovered])

  function onPointerDown(e) {
    dragHandle.current = startPointerDrag(e, {
      controls,
      canvas: gl.domElement,
      canStart: () => Boolean(liveRb()),
      key: claimKey,
      ownership,
      releaseAtEnd: false,
      onStart: () => {
        onDragSelect?.()
        // A drag ends a lift. The model follows the pointer and drops where it is released.
        lift.current = null
        liveRb()?.setBodyType(2, true)
        isDragging.current = true
        floorMode.current = 'top'
        setDragging(true)
        const rb = liveRb()
        if (!rb) return
        freePlace.current = { ...rb.translation() }
        startPose.current = {
          t: { ...rb.translation() },
          r: { ...rb.rotation() },
        }
        onDragStart?.()
      },
      onMove: (ev) => {
        pointer.current = { x: ev.clientX, y: ev.clientY }
      },
      onEnd: () => {
        isDragging.current = false
        floorMode.current = 'top'
        // A drop inside a model goes back to the last free place (rotation stays). A jump, as no
        // tween exists for a body.
        const rb = liveRb()
        const back = freePlace.current
        if (rb && back) {
          const t = rb.translation()
          if (overlapsAt?.(t.x, t.y, t.z)) rb.setTranslation(back, true)
        }
        freePlace.current = null
        startPose.current = null
        setDragOverlap(false)
        setDragging(false)
        liveRb()?.setBodyType(0, true)
        liveRb()?.setLinvel(ZERO, true)
        liveRb()?.setAngvel(ZERO, true)
        onDragEnd?.()
      },
      // Esc: the body goes back to the pose of the drag start, with no velocity and dynamic again. A turn (Q / E)
      // and a floor switch (R) of the drag are undone with it. No write here: the body falls asleep at the
      // start pose, and then the rest write and the claim release run as after any drag. The peers follow
      // the live pose until then.
      // A lost tie (reason 'lost'): the other player moves the model now. The body stays as it is for the
      // remote mode, and there is no put back, which would fight their drag.
      onCancel: (reason) => {
        const rb = liveRb()
        const from = startPose.current
        isDragging.current = false
        floorMode.current = 'top'
        freePlace.current = null
        startPose.current = null
        setDragOverlap(false)
        setDragging(false)
        if (reason !== 'lost' && reason !== 'unmount' && rb && from) {
          rb.setBodyType(0, true)
          rb.setTranslation(from.t, true)
          rb.setRotation(from.r, true)
          rb.setLinvel(ZERO, true)
          rb.setAngvel(ZERO, true)
        }
        onDragEnd?.(reason !== 'lost' && reason !== 'unmount' && Boolean(from))
      },
      onClick: () => onSelect?.(),
    })
  }

  // Also hand the body to the parent, so tools can read and move it
  function setBody(rb) {
    rigidRef.current = rb
    bodyRef?.(rb)
  }

  // RigidBody passes the new body to a function ref, but never passes null when it removes the body.
  // So the parent forgets the body here, on unmount. A call on a removed body makes Rapier fail, and
  // after that every call into the physics world fails (the room save read the removed body).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      dragHandle.current?.cancel('unmount')
      dragHandle.current = null
      setBody(null)
    },
    [],
  )

  // Also hand the 3D object to the parent, so tools can find the model under the pointer
  function setFigure(obj) {
    figureRef.current = obj
    objectRef?.(obj)
  }

  // Only the base collides, as in the mod's model bundles, so the center of mass is the base center.
  // Rotation is free, as in TTS: the model stays upright while its center of mass is over the ground
  // and tips over when it is past an edge.
  // The base circle under the body, red while it overlaps another model
  const footprintShape = () => {
    const t = follow.current?.pos ?? rigidRef.current?.translation()
    return t ? { x: t.x, z: t.z, radius: baseRadius } : null
  }

  return (
    // dominanceGroup 1 (dice stay at the default, 0): in a model-die contact, Rapier moves only the
    // lower-group body, so a die never pushes a model (design, "Collisions"). Fixed/kinematic
    // bodies are already always dominant, so this only changes model-die contacts.
    <RigidBody
      ref={setBody}
      type="dynamic"
      position={startPosition}
      quaternion={startQuaternion}
      colliders={false}
      linearDamping={LINEAR_DAMPING}
      angularDamping={ANGULAR_DAMPING}
      ccd
      dominanceGroup={1}
      onSleep={onRest}
    >
      <CylinderCollider
        args={[BASE_HALF_H, baseRadius]}
        position={[0, BASE_HALF_H, 0]}
        friction={FRICTION}
        density={BASE_DENSITY}
        collisionGroups={MODEL_GROUPS}
      />
      <primitive
        ref={setFigure}
        object={scene}
        rotation={rotation}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={onPointerDown}
      />
      {(dragging || (following && otherDragging)) && (
        <DragFootprint getShape={footprintShape} getApart={() => dragOverlap} />
      )}
      {overlay?.(top)}
    </RigidBody>
  )
}
