// The command line of the migrate scripts: --list, --force, --out <dir>, --help.

import { parseArgs } from 'node:util'

// Prints `usage` and exits when the arguments are not valid: with 0 on --help, else with 1.
// `isValid(opts, positionals)` defaults to "no positional argument".
export function parseMigrateArgs(usage, isValid = (opts, positionals) => !positionals.length) {
  const { values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      list: { type: 'boolean' },
      force: { type: 'boolean' },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (opts.help || !isValid(opts, positionals)) {
    console.log(usage)
    process.exit(opts.help ? 0 : 1)
  }
  return { opts, positionals }
}
