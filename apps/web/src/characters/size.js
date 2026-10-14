// Size of each side of a Jarvis stat card, for the Line of Sight tool (docs/features/line-of-sight.md).
// It changes between sides (Hulkbuster 4 to 2, Phoenix 2 to 4). A grunt has no Injured side
// (backSide is null): the Healthy size. 0 when Jarvis has none.
export function cardSizes(statCard) {
  const healthy = Number(statCard.frontSide.size) || 0
  return { healthy, injured: Number(statCard.backSide?.size) || healthy }
}

// Size of the face-up side: 'injured' or anything else (Healthy).
export function sideSize(sizes, side) {
  return side === 'injured' ? sizes.injured : sizes.healthy
}
