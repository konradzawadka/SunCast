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
} from '../../geometry/sun/dailyEstimation'
import { formatMinuteOfDay, sumProfiles } from '../../geometry/sun/profileAggregation'
import type { RoofPlane } from '../../types/geometry'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

interface SunDailyChartPanelProps {
  dateIso: string
  timeZone: string
  selectedRoofs: Array<{
    footprintId: string
    latDeg: number
    lonDeg: number
    roofPlane: RoofPlane
  }>
}

export function SunDailyChartPanel({ dateIso, timeZone, selectedRoofs }: SunDailyChartPanelProps) {
  const aggregated = useMemo(() => {
    if (!dateIso || selectedRoofs.length === 0) {
      return null
    }

    const perRoofSeries = selectedRoofs
      .map((roof) =>
        getDailyPoaSeries({
          dateIso,
          timeZone,
          latDeg: roof.latDeg,
          lonDeg: roof.lonDeg,
          plane: roof.roofPlane,
          stepMinutes: SUN_DAILY_SERIES_STEP_MINUTES,
        }),
      )
      .filter((series): series is NonNullable<typeof series> => Boolean(series))

    if (perRoofSeries.length === 0) {
      return null
    }

    const profiles = perRoofSeries.map((series) =>
      series.labels.map((label, index) => {
        const [hourRaw, minuteRaw] = label.split(':')
        const hour = Number(hourRaw)
        const minute = Number(minuteRaw)
        return {
          minuteOfDay: Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : -1,
          value: series.values_Wm2[index],
        }
      }),
    )

    const points = sumProfiles(profiles)
    if (points.length === 0) {
      return null
    }

    const firstDaylightByRoof = perRoofSeries.map((series) => series.sunriseTs)
    const lastDaylightByRoof = perRoofSeries.map((series) => series.sunsetTs)
    const sunriseTs = Math.min(...firstDaylightByRoof)
    const sunsetTs = Math.max(...lastDaylightByRoof)

    const labels = points.map((point) => formatMinuteOfDay(point.minuteOfDay))
    const values_Wm2 = points.map((point) => point.value)
    const peakIndex = values_Wm2.reduce((bestIndex, current, index, all) => (current > all[bestIndex] ? index : bestIndex), 0)

    return {
      labels,
      values_Wm2,
      sunriseTs,
      sunsetTs,
      peakValue_Wm2: values_Wm2[peakIndex],
      peakTimeLabel: labels[peakIndex],
    }
  }, [dateIso, selectedRoofs, timeZone])

  const sunriseSunset = useMemo(() => {
    if (!dateIso || selectedRoofs.length === 0) {
      return null
    }
    const firstRoof = selectedRoofs[0]
    return getSunriseSunset({ dateIso, timeZone, latDeg: firstRoof.latDeg, lonDeg: firstRoof.lonDeg })
  }, [dateIso, selectedRoofs, timeZone])

  const chartData = useMemo<ChartData<'line'> | null>(() => {
    if (!aggregated) {
      return null
    }

    return {
      labels: aggregated.labels,
      datasets: [
        {
          label: 'POA (clear-sky) W/m2',
          data: aggregated.values_Wm2,
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
  }, [aggregated])

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

      {aggregated && chartData && (
        <>
          <div className="sun-daily-chart" data-testid="sun-daily-chart">
            <Line data={chartData} options={chartOptions} />
          </div>
          <p data-testid="sun-daily-peak">
            Peak: {aggregated.peakValue_Wm2.toFixed(0)} W/m2 at {aggregated.peakTimeLabel}
          </p>
          <p data-testid="sun-daily-window">
            Window: {formatTimestampHHmm(aggregated.sunriseTs, timeZone)}-{formatTimestampHHmm(aggregated.sunsetTs, timeZone)}
          </p>
        </>
      )}
    </section>
  )
}
