import { Suspense, useMemo } from 'react'
import CrisisToken, { TOKEN_RADIUS } from './CrisisToken.jsx'
import LooseToken from './LooseToken.jsx'
import TokenDragPreview, { OtherSpawnPreview } from './TokenDragPreview.jsx'
import TokenFace from './TokenFace.jsx'
import { SupplyToken } from './SupplyPile.jsx'
import TokenPile, { PileStack } from './TokenPile.jsx'
import { clampWaiting } from '../tokens/dropWait.js'
import { TOKEN_THICKNESS } from '../tokens/solid.js'
import { tokenSize } from '../tokens/tokens.js'
import {
  TRAY_Y,
  onTray,
  trayGruntHeldClamp,
  trayGruntHeldLocal,
  trayHeldLocal,
  trayHeldWorld,
  trayShapeOf,
  trayYaw,
} from '../characters/trays.js'

// Tokens held by one character lie on its card in a stack, in the order they were taken, so two
// tokens that overlap do not z-fight. Each one is this much higher than the one before it.
const HELD_STACK_STEP = TOKEN_THICKNESS + 0.01
// The dragged token gets no pointer events, so it does not hide what is under it
const NO_RAYCAST = () => null

// The tokens on the table: the crisis tokens (also the held ones), the character tokens and their
// piles, the preview of a token that is being dragged, and the new piece the other player drags.
// Props are the values and handlers that Scene.jsx has for them.
export default function TokenLayer({
  tokens,
  characters,
  trayPositions,
  gruntLists,
  trayShape,
  selectedTokenId,
  selectedLooseId,
  rangeMarkOf,
  otherSelectedOf,
  toggleSelect,
  dragSelect,
  onHeldHover,
  onPieceHover,
  playedSides,
  applyPlaceLimits,
  onTokenMove,
  onTokenTurn,
  ownership,
  pieceLives,
  otherOwned,
  getPieceLive,
  onTokenHold,
  findCharacterAt,
  affiliations,
  tokenObjects,
  tokenCenters,
  looseObjects,
  looseCenters,
  looseTokens,
  tokenDrag,
  onTokenDragStart,
  onLooseHover,
  tokenPiles,
  onPileTakeStart,
  onPileMoveStart,
  onPileHover,
  dragPointRef,
  otherSpawn,
}) {
  // Every crisis token as it is drawn. A held token lies on its holder's card: its tray-local place
  // (heldAt) moves to the table with the tray position, and it faces the holder's player, the same
  // as the card (see trays.js, "An objective token that the character holds").
  const tokenViews = useMemo(() => {
    const stacks = new Map()
    return tokens.map((tok) => {
      if (!tok.heldBy) return { token: tok }
      const holder = characters.find((ch) => ch.id === tok.heldBy)
      const trayPos = trayPositions.get(tok.heldBy)
      if (!holder || !trayPos) return { token: tok }
      // A grunt's token lies on the grunt card (the default place is on a host card, so it is clamped)
      const { slot } = trayShapeOf(holder, characters, gruntLists)
      const local = holder.host ? trayGruntHeldClamp(tok.heldAt) : tok.heldAt
      const [x, z] = trayHeldWorld(holder.team, trayPos, local, slot)
      const level = stacks.get(tok.heldBy) ?? 0
      stacks.set(tok.heldBy, level + 1)
      return {
        token: { ...tok, x, z, yaw: trayYaw(holder.team) },
        floorY: TRAY_Y + level * HELD_STACK_STEP,
      }
    })
  }, [tokens, characters, trayPositions, gruntLists])

  return (
    <>
      {/* A held token lies on its holder's tray card (Hold and drop). A drag off the card puts
        it back on the mat (onMove). It is not a piece for the tools, so its hover goes to
        onHeldHover, not onPieceHover: a tool key over it does not snap a tool to it (App.jsx,
        handleToolKey), and the Delete key removes it. */}
      {tokenViews.map(({ token: tok, floorY }) => (
        <Suspense key={tok.id} fallback={null}>
          <CrisisToken
            token={tok}
            floorY={floorY}
            selected={selectedTokenId === tok.id}
            rangeMark={rangeMarkOf('token', tok.id)}
            otherSelected={otherSelectedOf('token', tok.id)}
            onSelect={() => toggleSelect('token', tok.id)}
            onDragSelect={() => dragSelect('token', tok.id)}
            onHover={
              tok.heldBy
                ? (over) => onHeldHover?.(tok.id, over)
                : (over) => onPieceHover?.({ kind: 'token', id: tok.id }, over)
            }
            canDrag={!tok.placeBy || playedSides.includes(tok.placeBy)}
            constrainDrag={(raw) => {
              const p = tok.placeBy ? clampWaiting(tok, raw, TOKEN_RADIUS) : raw
              return applyPlaceLimits('token', tok.id, p)
            }}
            onMove={(x, z) => onTokenMove(tok.id, x, z)}
            onTurn={(yaw) => onTokenTurn(tok.id, yaw)}
            ownership={ownership}
            pieceLives={pieceLives}
            remote={otherOwned.has(`token:${tok.id}`)}
            getLivePose={getPieceLive}
            onHold={(characterId, point) => {
              const holder = characters.find((ch) => ch.id === characterId)
              const trayPos = trayPositions.get(characterId)
              const shape = holder && trayShape(holder)
              const onCard =
                holder && trayPos && onTray(holder.team, trayPos, point, shape.cards, shape.grunts)
              onTokenHold(
                tok.id,
                characterId,
                onCard
                  ? holder.host
                    ? trayGruntHeldLocal(holder.team, trayPos, point, shape.slot)
                    : trayHeldLocal(holder.team, trayPos, point)
                  : null,
              )
            }}
            findCharacter={findCharacterAt}
            controlAffiliation={tok.control ? affiliations[tok.control] : null}
            objectRef={(obj) =>
              obj ? tokenObjects.current.set(tok.id, obj) : tokenObjects.current.delete(tok.id)
            }
            centerRef={(fn) =>
              fn ? tokenCenters.current.set(tok.id, fn) : tokenCenters.current.delete(tok.id)
            }
          />
        </Suspense>
      ))}

      {/* Character tokens on the table. Relative to the table, not the mat, the same as the crisis
        tokens above. A token that is being dragged shows under the pointer instead. */}
      {looseTokens.map((tok, index) =>
        tokenDrag?.active && tokenDrag.looseId === tok.id ? null : (
          <LooseToken
            key={tok.id}
            token={tok}
            index={index}
            count={(tok.count ?? 1) - (tokenDrag?.active && tokenDrag.takeFrom === tok.id ? 1 : 0)}
            onDragStart={(e) => onTokenDragStart(e, tok.key, tok.id)}
            selected={selectedLooseId === tok.id}
            rangeMark={rangeMarkOf('loose', tok.id)}
            otherSelected={otherSelectedOf('loose', tok.id)}
            onHover={(over) => {
              onLooseHover?.(tok.id, over)
              onPieceHover?.({ kind: 'loose', id: tok.id }, over)
            }}
            objects={looseObjects.current}
            centers={looseCenters.current}
            remote={otherOwned.has(`loose:${tok.id}`)}
            getLivePose={getPieceLive}
          />
        ),
      )}
      {/* Piles of character tokens on the table (Library, Pile mode). A pile that is moved shows
        under the pointer instead. */}
      {tokenPiles
        .filter((pile) => !(tokenDrag?.active && tokenDrag.pileId === pile.id))
        .map((pile) => (
          <TokenPile
            key={pile.id}
            pile={pile}
            onTakeStart={(e) => onPileTakeStart(e, pile)}
            onMoveStart={(e) => onPileMoveStart(e, pile)}
            onHover={(over) => onPileHover?.(pile.id, over)}
            remote={otherOwned.has(`pile:${pile.id}`)}
            getLivePose={getPieceLive}
          />
        ))}
      {tokenDrag?.active && (
        <TokenDragPreview
          pointRef={dragPointRef}
          start={tokenDrag.start}
          stacks={!tokenDrag.supplyCard && !tokenDrag.pile && !tokenDrag.pileId}
        >
          {tokenDrag.supplyCard ? (
            <SupplyToken tokenKey={tokenDrag.tokenKey} raycast={NO_RAYCAST} />
          ) : tokenDrag.pile || tokenDrag.pileId ? (
            <PileStack tokenKey={tokenDrag.tokenKey} interactive={false} />
          ) : (
            <TokenFace
              tokenKey={tokenDrag.tokenKey}
              size={tokenSize(tokenDrag.tokenKey)}
              interactive={false}
            />
          )}
        </TokenDragPreview>
      )}
      {/* The new piece that the other player drags: the kind comes from the key */}
      {otherSpawn && (
        <OtherSpawnPreview
          key={otherSpawn.key}
          spawnKey={otherSpawn.key}
          tokenKey={otherSpawn.tokenKey}
          getLivePose={getPieceLive}
          stacks={otherSpawn.key.startsWith('loose:')}
        >
          {otherSpawn.key.startsWith('token:') ? (
            <SupplyToken tokenKey={otherSpawn.tokenKey} raycast={NO_RAYCAST} />
          ) : otherSpawn.key.startsWith('pile:') ? (
            <PileStack tokenKey={otherSpawn.tokenKey} interactive={false} />
          ) : (
            <TokenFace
              tokenKey={otherSpawn.tokenKey}
              size={tokenSize(otherSpawn.tokenKey)}
              interactive={false}
            />
          )}
        </OtherSpawnPreview>
      )}
    </>
  )
}
