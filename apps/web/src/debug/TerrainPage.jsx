import { Suspense, startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics, useRapier } from '@react-three/rapier'
import { KeyboardCamera } from '../components/KeyboardCamera.jsx'
import { WheelCamera } from '../components/WheelCamera.jsx'
import { Backdrop, Mat, SceneLights, TableSurface } from '../components/SceneShared.jsx'
import SelectionOutlines from '../components/SelectionOutlines.jsx'
import Terrain from '../components/Terrain.jsx'
import { canvasEvents } from '../components/canvasEvents.js'
import { CAMERA_MOUSE_BUTTONS, startView } from '../camera.js'
import { defaultBindings } from '../input/bindings.js'
import { WORLD_GRAVITY } from '../physics.js'
import { startPointerDrag } from '../drag/pointerDrag.js'
import { tablePoint } from '../drag/tablePoint.js'
import { movedPosition, turnedRotation } from '../terrain/placementMove.js'
import { MATS, PIECES_BY_SIZE } from '../terrain/catalog.js'
import { TTS_MAT_TOP } from '../terrain/maps/index.js'

// Dev-only page (#terrain, see Root.jsx): the mats and the terrain pieces of all maps. A click on a mat shows it,
// a click on a piece adds it at the mat center. See docs/features/maps.md, "Terrain page". It is not in the
// production build.

const VIEW = startView(false)
const TIME_STEP = 1 / 120
const CAMERA = { position: VIEW.position, fov: 50 }
// The page has no popups or drags, and the default key bindings: a wheel step zooms
const BINDINGS = defaultBindings()
const wheelState = () => ({
  popup: false,
  dragging: false,
  overDiceTray: false,
  overPiece: false,
  bindings: BINDINGS,
})

const GROUPS = [
  { key: '1', title: 'Size 1' },
  { key: '2', title: 'Size 2' },
  { key: '3', title: 'Size 3' },
  { key: '4', title: 'Size 4' },
  { key: '5', title: 'Size 5' },
  { key: 'none', title: 'No size' },
]
const SORTED_MATS = [...MATS].sort((a, b) => a.name.localeCompare(b.name))

// The held camera keys of KeyboardCamera: W A S D pan, the arrows turn (input/bindings.js)
const PAN_KEYS = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] }
const TURN_KEYS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }

// The ground of a drag is the plane of the mat top, not the colliders: the piece itself and the pieces
// under it would give a point on their tops. A world with no hit makes tablePoint use the table plane
// (y 0 in Three coords, which is the mat top).
const NO_HIT_WORLD = { castRay: () => null }

// The terrain of the page, with the drag of a placed piece. Inside Physics (needs Rapier for tablePoint).
// A drag moves only the placement group (the body is fixed and does not follow). The drop writes the
// new TTS position and bumps rev, so the piece remounts with its body.
function EditableTerrain({ placements, setPlacements, selectedId, setSelectedId }) {
  const { camera, gl } = useThree()
  const controls = useThree((state) => state.controls)
  const { rapier } = useRapier()
  const groups = useRef(new Map())

  const groundPoint = (clientX, clientY) =>
    tablePoint({ camera, canvas: gl.domElement, world: NO_HIT_WORLD, rapier }, clientX, clientY)

  function handlePointerDown(id, e) {
    const group = groups.current.get(id)
    const start = groundPoint(e.clientX, e.clientY)
    if (!group || !start) return
    // The piece keeps its place under the pointer: the move is the pointer move from the press
    const origin = group.position.clone()
    let move = { dx: 0, dz: 0 }
    startPointerDrag(e, {
      controls,
      canvas: gl.domElement,
      onStart: () => setSelectedId(id),
      onMove: (ev) => {
        const point = groundPoint(ev.clientX, ev.clientY)
        if (!point) return false
        move = { dx: point.x - start.x, dz: point.z - start.z }
        group.position.set(origin.x + move.dx, origin.y, origin.z + move.dz)
        return false
      },
      onEnd: () => {
        startTransition(() =>
          setPlacements((list) =>
            list.map((p) =>
              p.id === id
                ? {
                    ...p,
                    position: movedPosition(p.position, move.dx, move.dz),
                    rev: (p.rev ?? 0) + 1,
                  }
                : p,
            ),
          ),
        )
      },
      // A cancel puts the group back
      onCancel: () => group.position.copy(origin),
    })
  }

  return (
    <Terrain
      placements={placements}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onPointerDown={handlePointerDown}
      groupRef={(id, group) => (group ? groups.current.set(id, group) : groups.current.delete(id))}
    />
  )
}

