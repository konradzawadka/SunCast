import { useEffect, useState, type ReactNode } from 'react'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

interface SunOverlayColumnProps {
  children: ReactNode
  datetimeIso: string
  timeZone: string
  onDatetimeInputChange: (datetimeIsoRaw: string) => void
  expanded?: boolean
}

export function SunOverlayColumn({
  children,
  datetimeIso,
  timeZone,
  onDatetimeInputChange,
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
          <section className="panel-section">
            <h3>Sun Date & Time</h3>
            <div className="sun-controls">
              <Label className="sun-datetime-label" htmlFor="sun-datetime-input">
                Datetime ISO ({timeZone})
              </Label>
              <Input
                id="sun-datetime-input"
                type="text"
                value={datetimeIso}
                onChange={(event) => onDatetimeInputChange(event.target.value)}
                placeholder="2026-03-05T14:30:00+01:00"
                data-testid="sun-datetime-input"
              />
            </div>
          </section>
          {children}
        </div>
      )}
    </aside>
  )
}
