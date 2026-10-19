// Browser and OS names for the performance report (perf/report.js). Pure functions of plain data, so
// they are tested; PerfOverlay reads the values from navigator. No React.

// Brands that say nothing: the engine name and the GREASE entry ("Not A;Brand")
const GENERIC_BRAND = /^(chromium|not.?a.?brand|not\)a;brand)/i

// brands: navigator.userAgentData.brands, or undefined. brave: true when navigator.brave exists (Brave
// reports itself as Chrome). userAgent: navigator.userAgent. Returns "Name version", or "unknown".
export function browserName({ brands, brave = false, userAgent = '' }) {
  if (Array.isArray(brands) && brands.length > 0) {
    const named = brands.find((b) => !GENERIC_BRAND.test(b.brand))
    const engine = brands.find((b) => /^chromium$/i.test(b.brand))
    if (brave) return `Brave ${(engine ?? named ?? brands[0]).version}`
    const pick = named ?? engine
    if (pick) return `${pick.brand} ${pick.version}`
  }
  if (brave) return 'Brave'
  const match =
    userAgent.match(/(Edg)\/([\d.]+)/) ??
    userAgent.match(/(Firefox)\/([\d.]+)/) ??
    userAgent.match(/(Chrome)\/([\d.]+)/) ??
    userAgent.match(/Version\/([\d.]+).*(Safari)/)
  if (!match) return userAgent || 'unknown'
  // The Safari pattern has the version first
  const [name, version] = match[2] === 'Safari' ? [match[2], match[1]] : [match[1], match[2]]
  return `${name === 'Edg' ? 'Edge' : name} ${version}`
}

// platform: navigator.userAgentData.platform, or undefined. userAgent: navigator.userAgent.
export function osName({ platform, userAgent = '' }) {
  if (platform) return platform
  if (/Windows/i.test(userAgent)) return 'Windows'
  if (/Android/i.test(userAgent)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS'
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macOS'
  if (/Linux|X11/i.test(userAgent)) return 'Linux'
  return 'unknown'
}
