// The table writer of a multiplayer room (docs/plans/implement-backend/07-multiplayer-rooms.md, decision 16).
// It imports no module that reads import.meta.env, so node --test can load it. The API call and the timers
// are arguments.

import * as Y from 'yjs'

// A change waits this long (ms) before it is written
export const WRITE_DELAY = 60_000
// keepalive allows 64 KB per page, so a hidden-tab write uses it only up to this size
export const KEEPALIVE_LIMIT = 60 * 1024

// True when doc has changes that the server bytes do not have, for example from a page that closed before its
// write. Compares snapshots, because a state vector does not change on a delete. Both docs are rebuilt with
// gc: false, as Yjs asks for snapshots. Checked: a delete-only change shows in the test.
export function hasLocalChanges(doc, serverBytes) {
  const copy = new Y.Doc({ gc: false })
  const local = new Y.Doc({ gc: false })
  try {
    Y.applyUpdate(copy, serverBytes)
    Y.applyUpdate(local, Y.encodeStateAsUpdate(doc))
    return !Y.equalSnapshots(Y.snapshot(local), Y.snapshot(copy))
  } finally {
    copy.destroy()
    local.destroy()
  }
}

// Writes the document to the server. A change with an origin other than 'server' starts a timer. When it
// ends, put(bytes, { keepalive }) writes the whole document. put rejects with an error that has a `status`
// (0: no answer). changed: the document has changes already (hasLocalChanges), so flush() writes them.
// Returns { flush({ hidden }), stop }. flush: writes at once when the table changed. stop: ends the writer.
// onGone(): the server has no room (404). onStop(text): the writer stopped (403 or 413).
export function watchServerTable({
  doc,
  put,
  onGone,
  onStop,
  changed = false,
  delay = WRITE_DELAY,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let dirty = changed
  let timer = null
  let writing = false
  // A flush that came during a write: the next write starts when this one ends
  let flushHidden = null
  let ended = false

  function schedule() {
    if (timer !== null || ended) return
    timer = setTimer(() => {
      timer = null
      write(false)
    }, delay)
  }

  function onUpdate(_update, origin) {
    if (origin === 'server') return
    dirty = true
    if (!writing) schedule()
  }

  async function write(hidden) {
    if (ended || writing || !dirty) return
    clearTimer(timer)
    timer = null
    const bytes = Y.encodeStateAsUpdate(doc)
    dirty = false
    writing = true
    try {
      await put(bytes, { keepalive: hidden && bytes.length <= KEEPALIVE_LIMIT })
    } catch (err) {
      writing = false
      if (ended) return
      if (err?.status === 404) {
        ended = true
        onGone()
      } else if (err?.status === 403 || err?.status === 413) {
        ended = true
        onStop(err.message)
      } else {
        // No answer, 409 or 5xx: keep the change, try again later
        dirty = true
        flushHidden = null
        schedule()
      }
      return
    }
    writing = false
    if (ended) return
    if (flushHidden !== null) {
      const hidden = flushHidden
      flushHidden = null
      write(hidden)
    } else if (dirty) schedule()
  }

  doc.on('update', onUpdate)
  return {
    flush({ hidden = false } = {}) {
      if (writing) flushHidden = hidden
      else write(hidden)
    },
    stop() {
      ended = true
      clearTimer(timer)
      timer = null
      doc.off('update', onUpdate)
    },
  }
}
