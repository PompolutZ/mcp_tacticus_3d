// What a released token drag does. drag: the drag fields (looseId, supplyCard, pile, pileId). characterId:
// the character under the pointer, or null. point: the table point under the pointer, { x, z } | null.
// Gives 'movePile' | 'newPile' (a pile goes only on the table), 'supplyHeld' (a character holds the
// supply token) | 'supplyTable', 'give' (the character gets the token), 'moveLoose' | 'newLoose' (on the
// table), or null (nothing changes). The order of the checks is the order of the release.
export function tokenDropTarget(drag, { characterId, point }) {
  const { looseId, supplyCard, pile, pileId } = drag
  if (pile || pileId) {
    if (characterId || !point) return null
    return pileId ? 'movePile' : 'newPile'
  }
  if (supplyCard) {
    if (characterId) return 'supplyHeld'
    return point ? 'supplyTable' : null
  }
  if (characterId) return 'give'
  if (!point) return null
  return looseId ? 'moveLoose' : 'newLoose'
}

// The footprint circle of a token that follows the pointer (or a peer's drag): { x, z, radius } at the
// current pose, or null while it has not moved. follow: ref of the follower, its current.moved is true
// once the token moved. poseRef: ref of the pose, { x, z }. radius: the token radius (the caller has it,
// as this file loads in Node).
export function tokenFootprint(follow, poseRef, radius) {
  return follow.current.moved ? { ...poseRef.current, radius } : null
}
