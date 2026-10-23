import { BoardCard } from './BoardCard.jsx'
import { getRoomImage } from './roomImage.js'
import { getServerRoomImage } from './serverStore.js'
import { useBoardImageUrl } from './useBoardImageUrl.js'

// The card of a room on the custom board, for the lobby tile and the join page. board: { name, author, hasImage }
// (rooms/roomBoard.js). multiplayer: the image comes from the server, else from IndexedDB of this browser.
export function RoomBoardCard({ code, multiplayer, board, className }) {
  const load = board.hasImage
    ? () => (multiplayer ? getServerRoomImage(code) : getRoomImage(code))
    : null
  const imageUrl = useBoardImageUrl(load, `${multiplayer}:${code}`)
  return (
    <BoardCard className={className} name={board.name} author={board.author} imageUrl={imageUrl} />
  )
}
