import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'

interface SunDateTimePanelProps {
  datetimeIso: string
  timeZone: string
  onDatetimeInputChange: (datetimeIsoRaw: string) => void
}

export function SunDateTimePanel({ datetimeIso, timeZone, onDatetimeInputChange }: SunDateTimePanelProps) {
  return (
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
  )
}
