import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Scene from './components/Scene.jsx'
import SelectionOutlines from './components/SelectionOutlines.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { CharacterSpawner } from './components/CharacterSpawner.jsx'
import { KeyboardPan } from './components/KeyboardPan.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'
import { TokenPanel } from './components/TokenPanel.jsx'
import { CardPopup } from './components/CardPopup.jsx'
import { canFlip, canMove, getCard, hasArc, hasMarkers } from './crisis/cards.js'
import { supplyPosition } from './crisis/layout.js'
import FrameStats from './debug/FrameStats.jsx'
import { DebugPanel } from './debug/DebugPanel.jsx'
import { MOVE_KEYS, PAN_KEYS, RANGE_KEYS, isEditing, useWindowKeys } from './keyboard.js'

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
  const [debugOn, setDebugOn] = useState(false)
  // 'full' | 'no-outline' | 'no-composer', see DebugPanel
  const [renderMode, setRenderMode] = useState('full')
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
  // Selected tool: 'range' | 'move' | null. It can be selected at the same time as a character or a token.
  const [selectedTool, setSelectedTool] = useState(null)
  // Character or token under the pointer: { kind, id } | null. Only the tool keys read it, so it is a ref.
  const hoveredRef = useRef(null)
  // Pan keys held down: key code → screen direction. KeyboardPan moves the camera while one is held.
  const heldPan = useRef(new Map())
  // Count of tool key presses over a piece, per tool: { range, move }. See Scene.
  const [toolSpawns, setToolSpawns] = useState({ range: 0, move: 0 })
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

  // over: true when the pointer moved onto the piece, false when it moved off
  function handlePieceHover(piece, over) {
    if (over) hoveredRef.current = piece
    else if (hoveredRef.current?.kind === piece.kind && hoveredRef.current.id === piece.id) hoveredRef.current = null
  }

  // Every key press of the app is handled here, so that the same key can do different things in
  // different states. The states now: the crisis card popup is open, or the table is in use.
  // The keys are in keyboard.js.
  function handleKeyDown(e) {
    if (openCard) {
      // Escape closes only the popup. Other keys do nothing, so nothing changes on the table behind it.
      if (e.key === 'Escape') setOpenCard(null)
      return
    }
    if (e.key === 'Escape') {
      handleEscape()
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey || isEditing(e.target)) return
    if (PAN_KEYS[e.code]) {
      // Arrow keys would also scroll the page
      e.preventDefault()
      heldPan.current.set(e.code, PAN_KEYS[e.code])
      return
    }
    if (e.repeat) return
    if (RANGE_KEYS[e.key]) handleToolKey('range', RANGE_KEYS[e.key])
    else if (MOVE_KEYS[e.key]) handleToolKey('move', MOVE_KEYS[e.key])
  }

  function handleKeyUp(e) {
    heldPan.current.delete(e.code)
  }

  // A key released outside the window sends no keyup
  function handleBlur() {
    heldPan.current.clear()
  }

  useWindowKeys(handleKeyDown, handleKeyUp, handleBlur)

  // Escape clears every selection: the character or token, and the tool. The selected tool is also
  // removed from the table.
  function handleEscape() {
    if (selectedTool === 'range') setActiveRange(null)
    if (selectedTool === 'move') setActiveMove(null)
    setSelectedTool(null)
    setSelection(null)
  }

  // tool: 'range' | 'move'. value: the range number or the movement tool type.
  // Toggles the tool, the same as its toolbar button. With the pointer over a character or a token,
  // it selects that piece and spawns the tool again, snapped to it, even if the tool is already out.
  function handleToolKey(tool, value) {
    const piece = hoveredRef.current
    if (!piece) {
      if (tool === 'range') handleRangeClick(value)
      else handleMoveClick(value)
      return
    }
    setSelection(piece)
    if (tool === 'range') setActiveRange(value)
    else setActiveMove(value)
    setToolSpawns(prev => ({ ...prev, [tool]: prev[tool] + 1 }))
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

  // Debug mode is only in the dev server. import.meta.env.DEV is false in `vite build`, so debug
  // is always false there and the build leaves out the debug code.
  const debug = import.meta.env.DEV && debugOn
  const mode = debug ? renderMode : 'full'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: CAMERA_POSITION, fov: 50 }}
        // The EffectComposer in SelectionOutlines renders the scene with its own antialiasing (multisampling)
        gl={{ antialias: false }}
        // A click with no piece under the pointer (table, terrain, background) clears the selection.
        // R3F does not count a camera drag as a click. A right click is a 'contextmenu' event, and it also
        // starts a camera pan, so it does not clear. Clicks on tool buttons (Html) are not on the canvas.
        onPointerMissed={e => { if (e.type === 'click' && e.target instanceof HTMLCanvasElement) setSelection(null) }}
      >
        <SelectionOutlines composer={mode !== 'no-composer'} outlines={mode === 'full'}>
          <Scene
            mapId={mapId}
            characters={characters}
            activeRange={activeRange}
            activeMove={activeMove}
            showColliders={debug}
            showLabels={showLabels}
            matTurns={matTurns}
            deployLine={deployLine}
            crisis={crisis}
            tokens={tokens}
            selection={selection}
            onSelectionChange={setSelection}
            selectedTool={selectedTool}
            onSelectedToolChange={setSelectedTool}
            onPieceHover={handlePieceHover}
            toolSpawns={toolSpawns}
            onTokenMove={handleTokenMove}
            onTokenTurn={handleTokenTurn}
            onCardOpen={setOpenCard}
          />
        </SelectionOutlines>
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
        <KeyboardPan held={heldPan} />
        {debug && <FrameStats />}
      </Canvas>
      <div className="hud-top">
        <Toolbar
          mapId={mapId}
          onMapChange={setMapId}
          activeRange={activeRange}
          activeMove={activeMove}
          onRangeClick={handleRangeClick}
          onMoveClick={handleMoveClick}
          debug={debug}
          onDebugClick={() => setDebugOn(prev => !prev)}
          showLabels={showLabels}
          onLabelsClick={() => setShowLabels(prev => !prev)}
          onTurnMat={handleTurnMat}
          deployLine={deployLine}
          onDeployLineClick={() => setDeployLine(prev => !prev)}
          crisis={crisis}
          onCrisisChange={handleCrisisChange}
        />
        <CharacterSpawner onSpawn={handleSpawn} />
      </div>
      <TokenPanel
        token={selectedToken}
        onFlip={() => handleTokenFlip(selectedToken.id)}
        onControl={control => handleTokenControl(selectedToken.id, control)}
        onDamage={damage => handleTokenDamage(selectedToken.id, damage)}
      />
      <CardPopup cardKey={openCard} onClose={() => setOpenCard(null)} />
      {debug && <DebugPanel renderMode={renderMode} onRenderModeChange={setRenderMode} />}
      <LoadingOverlay />
    </div>
  )
}
