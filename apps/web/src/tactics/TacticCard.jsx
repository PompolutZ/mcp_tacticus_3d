import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { castDown } from '../physics.js'
import { startPointerDrag } from '../drag/pointerDrag.js'
import { tablePoint } from '../drag/tablePoint.js'
import { assetUrl } from '../assets/index.js'
import { getTactic } from './cards.js'
import { tacticCardBack } from './files.js'
import { TACTIC_CARD_HEIGHT, TACTIC_CARD_WIDTH, TACTIC_CARD_Y, tacticCardYaw } from './layout.js'
import { TOKEN_DRAG_LIFT } from '../tokens/solid.js'
import DragFootprint from '../scene/DragFootprint.jsx'
import FaceMaterial from '../scene/FaceMaterial.jsx'
import { outlineMode, useOutline } from '../scene/SelectionOutlines.jsx'
import useLiveFollow from '../scene/useLiveFollow.js'
import { useColorTexture } from '../scene/useColorTexture.js'
import { useTacticFaceMap } from './useTacticFaceTexture.js'
import { isFaceKey } from './faceData.js'
import { NO_ROTATION } from '../characters/base.js'
import { useHoverCursor, useHoverPeek, useHoverReport } from '../scene/useHoverCursor.js'

// A thin box as large as the card finds the ground under it, the same as LooseToken.jsx
const HALF_H = 0.01
// Cards that overlap lie in the order of the tacticCards list (App.jsx): each card is this much
// higher than the card before it, so two cards do not z-fight
const STACK_STEP = 0.005
// A pointer that moves more than this many pixels is a drag, not a click
// Flip (F): the card turns 180° around its long side (local z) in FLIP_DURATION seconds. It goes up
// while it turns, so its edges stay above the table: at 90° it stands on its long edge, FLIP_EDGE_GAP
// above the table. Both values were chosen by look, not measured in TTS.
const FLIP_DURATION = 0.4
const FLIP_EDGE_GAP = 0.3
const FLIP_LIFT = TACTIC_CARD_WIDTH / 2 + FLIP_EDGE_GAP
// The turn starts and ends slowly (smoothstep)
const ease = (t) => t * t * (3 - 2 * t)
const upAngle = (up) => (up === 'back' ? Math.PI : 0)
const flipAngle = (flip) => flip.from + (flip.to - flip.from) * ease(flip.time / FLIP_DURATION)

