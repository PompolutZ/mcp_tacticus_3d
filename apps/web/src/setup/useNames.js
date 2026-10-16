import { useMemo } from 'react'
import { COLOR_NAME } from '../sideColors.js'

// The context of the names (setup/names.js). seatPlayers: { players, peer } in a multiplayer room, else null.
// colors: the color of each side (sideColors.js). App calls it above the store provider, so it passes them in.
export function useNames(mySide, seatPlayers, colors) {
  return useMemo(
    () => ({
      mySide,
      players: seatPlayers?.players ?? null,
      peer: seatPlayers?.peer ?? null,
      colors: { host: COLOR_NAME[colors.host], guest: COLOR_NAME[colors.guest] },
    }),
    [mySide, seatPlayers, colors],
  )
}
