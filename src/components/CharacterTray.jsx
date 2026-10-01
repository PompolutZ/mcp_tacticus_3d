import { useRef } from 'react'
import { Html, useTexture } from '@react-three/drei'
import { DoubleSide } from 'three'
import { assetUrl } from '../assets/index.js'
import { characterCard } from '../characters/files.js'
import { characterName, characterStamina } from '../characters/roster.js'
import {
  TRAY_BG_DEPTH,
  TRAY_BG_WIDTH,
  TRAY_BG_Y,
  TRAY_CARD_HEIGHT,
  TRAY_CARD_LOCAL_Z,
  TRAY_CARD_WIDTH,
  TRAY_CONTROLS_DEPTH,
  trayPosition,
  trayYaw,
} from '../characters/trays.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import TrayControls from './TrayControls.jsx'

// The card's local z offset inside the tray group (see trays.js).
const CARD_Z = TRAY_CARD_LOCAL_Z
// Center of the controls strip: the half of the tray the card does not occupy, on the owner's
// side (local +Z, see trays.js, trayYaw).
const CONTROLS_Z = CARD_Z + TRAY_CARD_HEIGHT / 2 + TRAY_CONTROLS_DEPTH / 2

function otherSide(side) {
  return side === 'healthy' ? 'injured' : 'healthy'
}

// One character tray: a background plate, the stat card (the side that faces up), and the
// controls strip (see TrayControls.jsx). No collider (see docs/characters-hud.md, Phase 1).
// A click on the card opens it in the popup (see CardPopup.jsx).
// objectRef: the card mesh, so Scene's characterAt can hit the tray, the same way it hits the
// model (see docs/characters-hud.md, "Give tokens by drag and drop"). The same mesh is also the
// outline target: selected highlights the tray card, the same way CharacterModel.jsx highlights a
// selected model (see useOutline below). The model itself (now spawned on the card) stays the
// usual way to select a character; the tray has no click target of its own for that.
// heldTokens: this character's held crisis tokens (see "Hold and drop"). onTokenDrop(tokenId): the
// tray's Held chip for one of them.
export default function CharacterTray({ character, index, onOpen, onDamage, onPower, onFlip, onRemove, onTokenRemove, onTokenDragStart, heldTokens, onTokenDrop, selected = false, objectRef }) {
  const cardUrl = assetUrl(characterCard(character.key, character.side))
  const map = useTexture(cardUrl)
  const name = characterName(character.key)
  const stamina = characterStamina(character.key, character.side)
  const position = trayPosition(character.teamColor, index)
  const yaw = trayYaw(character.teamColor)
  const cardRef = useRef()

  function openPopup(e) {
    e.stopPropagation()
    // The popup can show the other side too, since players often read the Injured side while
    // the card is Healthy (see docs/characters-hud.md, "Card popup").
    const altSrc = assetUrl(characterCard(character.key, otherSide(character.side)))
    onOpen({ src: cardUrl, alt: name, altSrc, characterId: character.id })
  }

  // Forwards the card mesh both to Scene's trayObjects map (objectRef) and to this component's own
  // ref, which useOutline below needs to find its meshes.
  function setCardRef(mesh) {
    cardRef.current = mesh
    objectRef(mesh)
  }

  useOutline(cardRef, outlineMode(selected, false))

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Background plate under the card and the controls strip, so the tray stands out from the
          table (docs/characters-hud.md, "One tray"). No collider, no shadow: it is purely visual. */}
      <mesh position={[0, TRAY_BG_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRAY_BG_WIDTH, TRAY_BG_DEPTH]} />
        <meshStandardMaterial color="#20242b" roughness={1} />
      </mesh>
      <mesh position={[0, 0, CARD_Z]} rotation={[-Math.PI / 2, 0, 0]} onClick={openPopup} ref={setCardRef}>
        <planeGeometry args={[TRAY_CARD_WIDTH, TRAY_CARD_HEIGHT]} />
        <meshStandardMaterial map={map} roughness={1} side={DoubleSide} />
      </mesh>
      {/* Rx(-pi/2) lays the Html flat on the table facing up, with its top to local -Z, the same
          as the card. So the owner reads it the right way up. */}
      <group position={[0, 0.02, CONTROLS_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <Html center transform>
          <TrayControls
            character={character}
            stamina={stamina}
            onDamage={onDamage}
            onPower={onPower}
            onFlip={onFlip}
            onRemove={onRemove}
            onTokenRemove={onTokenRemove}
            onTokenDragStart={onTokenDragStart}
            heldTokens={heldTokens}
            onTokenDrop={onTokenDrop}
          />
        </Html>
      </group>
    </group>
  )
}
