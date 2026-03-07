import { describe, expect, it } from 'vitest'
import { aggregateForecastProfiles, createRoofForecastProfile, mergeSettledRoofForecasts } from './forecastPvTransform'

describe('forecastPvTransform', () => {
  it('filters out zero/non-positive/invalid irradiance points', () => {
    const profile = createRoofForecastProfile(
      [
        { timestampIso: '2026-03-07T10:00', irradianceWm2: 0 },
        { timestampIso: '2026-03-07T11:00', irradianceWm2: -5 },
        { timestampIso: '2026-03-07T12:00', irradianceWm2: Number.NaN },
      ],
      '2026-03-07',
      6000,
    )

    expect(profile).toEqual([])
  })

  it('keeps only points matching selected date', () => {
    const profile = createRoofForecastProfile(
      [
        { timestampIso: '2026-03-06T10:00', irradianceWm2: 400 },
        { timestampIso: '2026-03-07T12:00', irradianceWm2: 500 },
      ],
      '2026-03-07',
      1000,
    )

    expect(profile).toEqual([{ minuteOfDay: 720, value: 500 }])
  })

  it('merges partially failed roof forecasts', () => {
    const merged = mergeSettledRoofForecasts([
      {
        status: 'fulfilled',
        value: [{ minuteOfDay: 600, value: 2 }],
      },
      {
        status: 'rejected',
        reason: new Error('network'),
      },
      {
        status: 'fulfilled',
        value: [{ minuteOfDay: 600, value: 3 }],
      },
    ])

    expect(merged.failedRoofCount).toBe(1)
    expect(merged.succeededRoofCount).toBe(2)
    expect(merged.points).toEqual([{ minuteOfDay: 600, timeLabel: '10:00', estimatedKw: 5 }])
  })

  it('returns empty aggregation for zero points', () => {
    expect(aggregateForecastProfiles([[], []])).toEqual([])
  })
})
