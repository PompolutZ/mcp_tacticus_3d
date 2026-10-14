import { useRef, useState } from 'react'
import { startPointerDrag } from './pointerDrag.js'
import { tokenDropTarget } from './tokenDrop.js'
import { getCard } from '../crisis/cards.js'
import { supplyPilePosition } from '../crisis/layout.js'
import { dragPose, tokenDragKey } from '../net/livePose.js'
import { playSound } from '../sound.js'
import { tokenSize, isCollected } from '../tokens/tokens.js'
import { clickAdd, countOf, dropCollected, firstPlace, takeOne } from '../tokens/count.js'

// The token drag: the drag starts from the Give sources, the Library, the piles, the table tokens and
// the supply piles, and the release (docs/features/library.md, "Tokens"). Call it after the hooks that
// give the character token give, the supply take and the table token remove. tokenDrag, dragPointRef
// and findCharacterAt go to the Scene and the keys.
export function useTokenDrag({
  table,
  ownership,
  pieceLives,
  controlsRef,
  characterAtRef,
  setLooseTokens,
  setTokenPiles,
  handleCharacterTokenGive,
  handleSupplyTake,
  handleLooseRemove,
}) {
  // A token drag in progress: { tokenKey, looseId, giveId, supplyCard, pile, pileId, newId, key, active, start } | null.
  // newId: the id of the new piece of the drag (a new token, pile or supply token), else null. key: the piece
  // key of the dragged piece, `loose:`, `pile:` or `token:` (decision 22). looseId: the table token that is dragged, or null for a new token from a source. giveId: the character of the tray, when the press is on its Give source (a click gives it one token), else null. supplyCard: the
  // card key when the new token comes from the supply pile of a Source card (tokenKey is then a
  // crisis token key), otherwise null. pile: the drag brings a new pile from the Library. pileId: the
  // drag moves that pile (Shift + drag). active: the pointer has moved DRAG_THRESHOLD px, so the dragged token
  // shows under the pointer (Scene.jsx, TokenDragPreview). start: the pointer position at that
  // moment. The state changes only at start and when the drag becomes active, not on every
  // pointermove.
  const [tokenDrag, setTokenDrag] = useState(null)
  // The same drag without the active and start fields, for handleTokenRelease
  const tokenDragRef = useRef(null)
  // The table point under the pointer, written by TokenDragPreview: { x, y, z } | null
  const dragPointRef = useRef(null)
  // pointerdown on a character token: a tray's Give source (a new token, the source never runs out),
  // or a token on the table (looseId).
  // giveId: the character of the tray, for a Give source: a click gives it one token (startTokenDrag).
  function handleTokenDragStart(e, tokenKey, looseId = null, giveId = null) {
    // A left drag on a counted token takes one off, Shift + drag moves the whole token
    const loose = looseId && table.looseTokens.read().find((t) => t.id === looseId)
    if (loose && countOf(loose) >= 2 && !e.shiftKey) {
      startTokenDrag(e, { tokenKey, takeFrom: looseId })
      return
    }
    startTokenDrag(e, { tokenKey, looseId, giveId })
  }

  // pointerdown on a Library token chip. mode 'single': a new token, the same as from a Give
  // source. mode 'pile': a new pile (see docs/features/library.md, "Tokens").
  function handleLibraryTokenDragStart(e, tokenKey, mode) {
    startTokenDrag(e, { tokenKey, pile: mode === 'pile' })
  }

  // pointerdown on a pile on the table: a new token, the pile never runs out. With Shift, the drag
  // moves the pile.
  // A click (no drag) on a pile of a collected token adds one to its counted token (handlePileClick).
  function handlePileTakeStart(e, pile) {
    startTokenDrag(e, { tokenKey: pile.key, clickPile: isCollected(pile.key) ? pile : null })
  }

  // The click on a collected pile: the loose token of the pile gets 1 more. The first one lies on the
  // pile's card, or next to a pile without a card (tokens/count.js).
  function handlePileClick(pile) {
    const card = pile.card ? table.tactics.read().find((c) => c.id === pile.card) : null
    const size = tokenSize(pile.key)
    const obstacles = [...table.looseTokens.read(), ...table.tokenPiles.read()]
    const place = firstPlace(pile, card, obstacles, size)
    const newId = crypto.randomUUID()
    playSound('tokenPlace')
    setLooseTokens((prev) => clickAdd(prev, pile, place, newId))
  }

  function handlePileMoveStart(e, pile) {
    startTokenDrag(e, { tokenKey: pile.key, pileId: pile.id })
  }

  // pointerdown on the supply pile of a Source card: a new supply token. The pile never runs out.
  function handleSupplyDragStart(e, cardKey) {
    const supply = getCard(cardKey)?.supply
    if (supply) startTokenDrag(e, { tokenKey: supply, supplyCard: cardKey })
  }

  // e is the DOM event. preventDefault stops the browser's own image drag and text selection. The
  // camera does not move during the drag (startPointerDrag). The drag becomes active after
  // DRAG_THRESHOLD px, and its release drops the token (handleTokenRelease). A release before that
  // is a click, which does nothing, except on a Give source (giveId). Esc cancels (cancelActiveDrag in drag/pointerDrag.js). Any button starts it: the
  // Library chips never checked the button.
  // drag: tokenKey and the fields of tokenDrag that are set, the others get their defaults.
  function startTokenDrag(e, drag) {
    const base = {
      looseId: null,
      supplyCard: null,
      pile: false,
      pileId: null,
      giveId: null,
      takeFrom: null,
      clickPile: null,
      ...drag,
    }
    // A new piece gets its id and key at the press, so the drag claims it like a piece on the table (decision 22)
    const newId = base.looseId || base.pileId ? null : crypto.randomUUID()
    const key = tokenDragKey(base, newId)
    const full = { ...base, newId, key }
    const spawn = newId ? { key, tokenKey: full.tokenKey } : null
    const handle = startPointerDrag(e, {
      key,
      ownership,
      live: pieceLives,
      // The point of TokenDragPreview
      livePose: () => dragPose(key, dragPointRef.current),
      controls: controlsRef.current,
      canvas: e.target,
      button: null,
      preventDefault: true,
      onStart: (ev) => {
        // After the claim, so the other player sees the key claimed when the spawn arrives
        if (spawn) ownership?.setSpawn(spawn)
        setTokenDrag(
          (prev) =>
            prev && { ...prev, active: true, start: { clientX: ev.clientX, clientY: ev.clientY } },
        )
      },
      onEnd: (ev) => {
        handleTokenRelease(ev.clientX, ev.clientY)
        endTokenDrag()
      },
      // A click on a Give source gives 1 token to the character of the tray, the same as a drop. The press
      // claimed nothing and set no spawn (onStart), so endTokenDrag only clears the state.
      onClick: () => {
        if (full.giveId) handleCharacterTokenGive(full.giveId, full.tokenKey)
        if (full.clickPile) handlePileClick(full.clickPile)
        endTokenDrag()
      },
      onCancel: endTokenDrag,
      // The other player owns the piece: no drag, so the state set below must not stay
      onRefused: endTokenDrag,
    })
    if (!handle) return
    tokenDragRef.current = full
    setTokenDrag({ ...full, active: false, start: null })
  }

  // The document write of a drop comes before this, and the release of the claim after it
  function endTokenDrag() {
    ownership?.setSpawn(null)
    tokenDragRef.current = null
    setTokenDrag(null)
  }

  // Character under (clientX, clientY): the DOM tray controls first (data-character-id, see
  // TrayControls.jsx), then the 3D scene (Scene.jsx, characterAt). Usable outside a drag too: it is
  // passed down to Scene, which gives it to CrisisToken.jsx for an Extract token's release (Phase
  // 7), so a release over the tray's DOM controls strip counts, not only the model or the tray plate.
  // { models: false }: the DOM tray controls and the tray plates only, not the models. A crisis
  // token is held by the card only ("Hold and drop").
  function findCharacterAt(clientX, clientY, options) {
    const el = document.elementFromPoint(clientX, clientY)?.closest('[data-character-id]')
    if (el) return el.dataset.characterId
    return characterAtRef.current?.(clientX, clientY, options) ?? null
  }

  // Release of an active token drag at (clientX, clientY). Over a HUD panel: nothing changes, so a
  // drag back onto the Library cancels it. Over a character (its model, or anywhere on its
  // tray): the character gets the token, the same as before. A table token is used up then, unless
  // the character is immune. Over the table or terrain: a new token lies there, or the dragged table
  // token moves there. Elsewhere (the space around the table): nothing changes. A supply token
  // follows the same rules, but it is a crisis token: a character holds it only when released on its tray card (handleSupplyTake); over a model it lies on the table. A
  // pile goes only on the table: a new pile lies there, or the moved pile moves there.
  function handleTokenRelease(clientX, clientY) {
    const { tokenKey, looseId, supplyCard, pileId, newId, takeFrom } = tokenDragRef.current
    if (!document.elementFromPoint(clientX, clientY)?.closest('.scene-root')) return
    // A supply token is a crisis token: only a card holds it, a model on the table does not
    const characterId = findCharacterAt(clientX, clientY, { models: !supplyCard })
    const point = dragPointRef.current
    switch (tokenDropTarget(tokenDragRef.current, { characterId, point })) {
      case 'movePile':
        playSound('tokenPlace')
        setTokenPiles((prev) =>
          prev.map((p) => (p.id === pileId ? { ...p, x: point.x, z: point.z } : p)),
        )
        return
      case 'newPile':
        playSound('tokenPlace')
        setTokenPiles((prev) => [...prev, { id: newId, key: tokenKey, x: point.x, z: point.z }])
        return
      case 'supplyHeld': {
        const pile = supplyPilePosition(getCard(supplyCard).type)
        handleSupplyTake(supplyCard, pile.x, pile.z, characterId, newId)
        return
      }
      case 'supplyTable':
        handleSupplyTake(supplyCard, point.x, point.z, null, newId)
        playSound('tokenPlace')
        return
      case 'give':
        table.transact(() => {
          if (!handleCharacterTokenGive(characterId, tokenKey)) return
          if (looseId) handleLooseRemove(looseId)
          if (takeFrom)
            setLooseTokens((prev) => prev.map((t) => (t.id === takeFrom ? takeOne(t) : t)))
        })
        return
      case 'moveLoose':
        playSound('tokenPlace')
        if (isCollected(tokenKey)) {
          setLooseTokens((prev) => {
            const moved = prev.find((t) => t.id === looseId)
            return moved ? dropCollected(prev, moved, point, tokenSize(tokenKey) / 2) : prev
          })
          return
        }
        // A moved token goes to the end of the list, so it lies on top (tokens/stack.js)
        setLooseTokens((prev) => {
          const moved = prev.find((t) => t.id === looseId)
          if (!moved) return prev
          return [...prev.filter((t) => t.id !== looseId), { ...moved, x: point.x, z: point.z }]
        })
        return
      case 'newLoose':
        playSound('tokenPlace')
        if (isCollected(tokenKey)) {
          const dragged = { id: newId, key: tokenKey }
          setLooseTokens((prev) =>
            dropCollected(prev, dragged, point, tokenSize(tokenKey) / 2, takeFrom),
          )
          return
        }
        setLooseTokens((prev) => [...prev, { id: newId, key: tokenKey, x: point.x, z: point.z }])
        return
      default:
    }
  }

  return {
    tokenDrag,
    dragPointRef,
    findCharacterAt,
    handleTokenDragStart,
    handleLibraryTokenDragStart,
    handlePileTakeStart,
    handlePileMoveStart,
    handleSupplyDragStart,
  }
}
