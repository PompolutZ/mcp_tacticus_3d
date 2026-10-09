import { Suspense, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Quaternion, Vector3 } from 'three'
import { TOKEN_SIZE } from '../tokens/files.js'
import { TOKEN_RADIUS, TokenDisk, useTokenMaps } from './CrisisToken.jsx'
import TokenFace from './TokenFace.jsx'
import { TrayCounters } from './TrayControls.jsx'

// The badge is the tray's pieces at this scale. Picked by look, not measured: real size (1) is as
// small as the tray tokens.
const BADGE_SCALE = 1.25
// Gap between two rows, in inches before the scale. The same gap as between two tokens on the tray
// (trays.js, TOKEN_GAP).
const GAP = 0.1
// Gap between the model top and the badge bottom, in inches. Picked by look: with 0.1 the upright
// badge's lowest row touches the model head.
const LIFT = 0.5
const TOKEN_PITCH = TOKEN_SIZE + GAP
const TOKENS_PER_ROW = 4
const OBJECTIVE_PITCH = 2 * TOKEN_RADIUS + GAP
// Height of the Damage and Power counters: about 16 CSS px, and drei's Html transform draws 40 CSS px
// as 1" (see DiceKeys.jsx)
const COUNTERS_HEIGHT = 0.45
// Rx(π/2) stands up a token that lies flat (image up, image top to local -z): the image faces local
// +z, the badge front, with its top up
const STAND_UP = [Math.PI / 2, 0, 0]
// The badge draws after the rest of the scene, with no depth test, so terrain and other models never
// hide a part of it. Its Html counters are on top of the canvas anyway.
const ON_TOP = 10
const NO_RAYCAST = () => null
const NO_EVENTS = { raycast: NO_RAYCAST }
// Range 1 is 1", edge to edge seen from above (README "Range 1"). TTS checks the same distance for
// its "Securing" icon (checkForSecure in the tray script: center distance < base radius + 1 + token
// radius). Physics can nudge a resting base a little, so a small gap still counts, the same as the
// R1 tool (RulerTool.jsx, CONTACT_EPS).
const RANGE_ONE = 1
const CONTACT_EPS = 0.01

const UP = new Vector3(0, 1, 0)
const center = new Vector3()
const baseTurn = new Quaternion()
const cameraRight = new Vector3()
const badgeTurn = new Quaternion()

// Draws every mesh under object on top of the scene (see ON_TOP). Each frame, because a token mounts
// later, after its image loads.
function drawOnTop(object) {
  object.traverse((obj) => {
    if (!obj.isMesh) return
    obj.renderOrder = ON_TOP
    for (const material of [obj.material].flat()) {
      if (!material.depthTest) continue
      material.depthTest = false
      material.depthWrite = false
      // Transparent objects draw after opaque ones. So the badge also draws after the transparent
      // objects of the scene, and none of them covers it.
      material.transparent = true
      material.needsUpdate = true
    }
  })
}

// x of item `index` of `count` items in a row centered on x = 0
function rowX(index, count, pitch) {
  return (index - (count - 1) / 2) * pitch
}

// A crisis token as on the tray card: the same disk as CrisisToken.jsx, without its drag and markers
function Objective({ token }) {
  const [topMap, bottomMap] = useTokenMaps(token)
  return <TokenDisk topMap={topMap} bottomMap={bottomMap} events={NO_EVENTS} />
}

