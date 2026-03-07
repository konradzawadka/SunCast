export interface OpenMeteoTiltedIrradianceSample {
  timestampIso: string
  irradianceWm2: number
}

interface OpenMeteoForecastResponse {
  hourly?: {
    time?: unknown
    global_tilted_irradiance?: unknown
  }
}

interface FetchOpenMeteoTiltedIrradianceArgs {
  latDeg: number
  lonDeg: number
  roofPitchDeg: number
  roofAzimuthDeg: number
  timeZone: string
  dateIso: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

function normalizeAzimuthDeg(deg: number): number {
  let normalized = deg % 360
  if (normalized < 0) {
    normalized += 360
  }
  return normalized
}

function toOpenMeteoAzimuthDeg(azimuthFromNorthDeg: number): number {
  const southCentered = normalizeAzimuthDeg(azimuthFromNorthDeg) - 180
  if (southCentered > 180) {
    return southCentered - 360
  }
  if (southCentered <= -180) {
    return southCentered + 360
  }
  return southCentered
}

function toOpenMeteoTiltDeg(roofPitchDeg: number): number {
  if (!Number.isFinite(roofPitchDeg)) {
    return 0
  }
  return Math.max(0, Math.min(90, roofPitchDeg))
}

export function parseOpenMeteoTiltedIrradiancePayload(payload: unknown): OpenMeteoTiltedIrradianceSample[] {
  const response = payload as OpenMeteoForecastResponse
  const time = Array.isArray(response?.hourly?.time) ? response.hourly.time : []
  const irradiance = Array.isArray(response?.hourly?.global_tilted_irradiance)
    ? response.hourly.global_tilted_irradiance
    : []

  const pointCount = Math.min(time.length, irradiance.length)
  const samples: OpenMeteoTiltedIrradianceSample[] = []

  for (let idx = 0; idx < pointCount; idx += 1) {
    const timestampIso = typeof time[idx] === 'string' ? time[idx] : null
    const irradianceWm2 = Number(irradiance[idx])
    if (!timestampIso || !Number.isFinite(irradianceWm2)) {
      continue
    }
    samples.push({ timestampIso, irradianceWm2 })
  }

  return samples
}

export async function fetchOpenMeteoTiltedIrradiance({
  latDeg,
  lonDeg,
  roofPitchDeg,
  roofAzimuthDeg,
  timeZone,
  dateIso,
  signal,
  fetchImpl = fetch,
}: FetchOpenMeteoTiltedIrradianceArgs): Promise<OpenMeteoTiltedIrradianceSample[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', latDeg.toFixed(6))
  url.searchParams.set('longitude', lonDeg.toFixed(6))
  url.searchParams.set('hourly', 'global_tilted_irradiance')
  url.searchParams.set('tilt', toOpenMeteoTiltDeg(roofPitchDeg).toFixed(2))
  url.searchParams.set('azimuth', toOpenMeteoAzimuthDeg(roofAzimuthDeg).toFixed(2))
  url.searchParams.set('timezone', timeZone)
  url.searchParams.set('start_date', dateIso)
  url.searchParams.set('end_date', dateIso)

  const response = await fetchImpl(url, { signal })
  if (!response.ok) {
    throw new Error(`Forecast API request failed with HTTP ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  return parseOpenMeteoTiltedIrradiancePayload(payload)
}

export function extractDateIso(datetimeIso: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(datetimeIso.trim())
  return match ? match[1] : null
}
