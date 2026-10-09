import { useGLTF } from '@react-three/drei'
import { RigidBody, CylinderCollider, useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import {
  Box3,
  Color,
  CylinderGeometry,
  FrontSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Vector3,
} from 'three'
import { FRICTION, castDown } from '../physics.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import { useColorTexture } from './useColorTexture.js'
import { assetUrl } from '../assets/index.js'
import { useHoverCursor } from './useHoverCursor.js'

const TEAM_COLORS = { red: '#c0392b', blue: '#2980b9' }
const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const DRAG_THRESHOLD = 4
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
// The R key lifts a model straight up by LIFT_HEIGHT (inches), and a second press puts it back at the
// same place. So a player can see and select a token under it, and a Throw or Push can move a model
// under it (README "Throw / Push"). The tallest model measured, Sentinel Prime MK4 (5.28", on
// 2026-10-06), fits under a lifted model. Onslaught was not in the TTS cache, so it is not measured.
// From the start view (45°), a token under a large base already shows below a model lifted 2".
const LIFT_HEIGHT = 6
// The lift is smoothed the same way as a Q / E turn (Scene.jsx): each frame the model does
// 1 − e^(−dt / time) of the move that is left. When less than LIFT_DONE (inches) is left, the move is done.
const LIFT_SMOOTH_TIME = 0.06
const LIFT_DONE = 0.001
// Something else moved a lifted model (for example Place, see RulerTool.jsx) when its x or z is this
// far (inches) from the place of the lift
const LIFT_MOVED = 0.001

// Base disk dims from angel.glb mesh0: radius≈0.983, height≈0.118
export const BASE_RADIUS = 0.983
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
export function baseGroundY(world, rapier, x, z, radius = BASE_RADIUS) {
  return castDown(
    world,
    rapier,
    new rapier.Cylinder(BASE_HALF_H, radius),
    NO_ROTATION,
    x,
    z,
    BASE_HALF_H,
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
// loads the same before a table shows (docs/feature-rooms.md, "Loading").
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
// liftRef: gets { toggle(), down() } for the R key (see liftPiece in Scene.jsx), isUp() for a Throw
// (a lifted model does not stop it), and restPosition() for the stored pose: the body position before the
// lift, or null when the model is not lifted. Gets null on unmount.
// slideRef: gets startSlide for a Throw or Push (see RulerTool.jsx), and null on unmount
// baseRadius: radius of the base in the model file, which has the game size
// onHover(over): called when the pointer moves onto the model (true) and off it (false)
// rangeMark: 'inRange' or 'outOfRange' while a range tool marks the model (RangeMark in RulerTool.jsx)
// position: where the body starts. Read only on mount: RigidBody moves its body when its position
// prop changes, and the spawn position follows the tray (Scene.jsx), which can move later.
// quaternion: the rotation the body starts with, [x, y, z, w], or undefined for none. Read only on mount,
// the same as position. A model of a saved room starts at its saved pose, asleep (docs/feature-rooms.md).
// overlay(top): optional, what moves with the model above it (SpectatorBadge.jsx). top: height of the
// model top above the base bottom, in inches.
function CharacterFigure({
  scene,
  position = [0, 0, 0],
  quaternion,
  baseRadius = BASE_RADIUS,
  rotation = [0, 0, 0],
  teamColor = 'red',
  selected = false,
  rangeMark,
  onSelect,
  onHover,
  bodyRef,
  onRest,
  objectRef,
  liftRef,
  slideRef,
  onDragStart,
  onDragEnd,
  constrainDrag,
  overlay,
}) {
  const [startPosition] = useState(position)
  const [startQuaternion] = useState(quaternion)
  const top = useMemo(() => modelTop(scene), [scene])
  const { camera, gl, controls } = useThree()
  const { world, rapier } = useRapier()
  const [hovered, setHovered] = useState(false)
  const rigidRef = useRef()
  const figureRef = useRef()
  const moveRef = useRef(null)
  const upRef = useRef(null)
  const raycaster = useRef(new Raycaster())
  const isDragging = useRef(false)
  // Pose the model has stayed close to, and for how long: { t, r, time }. See SETTLE_TIME.
  const rest = useRef(null)
  // The lift (R key): { x, y, z, sleeping, up, landing }, or null. x, y, z: the body position before
  // the lift. The model goes back there exactly. sleeping: the body was asleep then. up: the model
  // goes up (true) or back down (false). landing: the model is back at x, y, z, and becomes a
  // dynamic body again in the next frame.
  const lift = useRef(null)
  // The slide of a Throw or Push (startSlide): { path, duration, time }, or null
  const slide = useRef(null)
  const mouseNDC = useRef({ x: 0, y: 0 })
  // Pointer and ground casts hit only fixed bodies (table and terrain), and no sensors
  const groundOnly = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS

  function groundY(x, z) {
    return baseGroundY(world, rapier, x, z, baseRadius)
  }

  // Table or terrain point under the pointer, so the model stays under the cursor on raised terrain
  function pointerPoint() {
    raycaster.current.setFromCamera(mouseNDC.current, camera)
    const { origin, direction } = raycaster.current.ray
    const hit = world.castRay(new rapier.Ray(origin, direction), 1000, true, groundOnly)
    if (hit) return raycaster.current.ray.at(hit.timeOfImpact, new Vector3())
    return raycaster.current.ray.intersectPlane(TABLE_PLANE, new Vector3())
  }

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

  // R: lifts the model, or puts it back down if it is up. During a drag it does nothing.
  // The body is kinematic during the lift, so physics does not move it: it does not fall, and
  // nothing pushes it.
  function toggleLift() {
    const rb = rigidRef.current
    if (!rb || isDragging.current || slide.current) return
    if (lift.current) {
      lift.current.up = !lift.current.up
      lift.current.landing = false
      return
    }
    const t = rb.translation()
    lift.current = { x: t.x, y: t.y, z: t.z, sleeping: rb.isSleeping(), up: true, landing: false }
    rest.current = null
    rb.setBodyType(2, true)
  }

  function lowerLift() {
    if (lift.current) lift.current.up = false
  }

  function endLift(rb) {
    lift.current = null
    rb.setBodyType(0, true)
    rb.setLinvel(ZERO, true)
    rb.setAngvel(ZERO, true)
  }

  // Moves a lifted model one frame up or down. The heading stays as it is now, so a Q / E turn
  // during the lift stays after it. Back down, the model is at the same place as before the lift,
  // and a model that was asleep sleeps again. So physics does not move it from that place.
  function moveLift(rb, dt) {
    const from = lift.current
    const t = rb.translation()
    if (Math.abs(t.x - from.x) > LIFT_MOVED || Math.abs(t.z - from.z) > LIFT_MOVED) {
      // Something else moved the model during the lift: Place, or its tray moved and took the model
      // with it (Scene.jsx). The lift ends, and the model stands on the table or terrain there.
      const ground = groundY(t.x, t.z)
      if (ground !== null && t.y > ground) rb.setTranslation({ x: t.x, y: ground, z: t.z }, true)
      endLift(rb)
      return
    }
    const place = { x: from.x, y: from.y, z: from.z }
    if (from.landing) {
      // The kinematic move of the frame before put the body and its mesh at the place. The model
      // sleeps only now, because the mesh of a sleeping body does not follow the body.
      rb.setTranslation(place, true)
      endLift(rb)
      if (from.sleeping) rb.sleep()
      return
    }
    const left = (from.up ? from.y + LIFT_HEIGHT : from.y) - t.y
    if (Math.abs(left) < LIFT_DONE) {
      if (from.up) return
      from.landing = true
      rb.setNextKinematicTranslation(place)
      return
    }
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({
      ...place,
      y: t.y + left * (1 - Math.exp(-dt / LIFT_SMOOTH_TIME)),
    })
  }

  // Throw / Push (README "Throw / Push"): moves the model along path in duration seconds. path(f) is the
  // body position at the share f (0..1) of the slide, with y null when nothing is under it. The body is
  // kinematic during the slide, so physics does not move it. A slide ends a lift, and a drag ends a slide.
  function startSlide(path, duration) {
    const rb = rigidRef.current
    if (!rb || isDragging.current) return
    lift.current = null
    rest.current = null
    rb.setBodyType(2, true)
    slide.current = { path, duration, time: 0 }
  }

  // Moves a sliding model one frame. It stands upright, as during a drag. Its height follows the path,
  // smoothed the same way as during a drag, so a model that leaves a roof drops quickly but not at
  // once. At the end the model stands at the last point of the path, and physics moves it again.
  function moveSlide(rb, dt) {
    const s = slide.current
    const t = rb.translation()
    s.time += dt
    if (s.time >= s.duration) {
      const end = s.path(1)
      slide.current = null
      rb.setBodyType(0, true)
      rb.setTranslation({ x: end.x, y: end.y ?? t.y, z: end.z }, true)
      rb.setRotation(upright(rb.rotation()), true)
      rb.setLinvel(ZERO, true)
      rb.setAngvel(ZERO, true)
      return
    }
    const p = s.path(s.time / s.duration)
    const y = p.y === null ? t.y : t.y + (p.y - t.y) * Math.min(1, dt * HOVER_RATE)
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x: p.x, y, z: p.z })
    rb.setNextKinematicRotation(upright(rb.rotation()))
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
      down: lowerLift,
      isUp: () => lift.current?.up === true,
      restPosition: () =>
        lift.current && { x: lift.current.x, y: lift.current.y, z: lift.current.z },
    })
    slideRef?.(startSlide)
    return () => {
      liftRef?.(null)
      slideRef?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const rb = rigidRef.current
    if (!rb) return
    if (!isDragging.current) {
      if (slide.current) moveSlide(rb, dt)
      else if (lift.current) moveLift(rb, dt)
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
    const ground = groundY(p.x, p.z)
    const y =
      ground === null
        ? t.y
        : Math.max(ground, t.y + (ground + DRAG_HOVER - t.y) * Math.min(1, dt * HOVER_RATE))
    // A sleeping body keeps moving but its mesh is not synced, so keep it awake
    rb.wakeUp()
    rb.setNextKinematicTranslation({ x: p.x, y, z: p.z })
    // Picking the model up stands it upright again if it tipped over, as a TTS figurine does
    rb.setNextKinematicRotation(upright(rb.rotation()))
  })

  useEffect(() => {
    const color = new Color(TEAM_COLORS[teamColor] ?? teamColor)
    scene.traverse((obj) => {
      if (!obj.isMesh) return
      obj.castShadow = true
      obj.receiveShadow = true
      if (obj.material?.name === 'defaultMat') {
        obj.material = obj.material.clone()
        obj.material.color = color
      }
    })
  }, [scene, teamColor])

  useOutline(figureRef, outlineMode(selected, hovered, rangeMark))
  // A click selects the model. Only a selected model moves by a drag.
  useHoverCursor(hovered, selected ? 'grab' : 'pointer')

  // onHover(true) while the pointer is over the model, onHover(false) after. The cleanup also runs
  // on unmount, so a removed model does not stay hovered.
  useEffect(() => {
    if (!hovered) return undefined
    onHover?.(true)
    return () => onHover?.(false)
  }, [hovered])

  function onPointerDown(e) {
    // Only the left button moves a piece. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId ?? e.nativeEvent?.pointerId
    if (controls) controls.enabled = false
    if (pointerId !== undefined && gl.domElement.hasPointerCapture?.(pointerId)) {
      gl.domElement.releasePointerCapture(pointerId)
    }

    moveRef.current = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (!isDragging.current) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!selected || Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        // A drag ends a lift or a slide. The model follows the pointer and drops where it is released.
        lift.current = null
        slide.current = null
        rigidRef.current?.setBodyType(2, true)
        isDragging.current = true
        onDragStart?.()
      }
      const rect = gl.domElement.getBoundingClientRect()
      mouseNDC.current = {
        x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      }
    }

    upRef.current = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (isDragging.current) {
        isDragging.current = false
        rigidRef.current?.setBodyType(0, true)
        rigidRef.current?.setLinvel(ZERO, true)
        rigidRef.current?.setAngvel(ZERO, true)
        onDragEnd?.()
      } else {
        onSelect?.()
      }
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', moveRef.current)
      window.removeEventListener('pointerup', upRef.current)
      moveRef.current = null
      upRef.current = null
    }

    window.addEventListener('pointermove', moveRef.current)
    window.addEventListener('pointerup', upRef.current)
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
  useEffect(() => () => setBody(null), [])

  // Also hand the 3D object to the parent, so tools can find the model under the pointer
  function setFigure(obj) {
    figureRef.current = obj
    objectRef?.(obj)
  }

  // Only the base collides, as in the mod's model bundles, so the center of mass is the base center.
  // Rotation is free, as in TTS: the model stays upright while its center of mass is over the ground
  // and tips over when it is past an edge.
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
      {overlay?.(top)}
    </RigidBody>
  )
}
