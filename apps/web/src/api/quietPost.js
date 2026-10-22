// A send function for fire-and-forget reports (crash/reporter.js, analytics/track.js): POST the body as JSON
// with keepalive, so it outlives the page. The caller ignores a failure.
export function quietPost(path) {
  return async (body) => {
    // Loaded here: the client reads import.meta.env, which the node tests do not have
    const { api } = await import('./client.js')
    await api(path, { method: 'POST', json: body, keepalive: true })
  }
}
