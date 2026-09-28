// Reads a Lua table literal, such as `terrainDatabase = { ... }` in the mod's Terrain Database script.
// Supports what the mod scripts use: tables, quoted and long strings, numbers, true/false/nil,
// comments, parentheses, and `..` concatenation with `local NAME = "..."` string variables.

// Value of the top-level assignment `name = ...` in source. If source assigns name more than once,
// the last assignment is read, because it is the value after the script has run.
// resolveName(name): value of a name that is not a local string variable, for example `large` or `IG.mind`.
//   Without it, such a name is an error.
export function readLuaAssignment(source, name, { resolveName } = {}) {
  const vars = {}
  for (const [, key, value] of source.matchAll(/^local (\w+) = "([^"\n]*)"/gm)) vars[key] = value
  const start = [...source.matchAll(new RegExp(`^${name}\\s*=\\s*`, 'gm'))].at(-1)
  if (!start) throw new Error(`No "${name} =" in the Lua source`)
  return new Parser(source, start.index + start[0].length, vars, resolveName).expression()
}

const NUMBER = /-?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y
// A name, with fields: large, IG.mind
const NAME = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/y
const FIELD_NAME = /([A-Za-z_]\w*)\s*=(?!=)/y
const LONG_BRACKET = /\[(=*)\[/y

class Parser {
  constructor(src, pos, vars, resolveName) {
    this.src = src
    this.pos = pos
    this.vars = vars
    this.resolveName = resolveName
  }

  fail(message) {
    const line = this.src.slice(0, this.pos).split('\n').length
    throw new Error(`Lua parse error at line ${line}: ${message}`)
  }

  match(regex) {
    regex.lastIndex = this.pos
    const m = regex.exec(this.src)
    if (m) this.pos = regex.lastIndex
    return m
  }

  skipSpace() {
    const { src } = this
    for (;;) {
      while (/\s/.test(src[this.pos] ?? '')) this.pos++
      if (!src.startsWith('--', this.pos)) return
      this.pos += 2
      const long = this.match(LONG_BRACKET)
      if (long) this.longString(long[1])
      else {
        const end = src.indexOf('\n', this.pos)
        this.pos = end < 0 ? src.length : end + 1
      }
    }
  }

  // Terms joined with ..
  expression() {
    let value = this.term()
    this.skipSpace()
    while (this.src.startsWith('..', this.pos)) {
      this.pos += 2
      value = String(value) + String(this.term())
      this.skipSpace()
    }
    return value
  }

  term() {
    this.skipSpace()
    const c = this.src[this.pos]
    if (c === '{') return this.table()
    if (c === '(') {
      this.pos++
      const value = this.expression()
      this.expect(')')
      return value
    }
    if (c === '"' || c === "'") return this.quotedString(c)
    const long = this.match(LONG_BRACKET)
    if (long) return this.longString(long[1])
    const number = this.match(NUMBER)
    if (number) return Number(number[0])
    const name = this.match(NAME)
    if (name) {
      const word = name[0]
      if (word === 'true') return true
      if (word === 'false') return false
      if (word === 'nil') return null
      if (word in this.vars) return this.vars[word]
      if (this.resolveName) return this.resolveName(word)
      this.fail(`unknown name ${word}`)
    }
    this.fail(`unexpected ${JSON.stringify(c)}`)
  }

  // [[...]] or [=[...]=]; the opening bracket is already read
  longString(level) {
    const close = `]${level}]`
    const end = this.src.indexOf(close, this.pos)
    if (end < 0) this.fail('long string is not closed')
    // Lua drops a newline right after the opening bracket
    const value = this.src.slice(this.pos, end).replace(/^\r?\n/, '')
    this.pos = end + close.length
    return value
  }

  quotedString(quote) {
    const { src } = this
    let out = ''
    this.pos++
    for (;;) {
      const c = src[this.pos++]
      if (c === undefined || c === '\n') this.fail('string is not closed')
      if (c === quote) return out
      if (c !== '\\') {
        out += c
        continue
      }
      const e = src[this.pos++]
      const escapes = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '\n': '\n' }
      if (e in escapes) out += escapes[e]
      else if (/\d/.test(e)) {
        const digits = /\d{1,3}/y
        digits.lastIndex = this.pos - 1
        const m = digits.exec(src)
        out += String.fromCharCode(Number(m[0]))
        this.pos = digits.lastIndex
      } else this.fail(`unknown escape \\${e}`)
    }
  }

  // A table with only list items becomes an array. A table with named fields becomes an object.
  table() {
    this.pos++
    const list = []
    const fields = {}
    let named = false
    for (;;) {
      this.skipSpace()
      if (this.src[this.pos] === '}') {
        this.pos++
        break
      }
      const field = this.match(FIELD_NAME)
      if (field) {
        fields[field[1]] = this.expression()
        named = true
      } else if (this.src[this.pos] === '[' && !this.src.startsWith('[[', this.pos) && !this.src.startsWith('[=', this.pos)) {
        this.pos++
        const key = this.expression()
        this.expect(']')
        this.expect('=')
        fields[key] = this.expression()
        named = true
      } else list.push(this.expression())
      this.skipSpace()
      const sep = this.src[this.pos]
      if (sep === ',' || sep === ';') this.pos++
      else if (sep !== '}') this.fail(`expected , or } but found ${JSON.stringify(sep)}`)
    }
    if (!named) return list
    list.forEach((value, i) => { fields[i + 1] = value })
    return fields
  }

  expect(text) {
    this.skipSpace()
    if (!this.src.startsWith(text, this.pos)) this.fail(`expected ${text}`)
    this.pos += text.length
  }
}
