import { Suspense, useRef, useState } from 'react'
import { MovementRuler, AngleRuler, RangeRuler } from './RulerTool.jsx'
import { LosTool } from './LosTool.jsx'
import { TOOL_HOVER_HEIGHT, sameModel } from './toolGeometry.js'
import { useRenderCount } from '../debug/renderCount.js'

const toolKey = (kind, entry) => `${kind}-${entry.which}-${entry.spawn}`

// The own tools of this player: move, angle, Line of Sight and range. Props are the values and
// handlers that Scene.jsx has for them. onPlaceLimit(kind, limit): sets the Place limit of a tool in
// the map that Scene reads to limit a drag of a piece (applyPlaceLimits). turnProps(kind): the Q / E turn props of a tool.
export default function OwnTools({
  ownTools,
  ownSide,
  onToolStore,
  onToolReturn,
  onToolRemove,
  toolSpawn,
  angleSpawn,
  selectedTools,
  onSelectedToolsChange,
  toolTarget,
  toolModels,
  toolModel,
  onSnap,
  onPlaceLimit,
  setRangeMark,
  turnProps,
}) {
  useRenderCount('OwnTools')
  // The own tool that has Place or Throw on: 'range', 'move' or null. Only one at a time. The other tool turns
  // its own off (limitTaken in useToolLimits.js). A tool that turns off clears only its slot in placeLimits.
  const [limitTool, setLimitTool] = useState(null)
  // Function of the angle tool that returns { target, openYaw } while it is snapped, else null. See AngleRuler.
  const angleTool = useRef(null)
  // Props that every own tool gets from its entry
  const toolEntry = (kind) => ({
    team: ownSide,
    side: ownSide,
    entry: ownTools[kind],
    onStore: (fields) => onToolStore?.(kind, ownTools[kind].spawn, fields),
    onReturn: onToolReturn && (() => onToolReturn(kind)),
  })
  // The spawn target of the range and movement tools. undefined without one, so that RulerTool falls back
  // to target (null would mean "spawn free").
  const spawnModel = (piece) => (piece ? toolModel(piece) : undefined)
  function toggleTool(tool) {
    onSelectedToolsChange((prev) => ({ ...prev, [tool]: !prev[tool] }))
  }

  function selectTool(tool) {
    onSelectedToolsChange((prev) => ({ ...prev, [tool]: true }))
  }
  // The open direction of the angle tool when it is snapped to model, else null. A movement tool snapped
  // to the same character points within 45° of it.
  function angleLimit(model) {
    const angle = angleTool.current?.()
    return angle && sameModel(angle.target, model) ? angle.openYaw : null
  }

  return (
    <>
      {ownTools.move && (
        <Suspense key={toolKey('move', ownTools.move)} fallback={null}>
          <MovementRuler
            type={ownTools.move.which}
            spawnTarget={spawnModel(toolSpawn.move)}
            {...toolEntry('move')}
            hoverHeight={TOOL_HOVER_HEIGHT}
            selected={selectedTools.move}
            onSelect={() => toggleTool('move')}
            onDragSelect={() => selectTool('move')}
            // A new tool is selected, so its buttons (Place, Bend) can be used right away
            onSpawn={() => selectTool('move')}
            angleLimit={angleLimit}
            target={toolTarget}
            models={toolModels}
            onSnap={onSnap}
            onPlaceLimit={(limit) => onPlaceLimit('move', limit)}
            limitTaken={limitTool === 'range'}
            onLimitOn={() => setLimitTool('move')}
            {...turnProps('move')}
          />
        </Suspense>
      )}
      {ownTools.angle && (
        <Suspense key={toolKey('angle', ownTools.angle)} fallback={null}>
          <AngleRuler
            {...toolEntry('angle')}
            hoverHeight={TOOL_HOVER_HEIGHT}
            selected={selectedTools.angle}
            onSelect={() => toggleTool('angle')}
            onDragSelect={() => selectTool('angle')}
            onSpawn={() => selectTool('angle')}
            target={toolTarget}
            spawnTarget={toolModel(angleSpawn.target)}
            aim={toolModel(angleSpawn.aim)}
            models={toolModels}
            onSnap={onSnap}
            angleRef={(get) => {
              angleTool.current = get
            }}
            {...turnProps('angle')}
          />
        </Suspense>
      )}
      {ownTools.los && (
        <LosTool
          key={toolKey('los', ownTools.los)}
          {...toolEntry('los')}
          selected={selectedTools.los}
          onSelect={() => toggleTool('los')}
          onDragSelect={() => selectTool('los')}
          onSpawn={() => selectTool('los')}
          onRemove={() => onToolRemove?.('los')}
          models={toolModels}
          {...turnProps('los')}
        />
      )}
      {ownTools.range && (
        <Suspense key={toolKey('range', ownTools.range)} fallback={null}>
          <RangeRuler
            number={ownTools.range.which}
            spawnTarget={spawnModel(toolSpawn.range)}
            {...toolEntry('range')}
            hoverHeight={TOOL_HOVER_HEIGHT}
            selected={selectedTools.range}
            onSelect={() => toggleTool('range')}
            onDragSelect={() => selectTool('range')}
            onSpawn={() => selectTool('range')}
            target={toolTarget}
            models={toolModels}
            onSnap={onSnap}
            onPlaceLimit={(limit) => onPlaceLimit('range', limit)}
            limitTaken={limitTool === 'move'}
            onLimitOn={() => setLimitTool('range')}
            onRangeMark={setRangeMark}
            {...turnProps('range')}
          />
        </Suspense>
      )}
    </>
  )
}
