import { HTTPException } from 'hono/http-exception'
import { userIdsOf, type RoomInfo, type Store, type UserDoc } from '../stores/store'
import { isRoomCode } from './code'

// Reads the room. A room whose host is gone is deleted, and answers 404.
export async function readRoom(
  store: Store,
  code: string,
): Promise<{ room: RoomInfo; users: Map<string, UserDoc> }> {
  const room = isRoomCode(code) ? await store.rooms.get(code) : null
  if (!room) throw new HTTPException(404, { message: 'Room not found' })
  const users = await store.users.getMany(userIdsOf([room]))
  if (!users.has(room.host)) {
    await store.rooms.delete(room._id)
    throw new HTTPException(404, { message: 'Room not found' })
  }
  return { room, users }
}
