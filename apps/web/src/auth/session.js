// The login session (docs/feature-auth.md, "Login flow" and "Session"; plan decisions 10, 12, 13). This is
// the only file that touches localStorage and sessionStorage. status: off (login is not on), loading, out,
// in, error (the server does not answer).

import { ApiError, api, onUnauthorized, setToken } from '../api/client.js'
import { authorizeUrl, randomState, readCallback } from './oauth.js'

const TOKEN_KEY = 'mcp-assist-3d/session'
const LOGIN_KEY = 'mcp-assist-3d/login'
const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID
const FAILED = 'Login failed. Try again.'

// Production without a Discord client id does nothing and makes no API call
export const AUTH_ON = Boolean(CLIENT_ID) || import.meta.env.DEV
// The Discord button needs the client id. The dev login needs only a dev build.
export const DISCORD_ON = Boolean(CLIENT_ID)

let state = { status: AUTH_ON ? 'loading' : 'off', user: null }
const listeners = new Set()

function setState(next) {
  state = next
  listeners.forEach((l) => l())
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot() {
  return state
}

function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
  setToken(token)
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  setToken(null)
}

function readSaved() {
  try {
    return JSON.parse(sessionStorage.getItem(LOGIN_KEY))
  } catch {
    return null
  }
}

// A 401 on a request with a token: the token is bad or the user is gone
onUnauthorized(() => {
  clearToken()
  setState({ status: 'out', user: null })
})

let started = null

// Runs once per page load: StrictMode runs effects twice, and a Discord code works only once. Resolves to
// { returnHash, error } for Root.jsx: the page to open after a login (no '#'), and a message to show.
export function startSession() {
  started ??= run()
  return started
}

async function run() {
  const result = { returnHash: null, error: null }
  if (!AUTH_ON) return result
  const callback = readCallback(window.location.search, readSaved())
  if (callback) {
    // Remove the query and the saved state first, so a reload does not post the code again
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    sessionStorage.removeItem(LOGIN_KEY)
    if (callback.error) result.error = callback.error
    else {
      try {
        const { token, user } = await api('/auth/discord', {
          method: 'POST',
          json: { code: callback.code, redirectUri: redirectUri() },
        })
        saveToken(token)
        setState({ status: 'in', user })
        result.returnHash = callback.returnHash.replace(/^#/, '')
        return result
      } catch {
        result.error = FAILED
      }
    }
  }
  await loadUser()
  return result
}

function redirectUri() {
  return `${window.location.origin}/`
}

// With a stored token: GET /me
async function loadUser() {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return setState({ status: 'out', user: null })
  setToken(token)
  try {
    const res = await api('/me')
    if (res.token) saveToken(res.token)
    setState({ status: 'in', user: res.user })
  } catch (err) {
    // A 401 already cleared the token. Another failure keeps it, so a reload tries again.
    if (!(err instanceof ApiError) || err.status !== 401) setState({ status: 'error', user: null })
  }
}

// Goes to Discord. The page comes back with ?code=... (see run).
export function login() {
  if (!CLIENT_ID) return
  const oauthState = randomState()
  sessionStorage.setItem(
    LOGIN_KEY,
    JSON.stringify({ state: oauthState, returnHash: window.location.hash }),
  )
  window.location.assign(
    authorizeUrl({ clientId: CLIENT_ID, redirectUri: redirectUri(), state: oauthState }),
  )
}

// Dev builds only: the API makes a user from a name. Resolves to an error text, or null.
export async function devLogin(name) {
  if (!import.meta.env.DEV) return null
  try {
    const { token, user } = await api('/auth/dev', { method: 'POST', json: { name } })
    saveToken(token)
    setState({ status: 'in', user })
    return null
  } catch (err) {
    return err instanceof ApiError && err.status === 400
      ? 'Enter a name (1 to 32 characters).'
      : FAILED
  }
}

// No server call: the token stays valid until it expires (docs/feature-auth.md, "Session")
export function logout() {
  clearToken()
  setState({ status: 'out', user: null })
}
