import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { formatMinuteOfDay, parseHhmmToMinuteOfDay, scaleProfile, sumProfiles } from '../../geometry/sun/profileAggregation'
import type { SelectedRoofSunInput } from './SunOverlayColumn'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

interface OpenMeteoForecastResponse {
  hourly?: {
    time?: string[]
    global_tilted_irradiance?: number[]
  }
}

interface ForecastPoint {
  minuteOfDay: number
  timeLabel: string
  estimatedKw: number
}

interface ForecastPvPanelProps {
  datetimeIso: string
  timeZone: string
  selectedRoofs: SelectedRoofSunInput[]
  computationEnabled?: boolean
}

function extractDateIso(datetimeIso: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(datetimeIso.trim())
  return match ? match[1] : null
}

function normalizeAzimuthDeg(deg: number): number {
  let normalized = deg % 360
  if (normalized < 0) {
    normalized += 360
  }
  return normalized
}

function toOpenMeteoAzimuthDeg(azimuthFromNorthDeg: number): number {
  const southCentered = normalizeAzimuthDeg(azimuthFromNorthDeg) - 180
  if (southCentered > 180) {
    return southCentered - 360
  }
  if (southCentered <= -180) {
    return southCentered + 360
  }
  return southCentered
}

function toOpenMeteoTiltDeg(roofPitchDeg: number): number {
  if (!Number.isFinite(roofPitchDeg)) {
    return 0
  }
  return Math.max(0, Math.min(90, roofPitchDeg))
}

export function ForecastPvPanel({
  datetimeIso,
  timeZone,
  selectedRoofs,
  computationEnabled = true,
}: ForecastPvPanelProps) {
  const [isForecastLoading, setIsForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [forecastPoints, setForecastPoints] = useState<ForecastPoint[]>([])

  const selectedDateIso = useMemo(() => extractDateIso(datetimeIso), [datetimeIso])
  const selectedCount = selectedRoofs.length
  const hasForecastInputs = computationEnabled && selectedDateIso !== null && selectedCount > 0

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

    Promise.all(
      selectedRoofs.map(async (roof) => {
        const url = new URL('https://api.open-meteo.com/v1/forecast')
        url.searchParams.set('latitude', roof.latDeg.toFixed(6))
        url.searchParams.set('longitude', roof.lonDeg.toFixed(6))
        url.searchParams.set('hourly', 'global_tilted_irradiance')
        url.searchParams.set('tilt', toOpenMeteoTiltDeg(roof.roofPitchDeg).toFixed(2))
        url.searchParams.set('azimuth', toOpenMeteoAzimuthDeg(roof.roofAzimuthDeg).toFixed(2))
        url.searchParams.set('timezone', timeZone)
        url.searchParams.set('start_date', selectedDateIso)
        url.searchParams.set('end_date', selectedDateIso)

        const response = await fetch(url, { signal: abortController.signal })
        if (!response.ok) {
          throw new Error(`Forecast API request failed with HTTP ${response.status}`)
        }
        const payload = (await response.json()) as OpenMeteoForecastResponse
        const time = payload.hourly?.time ?? []
        const irradiance = payload.hourly?.global_tilted_irradiance ?? []
        const pointCount = Math.min(time.length, irradiance.length)
        const profile: Array<{ minuteOfDay: number; value: number }> = []

        for (let idx = 0; idx < pointCount; idx += 1) {
          const timestampIso = time[idx]
          if (!timestampIso.startsWith(selectedDateIso)) {
            continue
          }
          const minuteOfDay = parseHhmmToMinuteOfDay(timestampIso.slice(11, 16))
          if (minuteOfDay === null) {
            continue
          }

          const irradianceWm2 = Number(irradiance[idx])
          if (!Number.isFinite(irradianceWm2) || irradianceWm2 < 0 || irradianceWm2 === 0) {
            continue
          }

          profile.push({ minuteOfDay, value: irradianceWm2 })
        }

        return scaleProfile(profile, roof.kwp / 1000)
      }),
    )
      .then((profiles) => {
        const aggregated = sumProfiles(profiles).map((point) => ({
          minuteOfDay: point.minuteOfDay,
          timeLabel: formatMinuteOfDay(point.minuteOfDay),
          estimatedKw: point.value,
        }))
        setForecastPoints(aggregated)
      })
      .catch((error) => {
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

  const chartData = useMemo<ChartData<'line'> | null>(() => {
    if (forecastPoints.length === 0) {
      return null
    }

    return {
      labels: forecastPoints.map((point) => point.timeLabel),
      datasets: [
        {
          label: 'Estimated PV output (kW)',
          data: forecastPoints.map((point) => point.estimatedKw),
          borderColor: '#f6d25f',
          backgroundColor: 'rgba(246, 210, 95, 0.22)',
          pointRadius: 1,
          pointHoverRadius: 3,
          borderWidth: 1.5,
          fill: true,
          tension: 0.2,
        },
      ],
    }
  }, [forecastPoints])

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      animation: false as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            color: '#cad8de',
          },
          grid: {
            color: 'rgba(90, 110, 120, 0.35)',
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#cad8de',
          },
          grid: {
            color: 'rgba(90, 110, 120, 0.35)',
          },
        },
      },
    }),
    [],
  )

  const forecastPeak = useMemo(() => {
    if (forecastPoints.length === 0) {
      return null
    }
    return forecastPoints.reduce((peak, point) => (point.estimatedKw > peak.estimatedKw ? point : peak), forecastPoints[0])
  }, [forecastPoints])

  const totalSelectedKwp = useMemo(
    () => selectedRoofs.reduce((sum, roof) => sum + (Number.isFinite(roof.kwp) && roof.kwp > 0 ? roof.kwp : 0), 0),
    [selectedRoofs],
  )

  return (
    <section className="panel-section">
      <h3>Estimated PV (Forecast)</h3>
      {!selectedDateIso && <p>Select datetime above to load irradiance forecast.</p>}
      {!computationEnabled && <p>Production computation paused while editing geometry.</p>}
      {computationEnabled && selectedDateIso && !hasForecastInputs && (
        <p>Select one or more solved polygons to load irradiance forecast.</p>
      )}
      {selectedDateIso && hasForecastInputs && isForecastLoading && <p>Loading forecast data...</p>}
      {selectedDateIso && hasForecastInputs && forecastError && <p className="status-error">{forecastError}</p>}
      {selectedDateIso && hasForecastInputs && !isForecastLoading && !forecastError && forecastPoints.length === 0 && (
        <p>No daylight forecast points returned for selected date.</p>
      )}
      {selectedDateIso && hasForecastInputs && chartData && forecastPeak && (
        <>
          <div className="sun-daily-chart" data-testid="sun-forecast-chart">
            <Line data={chartData} options={chartOptions} />
          </div>
          <p data-testid="sun-forecast-peak">
            Peak: {forecastPeak.estimatedKw.toFixed(2)} kW at {forecastPeak.timeLabel}
          </p>
          <p data-testid="sun-forecast-points">Points: {forecastPoints.length}</p>
          <p data-testid="sun-forecast-date">Date: {selectedDateIso}</p>
          <p data-testid="sun-forecast-selection">Selected polygons: {selectedCount}</p>
          <p data-testid="sun-forecast-power">Weighted capacity: {totalSelectedKwp.toFixed(1)} kWp</p>
        </>
      )}
    </section>
  )
}
