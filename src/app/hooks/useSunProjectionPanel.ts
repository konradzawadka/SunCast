import { useMemo } from 'react'
import { computeSunProjection } from '../../geometry/sun/sunProjection'
import { parseIsoDateTimeWithTimezone } from '../../geometry/sun/sunPosition'
import type { ProjectSunProjectionSettings, RoofPlane } from '../../types/geometry'

interface UseSunProjectionPanelParams {
  sunProjection: ProjectSunProjectionSettings
  activeVertices: Array<[number, number]> | null
  activePlane: RoofPlane | null
  setSunProjectionDatetimeIso: (datetimeIso: string | null) => void
  setSunProjectionDailyDateIso: (dailyDateIso: string | null) => void
}

function computeFootprintCentroid(vertices: Array<[number, number]>): [number, number] {
  let lonSum = 0
  let latSum = 0
  for (const [lon, lat] of vertices) {
    lonSum += lon
    latSum += lat
  }
  return [lonSum / vertices.length, latSum / vertices.length]
}

function extractDateIso(datetimeIso: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(datetimeIso)
  return match ? match[1] : null
}

export function useSunProjectionPanel({
  sunProjection,
  activeVertices,
  activePlane,
  setSunProjectionDatetimeIso,
  setSunProjectionDailyDateIso,
}: UseSunProjectionPanelParams) {
  const sunDatetimeRaw = sunProjection.datetimeIso ?? ''
  const sunDailyDateRaw = sunProjection.dailyDateIso ?? ''
  const sunDailyTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])
  const sunDatetimeParsed = sunDatetimeRaw.trim() === '' ? null : parseIsoDateTimeWithTimezone(sunDatetimeRaw.trim())
  const sunDatetimeError =
    sunDatetimeRaw.trim() === '' || sunDatetimeParsed ? null : 'Use ISO datetime with timezone, e.g. 2026-03-05T14:30:00+01:00'
  const hasValidSunDatetime = sunDatetimeParsed !== null

  const activeFootprintCentroid = useMemo(
    () => (activeVertices && activeVertices.length > 0 ? computeFootprintCentroid(activeVertices) : null),
    [activeVertices],
  )

  const sunProjectionResult = useMemo(() => {
    if (!sunProjection.enabled || !hasValidSunDatetime || !activeFootprintCentroid || !activePlane) {
      return null
    }
    const [lon, lat] = activeFootprintCentroid
    try {
      return computeSunProjection({
        datetimeIso: sunDatetimeRaw.trim(),
        latDeg: lat,
        lonDeg: lon,
        plane: activePlane,
      })
    } catch {
      return null
    }
  }, [activeFootprintCentroid, activePlane, hasValidSunDatetime, sunDatetimeRaw, sunProjection.enabled])

  const onSunDatetimeInputChange = (rawDatetime: string) => {
    const trimmed = rawDatetime.trim()
    if (trimmed === '') {
      setSunProjectionDatetimeIso(null)
      setSunProjectionDailyDateIso(null)
      return
    }

    setSunProjectionDatetimeIso(trimmed)
    setSunProjectionDailyDateIso(extractDateIso(trimmed))
  }

  return {
    sunDatetimeRaw,
    sunDailyDateRaw,
    sunDailyTimeZone,
    sunDatetimeError,
    hasValidSunDatetime,
    sunProjectionResult,
    activeFootprintCentroid,
    onSunDatetimeInputChange,
  }
}

