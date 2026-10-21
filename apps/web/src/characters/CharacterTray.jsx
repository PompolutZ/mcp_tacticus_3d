import { Suspense, memo, useCallback, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { UI_COLORS } from '../uiColors.js'
import { startPointerDrag } from '../drag/pointerDrag.js'
import { DoubleSide } from 'three'
import { assetUrl } from '../assets/index.js'
import { trayCardFile } from './files.js'
import { modelCharacterId, trayCards } from './models.js'
import { characterGiveSources, characterName, characterStamina } from './characters.js'
import {
  GRUNT_CARD_HEIGHT,
  GRUNT_CARD_LOCAL_Z,
  GRUNT_CARD_WIDTH,
  GRUNT_CONTROLS_LOCAL_Z,
  TRAY_CONTROLS_DEPTH,
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
import TrayStrip3D from './TrayStrip3D.jsx'
import { CLICK_MOVE } from './trayControls.js'
import { useColorTexture } from '../scene/useColorTexture.js'
import useFlipTurn, { flipLift } from '../scene/useFlipTurn.js'
import { useHoverCursor, useHoverPeek, useHoverReport } from '../scene/useHoverCursor.js'
import { useRenderCount } from '../debug/renderCount.js'
import { useTableStore } from '../table/TableStoreContext.jsx'

// Tokens lie at the tray's own height (TRAY_Y): the "On" row just above the background plate (see
// trays.js, TRAY_BG_Y), the Give sources just above the table, the same height as a token on the
// table (LooseToken.jsx).
const TOKEN_Y = 0

// One stat card: a flip group with two single-sided planes, healthy up and injured down. A Flip turns it
// around its long side (local x), the same as a Team Tactic card (useFlipTurn.js), and lifts it so its
// edges stay above the table. A model on the card may pass through it during the turn. A grunt card
// (no backMap) has one plane and never turns. The group holds the pointer props, so a hit on either
// plane reaches them. z: the card's place on the tray.
function TrayCard({ z, width, height, frontMap, backMap, flipped, events }) {
  const turn = useFlipTurn(flipped)
  const groupRef = useRef()
  useFrame((_, dt) => {
    const angle = turn.step(dt)
    if (!groupRef.current) return
    groupRef.current.rotation.x = angle
    groupRef.current.position.y = flipLift(angle, height)
  })
  return (
    <group ref={groupRef} position={[0, 0, z]} {...events}>
      {/* Rx(-pi/2) lays the face flat, facing up, with its top to local -z */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <FaceMaterial map={frontMap} side={backMap ? undefined : DoubleSide} />
      </mesh>
      {/* Rx(pi/2) lays the back flat, facing down, with its top to local +z. After a turn of pi around x,
          it lies the same way as the face. */}
      {backMap && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, height]} />
          <FaceMaterial map={backMap} />
        </mesh>
      )}
    </group>
  )
}

