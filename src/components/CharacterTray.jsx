import { useRef } from 'react'
import { Html, useTexture } from '@react-three/drei'
import { DoubleSide } from 'three'
import { assetUrl } from '../assets/index.js'
import { characterCard } from '../characters/files.js'
import { characterName, characterStamina } from '../characters/roster.js'
import { TRAY_CARD_HEIGHT, TRAY_CARD_WIDTH, TRAY_CONTROLS_DEPTH, trayPosition, trayYaw } from '../characters/trays.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import TrayControls from './TrayControls.jsx'

// Local offset of the card inside the tray group, before the group's own yaw: the controls strip
// sits on the owner's side of the tray, so the card sits half that depth toward the opposite
// edge, the same -Z direction as the card's own top (see trays.js, trayYaw).
const CARD_Z = -TRAY_CONTROLS_DEPTH / 2
const LABEL_GAP = 0.3
// Center of the controls strip: the half of the tray the card does not occupy, on the owner's
// side (local +Z, see trays.js, trayYaw).
const CONTROLS_Z = CARD_Z + TRAY_CARD_HEIGHT / 2 + TRAY_CONTROLS_DEPTH / 2

function otherSide(side) {
  return side === 'healthy' ? 'injured' : 'healthy'
}

// One character tray: the stat card (the side that faces up), the character's name, and the
// controls strip (see TrayControls.jsx). No collider yet (see docs/characters-hud.md, Phase 1).
// A click on the card opens it in the popup (see CardPopup.jsx).
// objectRef: the card mesh, so Scene's characterAt can hit the tray, the same way it hits the
// model (see docs/characters-hud.md, "Give tokens by drag and drop"). The same mesh is also the
// outline target: selected highlights the tray, the same way CharacterModel.jsx highlights a
// selected model (see useOutline below).
// heldTokens: this character's held crisis tokens (see "Hold and drop"). onTokenDrop(tokenId): the
// tray's Held chip for one of them. onSelect: a click on the name selects the model (Phase 7).
export default function CharacterTray({ character, index, onOpen, onDamage, onPower, onFlip, onRemove, onTokenRemove, onTokenDragStart, heldTokens, onTokenDrop, selected = false, onSelect, objectRef }) {
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
      <mesh position={[0, 0, CARD_Z]} rotation={[-Math.PI / 2, 0, 0]} onClick={openPopup} ref={setCardRef}>
        <planeGeometry args={[TRAY_CARD_WIDTH, TRAY_CARD_HEIGHT]} />
        <meshStandardMaterial map={map} roughness={1} side={DoubleSide} />
      </mesh>
      {/* A click selects the model (not the tray itself, which has no Rapier body): the same
          selection the model's own click sets, so this is just another way to set it. */}
      <Html
        position={[0, 0.02, CARD_Z - TRAY_CARD_HEIGHT / 2 - LABEL_GAP]}
        center
        zIndexRange={[100, 0]}
        className="tray-label"
        onClick={e => { e.stopPropagation(); onSelect() }}
      >
        {name}
      </Html>
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
