// Jarvis Protocol requests of the fetch-jarvis scripts.

// Jarvis returns 403 for an unusual User-Agent or a Referer from another site
const JARVIS_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://www.jarvis-protocol.com/',
}

// The JSON of the response. Throws when the response is not ok.
export async function fetchJarvis(url) {
  const res = await fetch(url, { headers: JARVIS_HEADERS })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return res.json()
}
