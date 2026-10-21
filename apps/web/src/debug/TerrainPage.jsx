import { Suspense, startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { KeyboardCamera } from '../scene/KeyboardCamera.jsx'
import { CameraHover } from '../scene/CameraHover.jsx'
import { WheelCamera } from '../scene/WheelCamera.jsx'
import { Backdrop, Mat, SceneLights, TableSurface } from '../scene/SceneShared.jsx'
import SelectionOutlines from '../scene/SelectionOutlines.jsx'
import Terrain from '../terrain/Terrain.jsx'
import { TableStoreProvider } from '../table/TableStoreContext.jsx'
import { createTableStore } from '../table/tableStore.js'
import { canvasEvents } from '../scene/canvasEvents.js'
import { CAMERA_MOUSE_BUTTONS, MAX_POLAR_ANGLE, startView } from '../camera.js'
import { defaultBindings } from '../input/bindings.js'
import { WORLD_GRAVITY } from '../physics.js'
import BuilderPanel from '../terrain/BuilderPanel.jsx'
import { useTerrainDrag } from '../terrain/useTerrainDrag.js'
import { useBuilderKeys } from '../terrain/useBuilderKeys.js'
import { loadPieceBox } from '../terrain/pieceBox.js'
import {
  SORTED_MATS,
  addPlacement,
  clearPlacements,
  exportBoardText,
  loadMapState,
  movePlacement,
  newPlacement,
  removePlacement,
  turnPlacement,
} from '../terrain/builder.js'
import { MAPS } from '../terrain/maps/index.js'

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

// The held camera keys of KeyboardCamera: W A S D pan, the arrows turn (input/bindings.js)
const PAN_KEYS = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] }
const TURN_KEYS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }

// The terrain of the page, with the drag of a placed piece. Inside the Canvas (the drag reads the camera).
function EditableTerrain({ placements, onDrop, selectedId, setSelectedId }) {
  const drag = useTerrainDrag({ onDrop, onSelect: setSelectedId })
  return (
    <Terrain
      placements={placements}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onPointerDown={drag.onPointerDown}
      groupRef={drag.groupRef}
    />
  )
}

export default function TerrainPage() {
  // The scene parts read the look and the settings from a store of the table; the page has the defaults
  const [store] = useState(() => createTableStore({}))
  const [matName, setMatName] = useState(SORTED_MATS[0].name)
  // [{ id, piece, size, position, rotation, scale, tint, locked }], relative to the mat center (TTS coords)
  const [placements, setPlacements] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  // The fields of the loaded map that the page does not edit, kept for export
  const [meta, setMeta] = useState({})
  const [mapId, setMapId] = useState('')
  const [mapName, setMapName] = useState('')
  const [matRotation, setMatRotation] = useState(SORTED_MATS[0].rotation)
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

  // startTransition: a turn mounts the piece again, and the pieces that are placed stay on screen meanwhile
  const turnSelected = useCallback(
    (dir) => startTransition(() => setPlacements((list) => turnPlacement(list, selectedId, dir))),
    [selectedId],
  )
  const removeSelected = useCallback(() => {
    setPlacements((list) => removePlacement(list, selectedId))
    setSelectedId(null)
  }, [selectedId])
  useBuilderKeys({ selectedId, onTurn: turnSelected, onRemove: removeSelected })

  const drop = (id, dx, dz) =>
    startTransition(() => setPlacements((list) => movePlacement(list, id, dx, dz)))

  function clearPieces() {
    setPlacements(clearPlacements())
    setSelectedId(null)
  }

  // The box comes first (the files load async), then the piece is placed with its bottom on the mat.
  // startTransition: the new piece loads its files, and the pieces that are placed stay on screen meanwhile
  async function addPiece(p) {
    const id = crypto.randomUUID()
    let box
    try {
      box = await loadPieceBox(p.key)
    } catch (error) {
      console.error('terrain piece box', p.key, error)
      return
    }
    startTransition(() => {
      setPlacements((list) => addPlacement(list, newPlacement(p, id, box)))
      setSelectedId(id)
    })
  }

  // The mat turns the image only. The placements stay where they are.
  function pickMat(name) {
    startTransition(() => {
      setMatName(name)
      setMatRotation(SORTED_MATS.find((m) => m.name === name).rotation)
    })
  }

  // Replaces the mat, its rotation and the placements. id, name, ttsMap, note and skipped are kept for export.
  function loadMap(id) {
    const map = MAPS[id]
    if (!map) return
    const state = loadMapState(map, () => crypto.randomUUID())
    startTransition(() => {
      setMatName(state.mat)
      setMatRotation(state.matRotation)
      setPlacements(state.placements)
      setSelectedId(null)
      setMapId(state.id)
      setMapName(state.name)
      setMeta({ ttsMap: state.ttsMap, note: state.note, skipped: state.skipped })
    })
  }

  // Downloads <id>.json, the file format of the maps (src/terrain/exportMap.js)
  function exportFile() {
    const text = exportBoardText({
      ...meta,
      id: mapId,
      name: mapName,
      mat: matName,
      matRotation,
      placements,
    })
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <TableStoreProvider store={store}>
      <div className="terrain-page">
        <BuilderPanel
          mapId={mapId}
          mapName={mapName}
          onMapId={setMapId}
          onMapName={setMapName}
          matName={matName}
          pieceCount={placements.length}
          onLoadMap={loadMap}
          onExport={exportFile}
          onPickMat={pickMat}
          onClear={clearPieces}
          onAdd={addPiece}
        />
        <div className="terrain-canvas">
          <div className="scene-root">
            <Canvas
              shadows="percentage"
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
                    <Mat mat={mat.name} rotation={matRotation} />
                    <EditableTerrain
                      placements={placements}
                      onDrop={drop}
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
                maxPolarAngle={MAX_POLAR_ANGLE}
                mouseButtons={CAMERA_MOUSE_BUTTONS}
              />
              <KeyboardCamera pan={heldPan} turn={heldTurn} />
              <CameraHover />
              <WheelCamera wheelState={wheelState} />
            </Canvas>
          </div>
        </div>
      </div>
    </TableStoreProvider>
  )
}
