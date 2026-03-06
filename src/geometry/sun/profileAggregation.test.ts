import { describe, expect, it } from 'vitest'
import { formatMinuteOfDay, parseHhmmToMinuteOfDay, sumProfiles } from './profileAggregation'

describe('profileAggregation', () => {
  it('sums profiles by minute bucket and sorts results', () => {
    const result = sumProfiles([
      [
        { minuteOfDay: 60, value: 100 },
        { minuteOfDay: 75, value: 200 },
      ],
      [
        { minuteOfDay: 75, value: 50 },
        { minuteOfDay: 90, value: 300 },
      ],
    ])

    expect(result).toEqual([
      { minuteOfDay: 60, value: 100 },
      { minuteOfDay: 75, value: 250 },
      { minuteOfDay: 90, value: 300 },
    ])
  })

  it('ignores invalid buckets and non-finite values', () => {
    const result = sumProfiles([
      [
        { minuteOfDay: -1, value: 1 },
        { minuteOfDay: 20, value: Number.NaN },
      ],
      [
        { minuteOfDay: 20, value: 10 },
        { minuteOfDay: 24 * 60, value: 99 },
      ],
    ])

    expect(result).toEqual([{ minuteOfDay: 20, value: 10 }])
  })

  it('formats and parses HH:mm consistently', () => {
    expect(formatMinuteOfDay(0)).toBe('00:00')
    expect(formatMinuteOfDay(14 * 60 + 5)).toBe('14:05')
    expect(parseHhmmToMinuteOfDay('14:05')).toBe(14 * 60 + 5)
    expect(parseHhmmToMinuteOfDay('24:00')).toBeNull()
  })
})
