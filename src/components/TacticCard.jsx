import { useEffect, useMemo, useRef, useState } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { Raycaster, Vector3 } from 'three'
import { castDown } from '../physics.js'
import { assetUrl } from '../assets/index.js'
import { getTactic } from '../tactics/cards.js'
import { tacticCardBack, tacticCardFace } from '../tactics/files.js'
import { TACTIC_CARD_HEIGHT, TACTIC_CARD_WIDTH, TACTIC_CARD_Y, tacticCardYaw } from '../tactics/layout.js'
import { TOKEN_DRAG_LIFT } from '../tokens/solid.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'

// A thin box as large as the card finds the ground under it, the same as LooseToken.jsx
const HALF_H = 0.01
const NO_ROTATION = { x: 0, y: 0, z: 0, w: 1 }
// Cards that overlap lie in the order of the tacticCards list (App.jsx): each card is this much
// higher than the card before it, so two cards do not z-fight
const STACK_STEP = 0.005
// A pointer that moves more than this many pixels is a drag, not a click
const DRAG_THRESHOLD = 4

// One Team Tactic card, flat on the table or on the terrain under it. It has no physics body, the
// same as a token on the table. See docs/feature-team-tactic-cards.md, "Card on the table".
// card: { id, key, team, x, z, up }, see App.jsx, tacticCards. stackIndex: its place in that list.
// onMove(x, z): a drag ended over the table; App puts the card there or into a tray slot.
// onOpen({ src, alt }): a click opens the side that faces up in the card popup (CardPopup.jsx).
// onHover(over): the pointer moved onto (true) or off (false) the card, for the F and Delete keys.
export default function TacticCard({ card, stackIndex, onMove, onOpen, onHover }) {
  // Both sides load when the card mounts, so the first flip does not wait for an image
  const [faceUrl, backUrl] = [assetUrl(tacticCardFace(card.key)), assetUrl(tacticCardBack(card.key))]
  const [faceMap, backMap] = useTexture([faceUrl, backUrl])
  const { camera, gl, controls } = useThree()
  const { world, rapier } = useRapier()
  const shape = useMemo(() => new rapier.Cuboid(TACTIC_CARD_WIDTH / 2, HALF_H, TACTIC_CARD_HEIGHT / 2), [rapier])
  const groupRef = useRef()
  const meshRef = useRef()
  const raycaster = useRef(new Raycaster())
  const [hovered, setHovered] = useState(false)
  // Live position during a drag. Synced from the card prop when not dragging. App gives the card a
  // new object on every move (handleTacticMove), also when a snap puts it back on its old place, so
  // the effect runs after every drop.
  const poseRef = useRef({ x: card.x, z: card.z })
  const draggingRef = useRef(false)

  useEffect(() => {
    if (!draggingRef.current) poseRef.current = { x: card.x, z: card.z }
  }, [card])

  useFrame(() => {
    const { x, z } = poseRef.current
    // ONLY_FIXED + EXCLUDE_SENSORS inside castDown, so models and tools are ignored
    const ground = castDown(world, rapier, shape, NO_ROTATION, x, z, HALF_H) ?? 0
    const y = ground + TACTIC_CARD_Y + (draggingRef.current ? TOKEN_DRAG_LIFT : stackIndex * STACK_STEP)
    groupRef.current?.position.set(x, y, z)
  })

  // Table or terrain point under the pointer, or null when the pointer is not over the table. Only
  // fixed bodies count, the same as TokenDragPreview.jsx.
  function pointerPoint(clientX, clientY) {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = { x: ((clientX - rect.left) / rect.width) * 2 - 1, y: -((clientY - rect.top) / rect.height) * 2 + 1 }
    raycaster.current.setFromCamera(ndc, camera)
    const { origin, direction } = raycaster.current.ray
    const filter = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS
    const hit = world.castRay(new rapier.Ray(origin, direction), 1000, true, filter)
    return hit ? raycaster.current.ray.at(hit.timeOfImpact, new Vector3()) : null
  }

  // The same window listeners as CrisisToken.jsx: a drag moves the card, a click opens it
  function handlePointerDown(e) {
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
    // The last point over the table. A release off the table puts the card back.
    let overTable = true

    const handleMove = ev => {
      if (ev.pointerId !== pointerId) return
      if (!draggingRef.current) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
        draggingRef.current = true
      }
      const p = pointerPoint(ev.clientX, ev.clientY)
      overTable = Boolean(p)
      if (p) poseRef.current = { x: p.x, z: p.z }
    }

    const handleUp = ev => {
      if (ev.pointerId !== pointerId) return
      if (draggingRef.current) {
        draggingRef.current = false
        // The card stays at the drop point until App's new card prop sets its place (a slot, or the
        // same point). Released off the table, it goes back to its last place.
        if (overTable) onMove?.(poseRef.current.x, poseRef.current.z)
        else poseRef.current = { x: card.x, z: card.z }
      } else {
        const up = card.up === 'face' ? faceUrl : backUrl
        onOpen?.({ src: up, alt: getTactic(card.key)?.name ?? 'Team Tactic card' })
      }
      if (controls) controls.enabled = true
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  useOutline(meshRef, outlineMode(false, hovered))

  // onHover(true) while the pointer is over the card, onHover(false) after. The cleanup also runs on
  // unmount, so a removed card does not stay hovered and does not keep its cursor.
  useEffect(() => {
    if (!hovered) return undefined
    gl.domElement.style.cursor = 'grab'
    onHover?.(true)
    return () => {
      gl.domElement.style.cursor = ''
      onHover?.(false)
    }
  }, [hovered])

  return (
    <group ref={groupRef} position={[card.x, TACTIC_CARD_Y, card.z]} rotation={[0, tacticCardYaw(card.team), 0]}>
      {/* Rx(-pi/2) lays the image flat, facing up, with its top to local -z (see tacticCardYaw) */}
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[TACTIC_CARD_WIDTH, TACTIC_CARD_HEIGHT]} />
        <meshStandardMaterial map={card.up === 'face' ? faceMap : backMap} roughness={1} />
      </mesh>
    </group>
  )
}
