import type { KeyboardEvent } from 'react'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { HintTooltip } from '../../components/HintTooltip'

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

function parseTimeComponents(timePart: string): { hours: number; minutes: number; seconds: number; milliseconds: number } | null {
  const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(timePart)
  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const milliseconds = Number((match[4] ?? '').padEnd(3, '0') || '0')
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    Number.isNaN(milliseconds) ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return null
  }

  return { hours, minutes, seconds, milliseconds }
}

function parseOffsetMinutes(tzPart: string): number | null {
  if (tzPart === 'Z') {
    return 0
  }
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(tzPart)
  if (!match) {
    return null
  }
  const hours = Number(match[2])
  const minutes = Number(match[3])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null
  }
  const total = hours * 60 + minutes
  return match[1] === '-' ? -total : total
}

function formatTimeWithPrecision(date: Date, timePart: string): string {
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  const fractionPart = /\.(\d{1,3})$/.exec(timePart)?.[1] ?? ''
  if (fractionPart === '') {
    return `${hours}:${minutes}:${seconds}`
  }
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0').slice(0, fractionPart.length)
  return `${hours}:${minutes}:${seconds}.${milliseconds}`
}

function shiftIsoDateTimeByHours(datetimeIso: string, hourDelta: number): string | null {
  const trimmed = datetimeIso.trim()
  const match = ISO_DATE_TIME_WITH_TZ_REGEX.exec(trimmed)
  if (!match?.groups) {
    return null
  }

  const [yearPart, monthPart, dayPart] = match.groups.date.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)
  const time = parseTimeComponents(match.groups.time)
  const offsetMinutes = parseOffsetMinutes(match.groups.tz)
  if (!time || Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day) || offsetMinutes === null) {
    return null
  }

  const utcTimestamp =
    Date.UTC(year, month - 1, day, time.hours, time.minutes, time.seconds, time.milliseconds) - offsetMinutes * 60_000
  const shiftedUtcTimestamp = utcTimestamp + hourDelta * 60 * 60 * 1000
  const shiftedAtOffset = new Date(shiftedUtcTimestamp + offsetMinutes * 60_000)
  if (Number.isNaN(shiftedAtOffset.getTime())) {
    return null
  }

  const nextDate = formatUtcDate(shiftedAtOffset)
  const nextTime = formatTimeWithPrecision(shiftedAtOffset, match.groups.time)
  return `${nextDate}T${nextTime}${match.groups.tz}`
}

export function SunDateTimePanel({ datetimeIso, timeZone, onDatetimeInputChange }: SunDateTimePanelProps) {
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return
    }

    if (event.shiftKey) {
      const hourDelta = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
      if (hourDelta === 0) {
        return
      }
      const shiftedHour = shiftIsoDateTimeByHours(datetimeIso, hourDelta)
      if (!shiftedHour) {
        return
      }
      event.preventDefault()
      onDatetimeInputChange(shiftedHour)
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
      <h3 className="panel-heading-with-hint">
        Sun Date & Time{' '}
        <HintTooltip hint="Arrow Up/Down changes day. Shift + Arrow Up/Down changes hour while preserving timezone offset.">
          ?
        </HintTooltip>
      </h3>
      <p className="panel-hint">Tip: Use keyboard arrows in the input to quickly step through time.</p>
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
          title="Datetime with timezone offset, e.g. 2026-03-05T14:30:00+01:00"
          data-testid="sun-datetime-input"
        />
      </div>
    </section>
  )
}
