import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import { planeSlopeFromPitchAzimuth } from '../../geometry/solver/metrics'
import { getAnnualMonthlyEnergyEstimate } from '../../geometry/sun/annualEstimation'
import type { SelectedRoofSunInput } from './SunOverlayColumn'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface MonthlyProductionPanelProps {
  datetimeIso: string
  timeZone: string
  selectedRoofs: SelectedRoofSunInput[]
}

const MONTH_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

function extractYear(datetimeIso: string): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}T/.exec(datetimeIso.trim())
  if (!match) {
    return null
  }
  const year = Number(match[1])
  return Number.isInteger(year) ? year : null
}

export function MonthlyProductionPanel({ datetimeIso, timeZone, selectedRoofs }: MonthlyProductionPanelProps) {
  const selectedYear = useMemo(() => extractYear(datetimeIso) ?? new Date().getFullYear(), [datetimeIso])

  const totalSelectedKwp = useMemo(
    () => selectedRoofs.reduce((sum, roof) => sum + (Number.isFinite(roof.kwp) && roof.kwp > 0 ? roof.kwp : 0), 0),
    [selectedRoofs],
  )

  const monthlyEnergyKwh = useMemo(() => {
    if (selectedRoofs.length === 0) {
      return null
    }

    const totals = Array.from({ length: 12 }, () => 0)
    let hasData = false

    for (const roof of selectedRoofs) {
      const safeKwp = Number.isFinite(roof.kwp) && roof.kwp > 0 ? roof.kwp : 0
      if (safeKwp <= 0) {
        continue
      }

      const { p, q } = planeSlopeFromPitchAzimuth(roof.roofPitchDeg, roof.roofAzimuthDeg)
      const monthly = getAnnualMonthlyEnergyEstimate({
        year: selectedYear,
        timeZone,
        latDeg: roof.latDeg,
        lonDeg: roof.lonDeg,
        plane: { p, q, r: roof.roofPlane.r },
        stepMinutes: 15,
      })
      if (!monthly) {
        continue
      }

      hasData = true
      for (let monthIdx = 0; monthIdx < monthly.months.length; monthIdx += 1) {
        totals[monthIdx] += monthly.months[monthIdx].energyWhm2Estimate * (safeKwp / 1000)
      }
    }

    return hasData ? totals : null
  }, [selectedRoofs, selectedYear, timeZone])

  const chartData = useMemo<ChartData<'bar'> | null>(() => {
    if (!monthlyEnergyKwh) {
      return null
    }
    return {
      labels: MONTH_LABELS,
      datasets: [
        {
          label: 'Monthly production (kWh)',
          data: monthlyEnergyKwh,
          borderColor: '#8fe287',
          backgroundColor: 'rgba(143, 226, 135, 0.45)',
          borderWidth: 1,
        },
      ],
    }
  }, [monthlyEnergyKwh])

  const chartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      animation: false as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => `${(typeof context.parsed.y === 'number' ? context.parsed.y : 0).toFixed(1)} kWh`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#cad8de',
            autoSkip: false,
            maxRotation: 0,
          },
          grid: {
            color: 'rgba(90, 110, 120, 0.2)',
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
      <h3>Monthly Production</h3>
      {selectedRoofs.length === 0 && <p>Select one or more solved polygons to compute monthly production.</p>}
      {selectedRoofs.length > 0 && totalSelectedKwp <= 0 && <p>Set kWp on selected polygons to compute production.</p>}
      {chartData && monthlyEnergyKwh && (
        <>
          <div className="sun-daily-chart" data-testid="sun-monthly-chart">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </>
      )}
    </section>
  )
}
