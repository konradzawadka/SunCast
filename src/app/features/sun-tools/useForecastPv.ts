import { useEffect, useMemo, useState } from 'react'
import type { SelectedRoofSunInput } from './SunOverlayColumn'
import { fetchOpenMeteoTiltedIrradiance } from './forecast/openMeteoForecast'
import { createRoofForecastProfile, mergeSettledRoofForecasts, type ForecastPoint } from './forecast/forecastPvTransform'
import { extractDateIsoInTimeZone } from './sunDateTime'

const FORECAST_TIME_ZONE = 'UTC'

interface UseForecastPvArgs {
  datetimeIso: string
  selectedRoofs: SelectedRoofSunInput[]
  computationEnabled?: boolean
}

interface UseForecastPvResult {
  selectedDateIso: string | null
  selectedCount: number
  hasForecastInputs: boolean
  isForecastLoading: boolean
  forecastError: string | null
  forecastPoints: ForecastPoint[]
  totalSelectedKwp: number
}

export function useForecastPv({
  datetimeIso,
  selectedRoofs,
  computationEnabled = true,
}: UseForecastPvArgs): UseForecastPvResult {
  const [isForecastLoading, setIsForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [forecastPoints, setForecastPoints] = useState<ForecastPoint[]>([])

  const selectedDateIso = useMemo(() => extractDateIsoInTimeZone(datetimeIso, FORECAST_TIME_ZONE), [datetimeIso])
  const selectedCount = selectedRoofs.length
  const hasForecastInputs = computationEnabled && selectedDateIso !== null && selectedCount > 0

  const totalSelectedKwp = useMemo(
    () => selectedRoofs.reduce((sum, roof) => sum + (Number.isFinite(roof.kwp) && roof.kwp > 0 ? roof.kwp : 0), 0),
    [selectedRoofs],
  )

  useEffect(() => {
    if (!hasForecastInputs || !selectedDateIso || selectedRoofs.length === 0) {
      return
    }

    const abortController = new AbortController()
    queueMicrotask(() => {
      if (abortController.signal.aborted) {
        return
      }
      setIsForecastLoading(true)
      setForecastError(null)
    })

    Promise.allSettled(
      selectedRoofs.map(async (roof) => {
        const samples = await fetchOpenMeteoTiltedIrradiance({
          latDeg: roof.latDeg,
          lonDeg: roof.lonDeg,
          roofPitchDeg: roof.roofPitchDeg,
          roofAzimuthDeg: roof.roofAzimuthDeg,
          timeZone: FORECAST_TIME_ZONE,
          dateIso: selectedDateIso,
          signal: abortController.signal,
        })
        return createRoofForecastProfile(samples, selectedDateIso, roof.kwp)
      }),
    )
      .then((results) => {
        const merged = mergeSettledRoofForecasts(results)
        setForecastPoints(merged.points)

        if (merged.succeededRoofCount === 0 && merged.failedRoofCount > 0) {
          setForecastError('Forecast unavailable for all selected polygons.')
          return
        }

        if (merged.failedRoofCount > 0) {
          setForecastError(`Forecast unavailable for ${merged.failedRoofCount} selected polygon(s).`)
          return
        }

        setForecastError(null)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setForecastPoints([])
        setForecastError(error instanceof Error ? error.message : 'Unknown forecast API error')
      })
      .finally(() => {
        setIsForecastLoading(false)
      })

    return () => {
      abortController.abort()
    }
  }, [hasForecastInputs, selectedDateIso, selectedRoofs])

  const effectiveIsForecastLoading = hasForecastInputs ? isForecastLoading : false
  const effectiveForecastError = hasForecastInputs ? forecastError : null
  const effectiveForecastPoints = hasForecastInputs ? forecastPoints : []

  return {
    selectedDateIso,
    selectedCount,
    hasForecastInputs,
    isForecastLoading: effectiveIsForecastLoading,
    forecastError: effectiveForecastError,
    forecastPoints: effectiveForecastPoints,
    totalSelectedKwp,
  }
}
