import { useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { useEffect } from 'react'
import { Color } from 'three'

const TEAM_COLORS = { red: '#c0392b', blue: '#2980b9' }

export default function CharacterModel({ url, position = [0, 0, 0], scale = 1, rotation = [0, 0, 0], teamColor = 'red' }) {
  const { scene } = useGLTF(url)

  useEffect(() => {
    const color = new Color(TEAM_COLORS[teamColor] ?? teamColor)
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material?.name === 'defaultMat') {
        obj.material = obj.material.clone()
        obj.material.color = color
      }
    })
  }, [scene, teamColor])

  return (
    // hull collider matches the actual GLB geometry (base + figure).
    // lockRotations prevents the top-heavy figure from tipping sideways.
    <RigidBody type="dynamic" position={position} colliders="hull" lockRotations linearDamping={0.2} ccd>
      <primitive object={scene} scale={scale} rotation={rotation} />
    </RigidBody>
  )
}
