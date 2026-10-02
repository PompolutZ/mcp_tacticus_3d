import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector3 } from 'three'
import { useTexture, Stars, Environment } from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { MovementRuler, RangeRuler, DeployRangeTool, RANGE_TIP } from './RulerTool.jsx'
import CharacterModel from './CharacterModel.jsx'
import Character from './Character.jsx'
import CharacterTray from './CharacterTray.jsx'
import Terrain from './Terrain.jsx'
import CrisisCard from './CrisisCard.jsx'
import CrisisToken from './CrisisToken.jsx'
import DiceTray from './DiceTray.jsx'
import { projectFootprints } from './footprintProjection.js'
import { matImage } from '../terrain/files.js'
import { characterModel, characterStandee, BASE_DIAMETER } from '../characters/files.js'
import { MAPS } from '../terrain/maps.js'
import { FRICTION, WORLD_GRAVITY } from '../physics.js'
import { assetUrl } from '../assets/index.js'
import { CARD_X, CARD_Y, CARD_Z } from '../crisis/layout.js'
import { TRAYS } from '../dice/tray.js'
import { layoutTrays, onTray, trayModelPosition } from '../characters/trays.js'
import { TABLE_COLLIDER_HALF_H, TABLE_DEPTH, TABLE_WALLS, TABLE_WIDTH } from '../table.js'

// MCP mat is 36" x 36". 1 Three.js unit = 1 inch. Table size: see table.js.
const MAT_SIZE = 36
const TABLE_THICKNESS = 0.5
// The table image of the TTS mod (its TableURL). The image is 3:2, the same as the TTS table. The app table is
// deeper (table.js), so the image fills the table depth and its left and right ends are cut off. The planks
// keep their shape.
function fitTableTexture(texture) {
  const repeatX = (TABLE_WIDTH / TABLE_DEPTH) / (texture.image.width / texture.image.height)
  texture.repeat.set(repeatX, 1)
  texture.offset.set((1 - repeatX) / 2, 0)
}
// Tools hang this far above the table and measure by the outline cast below them
const TOOL_HOVER_HEIGHT = 1
// Two physics steps per frame. With one, a model dropped from high up sometimes gets stuck in terrain.
const TIME_STEP = 1 / 120

