import { useMemo } from 'react'
import { gruntsByHost, layoutTrays, trayShapeOf } from './trays.js'

// The layout of the character trays: the position of every tray (a player's row recenters when that player adds or
// removes a character), the grunts of each host (a grunt's card lies on its host's tray), and trayShape(character), the
// shape of one tray. Scene and TokenLayer (a held token lies on its holder's card) both use it, so the layout is
// computed in one place.
export function useTrayLayout(characters) {
  const trayPositions = useMemo(() => layoutTrays(characters), [characters])
  const gruntLists = useMemo(() => gruntsByHost(characters), [characters])
  const trayShape = (ch) => trayShapeOf(ch, characters, gruntLists)
  return { trayPositions, gruntLists, trayShape }
}
