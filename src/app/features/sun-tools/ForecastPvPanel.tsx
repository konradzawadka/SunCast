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
import type { SelectedRoofSunInput } from './SunOverlayColumn'
import { useForecastPv } from './useForecastPv'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

interface ForecastPvPanelProps {
  datetimeIso: string
  timeZone: string
  selectedRoofs: SelectedRoofSunInput[]
  computationEnabled?: boolean
}

export function ForecastPvPanel({
  datetimeIso,
  timeZone,
  selectedRoofs,
  computationEnabled = true,
}: ForecastPvPanelProps) {
  const {
    selectedDateIso,
    selectedCount,
    hasForecastInputs,
    isForecastLoading,
    forecastError,
    forecastPoints,
    totalSelectedKwp,
  } = useForecastPv({
    datetimeIso,
    timeZone,
    selectedRoofs,
    computationEnabled,
  })

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
  return (
    <section className="panel-section">
      <h3>Day Estimated (Weather Forecast)</h3>
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
