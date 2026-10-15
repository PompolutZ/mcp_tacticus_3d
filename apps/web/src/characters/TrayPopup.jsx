import { useEffect, useState } from 'react'
import { assetUrl } from '../assets/index.js'
import { characterCard, transformCard } from './files.js'
import { trayCards } from './models.js'
import { characterName, characterStamina } from './characters.js'
import {
  GRUNT_HELD_SIZE_U,
  HELD_SIZE_U,
  trayGruntHeldCardPoint,
  trayGruntHeldClamp,
  trayHeldCardPoint,
} from './trays.js'
import { tokenInfo } from '../crisis/cards.js'
import { crisisToken } from '../crisis/files.js'
import { characterToken } from '../tokens/files.js'
import { getToken } from '../tokens/tokens.js'
import { attachedCards } from '../rosters/cards.js'
import { Dialog } from '../ui/Dialog.jsx'
import TacticFaceScaled from '../tactics/TacticFaceScaled.jsx'
import TrayControls from './TrayControls.jsx'

function otherSide(side) {
  return side === 'healthy' ? 'injured' : 'healthy'
}

// The whole character tray in a full-screen popup, opened by a click on the tray card (see
// CharacterTray.jsx): the "On" row of tokens, the stat card at full size, and the same controls as
// the 3D tray (TrayControls.jsx). It shows the live character from App state, so a change here or
// on the 3D tray shows in both. The Give sources are not part of the tray (see trays.js), so they
// are not here. The objective tokens the character holds show on the card image, at the same place
// as on the 3D card. They only show here: a player moves or drops them on the 3D card. Closes with
// the cross button, a click outside the tray or Escape. A dialog, so it uses Dialog.jsx.
// App mounts it only while a tray is open. onTokenRemove(key): a click on an "On" token removes
// one, the same as on the 3D tray. heldTokens: the crisis tokens this character holds. A character
// whose second form has its own card shows that card under the first, as on the 3D tray; the held
// tokens lie on the first card. The attached cards (gems) show as small thumbnails at the side of the
// stat card, so the popup keeps its height. A click on one shows it large over the stat card, a
// second click on it or on the large card makes it small again. One card is large at a time. The
// controls show no gem chips here. A card without an image has no thumbnail.
export function TrayPopup({
  character,
  heldTokens,
  onClose,
  onDamage,
  onPower,
  onFlip,
  onRemove,
  onBoard,
  removeWait = null,
  onTokenRemove,
}) {
  // The other side of the card, shown with a button, because players often read the Injured side
  // while the card is Healthy. A Flip starts again on the side that faces up.
  const [showOther, setShowOther] = useState(false)
  useEffect(() => {
    setShowOther(false)
  }, [character.side])

  // The code of the attached card that shows large, or null. The popup unmounts on close, so it
  // starts closed each time. A Flip or "Show other side" does not touch it.
  const [largeCode, setLargeCode] = useState(null)

  const name = characterName(character.key)
  const shownSide = showOther ? otherSide(character.side) : character.side
  // Tokens on the character, in the order it got them (see characters/actions.js, giveToken).
  const attached = attachedCards(character).filter((card) => card.image)
  const large = attached.find((card) => card.code === largeCode)
  const onTokens = Object.entries(character.tokens ?? {})

  return (
    <Dialog
      backdropClassName="card-popup"
      className="tray-popup"
      label={name}
      closeButton={false}
      onClose={onClose}
    >
      <div className="tray-popup-top">
        <div className="tray-popup-on">
          {onTokens.map(([key, count]) => (
            <OnToken key={key} tokenKey={key} count={count} onClick={() => onTokenRemove(key)} />
          ))}
        </div>
        <button type="button" className="tray-popup-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className={`tray-popup-main${attached.length > 0 ? ' tray-popup-main--attached' : ''}`}>
        <div className="tray-popup-cards">
          <div
            className={
              character.host ? 'tray-popup-card tray-popup-card--grunt' : 'tray-popup-card'
            }
          >
            <img src={assetUrl(characterCard(character.key, shownSide))} alt={name} />
            {heldTokens.map((token) => (
              <HeldToken key={token.id} token={token} grunt={Boolean(character.host)} />
            ))}
          </div>
          {trayCards(character) === 2 && (
            <div className="tray-popup-card">
              <img
                src={assetUrl(transformCard(character.key, shownSide))}
                alt={`${name}, second form`}
              />
            </div>
          )}
          {large && (
            <button
              type="button"
              className="tray-popup-large"
              title={`${large.name} (click to make it small)`}
              onClick={() => setLargeCode(null)}
            >
              <AttachedFace card={large} />
            </button>
          )}
        </div>
        {attached.length > 0 && (
          <div className="tray-popup-attached">
            {attached.map((card) => (
              <button
                key={card.code}
                type="button"
                className={`tray-popup-attached-card${card.code === largeCode ? ' tray-popup-attached-card--open' : ''}`}
                title={card.name}
                onClick={() => setLargeCode((code) => (code === card.code ? null : card.code))}
              >
                <AttachedFace card={card} />
              </button>
            ))}
          </div>
        )}
      </div>
      {!character.host && (
        <button type="button" className="chip" onClick={() => setShowOther((v) => !v)}>
          {showOther ? 'Show side that faces up' : 'Show other side'}
        </button>
      )}
      <TrayControls
        character={character}
        stamina={characterStamina(character.key, character.side)}
        onDamage={onDamage}
        onPower={onPower}
        onFlip={onFlip}
        onRemove={onRemove}
        onBoard={onBoard}
        removeWait={removeWait}
        hideAttached
      />
    </Dialog>
  )
}

