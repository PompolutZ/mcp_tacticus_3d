// String replace for an onBeforeCompile shader patch. Warns in dev when the three chunk
// marker is gone (a three upgrade renamed it), so the patch does not silently stop working.
export function patchShader(source, marker, replacement) {
  if (import.meta.env?.DEV && !source.includes(marker)) {
    console.warn(`Shader patch: "${marker}" not found, patch skipped`)
  }
  return source.replace(marker, replacement)
}
