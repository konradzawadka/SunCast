import type { SolverWarning } from '../../types/geometry'

interface StatusPanelProps {
  footprintErrors: string[]
  interactionError: string | null
  solverError: string | null
  warnings: SolverWarning[]
  pitchDeg: number | null
  azimuthDeg: number | null
  roofAreaM2: number | null
  minHeightM: number | null
  maxHeightM: number | null
  fitRmsErrorM: number | null
}

export function StatusPanel({
  footprintErrors,
  interactionError,
  solverError,
  warnings,
  pitchDeg,
  azimuthDeg,
  roofAreaM2,
  minHeightM,
  maxHeightM,
  fitRmsErrorM,
}: StatusPanelProps) {
  return (
    <section className="panel-section">
      <h3>Status</h3>
      {footprintErrors.map((error) => (
        <p key={error} className="status-error">
          {error}
        </p>
      ))}
      {interactionError && <p className="status-error">{interactionError}</p>}
      {solverError && <p className="status-error">{solverError}</p>}

      {pitchDeg !== null &&
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
            <p data-testid="status-pitch-value">Pitch: {pitchDeg.toFixed(2)} deg</p>
            <p>Downslope azimuth: {azimuthDeg.toFixed(1)} deg</p>
            <p>Roof area: {roofAreaM2.toFixed(2)} m2</p>
            <p>
              Height range: {minHeightM.toFixed(2)}m - {maxHeightM.toFixed(2)}m
            </p>
            <p>Fit RMS error: {fitRmsErrorM.toFixed(3)} m</p>
          </>
        )}
    </section>
  )
}
