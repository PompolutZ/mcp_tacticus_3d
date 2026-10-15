import { useLoader, useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFootprintSlot, FOOTPRINT_COLOR } from './footprintProjection.js'
import { assetUrl } from '../assets/index.js'
import { useSideColor } from '../sideColors.js'
import { TOOL_TINT, RANGE_TIP } from '../tabletools/toolTips.js'
import { HOVER_RATE } from '../pieces/heights.js'
import { useFootprintGround } from '../tabletools/useFootprintGround.js'
import { RANGE_HALF_WIDTH, STRAIGHT } from './toolGeometry.js'

const TEXTURE = assetUrl('tools/toolbox-02.png')

// color: 'blue' or 'red', the player color (not the side). Without it, the texture keeps its own colors.
function textured(obj, map, playerColor) {
  const color = new THREE.Color().setRGB(
    ...(TOOL_TINT[playerColor] ?? [1, 1, 1]),
    THREE.SRGBColorSpace,
  )
  const mat = new THREE.MeshStandardMaterial({ map, color, roughness: 0.5, metalness: 0.1 })
  obj.traverse((child) => {
    if (child.isMesh) child.material = mat
  })
  return obj
}

// Vertex positions of the mesh in obj, for a convex hull collider
export function hullPoints(obj) {
  let points = null
  obj.traverse((child) => {
    if (child.isMesh && !points) points = child.geometry.attributes.position.array
  })
  return points
}

// The mesh of a range tool (2 to 5)
export function useRangeParts(mesh, team) {
  const playerColor = useSideColor(team)
  const raw = useLoader(OBJLoader, assetUrl(`tools/range-${mesh}-mesh.obj`))
  const map = useTexture(TEXTURE)
  return useMemo(() => [{ obj: textured(raw.clone(), map, playerColor) }], [raw, map, playerColor])
}

// The meshes of a movement tool: mesh-a is the right half with the round hinge, mesh-b is the left half
export function useMovementParts(type, team) {
  const playerColor = useSideColor(team)
  const rawA = useLoader(OBJLoader, assetUrl(`tools/${type}-movement-mesh-a.obj`))
  const rawB = useLoader(OBJLoader, assetUrl(`tools/${type}-movement-mesh-b.obj`))
  const map = useTexture(TEXTURE)
  return useMemo(
    () => [
      { obj: textured(rawA.clone(), map, playerColor), side: 'right' },
      { obj: textured(rawB.clone(), map, playerColor), side: 'left' },
    ],
    [rawA, rawB, map, playerColor],
  )
}

// Non-interactive R3 tool that follows a dragged model along the deployment edge.
// Visible only while a model is being dragged with the deploy-line toggle on.
// team: the dragged model's team, so the tool has that player's tint.
export function DeployRangeTool({ getBody, centerZ, yaw, team, hoverHeight = 1 }) {
  const [{ obj }] = useRangeParts(3, team)
  const groupRef = useRef()
  const slotRef = useFootprintSlot()
  const groundY = useFootprintGround(RANGE_TIP[3], RANGE_HALF_WIDTH, STRAIGHT)
  // Height of the tool, or null before the first frame
  const yRef = useRef(null)

  useFrame((_, dt) => {
    const body = getBody()
    if (!body || !groupRef.current) return
    const { x } = body.translation()
    // hoverHeight above the table or terrain under the footprint, the same as a dragged tool.
    // Off the table there is no ground, so keep the current height.
    const ground = groundY(x, centerZ, yaw)
    if (ground !== null) {
      const goal = ground + hoverHeight
      yRef.current =
        yRef.current === null
          ? goal
          : yRef.current + (goal - yRef.current) * Math.min(1, dt * HOVER_RATE)
    }
    groupRef.current.position.set(x, yRef.current ?? hoverHeight, centerZ)
    groupRef.current.rotation.y = yaw
    if (slotRef.current) {
      const shape = { x, z: centerZ, right: yaw, left: yaw + Math.PI }
      slotRef.current.set(
        shape,
        RANGE_TIP[3],
        RANGE_HALF_WIDTH,
        FOOTPRINT_COLOR,
        0.25,
        FOOTPRINT_COLOR,
      )
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={obj} />
    </group>
  )
}
