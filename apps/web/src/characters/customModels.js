// Files that a custom model (photos-to-glb) replaced. migrate-characters.mjs never writes them.
// The list is custom-models.json next to this file, see docs/features/custom-models.md. Plain module:
// the scripts import it too.

// True when `file` of character `key` is in the list. The --force option does not change this.
export function isCustomModel(list, key, file) {
  return Boolean(list[key]?.[file])
}
