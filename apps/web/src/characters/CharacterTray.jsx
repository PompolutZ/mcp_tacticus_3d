import { Suspense, useRef, useState } from 'react'
import { UI_COLORS } from '../uiColors.js'
import { OccludedHtml } from '../scene/LabelOcclusion.jsx'
import { DoubleSide } from 'three'
import { assetUrl } from '../assets/index.js'
import { trayCardFile } from './files.js'
import { trayCards } from './models.js'
import { characterGiveSources, characterName, characterStamina } from './characters.js'
import {
  GRUNT_CARD_HEIGHT,
  GRUNT_CARD_LOCAL_Z,
  GRUNT_CARD_WIDTH,
  GRUNT_CONTROLS_LOCAL_Z,
  TRAY_BG_Y,
  TRAY_CARD_HEIGHT,
  TRAY_CARD_WIDTH,
  trayCardLocalZ,
  trayControlsLocalZ,
  trayGiveTokenPosition,
  trayGruntOnTokenPosition,
  trayOnTokenPosition,
  trayPlate,
  trayYaw,
} from './trays.js'
import { outlineMode, useOutline } from '../scene/SelectionOutlines.jsx'
import FaceMaterial from '../scene/FaceMaterial.jsx'
import TokenFace from '../tokens/TokenFace.jsx'
import TrayControls from './TrayControls.jsx'
import { useColorTexture } from '../scene/useColorTexture.js'
import { useHoverCursor, useHoverPeek, useHoverReport } from '../scene/useHoverCursor.js'
import { useRenderCount } from '../debug/renderCount.js'

// Tokens lie at the tray's own height (TRAY_Y): the "On" row just above the background plate (see
// trays.js, TRAY_BG_Y), the Give sources just above the table, the same height as a token on the
// table (LooseToken.jsx).
const TOKEN_Y = 0
// A pointer that moved more than this many pixels between down and up was a drag, not a click on
// an "On" token or the card.
const CLICK_MOVE = 4

