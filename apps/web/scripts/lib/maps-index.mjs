// Adds a map to src/terrain/maps/index.js: an import line and an entry in the MAPS list.
// A map that is in the file is not added again. The new map goes last.

// "dimensional-assault" → dimensionalAssault
export function importName(id) {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, '_$1')
}

// Returns the new source, or the same string when the map is already there
export function addMapToIndex(source, id) {
  const importLine = `import ${importName(id)} from './${id}.json' with { type: 'json' }`
  if (source.includes(importLine)) return source
  const lines = source.split('\n')
  const lastImport = lines.findLastIndex((l) => l.startsWith('import '))
  const listEnd = lines.findIndex((l) => l.startsWith('  ].map('))
  if (lastImport < 0 || listEnd < 0) throw new Error('maps/index.js has an unexpected format')
  lines.splice(listEnd, 0, `    ${importName(id)},`)
  lines.splice(lastImport + 1, 0, importLine)
  return lines.join('\n')
}
