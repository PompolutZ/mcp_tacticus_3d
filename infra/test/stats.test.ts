import { describe, expect, it } from 'vitest'
import { formatStats, normalizeRow, statsPipeline, type DayRow } from '../scripts/stats-lib'

const row = (day: string, visitors: number, appOpen: number): DayRow => ({
  ...normalizeRow({ day, visitors, app_open: appOpen, sandbox_open: 1, room_create_versus: 2 }),
})

describe('stats', () => {
  it('matches only events since the date', () => {
    const since = new Date('2026-01-01T00:00:00Z')
    expect(statsPipeline(since)[0]).toEqual({ $match: { time: { $gte: since } } })
  })

  it('prints rows in order, then totals with visitors summed', () => {
    const lines = formatStats([row('2026-10-22', 3, 5), row('2026-10-21', 2, 4)]).split('\n')
    expect(lines[1]?.startsWith('2026-10-22')).toBe(true)
    expect(lines[2]?.startsWith('2026-10-21')).toBe(true)
    expect(lines[3]?.split(/\s{2,}/).slice(0, 3)).toEqual(['total', '5', '9'])
    expect(lines[4]).toContain('once per day')
  })

  it('aligns columns', () => {
    const lines = formatStats([row('2026-10-22', 300, 5), row('2026-10-21', 2, 4)]).split('\n')
    expect(new Set(lines.slice(0, 4).map((l) => l.length)).size).toBe(1)
  })

  it('prints only numbers and dates', () => {
    const r = normalizeRow({ day: '\u001b[31mx', visitors: 'a', app_open: 2 })
    expect(r.day).toBe('?')
    expect(r.visitors).toBe(0)
    expect(r.app_open).toBe(2)
  })
})
