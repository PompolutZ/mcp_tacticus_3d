// Which models show the overlap mark (docs/plans/implement-backend/09-moving-objects.md, decision 1).
// Models pass through models, so two bases can end up in one place. The one that moved last shows the mark.

// Base circles must overlap by more than this (inches), so touching bases have no mark
export const OVERLAP_MIN = 0.01
// Bases count as at the same height when their bottoms differ by less than this (inches). A lifted
// model (6") or a model on another level of terrain is not under or over the other one.
export const HEIGHT_TOLERANCE = 0.25

// models: [{ id, x, y, z, radius, moved }]. x, y, z: the body position, so y is the base bottom.
// moved: a number that grows with each move of the model. Of two overlapping models, the one with the
// higher number gets the mark. With equal numbers (none of them moved) neither does.
// Returns the Set of ids with the mark.
export function overlapMarks(models) {
  const marks = new Set()
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      const a = models[i]
      const b = models[j]
      if (a.moved === b.moved) continue
      if (Math.abs(a.y - b.y) >= HEIGHT_TOLERANCE) continue
      if (a.radius + b.radius - Math.hypot(a.x - b.x, a.z - b.z) <= OVERLAP_MIN) continue
      marks.add(a.moved > b.moved ? a.id : b.id)
    }
  }
  return marks
}
