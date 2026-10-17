// URLs of the files in src/assets. Vite adds a content hash to each built file name,
// so a changed file gets a new URL and the host can let browsers cache all of them forever.
const URLS = import.meta.glob(['./**/*', '!./index.js'], {
  eager: true,
  query: '?url',
  import: 'default',
})

// path is relative to src/assets, for example 'terrain/truck.glb'
export function assetUrl(path) {
  const url = URLS[`./${path}`]
  if (!url) throw new Error(`No asset at src/assets/${path}`)
  return url
}

// Whether src/assets has the file (a new map may have no card image yet)
export const hasAsset = (path) => `./${path}` in URLS

// The [path, url] pairs of the files whose path (relative to src/assets) passes `match`
export const assetEntries = (match) =>
  Object.entries(URLS)
    .map(([path, url]) => [path.slice(2), url])
    .filter(([path]) => match(path))
