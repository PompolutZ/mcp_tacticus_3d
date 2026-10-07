// Parse and format MCT roster codes. No imports, so that a Node script can load it.
// See docs/feature-roster.md, "MCT code".

// kind of a card: 'character' | 'tactic' | 'secure' | 'extract'
const GROUPS = ['tactics', 'secure', 'extract']
const GROUP_OF_KIND = { tactic: 'tactics', secure: 'secure', extract: 'extract' }

// Plain search, like TTS: separators and the text around a group do not matter.
const GROUP_PATTERN = /\d{8}(?:-\d{8})*/g

// kindOf(code) gives a card kind or null. Each group of text keeps its order, duplicates stay.
export function parseRoster(text, kindOf) {
  const parsed = { characters: [], tactics: [], secure: [], extract: [], unknown: [] }
  for (const [group] of String(text ?? '').matchAll(GROUP_PATTERN)) {
    const codes = group.split('-')
    if (kindOf(codes[0]) === 'character') {
      const gems = []
      for (const gem of codes.slice(1)) {
        if (kindOf(gem) === 'tactic') gems.push(gem)
        else parsed.unknown.push(gem)
      }
      parsed.characters.push({ code: codes[0], gems })
      continue
    }
    // Not a character: every code counts on its own.
    for (const code of codes) {
      const key = GROUP_OF_KIND[kindOf(code)]
      if (key) parsed[key].push(code)
      else parsed.unknown.push(code)
    }
  }
  return parsed
}

// Jarvis format: characters (code-gem-gem), tactics, Secure, Extract, joined by commas.
export function formatMctCode(parsed) {
  return [
    ...parsed.characters.map(ch => [ch.code, ...ch.gems].join('-')),
    ...GROUPS.flatMap(group => parsed[group]),
  ].join(',')
}

export function isEmptyRoster(parsed) {
  return parsed.characters.length === 0 && GROUPS.every(group => parsed[group].length === 0)
}
