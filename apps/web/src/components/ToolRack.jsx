import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { TEAMS } from '../setup/setup.js'
import { rackPlate, rackSlots, rackYaw } from '../tabletools/layout.js'
import { OnTable, OWNER_FACING_ROTATION } from './OnTable.jsx'
import { useMovementParts, useRangeParts } from './RulerTool.jsx'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import { useHoverCursor } from './useHoverCursor.js'

// The tool rack of each player: a plate with the range and movement tools in the player tint, and the R1 and
// T/A chips. See docs/features/table-tools.md, "Tool rack". The tools have no physics body. A click is the
// same as the toolbar button of that tool. A drag takes the tool to the table (tabletools/useTableTools.js, startToolDrag).

// The plate is a little above the table, like the tray plates (CharacterTray.jsx); the tools lie on it
const PLATE_Y = 0.01
const TOOL_Y = 0.02
const CHIP_Y = 0.05
const INCHES_PER_PX = 0.04
// A press that moved the pointer this many px or more is not a click: it is a drag (pointerDrag.js,
// DRAG_THRESHOLD) or a drag of the camera
const CLICK_MOVE = 4
// How much of the tool shows when it is on the table
const FAINT_OPACITY = 0.25
// Same as the label of a token (TokenFace.jsx): without this, the label takes the pointer from the tool
const NO_POINTER = { pointerEvents: 'none' }

const MOVE_TYPES = { s: 'short', m: 'medium', l: 'long' }
const MOVE_NAMES = { short: 'Short move', medium: 'Medium move', long: 'Long move' }
const MOVE_KEYS = { short: 7, medium: 8, long: 9 }

const px = (inches) => Math.round(inches / INCHES_PER_PX)

// A faint copy of the parts: a clone with its own transparent material. The materials of `parts` are shared
// with nothing else here, but the clone keeps them as they are.
function useFaintParts(parts) {
  const faint = useMemo(
    () =>
      parts.map((part) => {
        const obj = part.obj.clone()
        obj.traverse((child) => {
          if (!child.isMesh) return
          child.material = child.material.clone()
          child.material.transparent = true
          child.material.opacity = FAINT_OPACITY
          child.material.depthWrite = false
        })
        return { ...part, obj }
      }),
    [parts],
  )
  useEffect(
    () => () =>
      faint.forEach((part) =>
        part.obj.traverse((child) => child.isMesh && child.material.dispose()),
      ),
    [faint],
  )
  return faint
}

// One tool on the rack, lying along x at its slot. out: the tool is on the table, so a faint copy shows.
// onClick undefined: the rack of the other player, with no pointer handlers. onDragStart(e): a press, which
// may become a drag.
function RackTool({ parts, slot, side, out, label, onClick, onDragStart }) {
  const faint = useFaintParts(parts)
  const toolRef = useRef()
  const [pointerOver, setHovered] = useState(false)
  // The rack of the other player has no handlers, so it is never hovered
  const hovered = pointerOver && Boolean(onClick)
  useHoverCursor(hovered, 'pointer')
  // The faint copy of a tool that is out has no outline
  useOutline(toolRef, outlineMode(false, hovered && !out))

  const events = onClick && {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHovered(true)
    },
    onPointerOut: () => setHovered(false),
    onPointerDown: onDragStart,
    onClick: (e) => {
      // The click does not reach the table (it would clear the selection)
      e.stopPropagation()
      if (e.delta >= CLICK_MOVE) return
      onClick()
    },
  }

  return (
    <group position={[slot.x, TOOL_Y, slot.z]}>
      <group ref={toolRef} rotation-y={rackYaw(side)} {...events}>
        {(out ? faint : parts).map((part) => (
          <primitive key={part.obj.uuid} object={part.obj} />
        ))}
      </group>
      {hovered && (
        <Html position={[0, 0.4, 0]} center style={NO_POINTER}>
          <div className="token-face-label">
            <strong>{label}</strong>
          </div>
        </Html>
      )}
    </group>
  )
}

function RackRange({ slot, ...props }) {
  const mesh = Number(slot.key[1])
  const parts = useRangeParts(mesh, props.side)
  return <RackTool parts={parts} slot={slot} {...props} />
}

function RackMove({ slot, ...props }) {
  const parts = useMovementParts(MOVE_TYPES[slot.key], props.side)
  return <RackTool parts={parts} slot={slot} {...props} />
}

