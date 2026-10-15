// The side that the Library adds for. No React.
// seat: { multiplayer, ownSide, mySide } from rooms/seat.js. chosen: the side of the "For" choice.
// A multiplayer room adds for the own side only; a seat without a side (mySide null) adds for nobody (null).
// A single player room and the Sandbox are one person for both sides, so the choice counts.
export function libraryTeam({ multiplayer, ownSide, mySide }, chosen) {
  if (!multiplayer) return chosen
  return mySide ? ownSide : null
}
