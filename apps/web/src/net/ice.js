// The ICE servers of a connection (plan 08, decisions 13 and 22). STUN only in production, free.
// Cloudflare TURN comes in step 13.
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

// The local coturn of apps/api/compose.yaml (pnpm --filter api turn:up).
const DEV_TURN = {
  urls: ['turn:127.0.0.1:3478?transport=udp', 'turn:127.0.0.1:3478?transport=tcp'],
  username: 'dev',
  credential: 'dev',
}

// The config of an RTCPeerConnection. The caller passes dev and relay, so this file does not read
// import.meta.env. A dev build also has the local TURN server. relay sends all data through TURN.
export function iceConfig({ dev = false, relay = false } = {}) {
  const config = { iceServers: dev ? [...ICE_SERVERS, DEV_TURN] : ICE_SERVERS }
  if (dev && relay) config.iceTransportPolicy = 'relay'
  return config
}
