import { createStore } from 'zustand/vanilla'
import { effectiveBindings } from '../input/bindings.js'
import { defaultSettings } from '../settings/settings.js'
import { TEAMS } from '../setup/setup.js'
import { DEFAULT_SIDE_COLORS } from '../sideColors.js'

// The look of cards and tokens: tone mapping ('aces' | 'neutral' | 'agx') and surface of the faces
// ('standard' | 'matte' | 'unlit'). See FaceMaterial.jsx. The default is Neutral and Unlit (the choice in
// docs/plans/playtest/playtest-1-bugs.md). Debug mode can switch every option, to compare the look again,
// see debug/useDebugLook.js and DebugPanel.jsx.
export const DEFAULT_LOOK = { toneMapping: 'neutral', surface: 'unlit' }

// The store of one table: the local state that the DOM and the <Canvas> share, with no prop passing. App makes it
// once per table document (App is keyed by it). The slices are in the plan,
// docs/plans/state-context.md ("Store shape"). Doc data is not copied here: a component reads it with the useY* hooks (net/useY.js).
//
// net: { table, ownership, presence, live }. The store adds pieceLives, sceneApi, controlsRef and wheelCameraRef. Set once and never changed.
// ownership, presence and live are null outside a multiplayer room.
// initial: values of the seat and settings slices that App knows at the first render, so no child renders with a default.
// App writes them again when they change (layout effects).
export function createTableStore(net, initial = {}) {
  return createStore(() => ({
    // net
    table: net.table,
    ownership: net.ownership ?? null,
    presence: net.presence ?? null,
    live: net.live ?? null,
    // Live pose getters of dragged pieces without a body, piece key → getter. The drag code fills it, LiveSync reads it.
    pieceLives: new Map(),
    // The calls into Scene, set by Scene on every render, null before its first effect (scene/sceneApi.js)
    sceneApi: { current: null },
    controlsRef: { current: null },
    wheelCameraRef: { current: null },
    // seat
    ownSide: 'host',
    mySide: null,
    playedSides: TEAMS,
    hiddenSquads: false,
    seatPlayers: null,
    nameCtx: null,
    spectator: false,
    sideColors: DEFAULT_SIDE_COLORS,
    // settings
    settings: defaultSettings(),
    bindings: effectiveBindings(),
    debugOn: false,
    showLabels: false,
    showColliders: false,
    look: DEFAULT_LOOK,
    // actions
    actions: {},
    // selection
    selection: [],
    selectedTools: [],
    // drag
    tokenDrag: null,
    toolDrag: null,
    toolSpawn: { range: null, move: null },
    angleSpawn: { target: null, aim: null },
    // scene
    rangeMark: null,
    draggingCharId: null,
    overlapIds: new Set(),
    ...initial,
  }))
}
