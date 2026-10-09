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
