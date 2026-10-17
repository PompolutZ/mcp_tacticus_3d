import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import { Physics } from '@react-three/rapier'
import { TONE_MAPPINGS } from '../scene/SelectionOutlines.jsx'
import { DEFAULT_LOOK } from '../table/tableStore.js'
import { Backdrop, SceneLights, TableSurface } from '../scene/SceneShared.jsx'
import { styleFigure } from '../characters/useFigureMaterials.jsx'
import { assetEntries } from '../assets/index.js'
import { COLOR_HEX } from '../sideColors.js'
import { CAMERA_MOUSE_BUTTONS } from '../camera.js'
import characters from '../characters/characters.json'
import { buildModelList, filterModels, sortBySize } from './modelList.js'

// Dev-only page (#models, see Root.jsx): the models of the game and the candidates in model-candidates/, one at
// a time with an orbit camera, and the stats of the model. See docs/features/model-viewer.md. It is not in the
// production build.

// Eager, so the list is ready at once. A missing folder gives an empty object.
const CANDIDATES = import.meta.glob('/model-candidates/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
})
const GAME = assetEntries((path) => path.startsWith('characters/') && path.endsWith('.glb'))
const LIST = buildModelList({ candidates: CANDIDATES, assets: GAME, names: characters })

const URLS = LIST.map((row) => row.url)

// Renderer options of the Canvas. The tone mapping is the one of the table.
const GL = { antialias: false, toneMapping: TONE_MAPPINGS[DEFAULT_LOOK.toneMapping].renderer }

const BASE_COLOR = COLOR_HEX.blue
const CAMERA = { position: [0, 4, 8], fov: 40 }
const INCH_MM = 25.4

// Triangles, size in inches and texture sizes of a scene
function measure(scene) {
  let triangles = 0
  const textures = new Map()
  scene.traverse((obj) => {
    if (!obj.isMesh) return
    const g = obj.geometry
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3
    for (const m of [obj.material].flat()) {
      for (const value of Object.values(m)) {
        if (value?.isTexture && value.image) textures.set(value.uuid, value.image)
      }
    }
  })
  const box = new Box3().setFromObject(scene)
  return {
    triangles,
    box,
    textures: [...textures.values()].map((img) => `${img.width} × ${img.height}`),
  }
}

// The model of `url`, with its own copy of the scene (the useGLTF cache stays as the game uses it). Reports the
// stats and puts the camera so that the whole model shows.
function Model({ url, onStats }) {
  const { scene: source } = useGLTF(url)
  const scene = useMemo(() => {
    const copy = source.clone()
    styleFigure(copy, BASE_COLOR)
    return copy
  }, [source])
  const controls = useThree((state) => state.controls)
  const camera = useThree((state) => state.camera)

  useLayoutEffect(() => {
    const { triangles, box, textures } = measure(scene)
    const size = box.getSize(new Vector3())
    onStats({ triangles, textures, sizeMm: size.toArray().map((v) => v * INCH_MM) })
    if (!controls) return
    const center = box.getCenter(new Vector3())
    const radius = Math.max(size.length() / 2, 0.1)
    const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.1
    camera.position.copy(center).addScaledVector(new Vector3(0.5, 0.4, 1).normalize(), distance)
    controls.target.copy(center)
    controls.update()
  }, [scene, controls, camera, onStats])

  return <primitive object={scene} />
}

// The file sizes in bytes of `urls`, { [url]: bytes }, from HEAD requests (Content-Length). A url that is not
// known yet is asked once; a new candidate file is picked up when it is in `urls`.
function useFileSizes(urls) {
  const [sizes, setSizes] = useState({})
  const asked = useRef(new Set())
  useEffect(() => {
    for (const url of urls) {
      if (asked.current.has(url)) continue
      asked.current.add(url)
      fetch(url, { method: 'HEAD' })
        .then((r) => {
          const bytes = Number(r.headers.get('Content-Length'))
          if (r.ok && bytes > 0) setSizes((prev) => ({ ...prev, [url]: bytes }))
        })
        .catch(() => {})
    }
  }, [urls])
  return sizes
}

const formatKb = (bytes) =>
  bytes === undefined ? '...' : `${Math.round(bytes / 1024).toLocaleString('en-US')} KB`

function Stats({ stats, bytes }) {
  if (!stats) return null
  const [w, d, h] = stats.sizeMm.map((v) => v.toFixed(1))
  return (
    <dl className="models-stats">
      <dt>Triangles</dt>
      <dd>{Math.round(stats.triangles).toLocaleString('en-US')}</dd>
      <dt>Size (mm)</dt>
      <dd>{`${w} × ${d} × ${h}`}</dd>
      <dt>File</dt>
      <dd>{formatKb(bytes)}</dd>
      <dt>Textures</dt>
      <dd>{stats.textures.length ? stats.textures.join(', ') : 'none'}</dd>
    </dl>
  )
}

export default function ModelsPage() {
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(LIST[0] ?? null)
  const [stats, setStats] = useState(null)
  const sizes = useFileSizes(URLS)
  const sorted = useMemo(() => sortBySize(LIST, sizes), [sizes])
  const rows = useMemo(() => filterModels(sorted, filter), [sorted, filter])

  function select(row) {
    setStats(null)
    setSelected(row)
  }

  return (
    <div className="terrain-page">
      <aside className="terrain-panel">
        <h2 className="terrain-heading">Models</h2>
        <input
          type="search"
          className="chip chip--text terrain-filter"
          placeholder="Filter by name"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="terrain-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={
                  row.id === selected?.id ? 'terrain-row terrain-row--active' : 'terrain-row'
                }
                onClick={() => select(row)}
              >
                {row.group === 'candidate' ? `[candidate] ${row.name}` : row.name}
                <small> · {formatKb(sizes[row.url])}</small>
              </button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="terrain-empty">No model</p>}
      </aside>
      <div className="terrain-canvas">
        <div className="scene-root">
          {/* An explicit gl.toneMapping is applied after R3F's own default (ACES Filmic, which brightens dark models),
              and R3F skips that default when it is set. Same tone mapping as the table. */}
          <Canvas shadows="percentage" camera={CAMERA} gl={GL}>
            <Suspense fallback={null}>
              <Backdrop />
              <SceneLights />
              {/* TableSurface has a body, so it needs a physics world. Paused: nothing moves. */}
              <Physics paused>
                <TableSurface />
              </Physics>
            </Suspense>
            <Suspense fallback={null}>
              {selected && <Model key={selected.id} url={selected.url} onStats={setStats} />}
            </Suspense>
            <OrbitControls
              makeDefault
              minDistance={0.3}
              maxDistance={100}
              maxPolarAngle={Math.PI / 2}
              mouseButtons={CAMERA_MOUSE_BUTTONS}
            />
          </Canvas>
        </div>
        <Stats stats={stats} bytes={sizes[selected?.url]} />
      </div>
    </div>
  )
}
