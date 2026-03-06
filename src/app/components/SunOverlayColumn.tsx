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
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Line } from 'react-chartjs-2'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { planeSlopeFromPitchAzimuth } from '../../geometry/solver/metrics'
import { getAnnualAggregatedDayProfile } from '../../geometry/sun/annualEstimation'
import { formatMinuteOfDay, parseHhmmToMinuteOfDay, scaleProfile, sumProfiles } from '../../geometry/sun/profileAggregation'
import type { RoofPlane } from '../../types/geometry'

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

export interface SelectedRoofSunInput {
  footprintId: string
  latDeg: number
  lonDeg: number
  kwp: number
  roofPitchDeg: number
  roofAzimuthDeg: number
  roofPlane: RoofPlane
}

interface SunOverlayColumnProps {
  children: ReactNode
  datetimeIso: string
  timeZone: string
  selectedRoofs: SelectedRoofSunInput[]
  onDatetimeInputChange: (datetimeIsoRaw: string) => void
  expanded?: boolean
}

function extractDateIso(datetimeIso: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(datetimeIso.trim())
  return match ? match[1] : null
}

function extractYear(datetimeIso: string): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}T/.exec(datetimeIso.trim())
  if (!match) {
    return null
  }
  const year = Number(match[1])
  return Number.isInteger(year) ? year : null
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

