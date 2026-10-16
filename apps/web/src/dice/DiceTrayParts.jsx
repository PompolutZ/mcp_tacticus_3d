import { useEffect, useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { RigidBody, TrimeshCollider, useRapier } from '@react-three/rapier'
import { Color, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { assetUrl } from '../assets/index.js'
import { useSideColor } from '../table/useSideColors.jsx'
import { TOOL_TINT } from '../tabletools/toolTips.js'
import { IMPORT_ROTATION, TRAYS, TRAY_SCALE, trayColliderArrays } from './tray.js'
import { FRICTION } from '../physics.js'
import DiceKeys from './DiceKeys.jsx'
import { useDisposeMaterials } from '../scene/useDisposeMaterials.js'
import { patchShader } from '../scene/shaderPatch.js'

// Tray look, chosen by look in the app. The TTS texture is black except the face plates, so the
// tray showed no shape. The black lift turns the texture black into grey before the side tint:
// albedo = tint * mix(lift, 1, texel).
const TRAY_BLACK_LIFT = 0.03
const TRAY_ROUGHNESS = 0.8
const TRAY_METALNESS = 0.5
const noop = () => {}
const trayLift = { value: TRAY_BLACK_LIFT }

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
  useEffect(() => () => material.dispose(), [material])
  const geometry = useMemo(
    () => dieGltf.scene.getObjectByProperty('type', 'Mesh').geometry,
    [dieGltf.scene],
  )
  return { geometry, material }
}

// The tray body: a fixed RigidBody with the tray collider, the tinted visual and the keys.
// bodyRef: gets the RigidBody; the tray does not hide its own keys or die menu (OccludedHtml skip).
// keysProps: the props of DiceKeys. solid: the tray takes pointer hits (the own tray), see below.
export function TrayBody({ trayKey, keysProps, solid = false, bodyRef }) {
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
    const material = new MeshStandardMaterial({
      map: trayTexture,
      color,
      roughness: TRAY_ROUGHNESS,
      metalness: TRAY_METALNESS,
    })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTrayLift = trayLift
      const fs = patchShader(
        shader.fragmentShader,
        '#include <common>',
        '#include <common>\nuniform float uTrayLift;',
      )
      shader.fragmentShader = patchShader(
        fs,
        '#include <map_fragment>',
        `#include <map_fragment>
  diffuseColor.rgb = diffuse * (vec3(uTrayLift) + (1.0 - uTrayLift) * sampledDiffuseColor.rgb);`,
      )
    }
    return material
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
  useDisposeMaterials(trayVisual)

  return (
    <RigidBody
      ref={bodyRef}
      type="fixed"
      position={[tray.position.x, tray.position.y, tray.position.z]}
      rotation={[0, tray.yaw, 0]}
      colliders={false}
    >
      {/* ORIENTED is set explicitly: since engine 0.15.1 FIX_INTERNAL_EDGES no longer implies it. */}
      <TrimeshCollider
        args={[
          trayVertices,
          trayIndices,
          rapier.TriMeshFlags.FIX_INTERNAL_EDGES | rapier.TriMeshFlags.ORIENTED,
        ]}
        friction={FRICTION}
      />
      {/* A tray with a handler counts as a hit for R3F, so a click on it does not clear the
          selection (onPointerMissed in App.jsx). The number keys do not use the hit: the pointer
          over the tray outline does (useDiceTrayPointer.js). */}
      <group scale={TRAY_SCALE} onPointerOver={solid ? noop : undefined}>
        <primitive object={trayVisual} rotation={IMPORT_ROTATION} />
      </group>
      <DiceKeys {...keysProps} skip={() => bodyRef?.current ?? undefined} />
    </RigidBody>
  )
}
