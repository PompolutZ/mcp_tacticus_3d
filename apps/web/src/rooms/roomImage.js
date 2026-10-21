// The top view of the board of single player rooms, in IndexedDB keyed by the room code (docs/features/map-builder.md,
// "Board in a new room"). localStorage is too small for many images. Every function answers when IndexedDB is off
// or fails: no image is not an error. No React.

const DB_NAME = 'mcp-assist-3d/room-images'
const STORE = 'images'

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'))
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Runs one request on the store. mode: 'readonly' or 'readwrite'. Resolves with its result, or undefined on a failure.
async function run(mode, make) {
  let db
  try {
    db = await open()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, mode)
      const request = make(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = tx.onabort = () => resolve(undefined)
    })
  } catch {
    return undefined
  } finally {
    db?.close()
  }
}

// Stores the image Blob of a room. Returns false when the browser did not store it.
export async function putRoomImage(code, blob) {
  return (await run('readwrite', (store) => store.put(blob, code))) !== undefined
}

// The image Blob of a room, or null
export async function getRoomImage(code) {
  return (await run('readonly', (store) => store.get(code))) ?? null
}

export async function deleteRoomImage(code) {
  await run('readwrite', (store) => store.delete(code))
}

// The codes in keys that are not in codes
export function orphanImageCodes(keys, codes) {
  const keep = new Set(codes)
  return keys.filter((key) => !keep.has(key))
}

// Deletes the images of rooms that are gone (deleted in another way, or by the cleanup of old records)
export async function deleteOrphanRoomImages(codes) {
  const keys = (await run('readonly', (store) => store.getAllKeys())) ?? []
  for (const key of orphanImageCodes(keys, codes)) await deleteRoomImage(key)
}
