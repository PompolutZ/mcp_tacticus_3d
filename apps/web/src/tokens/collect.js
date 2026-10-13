// The collect flag of a token entry in tokens.json, in its own module so a plain node test can import it
// (tokens.js imports the JSON). See isCollected() in tokens.js.
export function isCollectedEntry(entry) {
  return entry?.collect === true
}
