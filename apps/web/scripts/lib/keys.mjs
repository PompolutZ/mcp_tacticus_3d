// Shared keys of the migrate scripts.

// Name as a key. "M'Kraan" → mkraan, "S.W.O.R.D." → sword. With keepPunctuation, the apostrophes and dots become
// a "-" like other punctuation: "King T'Challa" → king-t-challa. Characters and terrain have these keys already.
export function slug(text, { keepPunctuation = false } = {}) {
  const lower = text.toLowerCase().normalize('NFKD')
  return (keepPunctuation ? lower : lower.replace(/['‘’.]/g, ''))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Map from each row to its key (the name as a slug). Throws when two rows have the same key.
export function uniqueKeys(rows, { name = (r) => r.name, noun = 'cards' } = {}) {
  const keyMap = new Map(rows.map((r) => [r, slug(name(r))]))
  const seen = new Map()
  for (const [row, key] of keyMap) {
    if (seen.has(key))
      throw new Error(
        `The ${noun} "${name(seen.get(key))}" and "${name(row)}" have the same key ${key}`,
      )
    seen.set(key, row)
  }
  return keyMap
}
