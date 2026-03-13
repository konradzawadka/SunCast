import type { SolverWarning } from '../../../types/geometry'
import { useEffect, useState } from 'react'
import { HintTooltip } from '../../components/HintTooltip'

const MIN_PITCH_ADJUSTMENT_PERCENT = -90
const MAX_PITCH_ADJUSTMENT_PERCENT = 200

function clampPitchAdjustmentPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(MAX_PITCH_ADJUSTMENT_PERCENT, Math.max(MIN_PITCH_ADJUSTMENT_PERCENT, value))
}

interface StatusPanelProps {
  warnings: SolverWarning[]
  basePitchDeg: number | null
  pitchAdjustmentPercent: number
  adjustedPitchDeg: number | null
  onSetPitchAdjustmentPercent: (pitchAdjustmentPercent: number) => void
  azimuthDeg: number | null
  roofAreaM2: number | null
  minHeightM: number | null
  maxHeightM: number | null
  fitRmsErrorM: number | null
  activeFootprintLatDeg: number | null
  activeFootprintLonDeg: number | null
}

export function StatusPanel({
  warnings,
  basePitchDeg,
  pitchAdjustmentPercent,
  adjustedPitchDeg,
  onSetPitchAdjustmentPercent,
  azimuthDeg,
  roofAreaM2,
  minHeightM,
  maxHeightM,
  fitRmsErrorM,
  activeFootprintLatDeg,
  activeFootprintLonDeg,
}: StatusPanelProps) {
  const [pitchAdjustmentInput, setPitchAdjustmentInput] = useState(String(pitchAdjustmentPercent))

  useEffect(() => {
    setPitchAdjustmentInput(String(pitchAdjustmentPercent))
  }, [pitchAdjustmentPercent])

  return (
    <section className="panel-section">
      <h3 className="panel-heading-with-hint">
        Status{' '}
        <HintTooltip hint="Status updates after solving constraints. Pitch adjustment is a what-if slider and does not edit constraints.">
          ?
        </HintTooltip>
      </h3>
      {basePitchDeg !== null &&
        adjustedPitchDeg !== null &&
        azimuthDeg !== null &&
        roofAreaM2 !== null &&
        minHeightM !== null &&
        maxHeightM !== null &&
        fitRmsErrorM !== null && (
          <>
            {warnings.map((warning) => (
              <p key={`${warning.code}:${warning.message}`} className="status-warning">
                {warning.code}: {warning.message}
              </p>
            ))}
            <p data-testid="status-pitch-value">Base pitch: {basePitchDeg.toFixed(2)} deg</p>
            <label className="status-adjustment-control">
              Pitch adjustment (%)
              <input
                type="number"
                step="0.1"
                min={MIN_PITCH_ADJUSTMENT_PERCENT}
                max={MAX_PITCH_ADJUSTMENT_PERCENT}
                value={pitchAdjustmentInput}
                title="What-if pitch scaling relative to solved plane pitch."
                onChange={(event) => {
                  const { value } = event.target
                  setPitchAdjustmentInput(value)
                  if (value.trim() === '') {
                    return
                  }
                  const next = Number(value)
                  if (!Number.isFinite(next)) {
                    return
                  }
                  onSetPitchAdjustmentPercent(clampPitchAdjustmentPercent(next))
                }}
                onBlur={() => {
                  const next = Number(pitchAdjustmentInput)
                  if (!Number.isFinite(next)) {
                    setPitchAdjustmentInput(String(pitchAdjustmentPercent))
                    return
                  }
                  const clamped = clampPitchAdjustmentPercent(next)
                  onSetPitchAdjustmentPercent(clamped)
                  setPitchAdjustmentInput(String(clamped))
                }}
                data-testid="status-pitch-adjustment-input"
              />
            </label>
            <p>Adjusted pitch: {adjustedPitchDeg.toFixed(2)} deg</p>
            <p>Downslope azimuth: {azimuthDeg.toFixed(1)} deg</p>
            <p>Roof area: {roofAreaM2.toFixed(2)} m2</p>
            <p>
              Lat/Lon: {activeFootprintLatDeg?.toFixed(6) ?? 'n/a'}, {activeFootprintLonDeg?.toFixed(6) ?? 'n/a'}
            </p>
            <p>
              Height range: {minHeightM.toFixed(2)}m - {maxHeightM.toFixed(2)}m
            </p>
            <p>Fit RMS error: {fitRmsErrorM.toFixed(3)} m</p>
          </>
        )}
    </section>
  )
}
