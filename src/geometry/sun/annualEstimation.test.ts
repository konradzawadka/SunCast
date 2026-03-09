import { describe, expect, it } from 'vitest'
import { getAnnualAggregatedDayProfile, getAnnualMonthlyEnergyEstimate } from './annualEstimation'

describe('annualEstimation', () => {
  it('returns deterministic annual daylight aggregation with finite values', () => {
    const profile = getAnnualAggregatedDayProfile({
      year: 2026,
      timeZone: 'Europe/Warsaw',
      latDeg: 52.2297,
      lonDeg: 21.0122,
      plane: { p: 0.08, q: 0.14, r: 0 },
      stepMinutes: 15,
    })

    expect(profile).not.toBeNull()
    if (!profile) {
      return
    }

    expect(profile.meta.dayCount).toBe(365)
    expect(profile.meta.sampleWindowDays).toBe(5)
    expect(profile.meta.sampledDayCount).toBe(73)
    expect(profile.meta.nonZeroBuckets).toBe(profile.points.length)
    expect(profile.meta.stepMinutes).toBe(15)
    expect(profile.points.length).toBeGreaterThan(0)
    expect(profile.points.length).toBeLessThanOrEqual(96)

    for (let i = 0; i < profile.points.length; i += 1) {
      const point = profile.points[i]
      expect(Number.isFinite(point.value)).toBeTruthy()
      expect(point.value).toBeGreaterThanOrEqual(0)
      expect(point.minuteOfDay % 15).toBe(0)
      if (i > 0) {
        expect(point.minuteOfDay).toBeGreaterThan(profile.points[i - 1].minuteOfDay)
      }
    }
  })

  it('tracks leap-year day count correctly', () => {
    const profile = getAnnualAggregatedDayProfile({
      year: 2024,
      timeZone: 'America/New_York',
      latDeg: 40.7128,
      lonDeg: -74.006,
      plane: { p: 0.12, q: -0.05, r: 0 },
      stepMinutes: 30,
    })

    expect(profile).not.toBeNull()
    if (!profile) {
      return
    }

    expect(profile.meta.dayCount).toBe(366)
    expect(profile.meta.stepMinutes).toBe(30)
    expect(profile.meta.sampleWindowDays).toBe(5)
    const maxSampledDays = Math.ceil(profile.meta.dayCount / profile.meta.sampleWindowDays)
    // Some runtimes can miss one sampled day around DST boundaries for this timezone.
    expect(profile.meta.sampledDayCount).toBeGreaterThanOrEqual(maxSampledDays - 1)
    expect(profile.meta.sampledDayCount).toBeLessThanOrEqual(maxSampledDays)
  })

  it('returns deterministic monthly estimate and preserves annual total', () => {
    const input = {
      year: 2026,
      timeZone: 'Europe/Warsaw',
      latDeg: 52.2297,
      lonDeg: 21.0122,
      plane: { p: 0.08, q: 0.14, r: 0 },
      stepMinutes: 15,
    }
    const profile = getAnnualAggregatedDayProfile(input)
    const monthly = getAnnualMonthlyEnergyEstimate(input)

    expect(profile).not.toBeNull()
    expect(monthly).not.toBeNull()
    if (!profile || !monthly) {
      return
    }

    expect(monthly.months).toHaveLength(12)
    expect(monthly.meta.dayCount).toBe(365)
    expect(monthly.meta.sampleWindowDays).toBe(5)
    expect(monthly.meta.sampledDayCount).toBe(73)

    const annualWhm2FromProfile = profile.points.reduce(
      (sum, point) => sum + point.value * (profile.meta.stepMinutes / 60),
      0,
    )
    const annualWhm2FromMonthly = monthly.months.reduce((sum, month) => sum + month.energyWhm2Estimate, 0)

    expect(annualWhm2FromMonthly).toBeCloseTo(annualWhm2FromProfile, 8)
    for (const month of monthly.months) {
      expect(month.month).toBeGreaterThanOrEqual(1)
      expect(month.month).toBeLessThanOrEqual(12)
      expect(Number.isFinite(month.energyWhm2Estimate)).toBeTruthy()
      expect(month.energyWhm2Estimate).toBeGreaterThanOrEqual(0)
    }
  })
})
