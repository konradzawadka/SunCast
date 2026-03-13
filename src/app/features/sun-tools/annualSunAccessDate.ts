export function currentYear(): number {
  return new Date().getFullYear()
}

export function formatDateIso(year: number, month1Based: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month1Based).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatDateIsoEu(dateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
  if (!match) {
    return dateIso
  }
  return `${match[3]}.${match[2]}.${match[1]}`
}

export function parseDateEuToIso(value: string): string | null {
  const match = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(value)
  if (!match) {
    return null
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null
  }

  const ts = Date.UTC(year, month - 1, day)
  if (!Number.isFinite(ts)) {
    return null
  }

  const normalized = new Date(ts)
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() + 1 !== month ||
    normalized.getUTCDate() !== day
  ) {
    return null
  }

  return formatDateIso(year, month, day)
}

export function firstDayOfYearIso(year: number): string {
  return formatDateIso(year, 1, 1)
}

export function lastDayOfYearIso(year: number): string {
  return formatDateIso(year, 12, 31)
}
