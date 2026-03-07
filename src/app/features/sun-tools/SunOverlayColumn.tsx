import { useEffect, useState, type ReactNode } from 'react'
import { AnnualDayProfilePanel } from './AnnualDayProfilePanel'
import { ForecastPvPanel } from './ForecastPvPanel'
import { MonthlyProductionPanel } from './MonthlyProductionPanel'
import { SunDateTimePanel } from './SunDateTimePanel'
import type { RoofPlane } from '../../../types/geometry'

export interface SelectedRoofSunInput {
  footprintId: string
  latDeg: number
  lonDeg: number
  kwp: number
  roofPitchDeg: number
  roofAzimuthDeg: number
  roofPlane: RoofPlane
}

interface SunOverlayColumnProps {
  children: ReactNode
  datetimeIso: string
  timeZone: string
  selectedRoofs: SelectedRoofSunInput[]
  onDatetimeInputChange: (datetimeIsoRaw: string) => void
  productionComputationEnabled: boolean
  expanded?: boolean
}

export function SunOverlayColumn({
  children,
  datetimeIso,
  timeZone,
  selectedRoofs,
  onDatetimeInputChange,
  productionComputationEnabled,
  expanded,
}: SunOverlayColumnProps) {
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    if (expanded === undefined) {
      return
    }
    setCollapsed(!expanded)
  }, [expanded])

  return (
    <aside className={`sun-overlay-column${collapsed ? ' sun-overlay-column-collapsed' : ''}`}>
      <button
        type="button"
        className="sun-overlay-toggle"
        onClick={() => setCollapsed((current) => !current)}
        data-testid="sun-overlay-toggle"
      >
        {collapsed ? 'Sun tools' : 'Hide'}
      </button>
      {!collapsed && (
        <div className="sun-overlay-content">
          <SunDateTimePanel datetimeIso={datetimeIso} timeZone={timeZone} onDatetimeInputChange={onDatetimeInputChange} />
          <ForecastPvPanel
            datetimeIso={datetimeIso}
            timeZone={timeZone}
            selectedRoofs={selectedRoofs}
            computationEnabled={productionComputationEnabled}
          />
          {children}
          <MonthlyProductionPanel
            datetimeIso={datetimeIso}
            timeZone={timeZone}
            selectedRoofs={selectedRoofs}
            computationEnabled={productionComputationEnabled}
          />
          <AnnualDayProfilePanel
            datetimeIso={datetimeIso}
            timeZone={timeZone}
            selectedRoofs={selectedRoofs}
            computationEnabled={productionComputationEnabled}
          />
        </div>
      )}
    </aside>
  )
}
