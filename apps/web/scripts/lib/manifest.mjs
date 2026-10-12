// The image store of the migrate scripts that convert TTS images to WebP files: crisis, tactics and tokens.

import fs from 'node:fs'
import path from 'node:path'
import { imageToWebp } from './convert.mjs'
import { outputPath } from './files.mjs'
import { cachedFile } from './tts.mjs'

// `manifest` maps a written file to the URL it came from. A file is `{ file, url }`: the path under `assets`
// and the TTS source URL. `maxSize` is the largest side of the written image.
export function createImageStore({ assets, manifest, force, maxSize }) {
  // A file is migrated when the manifest has its URL and the file exists
  const migrated = (f) => manifest[f.file] === f.url && fs.existsSync(path.join(assets, f.file))
  return {
    // A file can be written when TTS has it in the cache, or when it is already migrated from the same URL
    available: (f) => Boolean(cachedFile(f.url)) || migrated(f),
    migrated,
    // Returns true when the file was converted
    convert(f) {
      if (migrated(f) && (!force || !cachedFile(f.url))) return false
      fs.writeFileSync(outputPath(assets, f.file), imageToWebp(cachedFile(f.url), maxSize))
      return true
    },
  }
}
