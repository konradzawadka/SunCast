import { formatMinuteOfDay, parseHhmmToMinuteOfDay, scaleProfile, sumProfiles } from '../../../../geometry/sun/profileAggregation'
import type { OpenMeteoTiltedIrradianceSample } from './openMeteoForecast'

export interface ForecastPoint {
  minuteOfDay: number
  timeLabel: string
  estimatedKw: number
}

export function createRoofForecastProfile(
  samples: OpenMeteoTiltedIrradianceSample[],
  dateIso: string,
  kwp: number,
): Array<{ minuteOfDay: number; value: number }> {
  const profile: Array<{ minuteOfDay: number; value: number }> = []

  for (const sample of samples) {
    if (!sample.timestampIso.startsWith(dateIso)) {
      continue
    }

    const minuteOfDay = parseHhmmToMinuteOfDay(sample.timestampIso.slice(11, 16))
    if (minuteOfDay === null) {
      continue
    }

    const irradianceWm2 = Number(sample.irradianceWm2)
    if (!Number.isFinite(irradianceWm2) || irradianceWm2 <= 0) {
      continue
    }

    profile.push({ minuteOfDay, value: irradianceWm2 })
  }

  return scaleProfile(profile, kwp / 1000)
}

export function aggregateForecastProfiles(
  profiles: Array<Array<{ minuteOfDay: number; value: number }>>,
): ForecastPoint[] {
  return sumProfiles(profiles).map((point) => ({
    minuteOfDay: point.minuteOfDay,
    timeLabel: formatMinuteOfDay(point.minuteOfDay),
    estimatedKw: point.value,
  }))
}

export function mergeSettledRoofForecasts(
  settled: PromiseSettledResult<Array<{ minuteOfDay: number; value: number }>>[],
): {
  points: ForecastPoint[]
  failedRoofCount: number
  succeededRoofCount: number
} {
  const profiles: Array<Array<{ minuteOfDay: number; value: number }>> = []
  let failedRoofCount = 0

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      profiles.push(result.value)
    } else {
      failedRoofCount += 1
    }
  }

  return {
    points: aggregateForecastProfiles(profiles),
    failedRoofCount,
    succeededRoofCount: profiles.length,
  }
}
