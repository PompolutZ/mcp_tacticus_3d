// The fetch wrapper for the API (docs/feature-auth.md). It keeps the session token in memory, and the
// session (auth/session.js) sets it. It imports nothing from auth/, so there is no import cycle.

// The base URL has no trailing slash
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

let token = null
let unauthorizedHandler = null

export class ApiError extends Error {
  // status: the HTTP status, or 0 when the server did not answer
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function setToken(next) {
  token = next
}

// handler(): called on a 401 for a request that had a token
export function onUnauthorized(handler) {
  unauthorizedHandler = handler
}

// Sends json or bytes (if given) and returns the parsed JSON answer, or null for an answer without a body.
// bytes: a Uint8Array body. binary: the answer is a Uint8Array. keepalive: the request outlives the page.
export async function api(path, { method = 'GET', json, bytes, keepalive, binary } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const init = { method, headers }
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(json)
  } else if (bytes !== undefined) {
    headers['Content-Type'] = 'application/octet-stream'
    init.body = bytes
  }
  if (keepalive) init.keepalive = true
  let res
  try {
    res = await fetch(BASE + path, init)
  } catch {
    throw new ApiError(0, 'The server does not answer')
  }
  if (binary && res.ok) {
    try {
      return new Uint8Array(await res.arrayBuffer())
    } catch {
      throw new ApiError(0, 'The server does not answer')
    }
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token && unauthorizedHandler) unauthorizedHandler()
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`)
  }
  return data
}
