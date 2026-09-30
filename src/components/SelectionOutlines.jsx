import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, Outline, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { ACESFilmicToneMapping } from 'three'

// Line around a selected or hovered piece, drawn after the scene render, as TTS highlights a piece.
// ALPHA draws the line in its exact color. The default (SCREEN) mixes it with the color under it,
// so orange on the light table looks almost white.
// The edge value the library finds is 0.5 on a straight edge and up to 0.71 on a diagonal one.
// edgeStrength 2 with the limit in clampEdges makes it 1 on every edge pixel: full color, fully opaque.
const LINE = { blendFunction: BlendFunction.ALPHA, edgeStrength: 2 }
const SELECTED = { ...LINE, visibleEdgeColor: 0xf5a623, hiddenEdgeColor: 0x7a5212, xRay: true }
const HOVERED = { ...LINE, visibleEdgeColor: 0xffffff, xRay: false }
// Line width. The edges are found on a smaller copy of the screen: LINE_SCALE times its size in
// CSS pixels. The line is about 1.5 pixels of that copy, so 0.5 gives a line of about 3 CSS pixels.
// A smaller value gives a thicker line with rougher steps.
const LINE_SCALE = 0.5
// Each Outline puts its meshes on its own layer, so the two sets stay apart
const SELECTED_LAYER = 10
const HOVERED_LAYER = 11
// Outline sets its selection to this prop each time the prop changes. The default is a new [] on
// every render, which would clear the selection set below, so this constant is passed instead.
const NO_SELECTION = []
// Line of the Outline shader that scales the edge value, and the same line with a limit of 1.
// Without the limit, ALPHA blending with a value above 1 goes past the line color, so diagonal
// edges were lighter than straight ones.
const EDGE_SCALE = 'edge*=(edgeStrength*mask.x*pulse);'
const EDGE_CLAMPED = 'edge=min(edge*edgeStrength,1.0)*mask.x*pulse;'

function clampEdges(effect) {
  const shader = effect.getFragmentShader()
  if (shader.includes(EDGE_CLAMPED)) return
  if (!shader.includes(EDGE_SCALE)) {
    console.warn('SelectionOutlines: the postprocessing Outline shader has changed, so the edge limit is not applied')
    return
  }
  effect.setFragmentShader(shader.replace(EDGE_SCALE, EDGE_CLAMPED))
}

const RegisterContext = createContext(null)

// Put around the scene. Renders the scene through an EffectComposer that draws the outlines.
// For measuring their cost in debug mode:
// outlines false: the composer runs, but draws no outline.
// composer false: R3F draws the scene straight to the screen, so there are no outlines and no
// antialiasing (the canvas is created without it).
export default function SelectionOutlines({ children, composer = true, outlines = true }) {
  // [{ meshes, mode }], one entry for each useOutline call that has a mode
  const [entries, setEntries] = useState([])
  const selectedRef = useRef()
  const hoveredRef = useRef()
  const dpr = useThree(state => state.viewport.dpr)
  const gl = useThree(state => state.gl)

  const register = useCallback((meshes, mode) => {
    const entry = { meshes, mode }
    setEntries(prev => [...prev, entry])
    return () => setEntries(prev => prev.filter(e => e !== entry))
  }, [])

  // An Outline with an empty selection skips its passes
  useEffect(() => {
    const shown = outlines ? entries : []
    selectedRef.current.selection.set(shown.filter(e => e.mode === 'selected').flatMap(e => e.meshes))
    hoveredRef.current.selection.set(shown.filter(e => e.mode === 'hovered').flatMap(e => e.meshes))
  }, [entries, outlines])

  // The composer sets the renderer tone mapping to none, because ToneMapping below does it.
  // While the composer is off, the renderer must do it again, with the R3F default.
  useEffect(() => {
    if (composer) return
    const previous = gl.toneMapping
    gl.toneMapping = ACESFilmicToneMapping
    return () => { gl.toneMapping = previous }
  }, [composer, gl])

  useEffect(() => {
    clampEdges(selectedRef.current)
    clampEdges(hoveredRef.current)
  }, [])

  // Outline does not update the scale from its props, so it is set on the effects
  useEffect(() => {
    selectedRef.current.resolution.scale = LINE_SCALE / dpr
    hoveredRef.current.resolution.scale = LINE_SCALE / dpr
  }, [dpr])

  // Created once. When the children of EffectComposer change, it builds its passes again and
  // compiles a new shader, so the selection is set on the effects above, not passed as a prop.
  // The composer turns off the renderer tone mapping, so ToneMapping adds back the R3F default.
  // It comes before the outlines, so the outline colors are not tone mapped.
  const passes = useMemo(() => (
    <>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Outline ref={selectedRef} selection={NO_SELECTION} selectionLayer={SELECTED_LAYER} {...SELECTED} />
      <Outline ref={hoveredRef} selection={NO_SELECTION} selectionLayer={HOVERED_LAYER} {...HOVERED} />
    </>
  ), [])

  // enabled, not unmount, turns the composer off: the library does not free the GPU memory of an
  // unmounted composer. Disabled, it does not render, so R3F renders the scene itself.
  // autoClear false: with true, the renderer clears the Outline mask target before it draws the
  // selected meshes into it, so the mask has no edges and no line is drawn. Each pass clears its
  // own target, so nothing else needs autoClear.
  return (
    <RegisterContext.Provider value={register}>
      {children}
      <EffectComposer autoClear={false} enabled={composer}>{passes}</EffectComposer>
    </RegisterContext.Provider>
  )
}

// Outlines every mesh under ref.current. mode: 'selected', 'hovered' or null (no outline).
// The meshes are collected when mode changes, so a mesh added later is outlined from the next change.
export function useOutline(ref, mode) {
  const register = useContext(RegisterContext)
  useEffect(() => {
    const object = ref.current
    if (!mode || !object || !register) return
    const meshes = []
    object.traverse(o => { if (o.isMesh) meshes.push(o) })
    return register(meshes, mode)
  }, [ref, mode, register])
}

// Outline mode of a piece from its selected and hovered state. Selected wins.
export function outlineMode(selected, hovered) {
  return selected ? 'selected' : hovered ? 'hovered' : null
}
