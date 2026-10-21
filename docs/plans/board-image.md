# Plan: board image

## Request

The map cards show the map from above. A custom board gets the same: a top view made when the board is saved to the account. The image is stored in Mongo. Each room made on the board keeps its own copy of the image, the board name and the author, so the lobby tile shows them.

## Decisions

1. **Capture.** "Save to account" renders the mat and the terrain once from straight above, with an orthographic camera, into an off-screen render target. The view is the mat square only. 512 × 512 px, WebP. Nothing changes on screen. One function in `src/terrain/` makes the image from the scene, the mat and the terrain.
2. **Account record.** `customBoards` keeps the image as binary data next to the board. `PUT /me/board` takes `{ board, image }`, the image as base64. The server checks the WebP signature and a size limit of 150 KB. The body limit grows to fit. `GET /me/board` says if there is an image. `GET /me/board/image` returns the bytes as `image/webp`. A board without an image (saved before) still works.
3. **Card.** The "My board" card and the tile of a custom room draw the card back with the board name, "by <author>" and the top view, in HTML over the card back, in the places of the map cards. The top view is the only image. Without an image, the card back alone, as now.
4. **Room copy.** A room made on the board copies the image, the name and the author when it is made. A later save to the account does not change the room.
   - Multiplayer room: in the room record in Mongo. `GET /rooms/{code}/image` returns the image to both players. The room name and author come with the room data. Deleting the room deletes its copy.
   - Single player room: the name and author in the room record in localStorage, the image in IndexedDB keyed by the room code (localStorage is too small for many images). Deleting the room deletes the image.
5. **Not included.** The exported JSON file has no image.

## Steps

### Step 1: capture, account save, My board card

- Decision 1, 2, 3 for the dialog card. API routes, stores, tests. Web: capture, `src/api/board.js`, the card.
- Tests: the route checks (not WebP, too big, no image), the image round trip, `DELETE /me` removes it.

### Step 2: room copies, lobby tiles

- Decision 3 for the lobby tile, decision 4.
- Tests: a room on a board keeps its image, name and author after a new save to the account. Delete removes the copy. Random rooms have none.

Each step: `pnpm format`, `pnpm lint` (no new warnings), `pnpm test`, `pnpm typecheck`, `pnpm --filter api test`, `pnpm --filter api test:mongo`, `pnpm --filter web build`. Docs: `map-builder.md`, `rooms.md`, `auth.md`, `backend.md`.

## User checks

- Save to account: no visible change on screen. The "My board" card shows the top view, the name and "by <author>".
- A new room on the board: its lobby tile shows the same card. Save another board to the account: the old room still shows its own board.
- Multiplayer: the guest's lobby tile shows the image too.
- Delete the room: no error, the tile goes.