// A chip of the rack (R1, T/A). It lies flat and faces the owner. on: its tool is on the table. A press starts
// the drag, and a release without a drag is the click. The keyboard click (detail 0) works as well.
function RackChip({ slot, side, on, title, onClick, onDragStart }) {
  return (
    <OnTable position={[slot.x, CHIP_Y, slot.z]} rotation={OWNER_FACING_ROTATION[side]}>
      <button
        type="button"
        className={`chip table-button rack-chip${on ? ' chip--active' : ''}${onClick ? '' : ' rack-chip--locked'}`}
        style={{ width: px(slot.length), height: px(slot.width) }}
        title={title}
        onPointerDown={onDragStart}
        onClick={onClick && ((e) => e.detail === 0 && onClick())}
      >
        {slot.key === 'r1' ? 'R1' : 'T/A'}
      </button>
    </OnTable>
  )
}

// The rack of `side`. tools: the `tools` record of the document. handlers: undefined for the rack of the other
// player, which only shows what is on the table.
function Rack({ side, tools, handlers }) {
  const plate = rackPlate(side)
  const entry = tools[side] ?? {}
  const rangeOn = entry.range?.which ?? null
  const moveOn = entry.move?.which ?? null
  const angleOn = Boolean(entry.angle)
  const click = (fn) => handlers && (() => fn())
  // The press of a tool or chip: it may become a drag. clickFn: the click of a chip, which has no click event
  // of its own after a press (a tool uses the click event of the 3D scene).
  const press = (kind, which, clickFn) =>
    handlers && ((e) => handlers.onDragStart(e, kind, which, clickFn))

  return (
    <group>
      <mesh position={[plate.x, PLATE_Y, plate.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[plate.width, plate.depth]} />
        <meshStandardMaterial color="#20242b" roughness={1} />
      </mesh>
      {rackSlots(side).map((slot) => {
        if (slot.key === 'r1') {
          return (
            <RackChip
              key={slot.key}
              slot={slot}
              side={side}
              on={rangeOn === 1}
              title="Range 1 · key 1"
              onClick={click(() => handlers.onRangeClick(1))}
              onDragStart={press('range', 1, () => handlers.onRangeClick(1))}
            />
          )
        }
        if (slot.key === 'ta') {
          return (
            <RackChip
              key={slot.key}
              slot={slot}
              side={side}
              on={angleOn}
              title="Toward / Away · key 6"
              onClick={click(() => handlers.onAngleClick())}
              onDragStart={press('angle', true, () => handlers.onAngleClick())}
            />
          )
        }
        if (slot.kind === 'range') {
          const n = Number(slot.key[1])
          // R2 is also the tool of Range 1
          const out = rangeOn === n || (n === 2 && rangeOn === 1)
          return (
            <Suspense key={slot.key} fallback={null}>
              <RackRange
                slot={slot}
                side={side}
                out={out}
                label={`Range ${n} · key ${n}`}
                onClick={click(() => handlers.onRangeClick(n))}
                onDragStart={press('range', n)}
              />
            </Suspense>
          )
        }
        const type = MOVE_TYPES[slot.key]
        return (
          <Suspense key={slot.key} fallback={null}>
            <RackMove
              slot={slot}
              side={side}
              out={moveOn === type}
              label={`${MOVE_NAMES[type]} · key ${MOVE_KEYS[type]}`}
              onClick={click(() => handlers.onMoveClick(type))}
              onDragStart={press('move', type)}
            />
          </Suspense>
        )
      })}
    </group>
  )
}

// The racks. A multiplayer room shows both, and only the own one reacts to the pointer. Else only the rack of
// the own side shows, because this browser has only its own tools. The handlers are the toolbar handlers.
// onDragStart(e, kind, which, onClick): a press on an own tool or chip (tabletools/useTableTools.js, startToolDrag).
export default function ToolRack({
  ownSide,
  multiplayer,
  tools,
  onRangeClick,
  onMoveClick,
  onAngleClick,
  onDragStart,
}) {
  const handlers = { onRangeClick, onMoveClick, onAngleClick, onDragStart }
  return (multiplayer ? TEAMS : [ownSide]).map((side) => (
    <Rack key={side} side={side} tools={tools} handlers={side === ownSide ? handlers : undefined} />
  ))
}