// One character tray: a background plate, the "On" row of tokens on the character, the stat card
// (the side that faces up), and the controls strip (see TrayStrip3D.jsx). A character whose second
// form has its own card (Ant-Man) has that card under the first one, with the same side up, so
// Flip turns both (see docs/features/character-trays.md, "Second forms"). The Give sources are
// not part of the tray: they lie on the table on the owner's side of the plate, as in TTS, and
// move with the tray. The tokens are real size, as in TTS (see trays.js for the layout). No
// collider (see docs/features/character-trays.md, "One tray"). A click on the card calls the action onTrayOpen: App opens
// the whole tray in a popup (see TrayPopup.jsx). The actions come from the table store (table/tableStore.js).
// objects: a ref to a Map, character id → the background plate, so Scene's characterAt can hit the whole tray, the same way it
// hits the model (see docs/features/character-trays.md, "Give tokens by drag and drop"). A token dropped
// anywhere on the tray goes to its character, as in TTS. A token dropped on the Give sources lies
// on the table, because they are outside the plate. The card mesh is the outline target:
// selected highlights the tray card, the same way CharacterModel.jsx highlights a selected model
// (see useOutline below). The model itself (spawned on the card) stays the usual way to select a
// character; the tray has no click target of its own for that.
// Actions: onAttachedOpen(code) (a click on a gem chip, TrayStrip3D.jsx), characters.removeToken(id, key) (a click on an "On"
// token removes one), onTokenDragStart(nativeEvent, key, looseId, giveId) (a left pointerdown on a Give source starts a drag of
// a new token, drag/useTokenDrag.js, handleTokenDragStart).
// A source never runs out. The objective tokens the character holds lie on the card, but they are
// crisis tokens, so Scene.jsx draws them (see "Hold and drop").
// position: the tray's table position, from trays.js layoutTrays (Scene.jsx).
// onTrayCardHover(id, over): the pointer moved onto (true) or off (false) the card, for the F key. onCardHover(card, over): the same, with
// the image under the pointer, { src, alt, by }, for Alt (useCardPeek.js).
// onTokenDragStart gets the id of the character as the 4th argument: a click on a Give source gives
// that character one token.
// affiliation: the affiliation key of the owner's side, for its Give source (characters.js, characterGiveSources).
// grunts: the number of grunt cards on the tray of a host, 0 for none: the plate and the Give sources
// follow it (trays.js). A grunt (character.host) has no plate and no Give sources: the host's tray draws
// its card, On row and controls strip at `slot`, the start of its unit on the host tray (trays.js,
// trayGruntSlot). The grunt card is portrait (trays.js, GRUNT_CARD_WIDTH). A grunt's card has only the Healthy side, and its controls have no Power and no Flip
// (docs/features/character-trays.md, "Grunts"). The grunt's position is the host's.
export default memo(function CharacterTray({
  character,
  position,
  onBoard,
  removeWait = null,
  objects,
  grunts = 0,
  affiliation = null,
  slot = [0, 0],
}) {
  useRenderCount('CharacterTray')
  // The same function while the map and the character stay, so a render of the parent does not move the ref
  const objectRef = useCallback(
    (obj) => (obj ? objects.current.set(character.id, obj) : objects.current.delete(character.id)),
    [objects.current, character.id],
  )
  // The plate is also the outline target of a tray swap drag (below)
  const plateRef = useRef()
  const setPlate = useCallback(
    (obj) => {
      plateRef.current = obj
      objectRef(obj)
    },
    [objectRef],
  )
  const actions = useTableStore((s) => s.actions)
  const table = useTableStore((s) => s.table)
  const playedSides = useTableStore((s) => s.playedSides)
  const controlsRef = useTableStore((s) => s.controlsRef)
  // Swap drag (startSwap): this tray is the dragged one, or the own tray under the pointer
  const swapId = character.host ?? character.id
  const swapDragged = useTableStore((s) => s.trayDrag?.id === swapId)
  const swapTarget = useTableStore((s) => !character.host && s.trayDrag?.over === character.id)
  // The tray card shows the selection of its character's model too
  const selected = useTableStore((s) =>
    s.selection.some((p) => p.kind === 'character' && modelCharacterId(p.id) === character.id),
  )
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
  // Map of card n: side 0 is healthy, 1 is injured
  const cardMap = (n, side) => maps[(n - 1) * sides.length + side]
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
    actions.onTrayOpen(character.id)
  }

  // Left press on the card of an own tray: a drag onto another own tray swaps the two trays (docs/features/
  // character-trays.md, "Swap trays"). A press that does not move is a click (popup). The camera is off during the
  // press. The target is the tray plate under the pointer (characterAt), of the same player. Esc cancels.
  function startSwap(e) {
    if (e.button !== 0 || !playedSides.includes(character.team)) return
    e.stopPropagation()
    const targetAt = (ev) => {
      if (!document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.scene-root')) return null
      const found = actions.findCharacterAt(ev.clientX, ev.clientY, { models: false })
      const list = table.characters.read()
      const hit = list.find((c) => c.id === found)
      const hostId = hit?.host ?? hit?.id
      const host = list.find((c) => c.id === hostId)
      return host && host.id !== swapId && host.team === character.team ? host.id : null
    }
    startPointerDrag(e.nativeEvent, {
      controls: controlsRef.current,
      canvas: e.nativeEvent.target,
      onStart: () => actions.setTrayDrag({ id: swapId, over: null }),
      onMove: (ev) => {
        const over = targetAt(ev)
        actions.setTrayDrag((prev) => (prev && prev.over !== over ? { ...prev, over } : prev))
      },
      onEnd: (ev) => {
        const over = targetAt(ev)
        actions.setTrayDrag(null)
        if (over) actions.characters.swap(swapId, over)
      },
      onCancel: () => actions.setTrayDrag(null),
    })
  }

  // Selected or under the pointer. A click on the card opens the popup. The tray under a swap drag is
  // selected, the target is green.
  useOutline(cardRef, outlineMode(selected || swapDragged, cardHovered))
  useOutline(plateRef, swapTarget ? 'inRange' : null)
  useHoverCursor(cardHovered, 'pointer')

  // onCardHover(true) while the pointer is over the card, onCardHover(false) after. The cleanup also
  // runs on unmount, so a removed tray does not stay hovered. The model and the held tokens on the
  // card stop their own pointerover, so the card is not hovered while the pointer is over them.
  useHoverReport(cardHovered, (over) => actions.onTrayCardHover(character.id, over))

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
    actions.onCardHover,
    `${hoveredCard}:${character.side}`,
  )

  // Tokens on the character, in the order it got them (see characters/actions.js, giveToken).
  const onTokens = Object.entries(character.tokens ?? {})
  const giveKeys = characterGiveSources(character.key, affiliation)

  function removeOnToken(e, key) {
    e.stopPropagation()
    if (e.delta > CLICK_MOVE) return
    actions.characters.removeToken(character.id, key)
  }

  function startGive(e, key) {
    // Only the left button drags a token. A right or middle drag goes to OrbitControls (the camera).
    if (e.button !== 0) return
    e.stopPropagation()
    actions.onTokenDragStart(e.nativeEvent, key, null, character.id)
  }

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Background plate under every part, so the tray stands out from the table
          (docs/features/character-trays.md, "One tray"). No collider, no shadow: it is purely visual. */}
      {!isGrunt && (
        <mesh
          position={[plate.x, TRAY_BG_Y, plate.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          ref={setPlate}
        >
          <planeGeometry args={[plate.width, plate.depth]} />
          <meshStandardMaterial color={UI_COLORS.trayPlate} roughness={1} />
        </mesh>
      )}
      {/* A grunt has no plate, so its unit (card, On row, controls strip) is what a dropped token finds
          (useModelRegistry.js, characterAt) */}
      <group position={[slot[0], 0, slot[1]]} ref={isGrunt ? objectRef : undefined}>
        <group ref={cardRef}>
          {cardNumbers.map((n) => (
            <TrayCard
              key={n}
              z={isGrunt ? GRUNT_CARD_LOCAL_Z : trayCardLocalZ(n)}
              width={isGrunt ? GRUNT_CARD_WIDTH : TRAY_CARD_WIDTH}
              height={isGrunt ? GRUNT_CARD_HEIGHT : TRAY_CARD_HEIGHT}
              frontMap={cardMap(n, 0)}
              backMap={isGrunt ? undefined : cardMap(n, 1)}
              flipped={character.side === 'injured' && !isGrunt}
              events={{
                onClick: openPopup,
                onPointerDown: startSwap,
                onPointerOver: (e) => {
                  e.stopPropagation()
                  setHoveredCard(n)
                },
                onPointerOut: () => setHoveredCard((now) => (now === n ? null : now)),
              }}
            />
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
        {/* Rx(-pi/2) lays the strip flat on the table facing up, with its top to local -Z, the same as
          the card. So the owner reads it the right way up. The strip is drawn in the canvas, so a model
          that stands on the card hides it (TrayStrip3D.jsx). On a plate tray the plate under it is the
          drop target. A grunt has none, so an invisible plane under its strip is. */}
        <group
          position={[0, 0.02, isGrunt ? GRUNT_CONTROLS_LOCAL_Z : trayControlsLocalZ(cards)]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {isGrunt && (
            <mesh visible={false}>
              <planeGeometry args={[GRUNT_CARD_WIDTH, TRAY_CONTROLS_DEPTH]} />
            </mesh>
          )}
          <TrayStrip3D
            character={character}
            stamina={stamina}
            onDamage={(damage) => actions.characters.damage(character.id, damage)}
            onPower={(power) => actions.characters.power(character.id, power)}
            onFlip={() => actions.characters.flip(character.id)}
            onRemove={() => actions.characters.offBoard(character.id)}
            onBoard={onBoard}
            removeWait={removeWait}
            onAttachedOpen={actions.onAttachedOpen}
          />
        </group>
      </group>
    </group>
  )
})
