import { useEffect, useMemo, useState } from 'react'
import type { SelectedRoofSunInput } from './SunOverlayColumn'
import { extractDateIso, fetchOpenMeteoTiltedIrradiance } from './forecast/openMeteoForecast'
import { createRoofForecastProfile, mergeSettledRoofForecasts, type ForecastPoint } from './forecast/forecastPvTransform'

interface UseForecastPvArgs {
  datetimeIso: string
  timeZone: string
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
  timeZone,
  selectedRoofs,
  computationEnabled = true,
}: UseForecastPvArgs): UseForecastPvResult {
  const [isForecastLoading, setIsForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [forecastPoints, setForecastPoints] = useState<ForecastPoint[]>([])

  const selectedDateIso = useMemo(() => extractDateIso(datetimeIso), [datetimeIso])
  const selectedCount = selectedRoofs.length
  const hasForecastInputs = computationEnabled && selectedDateIso !== null && selectedCount > 0

  const totalSelectedKwp = useMemo(
    () => selectedRoofs.reduce((sum, roof) => sum + (Number.isFinite(roof.kwp) && roof.kwp > 0 ? roof.kwp : 0), 0),
    [selectedRoofs],
  )

  useEffect(() => {
    if (!hasForecastInputs || !selectedDateIso || selectedRoofs.length === 0) {
      setForecastPoints([])
      setForecastError(null)
      setIsForecastLoading(false)
      return
    }

    const abortController = new AbortController()
    setIsForecastLoading(true)
    setForecastError(null)

    Promise.allSettled(
      selectedRoofs.map(async (roof) => {
        const samples = await fetchOpenMeteoTiltedIrradiance({
          latDeg: roof.latDeg,
          lonDeg: roof.lonDeg,
          roofPitchDeg: roof.roofPitchDeg,
          roofAzimuthDeg: roof.roofAzimuthDeg,
          timeZone,
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
  }, [hasForecastInputs, selectedDateIso, selectedRoofs, timeZone])

  return {
    selectedDateIso,
    selectedCount,
    hasForecastInputs,
    isForecastLoading,
    forecastError,
    forecastPoints,
    totalSelectedKwp,
  }
}
