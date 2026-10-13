// The command line of the migrate scripts: --list, --force, --out <dir>, --help, and --download for the scripts that can fill the TTS cache.

import { parseArgs } from 'node:util'

// Prints `usage` and exits when the arguments are not valid: with 0 on --help, else with 1.
// `isValid(opts, positionals)` defaults to "no positional argument". `--download` is accepted only with { download: true }.
export function parseMigrateArgs(
  usage,
  isValid = (opts, positionals) => !positionals.length,
  { download = false } = {},
) {
  const { values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      list: { type: 'boolean' },
      force: { type: 'boolean' },
      out: { type: 'string' },
      ...(download && { download: { type: 'boolean' } }),
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (opts.help || !isValid(opts, positionals)) {
    console.log(usage)
    process.exit(opts.help ? 0 : 1)
  }
  return { opts, positionals }
}
