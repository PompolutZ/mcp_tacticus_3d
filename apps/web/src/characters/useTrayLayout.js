import { useCallback, useMemo } from 'react'
import { gruntsByHost, layoutTrays, trayShapeOf } from './trays.js'

// The layout of the character trays: the position of every tray (a player's row recenters when that player adds or
// removes a character), the grunts of each host (a grunt's card lies on its host's tray), and trayShape(character), the
// shape of one tray. Scene and TokenLayer (a held token lies on its holder's card) both use it, so the layout is
// computed in one place.
export function useTrayLayout(characters) {
  const trayPositions = useMemo(() => layoutTrays(characters), [characters])
  const gruntLists = useMemo(() => gruntsByHost(characters), [characters])
  // One shape object for each character until the characters change, so a tray gets the same `slot` array
  const shapes = useMemo(
    () => new Map(characters.map((ch) => [ch.id, trayShapeOf(ch, characters, gruntLists)])),
    [characters, gruntLists],
  )
  const trayShape = useCallback(
    (ch) => shapes.get(ch.id) ?? trayShapeOf(ch, characters, gruntLists),
    [shapes, characters, gruntLists],
  )
  return { trayPositions, gruntLists, trayShape }
}
