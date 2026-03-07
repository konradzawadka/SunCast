import type { SunProjectionResult } from '../../../geometry/sun/sunProjection'

interface SunProjectionStatusProps {
  enabled: boolean
  hasDatetime: boolean
  datetimeError: string | null
  onToggleEnabled: (enabled: boolean) => void
  result: SunProjectionResult | null
}

export function SunProjectionStatus({ enabled, hasDatetime, datetimeError, onToggleEnabled, result }: SunProjectionStatusProps) {
  return (
    <section className="panel-section">
      <h3>Sun Projection</h3>
      <div className="sun-controls">
        <label className="sun-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggleEnabled(event.target.checked)}
            data-testid="sun-projection-toggle"
          />
          Enable sun projection
        </label>
      </div>
      {datetimeError && <p className="status-error">{datetimeError}</p>}
      {!enabled && <p>Sun projection is disabled.</p>}
      {enabled && !hasDatetime && <p data-testid="sun-status-set-datetime">Set datetime</p>}
      {enabled && hasDatetime && result && (
        <div className="sun-status" data-testid="sun-projection-status">
          {result.sunElevationDeg <= 0 ? (
            <p data-testid="sun-poa-value">POA: 0 W/m2 (sun below horizon)</p>
          ) : (
            <p data-testid="sun-poa-value">POA (clear-sky): {result.poaIrradiance_Wm2.toFixed(0)} W/m2</p>
          )}
          <p>
            Sun: az={result.sunAzimuthDeg.toFixed(1)} deg, el={result.sunElevationDeg.toFixed(1)} deg
          </p>
          <p>Incidence: {result.incidenceDeg.toFixed(1)} deg</p>
        </div>
      )}
    </section>
  )
}
