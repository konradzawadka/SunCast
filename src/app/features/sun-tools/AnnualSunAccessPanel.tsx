import { useMemo, useState } from 'react'
import type { AnnualSunAccessResult } from '../../../geometry/shading'
import type { AnnualSimulationOptions, AnnualSimulationState } from '../../hooks/useAnnualRoofSimulation'
import { AnnualHeatmapCanvas } from './AnnualHeatmapCanvas'
import {
  currentYear,
  firstDayOfYearIso,
  formatDateIsoEu,
  lastDayOfYearIso,
  parseDateEuToIso,
} from './annualSunAccessDate'
import { toCanvasDimensions } from './annualSunAccessHeatmap'

const HEATMAP_MAX_CANVAS_PX_PANEL = 1200
const HEATMAP_MAX_CANVAS_PX_OVERLAY = 2800

interface AnnualSunAccessPanelProps {
  selectedRoofCount: number
  gridResolutionM: number
  state: AnnualSimulationState
  progressRatio: number
  result: AnnualSunAccessResult | null
  error: string | null
  isAnnualHeatmapVisible: boolean
  onGridResolutionChange: (gridResolutionM: number) => void
  onRunSimulation: (options: AnnualSimulationOptions) => Promise<void>
  onClearSimulation: () => void
  onShowAnnualHeatmap: () => void
  onHideAnnualHeatmap: () => void
}

