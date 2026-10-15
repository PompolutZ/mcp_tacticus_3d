// The loop of migrate-crisis.mjs and migrate-tactics.mjs: for each card, plan, download the missing files (with
// --download), check the cache, convert. A failed card gets a result row and the loop goes on.
//
// - cards: the rows to migrate; they run in the order of their keys
// - keys: Map from a card to its key
// - planCard(card): returns a plan `{ files: [{ file, url, label }], ... }`; may throw
// - available(file): true when the source file is in the cache
// - download: false, or `downloadMissing(urls)` that returns the failures `[{ url, reason }]`
// - convertPlan(plan, card): converts the files of a plan, returns `{ status, warnings? }`
// Returns `{ results, done }`: `results` is `{ key, card, status, warnings? }` per card, `done` the plans that are ready.

export function downloadFailure(failures) {
  return `failed: download ${failures.map((f) => `${f.url} (${f.reason})`).join(', ')}`
}

export function missingStatus(missing) {
  return `missing in TTS cache: ${missing.map((f) => f.label).join(', ')}`
}

export async function runCardLoop({ cards, keys, planCard, available, download, convertPlan }) {
  const results = []
  const done = []
  for (const card of [...cards].sort((a, b) => keys.get(a).localeCompare(keys.get(b)))) {
    const key = keys.get(card)
    try {
      const plan = planCard(card)
      if (download) {
        const failed = await download(plan.files.filter((f) => !available(f)).map((f) => f.url))
        if (failed.length) {
          results.push({ key, card, status: downloadFailure(failed) })
          continue
        }
      }
      const missing = plan.files.filter((f) => !available(f))
      if (missing.length) {
        results.push({ key, card, status: missingStatus(missing) })
        continue
      }
      results.push({ key, card, ...convertPlan(plan, card) })
      done.push(plan)
    } catch (err) {
      results.push({ key, card, status: `failed: ${err.message}` })
    }
  }
  return { results, done }
}
