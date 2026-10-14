// What an input does to a range or movement tool (docs/features/range-movement-tools.md, "Input rules").
// Pure: no React, no Three.js. RulerTool.jsx does the pose math for the action.
//
// state:
//   snapped      the tool is snapped to a base
//   snappedSide  the half on the base ('left', 'right'), when snapped
//   bendable     a movement tool (it has a Bend button)
//   bendOn       Bend is on
//   side         the half under the pointer or grabbed ('left', 'right'), null on a range tool
//   drag         the drag in progress: 'move', 'turn', 'bend' or null
// input: 'drag' (a drag starts) or 'step' (Q / E press, held key, wheel step)
// action: { kind: 'move' | 'turnCenter' | 'turnBase' | 'bend' | 'none', side? }
export function toolAction(state, input) {
  const { snapped, snappedSide, bendable, bendOn, side, drag } = state
  // A step during a drag goes to the drag's own action
  if (input === 'step' && drag === 'turn') return { kind: 'turnBase' }
  if (input === 'step' && drag === 'bend') return { kind: 'bend', side }
  if (input === 'step' && drag === 'move') return { kind: 'turnCenter' }
  // Bend on: a half bends. On a snapped tool, the half on the base turns the tool around the base.
  if (bendable && bendOn && side && !(snapped && side === snappedSide))
    return { kind: 'bend', side }
  if (snapped) return { kind: 'turnBase' }
  return { kind: input === 'drag' ? 'move' : 'turnCenter' }
}
