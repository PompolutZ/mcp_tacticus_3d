import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Scene from './components/Scene.jsx'

// Slightly offset from the exact top-down pole to avoid gimbal lock on first drag.
const CAMERA_POSITION = [0, 20, 4]

export default function App() {
  return (
    <Canvas
      camera={{ position: CAMERA_POSITION, fov: 50 }}
      gl={{ antialias: true }}
    >
      <Scene />
      <OrbitControls
        target={[0, 0, 0]}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  )
}
