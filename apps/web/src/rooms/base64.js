// Bytes to base64 and back. Uint8Array.toBase64 is too new for Safari and Firefox, so this uses btoa.
// No React.

// btoa gets strings of this many bytes, so String.fromCharCode does not blow the call stack on 1 MB
const CHUNK = 0x8000

export function toBase64(bytes) {
  let text = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(text)
}

export function fromBase64(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
