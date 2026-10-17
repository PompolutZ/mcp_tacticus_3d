// The list of the models page (debug/ModelsPage.jsx): the candidate files and the game models, then sorted by
// file size (sortBySize). Plain functions without Vite imports, so that Node tests run them.

const GAME_FILE = /^characters\/([^/]+)\/(model|transform|construct)(?:-(\d+))?\.glb$/

// The kind of a game file that is not the first model, for the row label
function kindLabel(kind, n) {
  if (kind === 'transform') return 'transform'
  if (kind === 'construct') return `construct ${n}`
  return n ? `model ${n}` : ''
}

// candidates: { '/model-candidates/x.glb': url }. assets: [[path relative to src/assets, url]]. names: { key: name }
// (characters.json). Returns [{ id, group: 'candidate' | 'game', name, url }] in name order: candidates by file
// name, then game models by name. A game row has the character name, and the kind when the file is not model.glb.
export function buildModelList({ candidates, assets, names }) {
  const candidateRows = Object.entries(candidates)
    .map(([path, url]) => ({
      id: path,
      group: 'candidate',
      name: path
        .split('/')
        .pop()
        .replace(/\.glb$/, ''),
      url,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const gameRows = []
  for (const [path, url] of assets) {
    const m = GAME_FILE.exec(path)
    if (!m) continue
    const [, key, kind, n] = m
    const label = kindLabel(kind, n ? Number(n) : 0)
    const name = names[key]?.name ?? key
    gameRows.push({ id: path, group: 'game', name: label ? `${name} (${label})` : name, url })
  }
  gameRows.sort((a, b) => a.name.localeCompare(b.name))
  return [...candidateRows, ...gameRows]
}

// The rows whose name has `text` in it, upper or lower case
export function filterModels(list, text) {
  const needle = text.trim().toLowerCase()
  return list.filter((row) => row.name.toLowerCase().includes(needle))
}

// The rows by file size, largest first. sizes: { [url]: bytes }. A row with no known size goes after the others,
// in the order it had. Does not change `list`.
export function sortBySize(list, sizes) {
  const known = (row) => Number.isFinite(sizes[row.url])
  return [
    ...list.filter(known).sort((a, b) => sizes[b.url] - sizes[a.url]),
    ...list.filter((row) => !known(row)),
  ]
}
