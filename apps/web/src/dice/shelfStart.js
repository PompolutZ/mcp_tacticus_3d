// The dice a tray starts with, read from the table document. Plain module, no React and no scene,
// so node --test can load it.

import { FACES } from './faces.js'
import { SHELF_SLOT_COUNT, shelfSlot, trayToWorld, trayToWorldRotation } from './tray.js'
import { flatRotation, sortShelfEntries } from './shelf.js'
import { dieEntry } from './stored.js'

// A tray holds at most 42 dice, shelf and well together (design, "Roll flow"). SHELF_SLOT_COUNT
// is also 42 (one shelf place per die), so this reuses it instead of a second magic number.
export const MAX_DICE = SHELF_SLOT_COUNT

// The dice of a tray at mount: the shelf dice of its side of the document, each at its slot, so they
// start kinematic with no slide. side: the stored side, or undefined. docDice: the stored entries,
// for the first counts of the keys.
export function shelfFromDocument(trayKey, side) {
  const docDice = side?.dice ?? {}
  const shelf = Object.entries(docDice)
    .filter(([, d]) => d.place === 'shelf' && FACES[d.face - 1] && Number.isFinite(d.order))
    .slice(0, MAX_DICE)
    .map(([id, d]) => ({ id, order: d.order, face: d.face, symbol: FACES[d.face - 1].symbol }))
  const dice = new Map()
  const ids = []
  sortShelfEntries(shelf).forEach((d, index) => {
    const q = trayToWorldRotation(trayKey, flatRotation(d.face))
    const p = trayToWorld(trayKey, shelfSlot(index))
    dice.set(d.id, {
      ...d,
      doc: dieEntry(d.order, 'shelf', { face: d.face }),
      body: null,
      state: 'shelf',
      waiting: false,
      settling: false,
      stillTime: 0,
      throwTime: 0,
      slot: index,
      moving: false,
      spawn: { position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w] },
    })
    ids.push(d.id)
  })
  return { dice, ids, docDice, critsUsed: side?.critsUsed === true }
}