export function SunOverlayColumn({
  children,
  datetimeIso,
  timeZone,
  selectedRoofs,
  onDatetimeInputChange,
  expanded,
}: SunOverlayColumnProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [isForecastLoading, setIsForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [forecastPoints, setForecastPoints] = useState<ForecastPoint[]>([])
  const selectedDateIso = useMemo(() => extractDateIso(datetimeIso), [datetimeIso])
  const selectedYear = useMemo(() => extractYear(datetimeIso) ?? new Date().getFullYear(), [datetimeIso])
  const selectedCount = selectedRoofs.length
  const hasForecastInputs = selectedDateIso !== null && selectedCount > 0

  useEffect(() => {
    if (expanded === undefined) {
      return
    }
    setCollapsed(!expanded)
  }, [expanded])

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

  const forecastChartData = useMemo<ChartData<'line'> | null>(() => {
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

  const forecastChartOptions = useMemo<ChartOptions<'line'>>(
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

  const annualProfile = useMemo(() => {
    if (selectedRoofs.length === 0) {
      return null
    }

    const weightedProfiles = selectedRoofs
      .map((roof) => {
        const { p, q } = planeSlopeFromPitchAzimuth(roof.roofPitchDeg, roof.roofAzimuthDeg)
        const profile = getAnnualAggregatedDayProfile({
          year: selectedYear,
          timeZone,
          latDeg: roof.latDeg,
          lonDeg: roof.lonDeg,
          plane: { p, q, r: roof.roofPlane.r },
          stepMinutes: 15,
        })
        if (!profile) {
          return null
        }
        return {
          points: scaleProfile(
            profile.points.map((point) => ({ minuteOfDay: point.minuteOfDay, value: point.value })),
            roof.kwp / 1000,
          ),
          meta: profile.meta,
        }
      })
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))

    if (weightedProfiles.length === 0) {
      return null
    }

    const mergedPoints = sumProfiles(weightedProfiles.map((profile) => profile.points)).map((point) => ({
      minuteOfDay: point.minuteOfDay,
      timeLabel: formatMinuteOfDay(point.minuteOfDay),
      value: point.value,
    }))

    if (mergedPoints.length === 0) {
      return null
    }

    return {
      points: mergedPoints,
      meta: {
        dayCount: weightedProfiles[0].meta.dayCount,
        sampledDayCount: weightedProfiles[0].meta.sampledDayCount,
        sampleWindowDays: weightedProfiles[0].meta.sampleWindowDays,
        stepMinutes: weightedProfiles[0].meta.stepMinutes,
        nonZeroBuckets: mergedPoints.length,
      },
    }
  }, [selectedRoofs, selectedYear, timeZone])

  const annualChartData = useMemo<ChartData<'line'> | null>(() => {
    if (!annualProfile) {
      return null
    }

    return {
      labels: annualProfile.points.map((point) => point.timeLabel),
      datasets: [
        {
          label: 'Annual aggregated estimated output (kW-sum)',
          data: annualProfile.points.map((point) => point.value),
          borderColor: '#8fe287',
          backgroundColor: 'rgba(143, 226, 135, 0.18)',
          pointRadius: 1,
          pointHoverRadius: 3,
          borderWidth: 1.5,
          fill: true,
          tension: 0.2,
        },
      ],
    }
  }, [annualProfile])

  const annualPeak = useMemo(() => {
    if (!annualProfile || annualProfile.points.length === 0) {
      return null
    }
    return annualProfile.points.reduce((peak, point) => (point.value > peak.value ? point : peak), annualProfile.points[0])
  }, [annualProfile])

  return (
    <aside className={`sun-overlay-column${collapsed ? ' sun-overlay-column-collapsed' : ''}`}>
      <button
        type="button"
        className="sun-overlay-toggle"
        onClick={() => setCollapsed((current) => !current)}
        data-testid="sun-overlay-toggle"
      >
        {collapsed ? 'Sun tools' : 'Hide'}
      </button>
      {!collapsed && (
        <div className="sun-overlay-content">
          <section className="panel-section">
            <h3>Sun Date & Time</h3>
            <div className="sun-controls">
              <Label className="sun-datetime-label" htmlFor="sun-datetime-input">
                Datetime ISO ({timeZone})
              </Label>
              <Input
                id="sun-datetime-input"
                type="text"
                value={datetimeIso}
                onChange={(event) => onDatetimeInputChange(event.target.value)}
                placeholder="2026-03-05T14:30:00+01:00"
                data-testid="sun-datetime-input"
              />
            </div>
          </section>
          <section className="panel-section">
            <h3>Estimated PV (Forecast)</h3>
            {!selectedDateIso && <p>Select datetime above to load irradiance forecast.</p>}
            {selectedDateIso && !hasForecastInputs && <p>Select one or more solved polygons to load irradiance forecast.</p>}
            {selectedDateIso && hasForecastInputs && isForecastLoading && <p>Loading forecast data...</p>}
            {selectedDateIso && hasForecastInputs && forecastError && <p className="status-error">{forecastError}</p>}
            {selectedDateIso && hasForecastInputs && !isForecastLoading && !forecastError && forecastPoints.length === 0 && (
              <p>No daylight forecast points returned for selected date.</p>
            )}
            {selectedDateIso && hasForecastInputs && forecastChartData && forecastPeak && (
              <>
                <div className="sun-daily-chart" data-testid="sun-forecast-chart">
                  <Line data={forecastChartData} options={forecastChartOptions} />
                </div>
                <p data-testid="sun-forecast-peak">
                  Peak: {forecastPeak.estimatedKw.toFixed(2)} kW at {forecastPeak.timeLabel}
                </p>
                <p data-testid="sun-forecast-points">Points: {forecastPoints.length}</p>
                <p data-testid="sun-forecast-date">Date: {selectedDateIso}</p>
                <p data-testid="sun-forecast-selection">Selected polygons: {selectedCount}</p>
                <p data-testid="sun-forecast-power">
                  Weighted capacity: {totalSelectedKwp.toFixed(1)} kWp
                </p>
              </>
            )}
          </section>
          <section className="panel-section">
            <h3>Annual Day Profile</h3>
            {selectedRoofs.length === 0 && <p>Select one or more solved polygons to compute annual aggregation.</p>}
            {annualProfile && annualChartData && annualPeak && (
              <>
                <p>Weighted estimated output by time of day for {selectedYear}.</p>
                <div className="sun-daily-chart" data-testid="sun-annual-chart">
                  <Line data={annualChartData} options={forecastChartOptions} />
                </div>
                <p data-testid="sun-annual-peak">
                  Peak: {annualPeak.value.toFixed(2)} kW-sum at {annualPeak.timeLabel}
                </p>
                <p data-testid="sun-annual-meta">
                  Days: {annualProfile.meta.dayCount}, Sampled: {annualProfile.meta.sampledDayCount} (x{annualProfile.meta.sampleWindowDays}),
                  Step: {annualProfile.meta.stepMinutes} min, Buckets: {annualProfile.meta.nonZeroBuckets}, Selected polygons: {selectedCount},
                  Weighted capacity: {totalSelectedKwp.toFixed(1)} kWp
                </p>
              </>
            )}
          </section>
          {children}
        </div>
      )}
    </aside>
  )
}
