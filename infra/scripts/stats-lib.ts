// Pure parts of scripts/stats.ts: the aggregation pipeline and the table text.

export const DEFAULT_DAYS = 30
export const MAX_DAYS = 400

// One list for the pipeline, the table and the totals. A new event name in apps/api/src/stores/store.ts
// (EVENT_NAMES) needs a line here too: the packages do not import each other.
const EVENT_COLUMNS: { header: string; name: string; kind?: string }[] = [
  { header: 'app_open', name: 'app_open' },
  { header: 'sandbox', name: 'sandbox_open' },
  { header: 'create solo', name: 'room_create', kind: 'solo' },
  { header: 'create vs', name: 'room_create', kind: 'versus' },
  { header: 'open solo', name: 'room_open', kind: 'solo' },
  { header: 'open vs', name: 'room_open', kind: 'versus' },
  { header: 'join', name: 'room_join' },
]

// The row field of a column.
const keyOf = (c: { name: string; kind?: string }) => (c.kind ? `${c.name}_${c.kind}` : c.name)

export interface DayRow {
  day: string
  visitors: number
  // The count of each event column, by keyOf.
  [key: string]: number | string
}

type Count = { $sum: unknown }

function countOf(name: string, kind?: string): Count {
  const test = kind
    ? { $and: [{ $eq: ['$name', name] }, { $eq: ['$kind', kind] }] }
    : { $eq: ['$name', name] }
  return { $sum: { $cond: [test, 1, 0] } }
}

// One pass over the events since `since`, one output document per UTC day, oldest last.
export function statsPipeline(since: Date) {
  return [
    { $match: { time: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$time', timezone: 'UTC' } },
        visitorSet: { $addToSet: '$visitor' },
        ...Object.fromEntries(EVENT_COLUMNS.map((c) => [keyOf(c), countOf(c.name, c.kind)])),
      },
    },
    {
      $project: {
        _id: 0,
        day: '$_id',
        visitors: { $size: '$visitorSet' },
        ...Object.fromEntries(EVENT_COLUMNS.map((c) => [keyOf(c), 1])),
      },
    },
    { $sort: { day: -1 } },
  ]
}

const COLUMNS: { header: string; key: string }[] = [
  { header: 'date', key: 'day' },
  { header: 'visitors', key: 'visitors' },
  ...EVENT_COLUMNS.map((c) => ({ header: c.header, key: keyOf(c) })),
]

function totals(rows: DayRow[]): DayRow {
  const total: DayRow = { day: 'total', visitors: 0 }
  for (const { key } of COLUMNS.slice(1)) {
    total[key] = rows.reduce((n, r) => n + Number(r[key]), 0)
  }
  return total
}

// Only numbers and dates are printed. Anything else in a row prints as 0 or is cut to a date.
function num(value: unknown): number {
  return Number.isFinite(value) ? (value as number) : 0
}

export function normalizeRow(raw: Record<string, unknown>): DayRow {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.day)) ? String(raw.day) : '?'
  const row: DayRow = { day, visitors: num(raw.visitors) }
  for (const { key } of COLUMNS.slice(2)) row[key] = num(raw[key])
  return row
}

// Aligned table, rows in the given order, then the totals line and a note.
export function formatStats(rows: DayRow[]): string {
  if (rows.length === 0) return 'No events in this period.'
  const total = totals(rows)
  const all = [...rows, total]
  const widths = COLUMNS.map(({ header, key }) =>
    Math.max(header.length, ...all.map((r) => String(r[key]).length)),
  )
  const line = (cells: string[]) =>
    cells
      .map((c, i) => (i === 0 ? c.padEnd(widths[i] ?? 0) : c.padStart(widths[i] ?? 0)))
      .join('  ')
  const out = [line(COLUMNS.map((c) => c.header))]
  for (const r of rows) out.push(line(COLUMNS.map((c) => String(r[c.key]))))
  out.push(line(COLUMNS.map((c) => String(total[c.key]))))
  out.push('Total visitors is the sum of the daily counts: a person counts once per day.')
  return out.join('\n')
}
