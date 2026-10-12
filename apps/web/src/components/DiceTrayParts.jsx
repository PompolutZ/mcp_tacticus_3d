import { useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { RigidBody, TrimeshCollider, useRapier } from '@react-three/rapier'
import { Color, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { assetUrl } from '../assets/index.js'
import { useSideColor } from '../sideColors.js'
import { TOOL_TINT } from '../tabletools/toolTips.js'
import { IMPORT_ROTATION, TRAYS, TRAY_SCALE, trayColliderArrays } from '../dice/tray.js'
import { FRICTION } from '../physics.js'
import DiceKeys from './DiceKeys.jsx'

// Parts that the own tray (DiceTray.jsx) and the other player's tray (OtherDiceTray.jsx) share.

// The look of a die: the loaded d8 geometry and its material.
export function useDieLook() {
  const dieGltf = useGLTF(assetUrl('dice/d8.glb'))
  const dieTexture = useTexture(assetUrl('dice/d8.webp'))
  const material = useMemo(() => {
    dieTexture.colorSpace = SRGBColorSpace
    dieTexture.flipY = false
    return new MeshStandardMaterial({ map: dieTexture, roughness: 0.5, metalness: 0 })
  }, [dieTexture])
  const geometry = useMemo(
    () => dieGltf.scene.getObjectByProperty('type', 'Mesh').geometry,
    [dieGltf.scene],
  )
  return { geometry, material }
}

// The tray body: a fixed RigidBody with the tray collider, the tinted visual and the keys.
// keysProps: the props of DiceKeys. onHover(over): the pointer moved onto (true) or off (false) the tray.
export function TrayBody({ trayKey, keysProps, onHover }) {
  const tray = TRAYS[trayKey]
  // The tray has the color of its side (sideColors.js), not the color of its key
  const playerColor = useSideColor(trayKey) ?? trayKey
  const { rapier } = useRapier()
  const trayGltf = useGLTF(assetUrl('dice/tray.glb'))
  const trayTexture = useTexture(assetUrl('dice/tray.webp'))

  // Tray collider, in tray space, from the loaded mesh — the same function scripts/dice-sim.mjs
  // uses in Node, so the app and the headless sim build the exact identical trimesh.
  const { vertices: trayVertices, indices: trayIndices } = useMemo(() => {
    const mesh = trayGltf.scene.getObjectByProperty('type', 'Mesh')
    return trayColliderArrays(mesh.geometry.attributes.position.array, mesh.geometry.index.array)
  }, [trayGltf.scene])

  const trayMaterial = useMemo(() => {
    trayTexture.colorSpace = SRGBColorSpace
    trayTexture.flipY = false
    const color = new Color().setRGB(...TOOL_TINT[playerColor], SRGBColorSpace)
    return new MeshStandardMaterial({ map: trayTexture, color, roughness: 0.8, metalness: 0 })
  }, [trayTexture, playerColor])

  // Visible tray mesh: a clone of the loaded scene with the tinted material, IMPORT_ROTATION and
  // TRAY_SCALE (same mirror-and-scale fix as Terrain.jsx; the collider above already bakes both
  // into its vertices, so it needs no extra transform of its own).
  const trayVisual = useMemo(() => {
    const clone = trayGltf.scene.clone()
    clone.traverse((child) => {
      if (!child.isMesh) return
      child.material = trayMaterial
      child.castShadow = true
      child.receiveShadow = true
    })
    return clone
  }, [trayGltf.scene, trayMaterial])

  return (
    <RigidBody
      type="fixed"
      position={[tray.position.x, tray.position.y, tray.position.z]}
      rotation={[0, tray.yaw, 0]}
      colliders={false}
    >
      <TrimeshCollider
        args={[trayVertices, trayIndices, rapier.TriMeshFlags.FIX_INTERNAL_EDGES]}
        friction={FRICTION}
      />
      {/* A tray with these handlers counts as a hit for R3F, so a click on it does not clear the
          selection (onPointerMissed in App.jsx). A die of the own tray has its own handlers, and
          DiceTray counts the over and out events of the tray and its dice. */}
      <group
        scale={TRAY_SCALE}
        onPointerOver={onHover && (() => onHover(true))}
        onPointerOut={onHover && (() => onHover(false))}
      >
        <primitive object={trayVisual} rotation={IMPORT_ROTATION} />
      </group>
      <DiceKeys {...keysProps} />
    </RigidBody>
  )
}
