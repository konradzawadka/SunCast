export interface MinuteValuePoint {
  minuteOfDay: number
  value: number
}

function isValidMinuteOfDay(minuteOfDay: number): boolean {
  return Number.isInteger(minuteOfDay) && minuteOfDay >= 0 && minuteOfDay < 24 * 60
}

export function sumProfiles(profiles: MinuteValuePoint[][]): MinuteValuePoint[] {
  const totals = new Map<number, number>()

  for (const profile of profiles) {
    for (const point of profile) {
      if (!isValidMinuteOfDay(point.minuteOfDay) || !Number.isFinite(point.value)) {
        continue
      }
      totals.set(point.minuteOfDay, (totals.get(point.minuteOfDay) ?? 0) + point.value)
    }
  }

  return Array.from(totals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([minuteOfDay, value]) => ({ minuteOfDay, value }))
}

export function formatMinuteOfDay(minuteOfDay: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.floor(minuteOfDay)))
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseHhmmToMinuteOfDay(label: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(label)
  if (!match) {
    return null
  }

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return hour * 60 + minute
}