// One character tray: a background plate, the "On" row of tokens on the character, the stat card
// (the side that faces up), and the controls strip (see TrayControls.jsx). A character whose second
// form has its own card (Ant-Man) has that card under the first one, with the same side up, so
// Flip turns both (see docs/features/character-trays.md, "Second forms"). The Give sources are
// not part of the tray: they lie on the table on the owner's side of the plate, as in TTS, and
// move with the tray. The tokens are real size, as in TTS (see trays.js for the layout). No
// collider (see docs/features/character-trays.md, "One tray"). A click on the card calls onOpen(): App opens
// the whole tray in a popup (see TrayPopup.jsx).
// objectRef: the background plate, so Scene's characterAt can hit the whole tray, the same way it
// hits the model (see docs/features/character-trays.md, "Give tokens by drag and drop"). A token dropped
// anywhere on the tray goes to its character, as in TTS. A token dropped on the Give sources lies
// on the table, because they are outside the plate. The card mesh is the outline target:
// selected highlights the tray card, the same way CharacterModel.jsx highlights a selected model
// (see useOutline below). The model itself (spawned on the card) stays the usual way to select a
// character; the tray has no click target of its own for that.
// onAttachedOpen(code): a click on a gem chip (TrayControls.jsx).
// onTokenRemove(key): a click on an "On" token removes one. onTokenDragStart(nativeEvent, key): a
// left pointerdown on a Give source starts a drag of a new token (drag/useTokenDrag.js, handleTokenDragStart).
// A source never runs out. The objective tokens the character holds lie on the card, but they are
// crisis tokens, so Scene.jsx draws them (see "Hold and drop").
// position: the tray's table position, from trays.js layoutTrays (Scene.jsx).
// onCardHover(over): the pointer moved onto (true) or off (false) the card, for the F key.
// onCardImageHover(card, over): the same, with the image under the pointer, { src, alt, by }, for Alt (useCardPeek.js).
// onTokenDragStart gets the id of the character as the 4th argument: a click on a Give source gives
// that character one token.
// affiliation: the affiliation key of the owner's side, for its Give source (characters.js, characterGiveSources).
// grunts: the number of grunt cards on the tray of a host, 0 for none: the plate and the Give sources
// follow it (trays.js). A grunt (character.host) has no plate and no Give sources: the host's tray draws
// its card, On row and controls strip at `slot`, the start of its unit on the host tray (trays.js,
// trayGruntSlot). The grunt card is portrait (trays.js, GRUNT_CARD_WIDTH). A grunt's card has only the Healthy side, and its controls have no Power and no Flip
// (docs/features/character-trays.md, "Grunts"). The grunt's position is the host's.
export default function CharacterTray({
  character,
  position,
  onOpen,
  onDamage,
  onPower,
  onFlip,
  onCardHover,
  onCardImageHover,
  onRemove,
  onBoard,
  removeWait = null,
  onAttachedOpen,
  onTokenRemove,
  onTokenDragStart,
  selected = false,
  objectRef,
  grunts = 0,
  affiliation = null,
  slot = [0, 0],
}) {
  useRenderCount('CharacterTray')
  // Both sides of every card load when the tray mounts, so the first Flip does not wait for an image
  // (that wait hides the tray, see Scene.jsx, Suspense). The order is fixed: the loader caches by
  // the URL list.
  const isGrunt = Boolean(character.host)
  const cards = trayCards(character)
  const cardNumbers = cards === 2 ? [1, 2] : [1]
  const cardFile = (n, side) => trayCardFile(character.key, side, n)
  const sides = isGrunt ? ['healthy'] : ['healthy', 'injured']
  const maps = useColorTexture(
    cardNumbers.flatMap((n) => sides.map((side) => assetUrl(cardFile(n, side)))),
  )
  const sideMap = (n) =>
    maps[(n - 1) * sides.length + (character.side === 'injured' && !isGrunt ? 1 : 0)]
  const plate = trayPlate(cards, grunts)
  const stamina = characterStamina(character.key, character.side)
  const yaw = trayYaw(character.team)
  // Group of the cards, the outline target
  const cardRef = useRef()
  // The number of the card under the pointer (1 or 2), or null
  const [hoveredCard, setHoveredCard] = useState(null)
  const cardHovered = hoveredCard !== null

  // R3F sends a click to every object that was under the pointer at pointerdown and is under it at
  // pointerup, also after a drag. The card lies under the model and the held tokens on it, so it
  // gets their clicks and the end of their drags too. Only a click on the card itself opens the popup.
  function openPopup(e) {
    e.stopPropagation()
    if (e.delta > CLICK_MOVE || e.intersections[0]?.object !== e.object) return
    onOpen()
  }

  // Selected or under the pointer. A click on the card opens the popup.
  useOutline(cardRef, outlineMode(selected, cardHovered))
  useHoverCursor(cardHovered, 'pointer')

  // onCardHover(true) while the pointer is over the card, onCardHover(false) after. The cleanup also
  // runs on unmount, so a removed tray does not stay hovered. The model and the held tokens on the
  // card stop their own pointerover, so the card is not hovered while the pointer is over them.
  useHoverReport(cardHovered, onCardHover)

  // The same for Alt: the image of the card under the pointer, the side that faces up. A Flip shows the new side.
  useHoverPeek(
    hoveredCard !== null,
    () => {
      const name = characterName(character.key)
      return {
        src: assetUrl(cardFile(hoveredCard, character.side)),
        alt: hoveredCard === 2 ? `${name}, second form` : name,
        by: `tray:${character.id}:${hoveredCard}`,
      }
    },
    onCardImageHover,
    `${hoveredCard}:${character.side}`,
  )

  // Tokens on the character, in the order it got them (see characters/actions.js, giveToken).
  const onTokens = Object.entries(character.tokens ?? {})
  const giveKeys = characterGiveSources(character.key, affiliation)

  function removeOnToken(e, key) {
    e.stopPropagation()
    if (e.delta > CLICK_MOVE) return
    onTokenRemove(key)
  }

  function startGive(e, key) {
    // Only the left button drags a token. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    onTokenDragStart(e.nativeEvent, key, null, character.id)
  }

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Background plate under every part, so the tray stands out from the table
          (docs/features/character-trays.md, "One tray"). No collider, no shadow: it is purely visual. */}
      {!isGrunt && (
        <mesh
          position={[plate.x, TRAY_BG_Y, plate.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          ref={objectRef}
        >
          <planeGeometry args={[plate.width, plate.depth]} />
          <meshStandardMaterial color={UI_COLORS.trayPlate} roughness={1} />
        </mesh>
      )}
      <group position={[slot[0], 0, slot[1]]}>
        <group
          ref={(obj) => {
            cardRef.current = obj
            // A grunt has no plate, so its card is what a dropped token finds (useModelRegistry.js, characterAt)
            if (isGrunt) objectRef?.(obj)
          }}
        >
          {cardNumbers.map((n) => (
            <mesh
              key={n}
              position={[0, 0, isGrunt ? GRUNT_CARD_LOCAL_Z : trayCardLocalZ(n)]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={openPopup}
              onPointerOver={(e) => {
                e.stopPropagation()
                setHoveredCard(n)
              }}
              onPointerOut={() => setHoveredCard((now) => (now === n ? null : now))}
            >
              <planeGeometry
                args={
                  isGrunt
                    ? [GRUNT_CARD_WIDTH, GRUNT_CARD_HEIGHT]
                    : [TRAY_CARD_WIDTH, TRAY_CARD_HEIGHT]
                }
              />
              <FaceMaterial map={sideMap(n)} side={DoubleSide} />
            </mesh>
          ))}
        </group>
        {/* "On" row above the card, where TTS shows the tokens on a character. Each token has its own
          Suspense: a new token image loads without hiding the tray. */}
        {onTokens.map(([key, count], i) => {
          const [x, z] = isGrunt
            ? trayGruntOnTokenPosition(i, onTokens.length)
            : trayOnTokenPosition(i, onTokens.length)
          return (
            <group key={key} position={[x, TOKEN_Y, z]}>
              <Suspense fallback={null}>
                <TokenFace tokenKey={key} count={count} onClick={(e) => removeOnToken(e, key)} />
              </Suspense>
            </group>
          )
        })}
        {/* Give sources, on the table next to the plate. */}
        {!isGrunt &&
          giveKeys.map((key, i) => {
            const [x, z] = trayGiveTokenPosition(i, cards, grunts)
            return (
              <group key={key} position={[x, TOKEN_Y, z]}>
                <Suspense fallback={null}>
                  <TokenFace
                    tokenKey={key}
                    cursor="grab"
                    onPointerDown={(e) => startGive(e, key)}
                  />
                </Suspense>
              </group>
            )
          })}
        {/* Rx(-pi/2) lays the Html flat on the table facing up, with its top to local -Z, the same
          as the card. So the owner reads it the right way up. */}
        <group
          position={[0, 0.02, isGrunt ? GRUNT_CONTROLS_LOCAL_Z : trayControlsLocalZ(cards)]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <OccludedHtml center transform>
            <TrayControls
              character={character}
              stamina={stamina}
              onDamage={onDamage}
              onPower={onPower}
              onFlip={onFlip}
              onRemove={onRemove}
              onBoard={onBoard}
              removeWait={removeWait}
              onAttachedOpen={onAttachedOpen}
            />
          </OccludedHtml>
        </group>
      </group>
    </group>
  )
}