// A token on the character, with a count badge when the count is above 1. The tooltip shows its
// name and the mod's description, the same as the label of a 3D token (TokenFace.jsx).
// A token on the character, with its count. onClick: removes one; without it the token is only shown
// (the spectator columns).
export function OnToken({ tokenKey, count, onClick }) {
  const token = getToken(tokenKey)
  const name = token?.name ?? tokenKey
  const hint = onClick ? ' (click to remove one)' : ''
  const title = token?.description ? `${name}: ${token.description}${hint}` : `${name}${hint}`
  const face = (
    <>
      <img src={assetUrl(characterToken(tokenKey))} alt={name} draggable={false} />
      {count > 1 && <span className="tray-popup-token-count">{count}</span>}
    </>
  )
  if (!onClick)
    return (
      <span className="tray-popup-token tray-popup-token--static" title={title}>
        {face}
      </span>
    )
  return (
    <button type="button" className="tray-popup-token" title={title} onClick={onClick}>
      {face}
    </button>
  )
}

// The face of an attached card: the drawn face of a gem, else its image
function AttachedFace({ card }) {
  if (!card.faceKey) return <img src={assetUrl(card.image)} alt={card.name} />
  return (
    <span className="tray-popup-face" role="img" aria-label={card.name}>
      <TacticFaceScaled tacticKey={card.faceKey} />
    </span>
  )
}

// A crisis token the character holds, on the card image, the face that is up. Its place on the
// image is its place on the 3D card (trays.js, heldAt), as a percentage of the image size.
function HeldToken({ token, grunt }) {
  const key = token.up === 'front' ? token.frontKey : (token.backKey ?? token.frontKey)
  const name = tokenInfo(key)?.name ?? key
  // A grunt's token lies on the portrait grunt card (trays.js)
  const { u, v } = grunt
    ? trayGruntHeldCardPoint(trayGruntHeldClamp(token.heldAt))
    : trayHeldCardPoint(token.heldAt)
  const size = grunt ? GRUNT_HELD_SIZE_U : HELD_SIZE_U
  const style = { left: `${u * 100}%`, top: `${v * 100}%`, width: `${size * 100}%` }
  return (
    <img
      className="tray-popup-held"
      src={assetUrl(crisisToken(key))}
      alt={name}
      title={name}
      style={style}
    />
  )
}
