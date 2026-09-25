import { useGLTF } from '@react-three/drei'
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
    <primitive
      object={scene}
      position={position}
      scale={scale}
      rotation={rotation}
    />
  )
}
