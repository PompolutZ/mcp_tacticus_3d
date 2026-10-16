import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, Outline, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping } from 'three'
import { DEFAULT_LOOK, useLook } from './look.js'
import { COLOR_HEX, hexNumber } from '../sideColors.js'

// Line around a selected or hovered piece, drawn after the scene render, as TTS highlights a piece.
// ALPHA draws the line in its exact color. The default (SCREEN) mixes it with the color under it,
// so orange on the light table looks almost white.
// The edge value the library finds is 0.5 on a straight edge and up to 0.71 on a diagonal one.
// edgeStrength 2 with the limit in clampEdges makes it 1 on every edge pixel: full color, fully opaque.
const LINE = { blendFunction: BlendFunction.ALPHA, edgeStrength: 2 }
// The line of each outline mode. Each Outline puts its meshes on its own selection layer, so the sets
// stay apart. xRay also draws the hidden part of the line, in a darker color.
// inRange and outOfRange mark the piece that a range tool measures against (RangeMark in
// RulerTool.jsx). They have the green and red of the tool footprint. xRay, so that a piece behind
// terrain still shows its mark.
const OUTLINES = {
  selected: {
    ...LINE,
    visibleEdgeColor: 0xf5a623,
    hiddenEdgeColor: 0x7a5212,
    xRay: true,
    selectionLayer: 10,
  },
  hovered: { ...LINE, visibleEdgeColor: 0xffffff, xRay: false, selectionLayer: 11 },
  inRange: {
    ...LINE,
    visibleEdgeColor: 0x2ee06a,
    hiddenEdgeColor: 0x177035,
    xRay: true,
    selectionLayer: 12,
  },
  outOfRange: {
    ...LINE,
    visibleEdgeColor: 0xe5484d,
    hiddenEdgeColor: 0x732426,
    xRay: true,
    selectionLayer: 13,
  },
  // The other player's selection, in their side color (the cursor ring of RemoteCursor.jsx). One mode for
  // each side, because an Outline has one color.
  otherBlue: {
    ...LINE,
    visibleEdgeColor: hexNumber(COLOR_HEX.blue),
    hiddenEdgeColor: 0x15405c,
    xRay: true,
    selectionLayer: 15,
  },
  otherRed: {
    ...LINE,
    visibleEdgeColor: hexNumber(COLOR_HEX.red),
    hiddenEdgeColor: 0x601c15,
    xRay: true,
    selectionLayer: 16,
  },
  // Two models overlap (characters/overlap.js). The red of outOfRange.
  overlap: {
    ...LINE,
    visibleEdgeColor: 0xe5484d,
    hiddenEdgeColor: 0x732426,
    xRay: true,
    selectionLayer: 14,
  },
}
const MODES = Object.keys(OUTLINES)
// The tone mapping of each look option (look.js): the ToneMapping pass mode, and the renderer
// constant for when the composer is off
const TONE_MAPPINGS = {
  aces: { pass: ToneMappingMode.ACES_FILMIC, renderer: ACESFilmicToneMapping },
  neutral: { pass: ToneMappingMode.NEUTRAL, renderer: NeutralToneMapping },
  agx: { pass: ToneMappingMode.AGX, renderer: AgXToneMapping },
}
// Line width. The edges are found on a smaller copy of the screen: LINE_SCALE times its size in
// CSS pixels. The line is about 1.5 pixels of that copy, so 0.5 gives a line of about 3 CSS pixels.
// A smaller value gives a thicker line with rougher steps.
const LINE_SCALE = 0.5
// Outline sets its selection to this prop each time the prop changes. The default is a new [] on
// every render, which would clear the selection set below, so this constant is passed instead.
const NO_SELECTION = []
// Line of the Outline shader that scales the edge value, and the same line with a limit of 1.
// Without the limit, ALPHA blending with a value above 1 goes past the line color, so diagonal
// edges were lighter than straight ones.
const EDGE_SCALE = 'edge*=(edgeStrength*mask.x*pulse);'
const EDGE_CLAMPED = 'edge=min(edge*edgeStrength,1.0)*mask.x*pulse;'

function setRendererToneMapping(gl, toneMapping) {
  gl.toneMapping = toneMapping
}

function setToneMode(effect, mode) {
  effect.mode = mode
}

