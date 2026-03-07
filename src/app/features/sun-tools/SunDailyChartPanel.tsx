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
import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  SUN_DAILY_SERIES_STEP_MINUTES,
  formatTimestampHHmm,
  getDailyPoaSeries,
  getSunriseSunset,
} from '../../../geometry/sun/dailyEstimation'
import { formatMinuteOfDay, parseHhmmToMinuteOfDay, scaleProfile, sumProfiles } from '../../../geometry/sun/profileAggregation'
import type { RoofPlane } from '../../../types/geometry'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

interface SunDailyChartPanelProps {
  dateIso: string
  timeZone: string
  selectedRoofs: Array<{
    footprintId: string
    latDeg: number
    lonDeg: number
    kwp: number
    roofPlane: RoofPlane
  }>
  computationEnabled?: boolean
}

export function SunDailyChartPanel({ dateIso, timeZone, selectedRoofs, computationEnabled = true }: SunDailyChartPanelProps) {
  const totalSelectedKwp = useMemo(
    () => selectedRoofs.reduce((sum, roof) => sum + (Number.isFinite(roof.kwp) && roof.kwp > 0 ? roof.kwp : 0), 0),
    [selectedRoofs],
  )

  const aggregated = useMemo(() => {
    if (!computationEnabled || !dateIso || selectedRoofs.length === 0 || totalSelectedKwp <= 0) {
      return null
    }

    const perRoofSeries = selectedRoofs
      .map((roof) => {
        const safeKwp = Number.isFinite(roof.kwp) && roof.kwp > 0 ? roof.kwp : 0
        if (safeKwp <= 0) {
          return null
        }

        const series = getDailyPoaSeries({
          dateIso,
          timeZone,
          latDeg: roof.latDeg,
          lonDeg: roof.lonDeg,
          plane: roof.roofPlane,
          stepMinutes: SUN_DAILY_SERIES_STEP_MINUTES,
        })

        if (!series) {
          return null
        }

        const baseProfile = series.labels
          .map((label, index) => {
            const minuteOfDay = parseHhmmToMinuteOfDay(label)
            if (minuteOfDay === null) {
              return null
            }
            return {
              minuteOfDay,
              value: series.values_Wm2[index],
            }
          })
          .filter((point): point is { minuteOfDay: number; value: number } => point !== null)

        return {
          sunriseTs: series.sunriseTs,
          sunsetTs: series.sunsetTs,
          productionKwContribution: scaleProfile(baseProfile, safeKwp / 1000),
        }
      })
      .filter((series): series is NonNullable<typeof series> => Boolean(series))

    if (perRoofSeries.length === 0) {
      return null
    }

    const productionKwPoints = sumProfiles(perRoofSeries.map((series) => series.productionKwContribution))

    if (productionKwPoints.length === 0) {
      return null
    }

    const points = productionKwPoints
      .map((point) => ({
        minuteOfDay: point.minuteOfDay,
        production_kW: point.value,
      }))
      .filter((point): point is { minuteOfDay: number; production_kW: number } => Number.isFinite(point.production_kW))

    if (points.length === 0) {
      return null
    }

    const sunriseTs = Math.min(...perRoofSeries.map((series) => series.sunriseTs))
    const sunsetTs = Math.max(...perRoofSeries.map((series) => series.sunsetTs))

    const labels = points.map((point) => formatMinuteOfDay(point.minuteOfDay))
    const productionValues_kW = points.map((point) => point.production_kW)

    const productionPeakIndex = productionValues_kW.reduce((bestIndex, current, index, all) => (current > all[bestIndex] ? index : bestIndex), 0)

    return {
      labels,
      productionValues_kW,
      sunriseTs,
      sunsetTs,
      peakProductionValue_kW: productionValues_kW[productionPeakIndex],
      peakProductionTimeLabel: labels[productionPeakIndex],
    }
  }, [computationEnabled, dateIso, selectedRoofs, timeZone, totalSelectedKwp])

  const sunriseSunset = useMemo(() => {
    if (!computationEnabled || !dateIso || selectedRoofs.length === 0) {
      return null
    }
    const firstRoof = selectedRoofs[0]
    return getSunriseSunset({ dateIso, timeZone, latDeg: firstRoof.latDeg, lonDeg: firstRoof.lonDeg })
  }, [computationEnabled, dateIso, selectedRoofs, timeZone])

  const chartData = useMemo<ChartData<'line'> | null>(() => {
    if (!aggregated) {
      return null
    }

    return {
      labels: aggregated.labels,
      datasets: [
        {
          data: aggregated.productionValues_kW,
          yAxisID: 'yProduction',
          borderColor: '#cad8de',
          backgroundColor: 'rgba(246, 210, 95, 0.18)',
          pointRadius: 1,
          pointHoverRadius: 3,
          borderWidth: 1.5,
          fill: false,
          tension: 0.2,
        },
      ],
    }
  }, [aggregated])

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      animation: false as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
          labels: {
            color: '#cad8de',
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const y = context.parsed.y
              return `${(typeof y === 'number' ? y : 0).toFixed(2)} kW`
            },
          },
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
        yProduction: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          ticks: {
            color: '#cad8de',
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    }),
    [],
  )

  return (
    <section className="panel-section">
      <h3>Daily Production</h3>

      {!dateIso && <p>Select date/time above to compute sunrise, sunset, and production profile.</p>}
      {!computationEnabled && <p>Production computation paused while editing geometry.</p>}

      {computationEnabled && dateIso && !sunriseSunset && (
        <p data-testid="sun-daily-no-events">No sunrise/sunset for this date at this latitude.</p>
      )}


      {computationEnabled && dateIso && selectedRoofs.length > 0 && totalSelectedKwp <= 0 && (
        <p>Set kWp on selected polygons to compute production.</p>
      )}

      {aggregated && chartData && (
        <>
          <div className="sun-daily-chart" data-testid="sun-daily-chart">
            <Line data={chartData} options={chartOptions} />
          </div>
          <p data-testid="sun-daily-production-peak">
            Real production peak: {aggregated.peakProductionValue_kW.toFixed(2)} kW at {aggregated.peakProductionTimeLabel}
          </p>
          <p data-testid="sun-daily-power">Weighted capacity: {totalSelectedKwp.toFixed(1)} kWp</p>
          <p data-testid="sun-daily-window">
            Window: {formatTimestampHHmm(aggregated.sunriseTs, timeZone)}-{formatTimestampHHmm(aggregated.sunsetTs, timeZone)}
          </p>
        </>
      )}
    </section>
  )
}
