import { Html } from '@react-three/drei'

// HTML that lies flat on the table, just above it. `rotation` is one of the two below.
// 1 CSS px of the HTML is this many inches on the table. drei Html with transform makes 1 CSS px
// distanceFactor / 400 world units.
const INCHES_PER_PX = 0.04

// Reads like the scoring board and the crisis cards (CrisisCard.jsx, CARD_ROTATION): the top of the HTML faces the
// table edge (-x), and its right faces -z. For the setup panel and the board strip.
export const BOARD_READ_ROTATION = [-Math.PI / 2, 0, Math.PI / 2]

// Faces the owner of a side, the same as the tray controls (CharacterTray.jsx): the top of the HTML faces the
// mat (-z for blue). Rx(-pi/2) lays the HTML flat. Red turns 180 deg around the vertical axis, which is a
// turn of 180 deg in the plane of the HTML before it is laid flat.
export const OWNER_FACING_ROTATION = {
  blue: [-Math.PI / 2, 0, 0],
  red: [-Math.PI / 2, 0, Math.PI],
}

// drei Html that lies flat on the table at `position`
export function OnTable({ position, rotation = BOARD_READ_ROTATION, children }) {
  return (
    <group position={position} rotation={rotation}>
      <Html center transform distanceFactor={INCHES_PER_PX * 400}>
        {children}
      </Html>
    </group>
  )
}