// Spectator view: what TTS shows above each model (see docs/feature-spectator-view.md), made of the
// tray's own pieces, so it looks the same as the tray. From top to bottom: the objective tokens the
// character holds and the Secure tokens within range 1 of its base (the crisis token disk), the Damage
// and Power counters (TrayControls.jsx, without -/+), and the tokens on the character (TokenFace.jsx,
// with the count). It stands upright, as in TTS, and turns only around the vertical axis to face the
// camera. It gets smaller with distance, as in TTS.
// Mounted inside the model's RigidBody (CharacterModel.jsx, overlay), so it moves
// with the model. Its origin is the base bottom center.
// top: height of the model top above the base bottom, in inches. baseRadius: game size of the base.
// stamina: Stamina of the side that faces up. held: the crisis tokens the character holds.
// secureTokens: the tokens of the Secure card on the mat, [{ id, x, z, ... }] (App.jsx, tokens).
export default function SpectatorBadge({
  character,
  stamina,
  top,
  baseRadius,
  held = [],
  secureTokens = [],
}) {
  const baseRef = useRef()
  const anchorRef = useRef()
  // Ids of the Secure tokens within range 1, joined. The ref has the value of the last setNearIds
  // call, so a frame without a change does not render.
  const [nearIds, setNearIds] = useState('')
  const lastIds = useRef('')

  // Priority -1: before drei's Html (priority 0) reads the badge pose, so the counters and the tokens
  // turn in the same frame. OrbitControls also uses -1 and mounts first, so the camera has already
  // moved.
  useFrame(({ camera }) => {
    const base = baseRef.current
    const anchor = anchorRef.current
    if (!base || !anchor) return
    base.getWorldPosition(center)
    base.getWorldQuaternion(baseTurn).invert()
    // Straight above the base center and upright, also when the model tips over. A badge that tilts
    // with the camera looks like a token on the mat when the camera looks down.
    anchor.position.set(0, top + LIFT, 0).applyQuaternion(baseTurn)
    // The badge's x axis is the camera's right side, so the badge faces the camera. OrbitControls keeps
    // the camera without roll, so its right side is horizontal, also when it looks straight down.
    cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
    badgeTurn.setFromAxisAngle(UP, Math.atan2(-cameraRight.z, cameraRight.x))
    anchor.quaternion.copy(baseTurn).multiply(badgeTurn)
    drawOnTop(anchor)
    const ids = secureTokens
      .filter(
        (t) =>
          Math.hypot(t.x - center.x, t.z - center.z) - baseRadius - TOKEN_RADIUS <=
          RANGE_ONE + CONTACT_EPS,
      )
      .map((t) => t.id)
      .join()
    if (ids === lastIds.current) return
    lastIds.current = ids
    setNearIds(ids)
  }, -1)

  const near = nearIds ? secureTokens.filter((t) => nearIds.split(',').includes(t.id)) : []
  const objectives = [...held, ...near]
  // Tokens on the character, in the order it got them, in rows from the top left, as on the tray
  const onTokens = Object.entries(character.tokens ?? {})
  const tokenRows = Math.ceil(onTokens.length / TOKENS_PER_ROW)
  // Rows from the bottom up, in the badge's own space: tokens, counters, objectives
  const countersY = tokenRows * TOKEN_PITCH + COUNTERS_HEIGHT / 2
  const objectivesY = tokenRows * TOKEN_PITCH + COUNTERS_HEIGHT + GAP + TOKEN_RADIUS

  return (
    <group ref={baseRef}>
      <group ref={anchorRef} scale={BADGE_SCALE}>
        {objectives.map((token, i) => (
          <group
            key={token.id}
            position={[rowX(i, objectives.length, OBJECTIVE_PITCH), objectivesY, 0]}
            rotation={STAND_UP}
          >
            <Suspense fallback={null}>
              <Objective token={token} />
            </Suspense>
          </group>
        ))}
        <group position={[0, countersY, 0]}>
          <Html center transform pointerEvents="none">
            <TrayCounters character={character} stamina={stamina} />
          </Html>
        </group>
        {onTokens.map(([key, count], i) => {
          const row = Math.floor(i / TOKENS_PER_ROW)
          const inRow = Math.min(TOKENS_PER_ROW, onTokens.length - row * TOKENS_PER_ROW)
          const x = rowX(i % TOKENS_PER_ROW, inRow, TOKEN_PITCH)
          const y = (tokenRows - 1 - row) * TOKEN_PITCH + TOKEN_SIZE / 2
          return (
            <group key={key} position={[x, y, 0]} rotation={STAND_UP}>
              <Suspense fallback={null}>
                <TokenFace tokenKey={key} count={count} interactive={false} />
              </Suspense>
            </group>
          )
        })}
      </group>
    </group>
  )
}
