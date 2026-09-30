import jarvisData from './jarvis-characters.json'
import migratedData from './characters.json'

function baseName(mm) {
  if (mm <= 35) return 'small'
  if (mm <= 50) return 'medium'
  return 'large'
}

const migrated = new Map()
for (const [slug, ch] of Object.entries(migratedData)) {
  migrated.set(ch.id, { slug, ...ch })
}

export const ROSTER = jarvisData
  .filter(jch => jch.exportCode)
  .map(jch => {
    const m = migrated.get(jch.exportCode)
    return {
      slug: m?.slug || jch.slug,
      name: m?.name || jch.name,
      mctCode: jch.exportCode,
      available: !!m,
      base: m?.base || baseName(jch.baseSize),
      figure: m?.figure || 'model',
      rotation: m?.rotation || 0,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

export function searchCharacters(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return ROSTER.filter(ch =>
    ch.name.toLowerCase().includes(q) || ch.mctCode.startsWith(q)
  )
}
