import { useGLTF } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { useEffect, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Color, Plane, Raycaster, Vector3 } from 'three'

const TEAM_COLORS = { red: '#c0392b', blue: '#2980b9' }
const TABLE_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const DRAG_THRESHOLD = 4

export default function CharacterModel({ url, position = [0, 0, 0], scale = 1, rotation = [0, 0, 0], teamColor = 'red', selected = false, onSelect }) {
  const { scene } = useGLTF(url)
  const { camera, gl, controls } = useThree()
  const [hovered, setHovered] = useState(false)
  const rigidRef = useRef()
  const moveRef = useRef(null)
  const upRef = useRef(null)
  const raycaster = useRef(new Raycaster())
  const isDragging = useRef(false)
  const mouseNDC = useRef({ x: 0, y: 0 })
  const restY = useRef(0)

  useFrame(() => {
    if (!isDragging.current || !rigidRef.current) return
    raycaster.current.setFromCamera(mouseNDC.current, camera)
    const target = new Vector3()
    if (raycaster.current.ray.intersectPlane(TABLE_PLANE, target)) {
      rigidRef.current.setNextKinematicTranslation({ x: target.x, y: restY.current, z: target.z })
    }
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

  useEffect(() => {
    const emissiveColor = selected ? '#f5a623' : hovered ? '#ffffff' : '#000000'
    const intensity = selected ? 0.6 : hovered ? 0.4 : 0
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.emissive?.set(emissiveColor)
        obj.material.emissiveIntensity = intensity
      }
    })
  }, [scene, hovered, selected])

  function onPointerDown(e) {
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
        restY.current = rigidRef.current?.translation().y ?? 0.1
        rigidRef.current?.setBodyType(2, true)
        isDragging.current = true
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

  return (
    <RigidBody ref={rigidRef} type="dynamic" position={position} colliders="hull" lockRotations linearDamping={0.2} ccd>
      <primitive
        object={scene}
        scale={scale}
        rotation={rotation}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={onPointerDown}
      />
    </RigidBody>
  )
}
