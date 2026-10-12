// Shared file helpers of the migrate scripts: JSON in and out, and asset paths.

import fs from 'node:fs'
import path from 'node:path'

// The parsed object of the first of `file` and `fallback` that exists, else {}
export function readJson(file, fallback = file) {
  const found = [file, fallback].find((f) => fs.existsSync(f))
  return found ? JSON.parse(fs.readFileSync(found, 'utf8')) : {}
}

// Pretty JSON with a trailing newline. With sortKeys, the keys of an object are in sorted order, so that a new
// entry gives a small diff. Only the top level is sorted, and an array is never changed.
export function writeJson(file, data, { sortKeys = true } = {}) {
  const out =
    sortKeys && data && typeof data === 'object' && !Array.isArray(data)
      ? Object.fromEntries(
          Object.keys(data)
            .sort()
            .map((k) => [k, data[k]]),
        )
      : data
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`)
}

// The full path of `file` under `root`. The folder is created.
export function outputPath(root, file) {
  const full = path.join(root, file)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  return full
}
