// Bytes on the WebRTC connection, from getStats() (docs/features/peer-to-peer.md, "Traffic per game"). Plain functions, no browser calls,
// so node --test can load them. A log line holds only numbers and words, never an SDP or a packet.

// The stats of a report as an array. report: an RTCStatsReport or a Map.
function statsOf(report) {
  return [...report.values()]
}

// { sent, received, relayed } of the selected candidate pair, or null when there is none.
// Chrome and Safari name the pair in the transport stats. Firefox marks the pair with `selected`.
export function trafficOf(report) {
  if (!report) return null
  const all = statsOf(report)
  const transport = all.find((s) => s.type === 'transport' && s.selectedCandidatePairId)
  const pair = transport
    ? report.get(transport.selectedCandidatePairId)
    : all.find((s) => s.type === 'candidate-pair' && s.selected === true)
  if (!pair) return null
  const relay = (id) => report.get(id)?.candidateType === 'relay'
  return {
    sent: pair.bytesSent ?? 0,
    received: pair.bytesReceived ?? 0,
    relayed: relay(pair.localCandidateId) || relay(pair.remoteCandidateId),
  }
}

// 1234567 -> '1.2 MB', 1234 -> '1.2 KB', 0 -> '0.0 KB'
export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}

// Whole minutes of a time in ms
const minutesOf = (ms) => Math.round(ms / 60_000)

// The sum of connections { sent, received, ms }
export function sumTraffic(list) {
  const total = { sent: 0, received: 0, ms: 0 }
  for (const c of list) {
    total.sent += c.sent
    total.received += c.received
    total.ms += c.ms
  }
  return total
}

// The log line. connection: { sent, received, ms, relayed }. table: { sent, received, ms }.
export function trafficLine(connection, table) {
  const way = connection.relayed ? 'relayed' : 'direct'
  return (
    `traffic: connection ${formatBytes(connection.sent)} sent, ` +
    `${formatBytes(connection.received)} received, ${minutesOf(connection.ms)} min, ${way}; ` +
    `table ${formatBytes(table.sent)} sent, ${formatBytes(table.received)} received, ` +
    `${minutesOf(table.ms)} min`
  )
}