export default function TerrainPage() {
  const [matName, setMatName] = useState(SORTED_MATS[0].name)
  const [filter, setFilter] = useState('')
  // [{ id, piece, size, position, rotation, scale, tint, locked }], relative to the mat center (TTS coords)
  const [placements, setPlacements] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const heldPan = useRef(new Map())
  const heldTurn = useRef(new Map())
  const mat = SORTED_MATS.find((m) => m.name === matName)

  // The camera keys. Not while a field has the focus.
  useEffect(() => {
    function key(e, down) {
      if (e.target instanceof HTMLInputElement) return
      for (const [keys, held] of [
        [PAN_KEYS, heldPan.current],
        [TURN_KEYS, heldTurn.current],
      ]) {
        if (!keys[e.code]) continue
        if (down) held.set(e.code, keys[e.code])
        else held.delete(e.code)
        e.preventDefault()
      }
    }
    const onDown = (e) => key(e, true)
    const onUp = (e) => key(e, false)
    const clear = () => {
      heldPan.current.clear()
      heldTurn.current.clear()
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // Q / E turn the selected piece by 15° (Q counter-clockwise seen from above), Delete or Backspace removes it.
  // Not while a field has the focus, and not with a modifier (Ctrl+Q, Cmd+Backspace are the browser's).
  useEffect(() => {
    function onKey(e) {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      if (!selectedId) return
      const dir = e.code === 'KeyQ' ? 1 : e.code === 'KeyE' ? -1 : 0
      if (dir) {
        e.preventDefault()
        startTransition(() =>
          setPlacements((list) =>
            list.map((p) =>
              p.id === selectedId
                ? { ...p, rotation: turnedRotation(p.rotation, dir), rev: (p.rev ?? 0) + 1 }
                : p,
            ),
          ),
        )
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault()
        setPlacements((list) => list.filter((p) => p.id !== selectedId))
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  function clearPieces() {
    setPlacements([])
    setSelectedId(null)
  }

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return GROUPS.map((g) => ({
      ...g,
      pieces: PIECES_BY_SIZE[g.key].filter((p) => p.name.toLowerCase().includes(needle)),
    })).filter((g) => g.pieces.length > 0)
  }, [filter])

  // startTransition: a new piece loads its files, and the pieces that are placed stay on screen meanwhile
  function addPiece(p) {
    const id = crypto.randomUUID()
    startTransition(() => {
      setPlacements((list) => [
        ...list,
        {
          id,
          piece: p.key,
          size: p.size,
          position: [0, TTS_MAT_TOP, 0],
          rotation: [0, 0, 0],
          scale: p.scale,
          tint: p.tint,
          locked: false,
        },
      ])
      setSelectedId(id)
    })
  }

  // The mat turns the image only. The placements stay where they are.
  function pickMat(name) {
    startTransition(() => setMatName(name))
  }

  return (
    <div className="terrain-page">
      <aside className="terrain-panel">
        <h2 className="terrain-heading">Mats</h2>
        <ul className="terrain-list terrain-mats">
          {SORTED_MATS.map((m) => (
            <li key={m.name}>
              <button
                type="button"
                className={m.name === matName ? 'terrain-row terrain-row--active' : 'terrain-row'}
                onClick={() => pickMat(m.name)}
              >
                {m.name}
              </button>
            </li>
          ))}
        </ul>
        <h2 className="terrain-heading">Pieces</h2>
        <button
          type="button"
          className="terrain-row"
          disabled={placements.length === 0}
          onClick={clearPieces}
        >
          Clear ({placements.length})
        </button>
        <input
          type="search"
          className="chip chip--text terrain-filter"
          placeholder="Filter by name"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="terrain-pieces">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="terrain-group">
                {g.title} <span className="terrain-count">{g.pieces.length}</span>
              </h3>
              <ul className="terrain-list">
                {g.pieces.map((p) => (
                  <li key={p.key}>
                    <button type="button" className="terrain-row" onClick={() => addPiece(p)}>
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && <p className="terrain-empty">No piece</p>}
        </div>
      </aside>
      <div className="terrain-canvas">
        <div className="scene-root">
          <Canvas
            shadows
            camera={CAMERA}
            gl={{ antialias: false }}
            events={canvasEvents}
            onPointerMissed={(e) => {
              if (e.type === 'click' && e.target instanceof HTMLCanvasElement) setSelectedId(null)
            }}
          >
            <Suspense fallback={null}>
              <Backdrop />
              <SceneLights />
              <SelectionOutlines>
                <Physics gravity={[0, WORLD_GRAVITY, 0]} timeStep={TIME_STEP}>
                  <TableSurface />
                  <Mat mat={mat.name} rotation={mat.rotation} />
                  <EditableTerrain
                    placements={placements}
                    setPlacements={setPlacements}
                    selectedId={selectedId}
                    setSelectedId={setSelectedId}
                  />
                </Physics>
              </SelectionOutlines>
            </Suspense>
            <OrbitControls
              makeDefault
              target={VIEW.target}
              minDistance={5}
              maxDistance={50}
              maxPolarAngle={85 * (Math.PI / 180)}
              mouseButtons={CAMERA_MOUSE_BUTTONS}
            />
            <KeyboardCamera pan={heldPan} turn={heldTurn} />
            <WheelCamera wheelState={wheelState} />
          </Canvas>
        </div>
      </div>
    </div>
  )
}
