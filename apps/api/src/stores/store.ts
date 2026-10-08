export type DbStatus = 'none' | 'ok' | 'error'

// Later steps add the users, rooms and messages stores here.
export interface Store {
  ping(): Promise<DbStatus>
}