// One Team Tactic card, flat on the table or on the terrain under it. It has no physics body, the
// same as a token on the table. See docs/features/team-tactic-cards.md, "Card on the table".
// card: { id, key, team, x, z, up }, see App.jsx, tacticCards. stackIndex: its place in that list.
// onMove(x, z): a drag ended over the table; App puts the card there or into a tray slot.
// onOpen({ src, alt }): a click opens the side that faces up in the card popup (CardPopup.jsx).
// onHover(over): the pointer moved onto (true) or off (false) the card, for the F and Delete keys.
// onCardHover(card, over): the same, with the side that faces up, { src, alt, by }, for Alt (useCardPeek.js).
// ownership: the claims on pieces (net/ownership.js). A drag claims `tactic:<id>`. A cancelled drag (Escape,
// or a lost tie) puts the card back to its place in the document.
// pieceLives: the Map of live pose getters (net/live.js, LiveSync). remote: the other player claims the card.
// getLivePose(key): their latest numbers. While remote, the card follows them, hangs above the table and shows
// its footprint.
export default function TacticCard({
  card,
  stackIndex,
  onMove,
  onOpen,
  onHover,
  onCardHover,
  ownership = null,
  pieceLives = null,
  remote = false,
  getLivePose = null,
}) {
  // A card with Jarvis data draws its face (tacticFaceTexture.js); until it is ready the face is the art at
  // low opacity. A card with no Jarvis data shows its back on both sides. The back loads when the card
  // mounts, so the first flip does not wait for an image.
  const drawn = isFaceKey(card.key)
  const backUrl = assetUrl(tacticCardBack(card.key))
  const [backMap] = useColorTexture([backUrl])
  const drawnMap = useTacticFaceMap(card.key, backMap)
  const faceMap = drawn ? drawnMap : backMap
  const { camera, gl, controls } = useThree()
  const { world, rapier } = useRapier()
  const shape = useMemo(
    () => new rapier.Cuboid(TACTIC_CARD_WIDTH / 2, HALF_H, TACTIC_CARD_HEIGHT / 2),
    [rapier],
  )
  const groupRef = useRef()
  const flipGroupRef = useRef()
  const [hovered, setHovered] = useState(false)
  // Live position during a drag. Synced from the card prop when not dragging. App gives the card a
  // new object on every move (handleTacticMove), also when a snap puts it back on its old place, so
  // the effect runs after every drop.
  const poseRef = useRef({ x: card.x, z: card.z })
  const draggingRef = useRef(false)
  // Mounts the footprint during a drag
  const [dragging, setDragging] = useState(false)
  // False while the pointer is off the table: the footprint hides, a release puts the card back
  const overTableRef = useRef(true)
  // The turn around the long side: { up, from, to, time }. An angle that is an even multiple of π is
  // face up, an odd multiple is back up. up: the side of the last flip. time: seconds since that flip,
  // FLIP_DURATION when it is over. Each flip adds π to `to`, so the card always turns the same way.
  // A flip during a flip starts where the card is.
  const flipRef = useRef({
    up: card.up,
    from: upAngle(card.up),
    to: upAngle(card.up),
    time: FLIP_DURATION,
  })

  // The place in the document, for a cancelled drag
  const placeRef = useRef({ x: card.x, z: card.z })

  useEffect(() => {
    placeRef.current = { x: card.x, z: card.z }
    if (!draggingRef.current) poseRef.current = { ...placeRef.current }
  }, [card])

  const follow = useLiveFollow({
    pieceKey: `tactic:${card.id}`,
    remote,
    getLivePose,
    poseRef,
    placeRef,
  })

  useEffect(() => {
    const flip = flipRef.current
    if (flip.up === card.up) return
    flip.from = flipAngle(flip)
    flip.to += Math.PI
    flip.time = 0
    flip.up = card.up
  }, [card.up])

  useFrame((_, dt) => {
    const { x, z } = poseRef.current
    const flip = flipRef.current
    flip.time = Math.min(flip.time + dt, FLIP_DURATION)
    const angle = flipAngle(flip)
    // ONLY_FIXED + EXCLUDE_SENSORS inside castDown, so models and tools are ignored
    const ground = castDown(world, rapier, shape, NO_ROTATION, x, z, HALF_H) ?? 0
    const y =
      ground +
      TACTIC_CARD_Y +
      (draggingRef.current || follow.current.moved ? TOKEN_DRAG_LIFT : stackIndex * STACK_STEP)
    groupRef.current?.position.set(x, y + FLIP_LIFT * Math.abs(Math.sin(angle)), z)
    if (flipGroupRef.current) flipGroupRef.current.rotation.z = angle
  })

  // Table or terrain point under the pointer, or null when the pointer is not over the table. Only
  // fixed bodies count, the same as TokenDragPreview.jsx.
  function pointerPoint(clientX, clientY) {
    const scene = { camera, canvas: gl.domElement, world, rapier }
    return tablePoint(scene, clientX, clientY, { offTable: 'null' })
  }

  // The image of the side that faces up
  function upImage() {
    return {
      src: backUrl,
      alt: getTactic(card.key)?.name ?? 'Team Tactic card',
      // The popup draws the face component for these cards, see CardPopup.jsx
      tacticKey: card.up === 'face' && drawn ? card.key : undefined,
    }
  }

  // A drag moves the card, a click opens it
  function handlePointerDown(e) {
    // The last point over the table. A release off the table puts the card back.
    overTableRef.current = true

    startPointerDrag(e, {
      key: `tactic:${card.id}`,
      ownership,
      live: pieceLives,
      livePose: () => poseRef.current,
      controls,
      canvas: gl.domElement,
      onStart: () => {
        draggingRef.current = true
        setDragging(true)
      },
      onMove: (ev) => {
        const p = pointerPoint(ev.clientX, ev.clientY)
        overTableRef.current = Boolean(p)
        if (p) poseRef.current = { x: p.x, z: p.z }
      },
      onEnd: () => {
        draggingRef.current = false
        setDragging(false)
        // The card stays at the drop point until App's new card prop sets its place (a slot, or the
        // same point). Released off the table, it goes back to its last place.
        if (overTableRef.current) onMove?.(poseRef.current.x, poseRef.current.z)
        else poseRef.current = { x: card.x, z: card.z }
      },
      onCancel: () => {
        draggingRef.current = false
        setDragging(false)
        poseRef.current = { ...placeRef.current }
      },
      onClick: () => {
        onOpen?.(upImage())
      },
    })
  }

  useOutline(flipGroupRef, outlineMode(false, hovered))

  useHoverCursor(hovered, 'grab')

  // onHover(true) while the pointer is over the card, onHover(false) after. The cleanup also runs on
  // unmount, so a removed card does not stay hovered.
  useHoverReport(hovered, onHover)

  // The same for Alt. A flip while hovered shows the new side.
  useHoverPeek(hovered, () => ({ ...upImage(), by: `tactic:${card.id}` }), onCardHover, card.up)

  // The long side of the card is local z. The footprint angle (cos a, 0, -sin a) of local z is yaw - π/2.
  const footprintShape = () =>
    overTableRef.current && (draggingRef.current || follow.current.moved)
      ? {
          ...poseRef.current,
          angle: tacticCardYaw(card.team) - Math.PI / 2,
          halfLength: TACTIC_CARD_HEIGHT / 2,
          halfWidth: TACTIC_CARD_WIDTH / 2,
        }
      : null

  return (
    <group
      ref={groupRef}
      position={[card.x, TACTIC_CARD_Y, card.z]}
      rotation={[0, tacticCardYaw(card.team), 0]}
    >
      {/* The flip turns this group around local z (flipRef). Each side is a plane that is seen only
          from its front, so only the side that faces up is drawn and gets the pointer. */}
      <group
        ref={flipGroupRef}
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* Rx(-pi/2) lays the face flat, facing up, with its top to local -z (see tacticCardYaw) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[TACTIC_CARD_WIDTH, TACTIC_CARD_HEIGHT]} />
          <FaceMaterial map={faceMap} />
        </mesh>
        {/* Rz(pi) turns the back image in its plane, then Rx(pi/2) lays it flat, facing down, with its
            top to local -z. After a turn of pi around z, it lies the same way as the face. */}
        <mesh rotation={[Math.PI / 2, 0, Math.PI]}>
          <planeGeometry args={[TACTIC_CARD_WIDTH, TACTIC_CARD_HEIGHT]} />
          <FaceMaterial map={backMap} />
        </mesh>
      </group>
      {(dragging || remote) && <DragFootprint getShape={footprintShape} />}
    </group>
  )
}