export function AnnualSunAccessPanel({
  selectedRoofCount,
  gridResolutionM,
  state,
  progressRatio,
  result,
  error,
  isAnnualHeatmapVisible,
  onGridResolutionChange,
  onRunSimulation,
  onClearSimulation,
  onShowAnnualHeatmap,
  onHideAnnualHeatmap,
}: AnnualSunAccessPanelProps) {
  const [heatmapOverlayOpen, setHeatmapOverlayOpen] = useState(false)
  const [year, setYear] = useState<number>(() => currentYear())
  const [dateStartInput, setDateStartInput] = useState<string>(() => formatDateIsoEu(firstDayOfYearIso(currentYear())))
  const [dateEndInput, setDateEndInput] = useState<string>(() => formatDateIsoEu(lastDayOfYearIso(currentYear())))
  const [sampleWindowDays, setSampleWindowDays] = useState<number>(5)
  const [stepMinutes, setStepMinutes] = useState<number>(30)
  const [halfYearMirror, setHalfYearMirror] = useState(true)

  const summary = useMemo(() => {
    if (!result) {
      return null
    }

    const sunHours = result.roofs.reduce((sum, roof) => sum + roof.sunHours, 0)
    const daylightHours = result.roofs.reduce((sum, roof) => sum + roof.daylightHours, 0)
    const ratio = daylightHours > 0 ? sunHours / daylightHours : 0

    return {
      sunHours,
      daylightHours,
      ratio,
    }
  }, [result])

  const progressPercent = Math.round(progressRatio * 100)
  const canRun = selectedRoofCount > 0 && state !== 'RUNNING'
  const heatmapCanvasSize = useMemo(
    () => (result ? toCanvasDimensions(result, gridResolutionM, HEATMAP_MAX_CANVAS_PX_PANEL) : null),
    [gridResolutionM, result],
  )

  return (
    <section className="panel-section" data-testid="annual-sun-access-panel">
      <h3>Annual Sun Access</h3>
      <p>
        Simulates annual roof shading with day-step sampling. Grid resolution: {gridResolutionM.toFixed(2)} m.
      </p>
      <div className="constraint-grid">
        <label className="ui-label">
          Year
          <input
            className="ui-input"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(event) => {
              const nextYear = Number.parseInt(event.target.value, 10) || currentYear()
              const nextDateStartIso = firstDayOfYearIso(nextYear)
              const nextDateEndIso = lastDayOfYearIso(nextYear)
              setYear(nextYear)
              setDateStartInput(formatDateIsoEu(nextDateStartIso))
              setDateEndInput(formatDateIsoEu(nextDateEndIso))
            }}
          />
        </label>
        <label className="ui-label">
          Date from
          <input
            className="ui-input"
            type="text"
            inputMode="numeric"
            placeholder="DD.MM.YYYY"
            value={dateStartInput}
            onChange={(event) => {
              setDateStartInput(event.target.value)
            }}
            onBlur={() => {
              const parsedIso = parseDateEuToIso(dateStartInput)
              if (!parsedIso) {
                return
              }
              setDateStartInput(formatDateIsoEu(parsedIso))
            }}
            data-testid="annual-date-start-input"
          />
        </label>
        <label className="ui-label">
          Date to
          <input
            className="ui-input"
            type="text"
            inputMode="numeric"
            placeholder="DD.MM.YYYY"
            value={dateEndInput}
            onChange={(event) => {
              setDateEndInput(event.target.value)
            }}
            onBlur={() => {
              const parsedIso = parseDateEuToIso(dateEndInput)
              if (!parsedIso) {
                return
              }
              setDateEndInput(formatDateIsoEu(parsedIso))
            }}
            data-testid="annual-date-end-input"
          />
        </label>
        <p className="panel-hint">Range: {dateStartInput} - {dateEndInput}</p>
        <label className="ui-label">
          Day step
          <input
            className="ui-input"
            type="number"
            min={1}
            max={60}
            value={sampleWindowDays}
            onChange={(event) => setSampleWindowDays(Math.max(1, Number.parseInt(event.target.value, 10) || 5))}
          />
        </label>
        <label className="ui-label">
          Time step (min)
          <input
            className="ui-input"
            type="number"
            min={5}
            max={180}
            step={5}
            value={stepMinutes}
            onChange={(event) => setStepMinutes(Math.max(5, Number.parseInt(event.target.value, 10) || 30))}
          />
        </label>
        <label className="sun-toggle">
          <input
            type="checkbox"
            checked={halfYearMirror}
            onChange={(event) => setHalfYearMirror(event.target.checked)}
          />
          Half-year mirror
        </label>
        <label className="ui-label">
          Grid resolution (m)
          <input
            className="ui-input"
            type="number"
            min={0.1}
            step={0.05}
            value={gridResolutionM}
            onChange={(event) => {
              const parsed = Number.parseFloat(event.target.value)
              if (!Number.isFinite(parsed)) {
                return
              }
              onGridResolutionChange(Math.max(0.1, parsed))
            }}
            data-testid="annual-grid-resolution-input"
          />
        </label>
      </div>

      <div className="draw-actions">
        <button
          type="button"
          onClick={() => {
            const parsedDateStartIso = parseDateEuToIso(dateStartInput)
            const parsedDateEndIso = parseDateEuToIso(dateEndInput)
            void onRunSimulation({
              year,
              dateStartIso: parsedDateStartIso ?? dateStartInput.trim(),
              dateEndIso: parsedDateEndIso ?? dateEndInput.trim(),
              sampleWindowDays,
              stepMinutes,
              halfYearMirror,
            })
          }}
          disabled={!canRun}
          data-testid="annual-sim-run"
        >
          Run annual sun access simulation
        </button>
        <button
          type="button"
          onClick={isAnnualHeatmapVisible ? onHideAnnualHeatmap : onShowAnnualHeatmap}
          disabled={state !== 'READY'}
          data-testid="annual-sim-toggle-heatmap"
        >
          {isAnnualHeatmapVisible ? 'Hide annual heatmap' : 'Show annual heatmap on roof'}
        </button>
        <button type="button" onClick={onClearSimulation} disabled={state === 'IDLE'} data-testid="annual-sim-clear">
          Clear simulation
        </button>
      </div>

      {selectedRoofCount === 0 && <p>Select at least one solved roof to run annual simulation.</p>}
      {state === 'RUNNING' && <p>Simulation running: {progressPercent}%</p>}
      {error && <p className="status-error">{error}</p>}

      {summary && result && (
        <div data-testid="annual-sim-results">
          <p>Sun hours / year: {summary.sunHours.toFixed(1)} h</p>
          <p>Daylight hours considered: {summary.daylightHours.toFixed(1)} h</p>
          <p>Sun access ratio: {(summary.ratio * 100).toFixed(1)}%</p>
          <p>
            Sampling: 1 day every {result.meta.sampleWindowDays} days, {result.meta.stepMinutes} min steps,
            {result.meta.simulatedHalfYear ? ' mirrored half-year' : ' full year'}.
          </p>
          <p>
            Simulated dates: {formatDateIsoEu(result.meta.dateStartIso)} - {formatDateIsoEu(result.meta.dateEndIso)}.
          </p>
          <p>Heatmap cells: {result.heatmapCells.length}</p>
          {heatmapCanvasSize && (
            <p>
              Heatmap canvas: {heatmapCanvasSize.width} x {heatmapCanvasSize.height} px
            </p>
          )}
          <AnnualHeatmapCanvas
            result={result}
            gridResolutionM={gridResolutionM}
            maxCanvasPx={HEATMAP_MAX_CANVAS_PX_PANEL}
            wrapClassName="annual-heatmap-canvas-wrap"
            className="annual-heatmap-canvas"
            canvasTestId="annual-sim-heatmap-canvas"
            tooltipTestId="annual-sim-heatmap-tooltip"
          />
          <button
            type="button"
            onClick={() => setHeatmapOverlayOpen(true)}
            data-testid="annual-sim-heatmap-overlay-open"
          >
            Open heatmap overlay (80% screen)
          </button>
        </div>
      )}

      {heatmapOverlayOpen && result && (
        <div className="annual-heatmap-overlay-backdrop" role="dialog" aria-modal="true">
          <div className="annual-heatmap-overlay-panel">
            <div className="annual-heatmap-overlay-header">
              <h4>Annual Heatmap Overlay</h4>
              <button
                type="button"
                onClick={() => setHeatmapOverlayOpen(false)}
                data-testid="annual-sim-heatmap-overlay-close"
              >
                Close
              </button>
            </div>
            <AnnualHeatmapCanvas
              result={result}
              gridResolutionM={gridResolutionM}
              maxCanvasPx={HEATMAP_MAX_CANVAS_PX_OVERLAY}
              wrapClassName="annual-heatmap-overlay-canvas-wrap"
              className="annual-heatmap-overlay-canvas"
              canvasTestId="annual-sim-heatmap-overlay-canvas"
              tooltipTestId="annual-sim-heatmap-overlay-tooltip"
            />
          </div>
        </div>
      )}
    </section>
  )
}