function clampEdges(effect) {
  const shader = effect.getFragmentShader()
  if (shader.includes(EDGE_CLAMPED)) return
  if (!shader.includes(EDGE_SCALE)) {
    console.warn(
      'SelectionOutlines: the postprocessing Outline shader has changed, so the edge limit is not applied',
    )
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
  // Outline effect of each mode
  const effects = useRef({})
  const dpr = useThree((state) => state.viewport.dpr)
  const gl = useThree((state) => state.gl)
  const tone = TONE_MAPPINGS[useLook().toneMapping]
  // ToneMapping effect
  const toneEffect = useRef(null)

  const register = useCallback((meshes, mode) => {
    const entry = { meshes, mode }
    setEntries((prev) => [...prev, entry])
    return () => setEntries((prev) => prev.filter((e) => e !== entry))
  }, [])

  // An Outline with an empty selection skips its passes
  useEffect(() => {
    const shown = outlines ? entries : []
    for (const mode of MODES) {
      effects.current[mode].selection.set(
        shown.filter((e) => e.mode === mode).flatMap((e) => e.meshes),
      )
    }
  }, [entries, outlines])

  // The composer sets the renderer tone mapping to none, because ToneMapping below does it.
  // While the composer is off, the renderer must do it again, with the chosen tone mapping. With the composer on, the scene goes to a render target, so a material
  // flag toneMapped has no effect: the pass maps the whole image.
  useEffect(() => {
    if (composer) return
    const previous = gl.toneMapping
    setRendererToneMapping(gl, tone.renderer)
    return () => setRendererToneMapping(gl, previous)
  }, [composer, gl, tone])

  // The mode is set on the effect, not as a prop of ToneMapping below, so the passes are not built again
  useEffect(() => {
    if (toneEffect.current) setToneMode(toneEffect.current, tone.pass)
  }, [tone])

  useEffect(() => {
    for (const mode of MODES) clampEdges(effects.current[mode])
  }, [])

  // Outline does not update the scale from its props, so it is set on the effects
  useEffect(() => {
    for (const mode of MODES) effects.current[mode].resolution.scale = LINE_SCALE / dpr
  }, [dpr])

  // Created once. When the children of EffectComposer change, it builds its passes again and
  // compiles a new shader, so the selection is set on the effects above, not passed as a prop.
  // The composer turns off the renderer tone mapping, so ToneMapping adds it back. It starts with the
  // default mode (Neutral, see look.js); the effect above sets later switches from debug mode.
  // It comes before the outlines, so the outline colors are not tone mapped.
  const passes = useMemo(
    () => (
      <>
        <ToneMapping ref={toneEffect} mode={TONE_MAPPINGS[DEFAULT_LOOK.toneMapping].pass} />
        {MODES.map((mode) => (
          <Outline
            key={mode}
            ref={(effect) => {
              effects.current[mode] = effect
            }}
            selection={NO_SELECTION}
            {...OUTLINES[mode]}
          />
        ))}
      </>
    ),
    [],
  )

  // enabled, not unmount, turns the composer off: the library does not free the GPU memory of an
  // unmounted composer. Disabled, it does not render, so R3F renders the scene itself.
  // autoClear false: with true, the renderer clears the Outline mask target before it draws the
  // selected meshes into it, so the mask has no edges and no line is drawn. Each pass clears its
  // own target, so nothing else needs autoClear.
  return (
    <RegisterContext.Provider value={register}>
      {children}
      <EffectComposer autoClear={false} enabled={composer} multisampling={8}>
        {passes}
      </EffectComposer>
    </RegisterContext.Provider>
  )
}

// Outlines every mesh under ref.current. mode: a key of OUTLINES, or null (no outline).
// The meshes are collected when mode changes, so a mesh added later is outlined from the next change.
export function useOutline(ref, mode) {
  const register = useContext(RegisterContext)
  useEffect(() => {
    const object = ref.current
    if (!mode || !object || !register) return
    const meshes = []
    object.traverse((o) => {
      if (o.isMesh) meshes.push(o)
    })
    return register(meshes, mode)
  }, [ref, mode, register])
}

// Outline mode of a piece from its selected and hovered state, its range mark ('inRange',
// 'outOfRange' or none, see RangeMark in ToolFootprint.jsx) and its overlap mark. The order: overlap, the range
// mark (Scene gives the own one, else the other player's), selected, the other player's selection, hovered.
// other: the color ('blue' or 'red', not the side) of the other player who has the piece selected, or null.
export function outlineMode(selected, hovered, rangeMark = null, overlap = false, other = null) {
  if (overlap) return 'overlap'
  if (rangeMark) return rangeMark
  if (selected) return 'selected'
  if (other) return other === 'red' ? 'otherRed' : 'otherBlue'
  return hovered ? 'hovered' : null
}
