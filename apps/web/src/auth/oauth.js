// The pure parts of the Discord login (docs/feature-auth.md, "Login flow"). No browser globals, so the
// tests run in node.

// A random string for the OAuth state
export function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// The Discord page that asks the player to log in. prompt=none skips the consent screen for a player who
// approved the app before.
export function authorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'identify',
    redirect_uri: redirectUri,
    state,
    prompt: 'none',
  })
  return `https://discord.com/oauth2/authorize?${params}`
}

// The answer of Discord in the query of the page. saved: { state, returnHash } from before the redirect, or
// null. Returns null (no callback), { code, returnHash }, or { error: text for the player }.
export function readCallback(search, saved) {
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const error = params.get('error')
  if (!code && !error) return null
  const failed = { error: 'Login failed. Try again.' }
  // A state that is not the saved one: another site may have started this login
  if (!saved?.state || params.get('state') !== saved.state) return failed
  if (error === 'access_denied') return { error: 'Login cancelled.' }
  if (error || !code) return failed
  return { code, returnHash: saved.returnHash ?? '' }
}
