import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Scene from './components/Scene.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'

// Slightly offset from the exact top-down pole to avoid gimbal lock on first drag.
const CAMERA_POSITION = [0, 20, 4]

export default function App() {
  const [activeRange, setActiveRange] = useState(null)
  const [activeMove, setActiveMove] = useState(null)

  function handleRangeClick(range) {
    setActiveRange(prev => prev === range ? null : range)
  }

  function handleMoveClick(move) {
    setActiveMove(prev => prev === move ? null : move)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: CAMERA_POSITION, fov: 50 }}
        gl={{ antialias: true }}
      >
        <Scene activeRange={activeRange} activeMove={activeMove} />
        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={50}
          maxPolarAngle={85 * (Math.PI / 180)}
        />
      </Canvas>
      <Toolbar
        activeRange={activeRange}
        activeMove={activeMove}
        onRangeClick={handleRangeClick}
        onMoveClick={handleMoveClick}
      />
      <LoadingOverlay />
    </div>
  )
}
