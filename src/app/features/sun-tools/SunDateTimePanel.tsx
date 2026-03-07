import type { KeyboardEvent } from 'react'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'

interface SunDateTimePanelProps {
  datetimeIso: string
  timeZone: string
  onDatetimeInputChange: (datetimeIsoRaw: string) => void
}

const ISO_DATE_TIME_WITH_TZ_REGEX =
  /^(?<date>\d{4}-\d{2}-\d{2})T(?<time>\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(?<tz>Z|[+-]\d{2}:\d{2})$/

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftIsoDateByDays(datetimeIso: string, dayDelta: number): string | null {
  const trimmed = datetimeIso.trim()
  const match = ISO_DATE_TIME_WITH_TZ_REGEX.exec(trimmed)
  if (!match?.groups) {
    return null
  }

  const utcDate = new Date(`${match.groups.date}T00:00:00Z`)
  if (Number.isNaN(utcDate.getTime())) {
    return null
  }

  utcDate.setUTCDate(utcDate.getUTCDate() + dayDelta)
  return `${formatUtcDate(utcDate)}T${match.groups.time}${match.groups.tz}`
}

export function SunDateTimePanel({ datetimeIso, timeZone, onDatetimeInputChange }: SunDateTimePanelProps) {
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return
    }

    const dayDelta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (dayDelta === 0) {
      return
    }

    const shifted = shiftIsoDateByDays(datetimeIso, dayDelta)
    if (!shifted) {
      return
    }

    event.preventDefault()
    onDatetimeInputChange(shifted)
  }

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
          onKeyDown={onInputKeyDown}
          placeholder="2026-03-05T14:30:00+01:00"
          data-testid="sun-datetime-input"
        />
      </div>
    </section>
  )
}
