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
import { planeSlopeFromPitchAzimuth } from '../../geometry/solver/metrics'
import { getAnnualAggregatedDayProfile } from '../../geometry/sun/annualEstimation'
import { formatMinuteOfDay, scaleProfile, sumProfiles } from '../../geometry/sun/profileAggregation'
import type { SelectedRoofSunInput } from './SunOverlayColumn'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

interface AnualDayProfilePanelProps {
  datetimeIso: string
  timeZone: string
  selectedRoofs: SelectedRoofSunInput[]
  computationEnabled?: boolean
}

function extractYear(datetimeIso: string): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}T/.exec(datetimeIso.trim())
  if (!match) {
    return null
  }
  const year = Number(match[1])
  return Number.isInteger(year) ? year : null
}

export function AnualDayProfilePanel({
  datetimeIso,
  timeZone,
  selectedRoofs,
  computationEnabled = true,
}: AnualDayProfilePanelProps) {
  const selectedYear = useMemo(() => extractYear(datetimeIso) ?? new Date().getFullYear(), [datetimeIso])

  const annualProfile = useMemo(() => {
    if (!computationEnabled || selectedRoofs.length === 0) {
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
  }, [computationEnabled, selectedRoofs, selectedYear, timeZone])

  const chartData = useMemo<ChartData<'line'> | null>(() => {
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

  const annualPeak = useMemo(() => {
    if (!annualProfile || annualProfile.points.length === 0) {
      return null
    }
    return annualProfile.points.reduce((peak, point) => (point.value > peak.value ? point : peak), annualProfile.points[0])
  }, [annualProfile])

  const annualEnergyKwhEstimate = useMemo(() => {
    if (!annualProfile || annualProfile.points.length === 0) {
      return null
    }
    const stepHours = annualProfile.meta.stepMinutes / 60
    return annualProfile.points.reduce((sum, point) => sum + point.value * stepHours, 0)
  }, [annualProfile])

  return (
    <section className="panel-section">
      <h3>Annual Day Profile</h3>
      {!computationEnabled && <p>Production computation paused while editing geometry.</p>}
      {selectedRoofs.length === 0 && <p>Select one or more solved polygons to compute annual aggregation.</p>}
      {annualProfile && chartData && annualPeak && (
        <>
          <div className="sun-daily-chart" data-testid="sun-annual-chart">
            <Line data={chartData} options={chartOptions} />
          </div>
          <p data-testid="sun-annual-sampling-meta">
            Sampling: 1 day every {annualProfile.meta.sampleWindowDays} days, weighted to cover all {annualProfile.meta.dayCount}{' '}
            days ({annualProfile.meta.sampledDayCount} sampled days).
          </p>
          {annualEnergyKwhEstimate !== null && (
            <p data-testid="sun-annual-total">
              Overall PV: {annualEnergyKwhEstimate.toFixed(1)} kWh
            </p>
          )}
        </>
      )}
    </section>
  )
}
