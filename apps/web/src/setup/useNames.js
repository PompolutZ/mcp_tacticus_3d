import { useMemo } from 'react'
import { COLOR_NAME, useSideColors } from '../sideColors.js'

// The context of the names (setup/names.js). seatPlayers: { players, peer } in a multiplayer room, else null.
export function useNames(mySide, seatPlayers) {
  const colors = useSideColors()
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
