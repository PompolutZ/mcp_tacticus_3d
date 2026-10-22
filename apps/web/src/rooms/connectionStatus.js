// The words of the connection states of a multiplayer room (net/peer.js), for the tag of the other player
// (ui/Scoreboard.jsx). No imports, so a Node test can run it.
export const STATUS = {
  waiting: 'Waiting',
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  failed: 'Could not connect',
  stopped: 'Not here',
}

export const FAILED_TITLE =
  'Could not connect directly. One of the networks blocks peer-to-peer connections.'
