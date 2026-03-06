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
import type { RoofPlane } from '../../types/geometry'
import {
  SUN_DAILY_SERIES_STEP_MINUTES,
  expectedSeriesPointCount,
  formatTimestampHHmm,
  getDailyPoaSeries,
  getSunriseSunset,
} from '../../geometry/sun/dailyEstimation'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

interface SunDailyChartPanelProps {
  dateIso: string
  timeZone: string
  latDeg: number | null
  lonDeg: number | null
  plane: RoofPlane | null
}

export function SunDailyChartPanel({ dateIso, timeZone, latDeg, lonDeg, plane }: SunDailyChartPanelProps) {
  const sunriseSunset = useMemo(() => {
    if (!dateIso || latDeg === null || lonDeg === null) {
      return null
    }
    return getSunriseSunset({ dateIso, timeZone, latDeg, lonDeg })
  }, [dateIso, latDeg, lonDeg, timeZone])

  const series = useMemo(() => {
    if (!dateIso || latDeg === null || lonDeg === null || !plane) {
      return null
    }
    return getDailyPoaSeries({
      dateIso,
      timeZone,
      latDeg,
      lonDeg,
      plane,
      stepMinutes: SUN_DAILY_SERIES_STEP_MINUTES,
    })
  }, [dateIso, latDeg, lonDeg, plane, timeZone])

  const chartData = useMemo<ChartData<'line'> | null>(() => {
    if (!series) {
      return null
    }

    return {
      labels: series.labels,
      datasets: [
        {
          label: 'POA (clear-sky) W/m2',
          data: series.values_Wm2,
          borderColor: '#7ce0f2',
          backgroundColor: 'rgba(124, 224, 242, 0.18)',
          pointRadius: 1,
          pointHoverRadius: 3,
          borderWidth: 1.5,
          fill: true,
          tension: 0.2,
        },
      ],
    }
  }, [series])

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

  return (
    <section className="panel-section">
      <h3>Daily POA</h3>

      {!dateIso && <p>Select date/time above to compute sunrise, sunset, and POA profile.</p>}

      {dateIso && !sunriseSunset && <p data-testid="sun-daily-no-events">No sunrise/sunset for this date at this latitude.</p>}

      {dateIso && sunriseSunset && (
        <p className="sun-daily-window-meta">
          Sunrise/Sunset: {formatTimestampHHmm(sunriseSunset.sunriseTs, timeZone)}-{formatTimestampHHmm(sunriseSunset.sunsetTs, timeZone)}
        </p>
      )}

      {series && chartData && (
        <>
          <div className="sun-daily-chart" data-testid="sun-daily-chart">
            <Line data={chartData} options={chartOptions} />
          </div>
          <p data-testid="sun-daily-peak">
            Peak: {series.peakValue_Wm2.toFixed(0)} W/m2 at {series.peakTimeLabel}
          </p>
          <p data-testid="sun-daily-window">
            Window: {formatTimestampHHmm(series.sunriseTs, timeZone)}-{formatTimestampHHmm(series.sunsetTs, timeZone)} ({series.labels.length}{' '}
            points, {SUN_DAILY_SERIES_STEP_MINUTES} min)
          </p>
          <p>
            Expected points: {expectedSeriesPointCount(series.sunriseTs, series.sunsetTs, SUN_DAILY_SERIES_STEP_MINUTES)}
          </p>
        </>
      )}
    </section>
  )
}
