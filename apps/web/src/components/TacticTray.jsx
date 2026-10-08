import {
  TACTIC_CARD_HEIGHT,
  TACTIC_CARD_WIDTH,
  TACTIC_CARD_Y,
  TACTIC_PLATE_DEPTH,
  TACTIC_PLATE_WIDTH,
  TACTIC_PLATE_Y,
  TACTIC_SLOTS,
  tacticSlotPosition,
  tacticTrayPosition,
} from '../tactics/layout.js'

// Same color as a character tray's plate (CharacterTray.jsx). A slot is a little lighter.
const PLATE_COLOR = '#20242b'
const SLOT_COLOR = '#2f3540'
// Between the plate and the cards, so a card in the slot hides it
const SLOT_Y = (TACTIC_PLATE_Y + TACTIC_CARD_Y) / 2
const NO_RAYCAST = () => null

// The tactic tray of one player: a plate next to the mat edge with 5 card-sized slots (see
// tactics/layout.js and docs/feature-team-tactic-cards.md, "Tactic tray"). The cards are not part of
// the tray: Scene.jsx draws them (TacticCard.jsx), so a card can also lie anywhere on the table.
// No collider and no pointer events, the same as a character tray's plate.
export default function TacticTray({ team }) {
  const tray = tacticTrayPosition(team)
  const slots = Array.from({ length: TACTIC_SLOTS }, (_, i) => tacticSlotPosition(team, i))

  return (
    <group>
      <mesh position={[tray.x, TACTIC_PLATE_Y, tray.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
        <planeGeometry args={[TACTIC_PLATE_WIDTH, TACTIC_PLATE_DEPTH]} />
        <meshStandardMaterial color={PLATE_COLOR} roughness={1} />
      </mesh>
      {slots.map((slot, i) => (
        <mesh key={i} position={[slot.x, SLOT_Y, slot.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
          <planeGeometry args={[TACTIC_CARD_WIDTH, TACTIC_CARD_HEIGHT]} />
          <meshStandardMaterial color={SLOT_COLOR} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
