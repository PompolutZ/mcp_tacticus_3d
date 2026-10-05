import { Suspense, useRef } from 'react'
import { Html, useTexture } from '@react-three/drei'
import { DoubleSide } from 'three'
import { assetUrl } from '../assets/index.js'
import { characterCard } from '../characters/files.js'
import { characterGiveTokens, characterStamina } from '../characters/roster.js'
import {
  TRAY_BG_DEPTH,
  TRAY_BG_WIDTH,
  TRAY_BG_Y,
  TRAY_CARD_HEIGHT,
  TRAY_CARD_LOCAL_Z,
  TRAY_CARD_WIDTH,
  TRAY_CONTROLS_LOCAL_Z,
  trayGiveTokenPosition,
  trayOnTokenPosition,
  trayYaw,
} from '../characters/trays.js'
import { outlineMode, useOutline } from './SelectionOutlines.jsx'
import TokenFace from './TokenFace.jsx'
import TrayControls from './TrayControls.jsx'

// Every character's Give sources start with Activated and Dazed (characterGiveTokens adds only the
// character-specific tokens, see migrate-characters.mjs: the mod spawns these next to every tray).
const ALWAYS_GIVEN = ['activated', 'dazed']
// Tokens lie at the tray's own height (TRAY_Y): the "On" row just above the background plate (see
// trays.js, TRAY_BG_Y), the Give sources just above the table, the same height as a token on the
// table (LooseToken.jsx).
const TOKEN_Y = 0
// A pointer that moved more than this many pixels between down and up was a drag, not a click on
// an "On" token or the card.
const CLICK_MOVE = 4

// One character tray: a background plate, the "On" row of tokens on the character, the stat card
// (the side that faces up), and the controls strip (see TrayControls.jsx). The Give sources are
// not part of the tray: they lie on the table on the owner's side of the plate, as in TTS, and
// move with the tray. The tokens are real size, as in TTS (see trays.js for the layout). No
// collider (see docs/characters-hud.md, Phase 1). A click on the card calls onOpen(): App opens
// the whole tray in a popup (see TrayPopup.jsx).
// objectRef: the background plate, so Scene's characterAt can hit the whole tray, the same way it
// hits the model (see docs/characters-hud.md, "Give tokens by drag and drop"). A token dropped
// anywhere on the tray goes to its character, as in TTS. A token dropped on the Give sources lies
// on the table, because they are outside the plate. The card mesh is the outline target:
// selected highlights the tray card, the same way CharacterModel.jsx highlights a selected model
// (see useOutline below). The model itself (spawned on the card) stays the usual way to select a
// character; the tray has no click target of its own for that.
// onTokenRemove(key): a click on an "On" token removes one. onTokenDragStart(nativeEvent, key): a
// left pointerdown on a Give source starts a drag of a new token (App.jsx, handleTokenDragStart).
// A source never runs out. The objective tokens the character holds lie on the card, but they are
// crisis tokens, so Scene.jsx draws them (see "Hold and drop").
// position: the tray's table position, from trays.js layoutTrays (Scene.jsx).
export default function CharacterTray({ character, position, onOpen, onDamage, onPower, onFlip, onRemove, onTokenRemove, onTokenDragStart, selected = false, objectRef }) {
  // Both sides load when the tray mounts, so the first Flip does not wait for an image (that wait
  // hides the tray, see Scene.jsx, Suspense). The order is fixed: the loader caches by the URL list.
  const [healthyMap, injuredMap] = useTexture([
    assetUrl(characterCard(character.key, 'healthy')),
    assetUrl(characterCard(character.key, 'injured')),
  ])
  const map = character.side === 'healthy' ? healthyMap : injuredMap
  const stamina = characterStamina(character.key, character.side)
  const yaw = trayYaw(character.teamColor)
  const cardRef = useRef()

  // R3F sends a click to every object that was under the pointer at pointerdown and is under it at
  // pointerup, also after a drag. The card lies under the model and the held tokens on it, so it
  // gets their clicks and the end of their drags too. Only a click on the card itself opens the popup.
  function openPopup(e) {
    e.stopPropagation()
    if (e.delta > CLICK_MOVE || e.intersections[0]?.object !== e.object) return
    onOpen()
  }

  useOutline(cardRef, outlineMode(selected, false))

  // Tokens on the character, in the order it got them (see App.jsx, handleCharacterTokenGive).
  const onTokens = Object.entries(character.tokens ?? {})
  const giveKeys = [...ALWAYS_GIVEN, ...characterGiveTokens(character.key)]

  function removeOnToken(e, key) {
    e.stopPropagation()
    if (e.delta > CLICK_MOVE) return
    onTokenRemove(key)
  }

  function startGive(e, key) {
    // Only the left button drags a token. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    onTokenDragStart(e.nativeEvent, key)
  }

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Background plate under every part, so the tray stands out from the table
          (docs/characters-hud.md, "One tray"). No collider, no shadow: it is purely visual. */}
      <mesh position={[0, TRAY_BG_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} ref={objectRef}>
        <planeGeometry args={[TRAY_BG_WIDTH, TRAY_BG_DEPTH]} />
        <meshStandardMaterial color="#20242b" roughness={1} />
      </mesh>
      <mesh position={[0, 0, TRAY_CARD_LOCAL_Z]} rotation={[-Math.PI / 2, 0, 0]} onClick={openPopup} ref={cardRef}>
        <planeGeometry args={[TRAY_CARD_WIDTH, TRAY_CARD_HEIGHT]} />
        <meshStandardMaterial map={map} roughness={1} side={DoubleSide} />
      </mesh>
      {/* "On" row above the card, where TTS shows the tokens on a character. Each token has its own
          Suspense: a new token image loads without hiding the tray. */}
      {onTokens.map(([key, count], i) => {
        const [x, z] = trayOnTokenPosition(i, onTokens.length)
        return (
          <group key={key} position={[x, TOKEN_Y, z]}>
            <Suspense fallback={null}>
              <TokenFace tokenKey={key} count={count} onClick={e => removeOnToken(e, key)} />
            </Suspense>
          </group>
        )
      })}
      {/* Give sources, on the table next to the plate. */}
      {giveKeys.map((key, i) => {
        const [x, z] = trayGiveTokenPosition(i)
        return (
          <group key={key} position={[x, TOKEN_Y, z]}>
            <Suspense fallback={null}>
              <TokenFace tokenKey={key} cursor="grab" onPointerDown={e => startGive(e, key)} />
            </Suspense>
          </group>
        )
      })}
      {/* Rx(-pi/2) lays the Html flat on the table facing up, with its top to local -Z, the same
          as the card. So the owner reads it the right way up. */}
      <group position={[0, 0.02, TRAY_CONTROLS_LOCAL_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <Html center transform>
          <TrayControls
            character={character}
            stamina={stamina}
            onDamage={onDamage}
            onPower={onPower}
            onFlip={onFlip}
            onRemove={onRemove}
          />
        </Html>
      </group>
    </group>
  )
}
