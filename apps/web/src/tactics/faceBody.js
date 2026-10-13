// Parser of the Jarvis card body markup, for the Team Tactic face (components/TacticFace.jsx).
// Port of Jarvis' own parser. A pure function: string in, node tree out.
//
// The body is split on "|". The first character of a part sets its kind:
//   \        paragraph break
//   -        row (a flex box, empty)
//   !x       icon x
//   *text    bold (the text is parsed again)
//   ~text    bullet; inside it "&" stands for "|"
//   §slug§Label  a condition name, drawn as the label with a capital
//   <token>Label a token name, the label is parsed again ("&" stands for "|")
//   other    plain text
// A part that starts with "." joins the part before it: that part and the "." stay on one line.
//
// Empty parts give no node.
// Nodes: { t: 'text', text } | { t: 'br' } | { t: 'row' } | { t: 'icon', name } |
//   { t: 'bold' | 'bullet' | 'token', children } | { t: 'cond', text } | { t: 'nobreak', children }

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export function parseBody(source) {
  const parts = source.split('|')
  const out = []
  let glued = false
  parts.forEach((raw, i) => {
    let part = raw
    if (glued) {
      glued = false
      part = part.slice(1)
    }
    if (i + 1 < parts.length && parts[i + 1][0] === '.') glued = true
    const node = parsePart(part)
    if (!node) return
    out.push(glued ? { t: 'nobreak', children: [node] } : node)
  })
  return out
}

function parsePart(part) {
  if (!part) return null
  switch (part[0]) {
    case '\\':
      return { t: 'br' }
    case '-':
      return { t: 'row' }
    case '!':
      return { t: 'icon', name: part.slice(1) }
    case '*':
      return { t: 'bold', children: parseBody(part.slice(1)) }
    case '~':
      return {
        t: 'bullet',
        children: parseBody(part.replace(/^~\s?/, '').replaceAll('&', '|')),
      }
    case '§': {
      const m = part.match(/§([^§]+)§(.+)/)
      return m ? { t: 'cond', text: capitalize(m[2]) } : { t: 'text', text: part }
    }
    case '<': {
      const m = part.match(/<([^>]+)>(.+)/)
      return m
        ? { t: 'token', children: parseBody(m[2].replaceAll('&', '|')) }
        : { t: 'text', text: part }
    }
    default:
      return { t: 'text', text: part }
  }
}
