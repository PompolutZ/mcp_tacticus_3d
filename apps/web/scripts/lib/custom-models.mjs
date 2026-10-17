// Files that a custom model (photos-to-glb) replaced. migrate-characters.mjs never writes them.
// The list is scripts/custom-models.json, see docs/features/custom-models.md.

// True when `file` of character `key` is in the list. The --force option does not change this.
export function isCustomModel(list, key, file) {
  return Boolean(list[key]?.[file])
}
