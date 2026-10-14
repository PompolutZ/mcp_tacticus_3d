// Decides when the scene may mount again. Returns true when the error should show the fallback
// instead: `limit` errors within `windowMs`. `times` is the list of earlier error times (ms), changed here.
export function tooManyErrors(times, now, limit = 3, windowMs = 10000) {
  times.push(now)
  while (times.length && now - times[0] > windowMs) times.shift()
  return times.length >= limit
}
