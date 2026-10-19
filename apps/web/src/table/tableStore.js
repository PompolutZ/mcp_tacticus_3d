import { createStore } from 'zustand/vanilla'
import { effectiveBindings } from '../input/bindings.js'
import { defaultSettings } from '../settings/settings.js'
import { TEAMS } from '../setup/setup.js'
import { COLOR_NAME, DEFAULT_SIDE_COLORS } from '../sideColors.js'
import {
  NO_PIECES,
  NO_TOOLS,
  presenceSelection,
  presenceTools,
  selectPiece,
  toggleSelectPiece,
} from '../selection.js'

// The look of cards and tokens: tone mapping ('aces' | 'neutral' | 'agx') and surface of the faces
// ('standard' | 'matte' | 'unlit'). See FaceMaterial.jsx. The default is Neutral and Unlit (the choice in
// docs/plans/playtest/playtest-1-bugs.md). Debug mode can switch every option, to compare the look again,
// see debug/useDebugLook.js and DebugPanel.jsx.
export const DEFAULT_LOOK = { toneMapping: 'neutral', surface: 'unlit', ambient: 1.5, corner: 0.5 }

// The names of the actions (see createActions). Plain names are one function. The groups are objects of functions.
const ACTION_NAMES = [
  // Hover, for the keys and Alt (useHovered.js, useCardPeek.js)
  'onPieceHover',
  'onTerrainHover',
  'onHeldHover',
  'onTrayCardHover',
  'onLooseHover',
  'onPileHover',
  'onTacticHover',
  'onDiceTrayHover',
  'onCardHover',
  // Tokens, piles and tactic cards
  'onTokenMove',
  'onTokenTurn',
  'onTokenHold',
  'onSupplyDragStart',
  'onTokenDragStart',
  'onPileTakeStart',
  'onPileMoveStart',
  'onLibraryTokenDragStart',
  'findCharacterAt',
  'onTacticMove',
  'onTacticSpawn',
  // Tools. onToolReturn also removes a tool (the Line of Sight looker left).
  'onToolStore',
  'onToolReturn',
  'onRangeClick',
  'onMoveClick',
  'onAngleClick',
  'onLosClick',
  'onToolDragStart',
  // The table
  'onTurnMat',
  'onMapChange',
  'onCrisisChange',
  'onRosterLoad',
  'onRosterRemove',
  'onScoreMarkerMove',
  'onSquadToggle',
  'onDeployLineClick',
  'showHudMessage',
  // Popup openers and toolbar toggles
  'onCardOpen',
  'onTrayOpen',
  'onAttachedOpen',
  'onDiceMenuOpen',
  'onDiceMenuClose',
  'onRosterOpen',
  'onCrisisOpen',
  'onLobby',
  'onSpectatorClick',
  'onSettingsClick',
  'onLibraryClick',
  'onLogClick',
  'onSetupClick',
  'onSetupClose',
]
const ACTION_GROUPS = {
  setup: [
    'priority',
    'deck',
    'pick',
    'threat',
    'turnMat',
    'edge',
    'ready',
    'affiliation',
    'restart',
    'browse',
    'override',
  ],
  characters: ['spawn', 'damage', 'power', 'flip', 'offBoard', 'removeToken', 'swap'],
  phases: ['power', 'cleanup', 'priorityClick'],
}

// The actions that components call to change the table. The object is made once and never changes, and so is each
// function in it: a function calls the newest implementation, which App gives to register(impls) after each render
// (a ref write, no store change, so no reader renders). impls has the same names. An action runs in an event or an
// effect. One called during render would see the implementation of the previous render. See docs/plans/state-context.md, step 6.
function createActions(set) {
  const impl = { current: {} }
  const actions = {}
  // The setters of the selection and drag slices. Each takes a value or an updater (prev) => next, the same as a
  // useState setter, and changes nothing (no reader renders) when the result is the same value.
  const setter = (key) => (value) =>
    set((s) => {
      const next = typeof value === 'function' ? value(s[key]) : value
      return Object.is(next, s[key]) ? s : { [key]: next }
    })
  actions.setSelection = setter('selection')
  actions.setSelectedTools = setter('selectedTools')
  actions.setTokenDrag = setter('tokenDrag')
  actions.setTrayDrag = setter('trayDrag')
  actions.setToolDrag = setter('toolDrag')
  actions.setToolSpawn = setter('toolSpawn')
  actions.setAngleSpawn = setter('angleSpawn')
  // The scene slice: the piece that a range tool marks, the dragged own model, the models that show the overlap mark
  actions.setRangeMark = setter('rangeMark')
  actions.setDraggingCharId = setter('draggingCharId')
  // marks: a Set of model ids. The store keeps the old Set when the content is the same (the 100 ms check).
  actions.setOverlapIds = (marks) =>
    set((s) =>
      s.overlapIds.size === marks.size && [...marks].every((m) => s.overlapIds.has(m))
        ? s
        : { overlapIds: marks },
    )
  // A click on a piece toggles it, a drag selects it and keeps it selected (selection.js)
  actions.toggleSelect = (kind, id) =>
    actions.setSelection((prev) => toggleSelectPiece(prev, { kind, id }))
  actions.dragSelect = (kind, id) => actions.setSelection((prev) => selectPiece(prev, { kind, id }))
  for (const name of ACTION_NAMES) actions[name] = (...args) => impl.current[name]?.(...args)
  for (const [group, names] of Object.entries(ACTION_GROUPS)) {
    actions[group] = {}
    for (const name of names)
      actions[group][name] = (...args) => impl.current[group]?.[name]?.(...args)
  }
  return {
    actions,
    registerActions: (next) => {
      impl.current = next
    },
  }
}

