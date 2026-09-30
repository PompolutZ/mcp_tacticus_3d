import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Scene from './components/Scene.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { CharacterSpawner } from './components/CharacterSpawner.jsx'
import { KeyboardPan } from './components/KeyboardPan.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'

// Slightly offset from the exact top-down pole to avoid gimbal lock on first drag.
const CAMERA_POSITION = [0, 20, 4]

export default function App() {
  const [activeRange, setActiveRange] = useState(null)
  const [activeMove, setActiveMove] = useState(null)
  const [showColliders, setShowColliders] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [matTurns, setMatTurns] = useState(0)
  const [mapId, setMapId] = useState('vibranium-heist')
  const [deployLine, setDeployLine] = useState(false)
  const [characters, setCharacters] = useState([])

  // direction: 1 turns the mat 90° counter-clockwise, -1 clockwise
  function handleTurnMat(direction) {
    setMatTurns(prev => (prev + direction + 4) % 4)
  }

  function handleSpawn(ch) {
    setCharacters(prev => [...prev, {
      id: crypto.randomUUID(),
      key: ch.slug,
      figure: ch.figure,
      base: ch.base,
      rotation: ch.rotation,
      teamColor: ch.teamColor,
      slot: prev.filter(c => c.teamColor === ch.teamColor).length,
    }])
  }

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
        <Scene mapId={mapId} characters={characters} activeRange={activeRange} activeMove={activeMove} showColliders={showColliders} showLabels={showLabels} matTurns={matTurns} deployLine={deployLine} />
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
        <KeyboardPan />
      </Canvas>
      <Toolbar
        mapId={mapId}
        onMapChange={setMapId}
        activeRange={activeRange}
        activeMove={activeMove}
        onRangeClick={handleRangeClick}
        onMoveClick={handleMoveClick}
        showColliders={showColliders}
        onCollidersClick={() => setShowColliders(prev => !prev)}
        showLabels={showLabels}
        onLabelsClick={() => setShowLabels(prev => !prev)}
        onTurnMat={handleTurnMat}
        deployLine={deployLine}
        onDeployLineClick={() => setDeployLine(prev => !prev)}
      />
      <CharacterSpawner onSpawn={handleSpawn} />
      <LoadingOverlay />
    </div>
  )
}
