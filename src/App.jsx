import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { MOUSE } from 'three'
import { OrbitControls } from '@react-three/drei'
import Scene from './components/Scene.jsx'
import SelectionOutlines from './components/SelectionOutlines.jsx'
import { Toolbar } from './components/Toolbar.jsx'
import { CharacterSpawner } from './components/CharacterSpawner.jsx'
import { KeyboardCamera } from './components/KeyboardCamera.jsx'
import { WheelCamera } from './components/WheelCamera.jsx'
import { LoadingOverlay } from './components/LoadingOverlay.jsx'
import { TokenPanel } from './components/TokenPanel.jsx'
import { TokensPanel } from './components/TokensPanel.jsx'
import { CardPopup } from './components/CardPopup.jsx'
import { TrayPopup } from './components/TrayPopup.jsx'
import { canFlip, canMove, getCard, hasArc, hasMarkers } from './crisis/cards.js'
import { supplyPilePosition } from './crisis/layout.js'
import { characterImmune, characterName, characterStamina } from './characters/roster.js'
import { BASE_DIAMETER } from './characters/files.js'
import { trayHeldDefault } from './characters/trays.js'
import { isSoftwareRenderer, rendererName } from './renderer.js'
import { getToken, isCappedToken } from './tokens/tokens.js'
import { START_MARKERS } from './scoreboard/board.js'
import { DEFAULT_AFFILIATION } from './scoreboard/affiliations.js'
import FrameStats from './debug/FrameStats.jsx'
import { DebugPanel } from './debug/DebugPanel.jsx'
import { NO_PIECES, NO_TOOLS, deselectPiece, selectPiece, selectedId } from './selection.js'
import { CLEAR_TOOLS_KEY, DELETE_KEYS, FLIP_KEY, LIFT_KEY, MOVE_KEYS, PAN_KEYS, RANGE_KEYS, RESET_VIEW_KEY, ROTATE_KEYS, TURN_KEYS, isEditing, useWindowKeys } from './keyboard.js'

// Start view, the seat of the blue player. For now every player is Blue. Blue sits at +z (see
// characters/trays.js). The camera stands behind the blue table edge and looks down at 45° at a
// point 6" from the mat center toward blue, 46" away. Then a 16:10 view shows the whole mat, the
// blue trays and the red trays. The bottom edge of the view meets the table at z = 26.7", just
// past the blue trays' edge (26.15", see trays.js). Space returns to this view (see resetCamera).
const CAMERA_TARGET = [0, 0, 6]
const CAMERA_POSITION = [0, 32.5, 38.5]
// Camera mouse buttons as in TTS: right drag turns, middle drag pans. Left drag also turns, because
// the app has no box select (the TTS left drag) and a trackpad has no easy right drag. Shift, Ctrl
// or Cmd + a turn drag pans (OrbitControls). A mouse wheel zooms. On a trackpad, a two-finger swipe
// pans and a pinch zooms (WheelCamera.jsx).
const CAMERA_MOUSE_BUTTONS = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE }
const DEG = Math.PI / 180
// A crisis token is a 1" circle (CrisisToken.jsx, RADIUS). Drop places it just clear of the base.
const TOKEN_RADIUS = 0.5
const DROP_GAP = 0.1
// Several tokens dropped at once (handleDropCharacterTokens) are spread along a row next to the
// base, one TOKEN_RADIUS*2 (diameter) apart plus a gap, so they do not overlap.
const TOKEN_ROW_SPACING = TOKEN_RADIUS * 2 + DROP_GAP * 2
// A character token drag starts only after the pointer moves this many pixels, so a click on a
// Give source or a token on the table does not drop a token.
const DRAG_THRESHOLD = 4

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
    // Only Asset and Civilian can be held (p22); a Source stays on the mat and gives out its
    // supply instead (see supplyToken, docs/characters-hud.md, "Hold and drop").
    canHold: card.type === 'extract' && canMove(t),
    heldBy: null, // character id, or null while the token sits on the mat
    heldAt: null, // tray-local [x, z] on the holder's card while held (see characters/trays.js)
    control: null,
    damage: false,
  }))
}

