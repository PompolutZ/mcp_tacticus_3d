import { useLoader } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import * as THREE from 'three'

const TEXTURE = '/tools/toolbox-02.png'

function textured(obj, map) {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.1 })
  obj.traverse(child => { if (child.isMesh) child.material = mat })
  return obj
}

export function MovementRuler({ type = 'short', position = [0, 0, 0] }) {
  const rawA = useLoader(OBJLoader, `/tools/${type}-movement-mesh-a.obj`)
  const rawB = useLoader(OBJLoader, `/tools/${type}-movement-mesh-b.obj`)
  const map = useTexture(TEXTURE)
  const [objA, objB] = useMemo(
    () => [textured(rawA.clone(), map), textured(rawB.clone(), map)],
    [rawA, rawB, map],
  )

  return (
    <RigidBody type="dynamic" position={position} colliders="hull" linearDamping={0.4} ccd>
      <primitive object={objA} />
      <primitive object={objB} />
    </RigidBody>
  )
}

export function RangeRuler({ number = 2, position = [0, 0, 0] }) {
  const raw = useLoader(OBJLoader, `/tools/range-${number}-mesh.obj`)
  const map = useTexture(TEXTURE)
  const obj = useMemo(() => textured(raw.clone(), map), [raw, map])

  return (
    <RigidBody type="dynamic" position={position} colliders="hull" linearDamping={0.4} ccd>
      <primitive object={obj} />
    </RigidBody>
  )
}