// mapId: key in MAPS
// showColliders: draw every physics collider as lines (the shapes physics uses, not the visible meshes)
// showLabels: show the piece name and game Size above each terrain piece
// matTurns: number of 90° counter-clockwise turns of the mat and its terrain
// crisis: { secure, extract } chosen card keys. tokens: every crisis token on the table (see App.jsx).
// selection: { kind: 'character' | 'token', id } | null, lifted to App so a character and a token
// share one selection. onSelectionChange: the setter, called with a value or an updater function.
// onPieceHover(piece, over): the pointer moved onto (true) or off (false) a character or a token,
// piece as { kind, id }. toolSpawns: { range, move }, a count that changes when App spawns that tool
// again. It is part of the tool key, so the tool mounts again and snaps to the selection.
// selectedTool: 'range' | 'move' | null, lifted to App with its setter onSelectedToolChange.
// One tool can be selected at the same time as a character or a token.
// onCharacterDamage(id, damage), onCharacterPower(id, power), onCharacterFlip(id): the tray's
// controls, lifted to App the same way as the token handlers above (see TrayControls.jsx).
// onCharacterRemove(id): the tray's Remove button, after its own confirmation.
// onCharacterTokenRemove(id, key): a click on a chip in the tray's "On" row.
// onTokenDragStart(e, key): pointerdown on a chip in the tray's "Give" row, the same handler the
// Tokens panel uses (see App.jsx, handleTokenDragStart).
// diceMenu: the open face menu of a dice tray, { trayKey, symbol } | null, lifted to App so Escape
// can close it. onDiceMenuToggle(trayKey, symbol), onDiceMenuClose(): see DiceKeys.jsx.
// characterAtRef: ref App calls with (clientX, clientY) to find the character under the pointer,
// the same pattern as bodyRef. Scene fills it with its own characterAt (3D only: the model
// or the tray's card mesh), used by App's findCharacterAt below.
// findCharacterAt(clientX, clientY): App's own lookup, the DOM tray controls (data-character-id)
// first, then characterAtRef's characterAt. Passed back down so CrisisToken.jsx's Extract-token
// release (Phase 7) uses the same lookup as App's token drag, instead of 3D-only characterAt, so a
// release over the tray's controls strip (DOM) counts too.
// modelPositionRef: ref App calls with a character id to get its live table position { x, z }
// (Rapier body or model object, not the spawn position), or null. Used by App's handleTokenDrop, the
// same pattern as characterAtRef. See "Hold and drop".
// onTokenHold(tokenId, characterId): a canHold token was released over a character. onTokenDrop(id):
// the tray's Held chip for that token, see TrayControls.jsx.
export default function Scene({
  mapId, characters = [], activeRange, activeMove, showColliders = false, showLabels = false, matTurns = 0, deployLine = false,
  crisis = { secure: null, extract: null }, tokens = [], selection = null, onSelectionChange, selectedTool = null, onSelectedToolChange, onPieceHover, toolSpawns = { range: 0, move: 0 }, onTokenMove, onTokenTurn, onTokenHold, onTokenDrop, onCharacterDamage, onCharacterPower, onCharacterFlip, onCharacterRemove, onCharacterTokenRemove, onTokenDragStart, onCardOpen, diceMenu = null, onDiceMenuToggle, onDiceMenuClose, characterAtRef, findCharacterAt, modelPositionRef,
}) {
  const map = MAPS[mapId]
  const matTexture = useTexture(assetUrl(matImage(map.mat)))
  const tableTexture = useTexture(assetUrl('table.webp'), fitTableTexture)
  const { camera, gl } = useThree()
  // Character id → Rapier body. Tools read and move characters through it.
  const charBodies = useRef(new Map())
  // Character id → 3D object. Tools find the character under the pointer with it.
  const charObjects = useRef(new Map())
  // Character id → the tray's card mesh. characterAt below hits this too, so a drop on an empty
  // part of the tray still finds the character (see CharacterTray.jsx).
  const trayObjects = useRef(new Map())
  const raycaster = useRef(new Raycaster())
  // Token id → 3D object, and token id → live center getter. The same purpose as charBodies and
  // charObjects, but a token has no Rapier body (see CrisisToken.jsx).
  const tokenObjects = useRef(new Map())
  const tokenCenters = useRef(new Map())
  const [draggingCharId, setDraggingCharId] = useState(null)

  // Nearest character whose model or tray card is under the client point (DOM pixels), or null.
  function characterAt(clientX, clientY) {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    }
    raycaster.current.setFromCamera(ndc, camera)
    let nearestId = null
    let nearestDistance = Infinity
    for (const ch of characters) {
      for (const object of [charObjects.current.get(ch.id), trayObjects.current.get(ch.id)]) {
        const hit = object && raycaster.current.intersectObject(object, true)[0]
        if (hit && hit.distance < nearestDistance) {
          nearestId = ch.id
          nearestDistance = hit.distance
        }
      }
    }
    return nearestId
  }

  // Live table position of a character's model (Hold and drop, "Drop"): the Rapier body when there
  // is one, otherwise the 3D object's own position. Not the spawn position, so a character that moved
  // drops its token where it now stands. Returns null if neither is mounted yet.
  function modelPosition(id) {
    const body = charBodies.current.get(id)
    if (body) {
      const t = body.translation()
      return { x: t.x, z: t.z }
    }
    const object = charObjects.current.get(id)
    if (object) {
      const p = object.getWorldPosition(new Vector3())
      return { x: p.x, z: p.z }
    }
    return null
  }

  // Registered on every render, so the closures above always see the latest characters/objects.
  useEffect(() => {
    if (characterAtRef) characterAtRef.current = characterAt
    if (modelPositionRef) modelPositionRef.current = modelPosition
  })

  // Tray position of every character (trays.js). A player's row recenters when that player adds
  // or removes a character, so these positions change then.
  const trayPositions = useMemo(() => layoutTrays(characters), [characters])
  // Tray positions of the last layout, to find the trays that moved.
  const lastTrayPositions = useRef(new Map())
  // A model that still stands on its tray moves with the tray, the same as TTS (moveTray in the
  // tray script). A model that the player moved off its tray, for example onto the mat, stays.
  useEffect(() => {
    for (const [id, pos] of trayPositions) {
      const last = lastTrayPositions.current.get(id)
      const body = charBodies.current.get(id)
      if (!last || !body || (last[0] === pos[0] && last[2] === pos[2])) continue
      const t = body.translation()
      if (onTray(last, t)) body.setTranslation({ x: t.x + pos[0] - last[0], y: t.y, z: t.z + pos[2] - last[2] }, true)
    }
    lastTrayPositions.current = trayPositions
  }, [trayPositions])

  const selectedCharId = selection?.kind === 'character' ? selection.id : null
  const selectedTokenId = selection?.kind === 'token' ? selection.id : null

  // Deploy-line: R3 zone depth from the deployment edge
  const deployTip = RANGE_TIP[3]
  const deployDepth = 2 * deployTip
  const draggingChar = deployLine && draggingCharId ? characters.find(ch => ch.id === draggingCharId) : null

  // Every character and every mat token as the range and movement tools see them. A character has a
  // Rapier body; a token does not, so getCenter (not getBody) is what the tools measure with.
  // getBody is only used where a tool moves a piece (Place), and Place is disabled for a token.
  // A held token is not in this list: it is off the mat, on its holder's tray (see "Hold and drop").
  const matTokens = useMemo(() => tokens.filter(tok => !tok.heldBy), [tokens])
  const toolModels = useMemo(() => [
    ...characters.map(ch => ({
      kind: 'character',
      id: ch.id,
      getBody: () => charBodies.current.get(ch.id),
      getObject: () => charObjects.current.get(ch.id),
      getCenter: () => charBodies.current.get(ch.id)?.translation() ?? { x: 0, y: 0, z: 0 },
      radius: BASE_DIAMETER[ch.base] / 2,
    })),
    ...matTokens.map(tok => ({
      kind: 'token',
      id: tok.id,
      getObject: () => tokenObjects.current.get(tok.id),
      getCenter: () => tokenCenters.current.get(tok.id)?.() ?? { x: tok.x, y: 0, z: tok.z },
      radius: 0.5,
    })),
  ], [characters, matTokens])
  const toolTarget = toolModels.find(model => selection && model.kind === selection.kind && model.id === selection.id)

  function toggleTool(tool) {
    onSelectedToolChange(prev => prev === tool ? null : tool)
  }

  function toggleSelect(kind, id) {
    onSelectionChange(prev => (prev?.kind === kind && prev.id === id) ? null : { kind, id })
  }

  return (
    <>
      {/* Space background */}
      <color attach="background" args={['#050510']} />
      <Stars radius={200} depth={60} count={5000} factor={4} fade speed={0.5} />

      <ambientLight intensity={0.6} />
      {/* The shadow camera looks from the light to the origin, so its x axis runs along the world
          diagonal (x − z), not along world x. The bounds are the mat and both dice trays measured in
          that camera's space: the mat needs x ±25.5, y −23 to 24.7, and the trays reach x = 37.1 and
          y = −33.5. The map is 3072 so that one shadow pixel is about as small as before
          (64" / 3072 ≈ 40" / 2048). */}
      <directionalLight
        position={[10, 30, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[3072, 3072]}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-camera-left={-26}
        shadow-camera-right={38}
        shadow-camera-top={25}
        shadow-camera-bottom={-34}
      />
      {/* Same HDR as drei's "city" preset, served with the app instead of from a CDN.
          On a surface that faces up, the light multiplies the texture color by: HDR 1.34 at intensity 1
          (its cos-weighted sky average), directional 0.35, ambient 0.19. A texture shows its own colors at
          about 1.0. At intensity 1 the total was 1.88, and cards and tokens looked washed out. At 0.5 it is 1.21. */}
      <Environment files={assetUrl('hdri/potsdamer_platz_1k.hdr')} backgroundIntensity={0} environmentIntensity={0.5} />

      <Physics gravity={[0, WORLD_GRAVITY, 0]} timeStep={TIME_STEP} debug={showColliders}>
        {/* Table surface — fixed collider so models land on it */}
        <RigidBody type="fixed" colliders={false}>
          {/* Collider much thicker than the visual so fast bodies can't tunnel through; top stays at y=0 */}
          <CuboidCollider
            args={[TABLE_WIDTH / 2, TABLE_COLLIDER_HALF_H, TABLE_DEPTH / 2]}
            position={[0, -TABLE_COLLIDER_HALF_H, 0]}
            friction={FRICTION}
          />
          <mesh position={[0, -TABLE_THICKNESS / 2, 0]} receiveShadow>
            <boxGeometry args={[TABLE_WIDTH, TABLE_THICKNESS, TABLE_DEPTH]} />
            <meshStandardMaterial map={tableTexture} roughness={0.8} metalness={0.05} onBeforeCompile={projectFootprints} />
          </mesh>
        </RigidBody>
        {/* Invisible walls at the table edge, so dice cannot fall off the table. Kinematic, see table.js. */}
        <RigidBody type="kinematicPosition" colliders={false}>
          {TABLE_WALLS.map(({ halfExtents, position }, i) => (
            <CuboidCollider key={i} args={halfExtents} position={position} friction={FRICTION} />
          ))}
        </RigidBody>

        {/* The mat and its terrain turn together around the mat center. In game setup, the player with priority
            turns them so that the deployment edge they chose faces the blue side. */}
        <group rotation={[0, matTurns * Math.PI / 2, 0]}>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[MAT_SIZE, MAT_SIZE]} />
            <meshStandardMaterial map={matTexture} roughness={1} metalness={0} onBeforeCompile={projectFootprints} />
          </mesh>
          {/* A fixed body does not follow its parent after it is created. So each turn mounts the terrain again,
              and its colliders are created at the new pose. A new map also mounts it again. */}
          <Terrain key={`${mapId}-${matTurns}`} placements={map.placements} showLabels={showLabels} />
        </group>

        {/* Dice trays are relative to the table, not the mat: not keyed by mapId or matTurns, so a
            map change or a mat turn (which remounts Terrain above) never remounts them and their
            dice keep their state. See docs/plan-dice-rolling.md, Phase 4. */}
        {Object.keys(TRAYS).map(trayKey => (
          <DiceTray
            key={trayKey}
            trayKey={trayKey}
            openMenuSymbol={diceMenu?.trayKey === trayKey ? diceMenu.symbol : null}
            onMenuToggle={symbol => onDiceMenuToggle(trayKey, symbol)}
            onMenuClose={onDiceMenuClose}
          />
        ))}

        {/* Crisis cards and tokens are relative to the player sides, not the mat, so they stay
            outside the rotating group above: a mat turn must not turn them. See docs/feature-crisis.md. */}
        {crisis.secure && (
          <CrisisCard cardKey={crisis.secure} position={[CARD_X, CARD_Y, CARD_Z.secure]} onOpen={onCardOpen} />
        )}
        {crisis.extract && (
          <CrisisCard cardKey={crisis.extract} position={[CARD_X, CARD_Y, CARD_Z.extract]} onOpen={onCardOpen} />
        )}
        {/* A held token is not rendered here: it shows on its holder's tray instead (Hold and drop). */}
        {matTokens.map(tok => (
          <CrisisToken
            key={tok.id}
            token={tok}
            selected={selectedTokenId === tok.id}
            onSelect={() => toggleSelect('token', tok.id)}
            onHover={over => onPieceHover?.({ kind: 'token', id: tok.id }, over)}
            onMove={(x, z) => onTokenMove(tok.id, x, z)}
            onTurn={yaw => onTokenTurn(tok.id, yaw)}
            onHold={characterId => onTokenHold(tok.id, characterId)}
            findCharacter={findCharacterAt}
            objectRef={obj => obj ? tokenObjects.current.set(tok.id, obj) : tokenObjects.current.delete(tok.id)}
            centerRef={fn => fn ? tokenCenters.current.set(tok.id, fn) : tokenCenters.current.delete(tok.id)}
          />
        ))}

        {/* One tray per spawned character, next to the mat edge (see trays.js and
            docs/characters-hud.md, "Tray layout"). The model below spawns standing on the center
            of this tray's card (trayModelPosition). It reads that position only once, when its
            body mounts, so a later tray move does not teleport it. */}
        {characters.map(ch => (
          <CharacterTray
            key={ch.id}
            character={ch}
            position={trayPositions.get(ch.id)}
            onOpen={onCardOpen}
            onDamage={damage => onCharacterDamage(ch.id, damage)}
            onPower={power => onCharacterPower(ch.id, power)}
            onFlip={() => onCharacterFlip(ch.id)}
            onRemove={() => onCharacterRemove(ch.id)}
            onTokenRemove={key => onCharacterTokenRemove(ch.id, key)}
            onTokenDragStart={onTokenDragStart}
            heldTokens={tokens.filter(tok => tok.heldBy === ch.id)}
            onTokenDrop={onTokenDrop}
            selected={selectedCharId === ch.id}
            objectRef={obj => obj ? trayObjects.current.set(ch.id, obj) : trayObjects.current.delete(ch.id)}
          />
        ))}

        {characters.map(ch => {
          if (ch.figure === 'standee') {
            return (
              <Character
                key={ch.id}
                position={trayModelPosition(ch.teamColor, trayPositions.get(ch.id))}
                baseSize={ch.base}
                frontUrl={assetUrl(characterStandee(ch.key, 'front'))}
                backUrl={assetUrl(characterStandee(ch.key, 'back'))}
              />
            )
          }
          return (
            <CharacterModel
              key={ch.id}
              url={assetUrl(characterModel(ch.key))}
              position={trayModelPosition(ch.teamColor, trayPositions.get(ch.id))}
              baseRadius={BASE_DIAMETER[ch.base] / 2}
              rotation={[0, ch.rotation * Math.PI / 180, 0]}
              teamColor={ch.teamColor}
              selected={selectedCharId === ch.id}
              onSelect={() => toggleSelect('character', ch.id)}
              onHover={over => onPieceHover?.({ kind: 'character', id: ch.id }, over)}
              bodyRef={rb => rb ? charBodies.current.set(ch.id, rb) : charBodies.current.delete(ch.id)}
              objectRef={obj => obj ? charObjects.current.set(ch.id, obj) : charObjects.current.delete(ch.id)}
              onDragStart={() => setDraggingCharId(ch.id)}
              onDragEnd={() => setDraggingCharId(null)}
              constrainDrag={deployLine ? (p) => {
                if (ch.teamColor === 'blue') p.z = Math.max(p.z, MAT_SIZE / 2 - deployDepth)
                else p.z = Math.min(p.z, -(MAT_SIZE / 2 - deployDepth))
              } : undefined}
            />
          )
        })}

        {activeMove && (
          <MovementRuler
            key={`${activeMove}-${toolSpawns.move}`}
            type={activeMove}
            position={[0, TOOL_HOVER_HEIGHT, -6]}
            hoverHeight={TOOL_HOVER_HEIGHT}
            selected={selectedTool === 'move'}
            onSelect={() => toggleTool('move')}
            // A new tool is selected, so its buttons (Place, Bend) can be used right away
            onSpawn={() => onSelectedToolChange('move')}
            target={toolTarget}
            models={toolModels}
            onSnap={model => onSelectionChange({ kind: model.kind, id: model.id })}
          />
        )}
        {draggingChar && (
          <DeployRangeTool
            getBody={() => charBodies.current.get(draggingCharId)}
            centerZ={draggingChar.teamColor === 'blue' ? MAT_SIZE / 2 - deployTip : -(MAT_SIZE / 2 - deployTip)}
            yaw={draggingChar.teamColor === 'blue' ? -Math.PI / 2 : Math.PI / 2}
            hoverHeight={TOOL_HOVER_HEIGHT}
          />
        )}
        {activeRange && (
          <RangeRuler
            key={`${activeRange}-${toolSpawns.range}`}
            number={activeRange}
            position={[0, TOOL_HOVER_HEIGHT, 6]}
            hoverHeight={TOOL_HOVER_HEIGHT}
            selected={selectedTool === 'range'}
            onSelect={() => toggleTool('range')}
            onSpawn={() => onSelectedToolChange('range')}
            target={toolTarget}
            models={toolModels}
            onSnap={model => onSelectionChange({ kind: model.kind, id: model.id })}
          />
        )}
      </Physics>
    </>
  )
}