// A new supply token of a Source card, taken from its pile (see SupplyPile.jsx and
// handleSupplyTake). It lies on the table at (x, z), or a character holds it.
function supplyToken(card, x, z) {
  return {
    id: crypto.randomUUID(),
    cardKey: card.key,
    frontKey: card.supply,
    backKey: null,
    up: 'front',
    x,
    z,
    yaw: 0,
    canMove: true,
    canFlip: false,
    hasArc: false,
    hasMarkers: false,
    canHold: true, // a Source's supply is the same Asset/Civilian token, see buildMatTokens above
    heldBy: null,
    heldAt: null,
    control: null,
    damage: false,
  }
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
  // Every crisis token on the table: the mat tokens of the cards (buildMatTokens) and the supply
  // tokens that players took from a pile (supplyToken).
  const [tokens, setTokens] = useState([])
  // Scoring board markers: { blue, red, round } → { x, z } on the table (see ScoreBoard.jsx)
  const [scoreMarkers, setScoreMarkers] = useState(START_MARKERS)
  // Affiliation token that each player's VP marker shows: { blue, red } → key in scoreboard/affiliations.json
  const [affiliations, setAffiliations] = useState({ blue: DEFAULT_AFFILIATION, red: DEFAULT_AFFILIATION })
  // Selected pieces and tools, see selection.js. One character, one token, the range tool and the
  // movement tool can all be selected at the same time.
  const [selection, setSelection] = useState(NO_PIECES)
  const [selectedTools, setSelectedTools] = useState(NO_TOOLS)
  // Character or token under the pointer: { kind, id } | null. Only the tool keys read it, so it is a ref.
  const hoveredRef = useRef(null)
  // Pan and turn keys held down: key code → screen direction. KeyboardCamera moves the camera while one is held.
  const heldPan = useRef(new Map())
  const heldTurn = useRef(new Map())
  // Q / E held down: key code → direction. Scene turns the piece on while one is held (see turnPiece).
  const heldRotate = useRef(new Map())
  const controlsRef = useRef(null)
  const wheelCameraRef = useRef(null)
  // Count of tool key presses over a piece, per tool: { range, move }. See Scene.
  const [toolSpawns, setToolSpawns] = useState({ range: 0, move: 0 })
  // Crisis card image open in the full-screen popup: { src, alt } | null, see CardPopup.jsx.
  const [openCard, setOpenCard] = useState(null)
  // Id of the character whose whole tray is open in the full-screen popup, or null (see
  // TrayPopup.jsx). At most one of openCard and openTrayId is set: each popup covers the table.
  const [openTrayId, setOpenTrayId] = useState(null)
  // The open "Reroll one / Change one to" menu of a dice tray face plate, at most one across both
  // trays: { trayKey, symbol } | null. Lifted here, not into DiceKeys, so Escape can close it (see
  // handleKeyDown).
  const [diceMenu, setDiceMenu] = useState(null)
  // The Tokens HUD panel (see TokensPanel.jsx), toggled by its toolbar button.
  const [tokensOpen, setTokensOpen] = useState(false)
  // A short HUD message, for example an immunity block. Same pattern as CharacterSpawner's own
  // message (a timeout clears it), but global: a drag can end over any tray.
  const [hudMessage, setHudMessage] = useState(null)
  const hudMessageTimer = useRef(null)
  // Name of the WebGL renderer when it runs on the CPU, see renderer.js. null: the graphics card draws, or
  // the player closed the warning.
  const [softwareRenderer, setSoftwareRenderer] = useState(null)
  // Character tokens that lie on the table: [{ id, key, x, z }]. A player drops them there from a
  // Give source or the Tokens panel, and drags them on to a character or another place. See
  // docs/characters-hud.md, "Give tokens by drag and drop".
  const [looseTokens, setLooseTokens] = useState([])
  // Id of the table token under the pointer, for the Delete key. A ref, the same as hoveredRef.
  const hoveredLooseRef = useRef(null)
  // Id of the crisis token under the pointer that a character holds, for the Delete key
  const hoveredHeldRef = useRef(null)
  // Id of the character whose tray card is under the pointer, for the F key
  const hoveredTrayCardRef = useRef(null)
  // A token drag in progress: { tokenKey, looseId, supplyCard, active, start } | null. looseId: the
  // table token that is dragged, or null for a new token from a source. supplyCard: the card key
  // when the new token comes from the supply pile of a Source card (tokenKey is then a crisis token
  // key), otherwise null. active: the pointer has moved DRAG_THRESHOLD px, so the dragged token
  // shows under the pointer (Scene.jsx, TokenDragPreview). start: the pointer position at that
  // moment. The state changes only at start and when the drag becomes active, not on every
  // pointermove.
  const [tokenDrag, setTokenDrag] = useState(null)
  // The same drag, plus the pointerdown position, for the window listeners below
  const tokenDragRef = useRef(null)
  // The table point under the pointer, written by TokenDragPreview: { x, y, z } | null
  const dragPointRef = useRef(null)
  // Scene calls this with (clientX, clientY) and returns the character id under the point, or
  // null. See Scene.jsx, characterAt.
  const characterAtRef = useRef(null)
  // Scene calls this with a character id and returns its live table position { x, z } (Rapier body
  // or model object, not the spawn position), or null. Used by handleTokenDrop. See Scene.jsx, modelPosition.
  const modelPositionRef = useRef(null)
  // Scene calls this with a direction for Q / E: it turns the dragged character or tool, else the
  // one under the pointer. See Scene.jsx, turnPiece.
  const turnPieceRef = useRef(null)
  // Scene calls this for R: it lifts the character under the pointer or puts it back down. See
  // Scene.jsx, liftPiece.
  const liftPieceRef = useRef(null)

  // direction: 1 turns the mat 90° counter-clockwise, -1 clockwise
  function handleTurnMat(direction) {
    setMatTurns(prev => (prev + direction + 4) % 4)
  }

  // Toggles the "Reroll one / Change one to" menu for one face plate. Opening one closes any other.
  function handleDiceMenuToggle(trayKey, symbol) {
    setDiceMenu(prev => (prev?.trayKey === trayKey && prev.symbol === symbol) ? null : { trayKey, symbol })
  }

  function handleDiceMenuClose() {
    setDiceMenu(null)
  }

  // The new character's tray goes at the end of its player's row, and the row recenters (see
  // trays.js, layoutTrays).
  function handleSpawn(ch) {
    setCharacters(prev => [...prev, {
      id: crypto.randomUUID(),
      key: ch.slug,
      figure: ch.figure,
      base: ch.base,
      rotation: ch.rotation,
      teamColor: ch.teamColor,
      // Card side that faces up, and the simple limits players apply by hand (see
      // docs/characters-hud.md, "Players apply the rules").
      side: 'healthy',
      damage: 0,
      power: 0,
      // Token key (tokens.json) -> count, see handleCharacterTokenGive.
      tokens: {},
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
  // different states. The states now: a card or tray popup is open, or the table is in use.
  // The keys are in keyboard.js.
  function handleKeyDown(e) {
    if (tokenDrag) {
      // Escape cancels the drag. Other keys do nothing while a token is under the pointer.
      if (e.key === 'Escape') cancelTokenDrag()
      return
    }
    if (openCard || openTrayId) {
      // Escape closes only the popup. Other keys do nothing, so nothing changes on the table behind it.
      if (e.key === 'Escape') { setOpenCard(null); setOpenTrayId(null) }
      return
    }
    if (e.key === 'Escape') {
      // A dice tray face menu closes first, before the table's own Escape behavior.
      if (diceMenu) { setDiceMenu(null); return }
      handleEscape()
      return
    }
    if (e.metaKey || e.ctrlKey || e.altKey || isEditing(e.target)) return
    if (DELETE_KEYS.includes(e.key)) {
      if (hoveredLooseRef.current) handleLooseRemove(hoveredLooseRef.current)
      else if (hoveredHeldRef.current) handleHeldRemove(hoveredHeldRef.current)
      return
    }
    if (PAN_KEYS[e.code]) {
      heldPan.current.set(e.code, PAN_KEYS[e.code])
      return
    }
    if (TURN_KEYS[e.code]) {
      heldTurn.current.set(e.code, TURN_KEYS[e.code])
      return
    }
    if (e.code === RESET_VIEW_KEY) {
      // Space also presses the focused button, for example the last clicked toolbar button
      e.preventDefault()
      if (!e.repeat) resetCamera()
      return
    }
    if (ROTATE_KEYS[e.code]) {
      heldRotate.current.set(e.code, ROTATE_KEYS[e.code])
      // Scene turns the piece on while the key is held, at the same speed on every computer. So
      // the key repeat of the system does not turn it.
      if (!e.repeat) turnPieceRef.current?.(ROTATE_KEYS[e.code])
      return
    }
    if (e.repeat) return
    if (e.code === FLIP_KEY) {
      handleFlipKey()
      return
    }
    if (e.code === LIFT_KEY) {
      liftPieceRef.current?.()
      return
    }
    if (RANGE_KEYS[e.key]) handleToolKey('range', RANGE_KEYS[e.key])
    else if (MOVE_KEYS[e.key]) handleToolKey('move', MOVE_KEYS[e.key])
    else if (e.key === CLEAR_TOOLS_KEY) clearTools()
  }

  function handleKeyUp(e) {
    heldPan.current.delete(e.code)
    heldTurn.current.delete(e.code)
    heldRotate.current.delete(e.code)
  }

  // A key released outside the window sends no keyup
  function handleBlur() {
    heldPan.current.clear()
    heldTurn.current.clear()
    heldRotate.current.clear()
  }

  useWindowKeys(handleKeyDown, handleKeyUp, handleBlur)

  // Moves the camera back to the start view at once
  function resetCamera() {
    const controls = controlsRef.current
    if (!controls) return
    // A zoom or pan of the wheel that is not done yet would move the camera away from the start view
    wheelCameraRef.current?.stop()
    controls.object.position.set(...CAMERA_POSITION)
    controls.target.set(...CAMERA_TARGET)
    controls.update()
  }

  // Escape clears every selection: the character, the token and the tools. The selected tools are
  // also removed from the table.
  function handleEscape() {
    if (selectedTools.range) setActiveRange(null)
    if (selectedTools.move) setActiveMove(null)
    setSelectedTools(NO_TOOLS)
    setSelection(NO_PIECES)
  }

  // Key 0: removes every tool from the table. The selected pieces stay selected.
  function clearTools() {
    setActiveRange(null)
    setActiveMove(null)
    setSelectedTools(NO_TOOLS)
  }

  // tool: 'range' | 'move'. value: the range number or the movement tool type.
  // Toggles the tool, the same as its toolbar button. With the pointer over a character or a token,
  // it selects that piece and spawns the tool again, snapped to it, even if the tool is already out.
  // A selected piece of the other kind stays selected.
  function handleToolKey(tool, value) {
    const piece = hoveredRef.current
    if (!piece) {
      if (tool === 'range') handleRangeClick(value)
      else handleMoveClick(value)
      return
    }
    setSelection(prev => selectPiece(prev, piece))
    if (tool === 'range') setActiveRange(value)
    else setActiveMove(value)
    setToolSpawns(prev => ({ ...prev, [tool]: prev[tool] + 1 }))
  }

  // F, as in TTS: flips the crisis token under the pointer (also one that a character holds), or the
  // card of the character under the pointer (its model or its tray card). With nothing under the
  // pointer, it flips the piece selected last: a token, or the card of a character. A token without
  // a back does not flip (handleTokenFlip).
  function handleFlipKey() {
    const piece = hoveredRef.current
      ?? (hoveredHeldRef.current && { kind: 'token', id: hoveredHeldRef.current })
      ?? (hoveredTrayCardRef.current && { kind: 'character', id: hoveredTrayCardRef.current })
      ?? selection.at(-1)
    if (piece?.kind === 'token') handleTokenFlip(piece.id)
    else if (piece?.kind === 'character') handleCharacterFlip(piece.id)
  }

  // type: 'secure' | 'extract'. key: a card key, or null for "None".
  function handleCrisisChange(type, key) {
    const oldKey = crisis[type]
    setCrisis(prev => ({ ...prev, [type]: key }))
    setTokens(prev => {
      const kept = prev.filter(t => t.cardKey !== oldKey)
      const card = getCard(key)
      return card ? [...kept, ...buildMatTokens(card)] : kept
    })
    // The selected token may no longer exist; a selected character is not affected.
    setSelection(prev => prev.filter(p => p.kind !== 'token'))
  }

  // A held token dragged off its tray card and released on the table is no longer held.
  function handleTokenMove(id, x, z) {
    setTokens(prev => prev.map(t => t.id === id ? { ...t, x, z, heldBy: null, heldAt: null } : t))
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

  // A canHold token is released over a character (CrisisToken.jsx reports it, Scene.jsx finds the
  // character with characterAt): that character now holds it. The token leaves the mat (Scene.jsx
  // keeps heldBy tokens out of the tool snap list) and lies on its holder's tray card, on the
  // character art (trays.js, trayHeldDefault). No range check (see docs/feature-crisis.md, "Players
  // apply the rules"). cardPoint: the tray-local [x, z] on the character's card when the release
  // point is on its tray, otherwise null. It is used only to move a token on its own holder's card:
  // a token given to a character always goes to the default place.
  function handleTokenHold(id, characterId, cardPoint) {
    setTokens(prev => {
      const token = prev.find(t => t.id === id)
      if (!token) return prev
      if (token.heldBy === characterId) {
        return cardPoint ? prev.map(t => t.id === id ? { ...t, heldAt: cardPoint } : t) : prev
      }
      const heldCount = prev.filter(t => t.heldBy === characterId).length
      return prev.map(t => t.id === id ? { ...t, heldBy: characterId, heldAt: trayHeldDefault(heldCount) } : t)
    })
  }

  // A new supply token from the pile of a Source card (handleTokenRelease). Released over a
  // character: that character holds it, at the default place on its card, the same as
  // handleTokenHold. Otherwise it lies on the table at (x, z).
  function handleSupplyTake(cardKey, x, z, characterId) {
    const card = getCard(cardKey)
    if (!card?.supply) return
    setTokens(prev => {
      const token = supplyToken(card, x, z)
      if (!characterId) return [...prev, token]
      const heldCount = prev.filter(t => t.heldBy === characterId).length
      return [...prev, { ...token, heldBy: characterId, heldAt: trayHeldDefault(heldCount) }]
    })
  }

  // over: the pointer moved onto (true) or off (false) a crisis token that a character holds
  function handleHeldHover(id, over) {
    if (over) hoveredHeldRef.current = id
    else if (hoveredHeldRef.current === id) hoveredHeldRef.current = null
  }

  // over: the pointer moved onto (true) or off (false) the tray card of a character
  function handleTrayCardHover(id, over) {
    if (over) hoveredTrayCardRef.current = id
    else if (hoveredTrayCardRef.current === id) hoveredTrayCardRef.current = null
  }

  // Delete key over a token on a character's card, as in TTS. Players remove a Source's supply
  // tokens in the Cleanup Phase, and the pile gives new ones. The hover can outlive the hold (a
  // drag off the card ends on the table before the pointer leaves the token), so only a token that
  // is still held is removed.
  function handleHeldRemove(id) {
    if (!tokens.find(t => t.id === id)?.heldBy) return
    setTokens(prev => prev.filter(t => t.id !== id))
    setSelection(prev => deselectPiece(prev, { kind: 'token', id }))
  }

  // Drop, when its holder is removed: the token goes back on the table, next to the base of the
  // model that held it (the live Rapier/object position, not the spawn position, so a moved
  // character drops it where it stands). rowOffset moves it along the base's edge (+z of the +x drop
  // direction), so several tokens dropped together (handleDropCharacterTokens) land in a row
  // instead of stacked on each other. If the holder's position is not available (see Scene.jsx,
  // modelPosition), the token stays where it last sat on the mat. During the game, a player drops a
  // token by dragging it from the card to the table (handleTokenMove).
  function handleTokenDrop(id, rowOffset) {
    setTokens(prev => {
      const token = prev.find(t => t.id === id)
      if (!token?.heldBy) return prev
      const holder = characters.find(ch => ch.id === token.heldBy)
      const pos = modelPositionRef.current?.(token.heldBy)
      const baseRadius = holder ? BASE_DIAMETER[holder.base] / 2 : 0
      const x = (pos?.x ?? token.x) + baseRadius + TOKEN_RADIUS + DROP_GAP
      const z = (pos?.z ?? token.z) + rowOffset
      return prev.map(t => t.id === id ? { ...t, heldBy: null, heldAt: null, x, z } : t)
    })
  }

  // Phase 7 calls this for a character it is about to remove, so the character drops every token it
  // holds first (see docs/characters-hud.md, "Hold and drop"). Several tokens spread along a row
  // next to the base (TOKEN_ROW_SPACING apart) instead of landing on the same spot.
  function handleDropCharacterTokens(characterId) {
    const held = tokens.filter(t => t.heldBy === characterId)
    held.forEach((t, i) => {
      const rowOffset = (i - (held.length - 1) / 2) * TOKEN_ROW_SPACING
      handleTokenDrop(t.id, rowOffset)
    })
  }

  // Damage never goes below 0 or above the Stamina of the side that faces up (p16).
  function handleCharacterDamage(id, damage) {
    setCharacters(prev => prev.map(ch => {
      if (ch.id !== id) return ch
      const stamina = characterStamina(ch.key, ch.side)
      return { ...ch, damage: Math.max(0, Math.min(damage, stamina)) }
    }))
  }

  // Power never goes below 0 or above 10 (p7-8).
  function handleCharacterPower(id, power) {
    setCharacters(prev => prev.map(ch => ch.id === id ? { ...ch, power: Math.max(0, Math.min(power, 10)) } : ch))
  }

  // Flip turns the card to the other side and clears Damage, the same as in TTS.
  function handleCharacterFlip(id) {
    setCharacters(prev => prev.map(ch => ch.id === id
      ? { ...ch, side: ch.side === 'healthy' ? 'injured' : 'healthy', damage: 0 }
      : ch))
  }

  // Remove button on the tray (TrayControls.jsx confirms before calling this). Drops every token
  // the character holds first (p10), then removes the character: its model and its tray both come
  // from the same characters array (Scene.jsx), so one state update removes all three. Also clears
  // a selection or popup that still points at it, so nothing keeps the id or its Rapier body after
  // the model unmounts.
  function handleCharacterRemove(id) {
    handleDropCharacterTokens(id)
    setCharacters(prev => prev.filter(ch => ch.id !== id))
    setSelection(prev => deselectPiece(prev, { kind: 'character', id }))
    setOpenTrayId(prev => prev === id ? null : prev)
  }

  // A short message in the HUD, for a few seconds (the immunity block below; CharacterSpawner has
  // its own copy of this pattern for the "no 3D model" message).
  function showHudMessage(text) {
    clearTimeout(hudMessageTimer.current)
    setHudMessage(text)
    hudMessageTimer.current = setTimeout(() => setHudMessage(null), 3000)
  }

  // Gives one of tokenKey to a character. A character cannot get a condition it is immune to
  // (p21): the drop does nothing, the HUD shows why, and the result is false. Conditions, Activated
  // and Dazed stay at 1 at most (p17); every other token counts up (see docs/characters-hud.md,
  // "Players apply the rules"). The result is true then, also for a token at its limit: the
  // dropped token is used up, as in TTS, where the tray deletes it.
  function handleCharacterTokenGive(id, tokenKey) {
    const target = characters.find(ch => ch.id === id)
    if (target && characterImmune(target.key).includes(tokenKey)) {
      showHudMessage(`${characterName(target.key)} is immune to ${getToken(tokenKey)?.name ?? tokenKey}.`)
      return false
    }
    setCharacters(prev => prev.map(ch => {
      if (ch.id !== id) return ch
      const count = ch.tokens[tokenKey] ?? 0
      if (isCappedToken(tokenKey) && count >= 1) return ch
      return { ...ch, tokens: { ...ch.tokens, [tokenKey]: count + 1 } }
    }))
    return true
  }

  // A click on a token in the tray's "On" row removes one.
  function handleCharacterTokenRemove(id, tokenKey) {
    setCharacters(prev => prev.map(ch => {
      if (ch.id !== id) return ch
      const count = (ch.tokens[tokenKey] ?? 0) - 1
      const tokens = { ...ch.tokens }
      if (count > 0) tokens[tokenKey] = count
      else delete tokens[tokenKey]
      return { ...ch, tokens }
    }))
  }

  // over: the pointer moved onto (true) or off (false) a table token. A token that is removed or
  // dragged unmounts, which also ends its hover (see TokenFace.jsx).
  function handleLooseHover(id, over) {
    if (over) hoveredLooseRef.current = id
    else if (hoveredLooseRef.current === id) hoveredLooseRef.current = null
  }

  // Delete key over a token on the table, as in TTS
  function handleLooseRemove(id) {
    setLooseTokens(prev => prev.filter(t => t.id !== id))
  }

  // pointerdown on a character token: a Tokens panel chip, a tray's Give source (a new token, the
  // source never runs out), or a token on the table (looseId).
  function handleTokenDragStart(e, tokenKey, looseId = null) {
    startTokenDrag(e, { tokenKey, looseId, supplyCard: null })
  }

  // pointerdown on the supply pile of a Source card: a new supply token. The pile never runs out.
  function handleSupplyDragStart(e, cardKey) {
    const supply = getCard(cardKey)?.supply
    if (supply) startTokenDrag(e, { tokenKey: supply, looseId: null, supplyCard: cardKey })
  }

  // e is the DOM event. preventDefault stops the browser's own image drag and text selection. The
  // camera does not move during the drag. A pointerdown on the canvas also starts an OrbitControls
  // drag, which captures the pointer, so the capture is released, the same as CrisisToken.jsx.
  function startTokenDrag(e, drag) {
    e.preventDefault()
    e.stopPropagation()
    if (e.target?.hasPointerCapture?.(e.pointerId)) e.target.releasePointerCapture(e.pointerId)
    if (controlsRef.current) controlsRef.current.enabled = false
    tokenDragRef.current = { ...drag, startX: e.clientX, startY: e.clientY, active: false }
    setTokenDrag({ ...drag, active: false, start: null })
  }

  function cancelTokenDrag() {
    tokenDragRef.current = null
    setTokenDrag(null)
    if (controlsRef.current) controlsRef.current.enabled = true
  }

  // Character under (clientX, clientY): the DOM tray controls first (data-character-id, see
  // TrayControls.jsx), then the 3D scene (Scene.jsx, characterAt). Usable outside a drag too: it is
  // passed down to Scene, which gives it to CrisisToken.jsx for an Extract token's release (Phase
  // 7), so a release over the tray's DOM controls strip counts, not only the model or the tray plate.
  function findCharacterAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY)?.closest('[data-character-id]')
    if (el) return el.dataset.characterId
    return characterAtRef.current?.(clientX, clientY) ?? null
  }

  // Release of an active token drag at (clientX, clientY). Over a HUD panel: nothing changes, so a
  // drag back onto the Tokens panel cancels it. Over a character (its model, or anywhere on its
  // tray): the character gets the token, the same as before. A table token is used up then, unless
  // the character is immune. Over the table or terrain: a new token lies there, or the dragged table
  // token moves there. Elsewhere (the space around the table): nothing changes. A supply token
  // follows the same rules, but it is a crisis token: a character holds it (handleSupplyTake).
  function handleTokenRelease(clientX, clientY) {
    const { tokenKey, looseId, supplyCard } = tokenDragRef.current
    if (!document.elementFromPoint(clientX, clientY)?.closest('.scene-root')) return
    const characterId = findCharacterAt(clientX, clientY)
    if (supplyCard) {
      const point = dragPointRef.current
      const pile = supplyPilePosition(getCard(supplyCard).type)
      if (characterId) handleSupplyTake(supplyCard, pile.x, pile.z, characterId)
      else if (point) handleSupplyTake(supplyCard, point.x, point.z, null)
      return
    }
    if (characterId) {
      if (handleCharacterTokenGive(characterId, tokenKey) && looseId) handleLooseRemove(looseId)
      return
    }
    const point = dragPointRef.current
    if (!point) return
    if (looseId) setLooseTokens(prev => prev.map(t => t.id === looseId ? { ...t, x: point.x, z: point.z } : t))
    else setLooseTokens(prev => [...prev, { id: crypto.randomUUID(), key: tokenKey, x: point.x, z: point.z }])
  }

  // Window listeners for the token drag: it becomes active after DRAG_THRESHOLD px, and its release
  // drops the token (handleTokenRelease). A release before that is a click, which does nothing.
  // Escape cancels (see handleKeyDown).
  useEffect(() => {
    if (!tokenDrag) return undefined
    function handleMove(e) {
      const drag = tokenDragRef.current
      if (!drag || drag.active || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return
      drag.active = true
      setTokenDrag(prev => prev && { ...prev, active: true, start: { clientX: e.clientX, clientY: e.clientY } })
    }
    function handleUp(e) {
      if (tokenDragRef.current?.active) handleTokenRelease(e.clientX, e.clientY)
      cancelTokenDrag()
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [tokenDrag])

  const selectedTokenId = selectedId(selection, 'token')
  const selectedToken = tokens.find(t => t.id === selectedTokenId) ?? null
  const openTray = openTrayId ? characters.find(ch => ch.id === openTrayId) ?? null : null

  // Debug mode is only in the dev server. import.meta.env.DEV is false in `vite build`, so debug
  // is always false there and the build leaves out the debug code.
  const debug = import.meta.env.DEV && debugOn
  const mode = debug ? renderMode : 'full'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Holds the Canvas only: isolation: isolate (index.css) keeps every drei <Html> wrapper it
          mounts (terrain labels, the ruler tool, the tray controls) from ever drawing over the
          HUD below, no matter its z-index. See index.css, .scene-root. */}
      <div className="scene-root">
        <Canvas
          shadows
          camera={{ position: CAMERA_POSITION, fov: 50 }}
          // The EffectComposer in SelectionOutlines renders the scene with its own antialiasing (multisampling)
          gl={{ antialias: false }}
          // A click with no piece under the pointer (table, terrain, background) clears the selected
          // pieces. The selected tools stay selected.
          // R3F does not count a camera drag as a click. A right click is a 'contextmenu' event, and it also
          // starts a camera turn, so it does not clear. Clicks on tool buttons (Html) are not on the canvas.
          onPointerMissed={e => { if (e.type === 'click' && e.target instanceof HTMLCanvasElement) setSelection(NO_PIECES) }}
          onCreated={({ gl }) => {
            const name = rendererName(gl.getContext())
            if (isSoftwareRenderer(name)) setSoftwareRenderer(name)
          }}
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
              selectedTools={selectedTools}
              onSelectedToolsChange={setSelectedTools}
              onPieceHover={handlePieceHover}
              toolSpawns={toolSpawns}
              onTokenMove={handleTokenMove}
              onTokenTurn={handleTokenTurn}
              onTokenHold={handleTokenHold}
              onHeldHover={handleHeldHover}
              onSupplyDragStart={handleSupplyDragStart}
              onCharacterDamage={handleCharacterDamage}
              onCharacterPower={handleCharacterPower}
              onCharacterFlip={handleCharacterFlip}
              onTrayCardHover={handleTrayCardHover}
              onCharacterRemove={handleCharacterRemove}
              onCharacterTokenRemove={handleCharacterTokenRemove}
              onTokenDragStart={handleTokenDragStart}
              looseTokens={looseTokens}
              onLooseHover={handleLooseHover}
              tokenDrag={tokenDrag}
              dragPointRef={dragPointRef}
              onCardOpen={setOpenCard}
              onTrayOpen={setOpenTrayId}
              diceMenu={diceMenu}
              onDiceMenuToggle={handleDiceMenuToggle}
              onDiceMenuClose={handleDiceMenuClose}
              characterAtRef={characterAtRef}
              findCharacterAt={findCharacterAt}
              modelPositionRef={modelPositionRef}
              turnPieceRef={turnPieceRef}
              liftPieceRef={liftPieceRef}
              heldRotate={heldRotate}
              scoreMarkers={scoreMarkers}
              affiliations={affiliations}
              onScoreMarkerMove={(marker, x, z) => setScoreMarkers(prev => ({ ...prev, [marker]: { x, z } }))}
            />
          </SelectionOutlines>
          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={CAMERA_TARGET}
            enablePan={true}
            // WheelCamera takes every wheel event, so this is only the pinch on a touch screen
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={50}
            maxPolarAngle={85 * (Math.PI / 180)}
            mouseButtons={CAMERA_MOUSE_BUTTONS}
          />
          <KeyboardCamera pan={heldPan} turn={heldTurn} />
          <WheelCamera ref={wheelCameraRef} />
          {debug && <FrameStats />}
        </Canvas>
      </div>
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
          affiliations={affiliations}
          onAffiliationChange={(team, key) => setAffiliations(prev => ({ ...prev, [team]: key }))}
          tokensOpen={tokensOpen}
          onTokensClick={() => setTokensOpen(prev => !prev)}
        />
        <div className="hud-top-right">
          <CharacterSpawner onSpawn={handleSpawn} />
        </div>
      </div>
      <TokenPanel
        token={selectedToken}
        onFlip={() => handleTokenFlip(selectedToken.id)}
        onControl={control => handleTokenControl(selectedToken.id, control)}
        onDamage={damage => handleTokenDamage(selectedToken.id, damage)}
      />
      <TokensPanel open={tokensOpen} onDragStart={handleTokenDragStart} />
      <CardPopup card={openCard} onClose={() => setOpenCard(null)} />
      {openTray && (
        <TrayPopup
          character={openTray}
          heldTokens={tokens.filter(tok => tok.heldBy === openTray.id)}
          onClose={() => setOpenTrayId(null)}
          onDamage={damage => handleCharacterDamage(openTray.id, damage)}
          onPower={power => handleCharacterPower(openTray.id, power)}
          onFlip={() => handleCharacterFlip(openTray.id)}
          onRemove={() => handleCharacterRemove(openTray.id)}
          onTokenRemove={key => handleCharacterTokenRemove(openTray.id, key)}
        />
      )}
      {hudMessage && <div className="hud-message">{hudMessage}</div>}
      {softwareRenderer && (
        <div className="hud-warning" role="alert" title={softwareRenderer}>
          <span>
            The browser draws the 3D view without the graphics card (software rendering), so the app is slow.
            Turn on hardware acceleration in the browser settings.
          </span>
          <button type="button" className="chip" onClick={() => setSoftwareRenderer(null)}>Close</button>
        </div>
      )}
      {debug && <DebugPanel renderMode={renderMode} onRenderModeChange={setRenderMode} />}
      <LoadingOverlay />
    </div>
  )
}
