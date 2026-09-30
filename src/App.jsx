import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Scene from './components/Scene.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { CharacterSpawner } from './components/CharacterSpawner.jsx'
import { KeyboardPan } from './components/KeyboardPan.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'
import { TokenPanel } from './components/TokenPanel.jsx'
import { CardPopup } from './components/CardPopup.jsx'
import { canFlip, canMove, getCard, hasArc, hasMarkers } from './crisis/cards.js'
import { supplyPosition } from './crisis/layout.js'

// Slightly offset from the exact top-down pole to avoid gimbal lock on first drag.
const CAMERA_POSITION = [0, 20, 4]
const DEG = Math.PI / 180

// Mat token entries of a card, as tracked in App state. Position and rotation come from cards.json
// (TTS x, z from the mat center, and TTS Y rotation), converted the same way as terrain: z -> -z.
// yaw: checked against the X-Men Infiltrate Secret Weapons Facility Zone map, see the report.
function buildMatTokens(card) {
  const marked = hasMarkers(card)
  return card.tokens.map(t => ({
    id: crypto.randomUUID(),
    cardKey: card.key,
    frontKey: t.token,
    backKey: t.back ?? null,
    up: 'front',
    x: t.position[0],
    z: -t.position[1],
    yaw: Math.PI - (t.rotation ?? 180) * DEG,
    canMove: canMove(t),
    canFlip: canFlip(t),
    hasArc: hasArc(t),
    hasMarkers: marked,
    control: null,
    damage: false,
  }))
}

// Supply tokens of a card: one per Source token (a token with flipOnly), in a column next to the card.
function buildSupplyTokens(card) {
  if (!card.supply) return []
  const count = card.tokens.filter(t => t.flipOnly).length
  return Array.from({ length: count }, (_, i) => {
    const pos = supplyPosition(card.type, i, count)
    return {
      id: crypto.randomUUID(),
      cardKey: card.key,
      frontKey: card.supply,
      backKey: null,
      up: 'front',
      x: pos.x,
      z: pos.z,
      yaw: 0,
      canMove: true,
      canFlip: false,
      hasArc: false,
      hasMarkers: false,
      control: null,
      damage: false,
    }
  })
}

function buildCardTokens(card) {
  return [...buildMatTokens(card), ...buildSupplyTokens(card)]
}

export default function App() {
  const [activeRange, setActiveRange] = useState(null)
  const [activeMove, setActiveMove] = useState(null)
  const [showColliders, setShowColliders] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [matTurns, setMatTurns] = useState(0)
  const [mapId, setMapId] = useState('vibranium-heist')
  const [deployLine, setDeployLine] = useState(false)
  const [characters, setCharacters] = useState([])
  // The chosen Secure and Extract card, by key. null = none.
  const [crisis, setCrisis] = useState({ secure: null, extract: null })
  // Every crisis token on the table: mat tokens and supply tokens together, see buildCardTokens.
  const [tokens, setTokens] = useState([])
  // A character or a token can be selected, not both: { kind: 'character' | 'token', id } | null
  const [selection, setSelection] = useState(null)
  // Crisis card whose face is open in the popup, by key. null = closed.
  const [openCard, setOpenCard] = useState(null)

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

  // type: 'secure' | 'extract'. key: a card key, or null for "None".
  function handleCrisisChange(type, key) {
    const oldKey = crisis[type]
    setCrisis(prev => ({ ...prev, [type]: key }))
    setTokens(prev => {
      const kept = prev.filter(t => t.cardKey !== oldKey)
      const card = getCard(key)
      return card ? [...kept, ...buildCardTokens(card)] : kept
    })
    // The selected token may no longer exist; a selected character is not affected.
    setSelection(prev => prev?.kind === 'token' ? null : prev)
  }

  function handleTokenMove(id, x, z) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, x, z } : t))
  }

  function handleTokenTurn(id, yaw) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, yaw } : t))
  }

  function handleTokenFlip(id) {
    setTokens(prev => prev.map(t => t.id === id && t.canFlip ? { ...t, up: t.up === 'front' ? 'back' : 'front' } : t))
  }

  function handleTokenControl(id, control) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, control } : t))
  }

  function handleTokenDamage(id, damage) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, damage } : t))
  }

  const selectedToken = selection?.kind === 'token' ? tokens.find(t => t.id === selection.id) ?? null : null

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: CAMERA_POSITION, fov: 50 }}
        gl={{ antialias: true }}
      >
        <Scene
          mapId={mapId}
          characters={characters}
          activeRange={activeRange}
          activeMove={activeMove}
          showColliders={showColliders}
          showLabels={showLabels}
          matTurns={matTurns}
          deployLine={deployLine}
          crisis={crisis}
          tokens={tokens}
          selection={selection}
          onSelectionChange={setSelection}
          onTokenMove={handleTokenMove}
          onTokenTurn={handleTokenTurn}
          onCardOpen={setOpenCard}
        />
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
        crisis={crisis}
        onCrisisChange={handleCrisisChange}
      />
      <CharacterSpawner onSpawn={handleSpawn} />
      <TokenPanel
        token={selectedToken}
        onFlip={() => handleTokenFlip(selectedToken.id)}
        onControl={control => handleTokenControl(selectedToken.id, control)}
        onDamage={damage => handleTokenDamage(selectedToken.id, damage)}
      />
      <CardPopup cardKey={openCard} onClose={() => setOpenCard(null)} />
      <LoadingOverlay />
    </div>
  )
}
