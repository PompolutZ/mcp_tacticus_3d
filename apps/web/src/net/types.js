// The shapes that cross the network or the document, as JSDoc typedefs. Checked by `pnpm typecheck`
// (apps/web/jsconfig.json). Layout and rules: docs/features/peer-to-peer.md.

/**
 * A piece key: `<kind>:<id>`, for example `character:abc`, `die:1`, `tool:blue:ruler`, `token:7`.
 * @typedef {string} PieceKey
 */

/**
 * The cursor on the table: [x, y, z], or null when the pointer left the table.
 * @typedef {number[] | null} LiveCursor
 */

/**
 * A packet on the live channel. s: the sequence number of the sender. p: piece key to its numbers (the layout
 * of each kind is in livePose.js). c: the cursor.
 * @typedef {object} LivePacket
 * @property {number} s
 * @property {Record<PieceKey, number[]>} [p]
 * @property {LiveCursor} [c]
 */

/**
 * What a live subscriber gets: the parts of a packet that are newer than the last of their key.
 * @typedef {object} LiveUpdate
 * @property {Record<PieceKey, number[]>} p
 * @property {LiveCursor} [c]
 */

/**
 * The hello of a peer, as peer.js sends and reads it. schema is null for the hello of an older build.
 * @typedef {object} Hello
 * @property {string} build
 * @property {number | null} schema
 */

/**
 * A message of the signaling server (apps/api).
 * @typedef {object} SignalMessage
 * @property {string} from
 * @property {string} to The peer id, or `*` for all
 * @property {string} type hello, offer, answer or bye
 * @property {string} data
 */

/**
 * The awareness state that presence.js sets.
 * @typedef {object} PresenceState
 * @property {PieceKey[]} selection
 * @property {string[]} tools Tool kinds
 * @property {{ key: PieceKey, mode: string } | null} mark
 * @property {{ id: string, at: number[] } | null} ping
 */

/**
 * The awareness state that ownership.js sets.
 * @typedef {object} OwnershipState
 * @property {PieceKey[]} owns The claimed keys
 * @property {PieceKey | null} drag The key of the piece in a token drag
 * @property {{ key: PieceKey, tokenKey: PieceKey } | null} spawn
 */

/**
 * A store over a Y.Map record.
 * @typedef {object} RecordStore
 * @property {() => any} read
 * @property {(key: string) => any} get
 * @property {(next: any | ((current: any) => any)) => void} set
 * @property {(key: string, next: any | ((current: any) => any)) => void} setField
 * @property {(fn: () => void) => () => void} subscribe
 * @property {() => any} getSnapshot
 */

/**
 * A store over a Y.Map list of entities `{ id, ...fields }`, in order.
 * @typedef {object} ListStore
 * @property {() => any[]} read
 * @property {(next: any[] | ((current: any[]) => any[])) => void} set
 * @property {(fn: () => void) => () => void} subscribe
 * @property {() => any[]} getSnapshot
 */

/**
 * The stores of one table (createTable in doc.js).
 * @typedef {object} Table
 * @property {import('yjs').Doc} doc
 * @property {(fn: () => void) => void} transact
 * @property {RecordStore} game
 * @property {RecordStore} rosters
 * @property {RecordStore} setup
 * @property {ListStore} terrain
 * @property {ListStore} characters
 * @property {RecordStore} poses
 * @property {RecordStore} tools
 * @property {RecordStore} dice
 * @property {ListStore} rolls
 * @property {ListStore} log
 * @property {ListStore} tokens
 * @property {ListStore} tactics
 * @property {ListStore} looseTokens
 * @property {ListStore} tokenPiles
 */

export {}