// The store of one table: the local state that the DOM and the <Canvas> share, with no prop passing. App makes it
// once per table document (App is keyed by it). The slices are in the plan,
// docs/plans/state-context.md ("Store shape"). Doc data is not copied here: a component reads it with the useY* hooks (net/useY.js).
//
// net: { table, ownership, presence, live }. The store adds pieceLives, sceneApi, controlsRef and wheelCameraRef. Set once and never changed.
// ownership, presence and live are null outside a multiplayer room.
// initial: values of the seat and settings slices that App knows at the first render, so no child renders with a default.
// App writes them again when they change (layout effects).
export function createTableStore(net, initial = {}) {
  const received = { current: null }
  const store = createStore((set) => {
    const { actions, registerActions } = createActions(set)
    return {
      // net
      table: net.table,
      ownership: net.ownership ?? null,
      presence: net.presence ?? null,
      live: net.live ?? null,
      // Live pose getters of dragged pieces without a body, piece key → getter. The drag code fills it, LiveSync reads it.
      pieceLives: new Map(),
      // The calls into Scene, set by Scene on every render, null before its first effect (scene/sceneApi.js)
      sceneApi: { current: null },
      // What LiveSync received: { pose(key), poseTime(key), tool(kind), die(key), cursor() }, or null (LiveSync.jsx)
      received,
      // The latest live numbers of a piece key and when they came, or null. Stable, for the pieces that follow.
      getPieceLive: (key) => received.current?.pose(key) ?? null,
      getPieceLiveTime: (key) => received.current?.poseTime(key) ?? null,
      controlsRef: { current: null },
      wheelCameraRef: { current: null },
      // seat
      ownSide: 'host',
      mySide: null,
      playedSides: TEAMS,
      hiddenSquads: false,
      seatPlayers: null,
      // App writes the real names in a layout effect, before the first paint. This one keeps a first render from reading null.
      nameCtx: {
        mySide: null,
        players: null,
        peer: null,
        colors: {
          host: COLOR_NAME[DEFAULT_SIDE_COLORS.host],
          guest: COLOR_NAME[DEFAULT_SIDE_COLORS.guest],
        },
      },
      spectator: false,
      sideColors: DEFAULT_SIDE_COLORS,
      // settings
      settings: defaultSettings(),
      bindings: effectiveBindings(),
      debugOn: false,
      showLabels: false,
      showColliders: false,
      look: DEFAULT_LOOK,
      // The WebGL renderer name from the Canvas onCreated (App.jsx), or null. Read by perf/PerfOverlay.jsx.
      gpuName: null,
      // actions
      actions,
      registerActions,
      // selection
      selection: NO_PIECES,
      selectedTools: NO_TOOLS,
      // drag. The table point under the pointer of a drag is a ref, not state: the preview writes it on every pointermove.
      dragPointRef: { current: null },
      toolDragPointRef: { current: null },
      tokenDrag: null,
      // The drag of a tray card: { id, over } (the dragged tray, the own tray under the pointer or null), else null
      trayDrag: null,
      toolDrag: null,
      toolSpawn: { range: null, move: null },
      angleSpawn: { target: null, aim: null },
      // scene
      // The piece that a range tool measures against, { kind, id, mode: 'inRange' | 'outOfRange' } or null (RangeMark
      // in ToolFootprint.jsx). The other player sees it through presence.
      rangeMark: null,
      // The id of the dragged own model, else null
      draggingCharId: null,
      // Ids of the models that show the overlap mark (Scene checks every 100 ms, sets it only on a change)
      overlapIds: new Set(),
      ...initial,
    }
  })
  // The other player sees the selection and the selected tools (docs/features/peer-to-peer.md, "What each player controls")
  const { presence } = net
  if (presence) {
    const mirror = ({ selection, selectedTools }) =>
      presence.set({ selection: presenceSelection(selection), tools: presenceTools(selectedTools) })
    mirror(store.getState())
    store.subscribe((s, prev) => {
      if (s.selection !== prev.selection || s.selectedTools !== prev.selectedTools) mirror(s)
    })
    // The piece that the own range tool marks
    store.subscribe((s, prev) => {
      const { rangeMark } = s
      if (rangeMark === prev.rangeMark) return
      presence.set({
        mark: rangeMark && { key: `${rangeMark.kind}:${rangeMark.id}`, mode: rangeMark.mode },
      })
    })
  }
  return store
}
