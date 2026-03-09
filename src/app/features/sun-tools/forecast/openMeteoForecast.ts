import { captureException, recordEvent, recordMetric } from '../../../../shared/observability/observability'

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

interface ForecastCacheEntry {
  samples: OpenMeteoTiltedIrradianceSample[]
  fetchedAtMs: number
}

const FORECAST_CACHE_TTL_MS = 10 * 60 * 1000
const forecastCache = new Map<string, ForecastCacheEntry>()

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

function buildCacheKey(args: Omit<FetchOpenMeteoTiltedIrradianceArgs, 'signal' | 'fetchImpl'>): string {
  return [
    args.latDeg.toFixed(6),
    args.lonDeg.toFixed(6),
    args.roofPitchDeg.toFixed(2),
    args.roofAzimuthDeg.toFixed(2),
    args.timeZone,
    args.dateIso,
  ].join('|')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isRetriableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false
  }
  if (error instanceof Error && /HTTP\s(429|5\d{2})/.test(error.message)) {
    return true
  }
  return true
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
  const requestKey = buildCacheKey({
    latDeg,
    lonDeg,
    roofPitchDeg,
    roofAzimuthDeg,
    timeZone,
    dateIso,
  })
  const cached = forecastCache.get(requestKey)
  const now = Date.now()
  if (cached && now - cached.fetchedAtMs <= FORECAST_CACHE_TTL_MS) {
    recordEvent('forecast.cache_hit', { key: requestKey })
    return cached.samples
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', latDeg.toFixed(6))
  url.searchParams.set('longitude', lonDeg.toFixed(6))
  url.searchParams.set('hourly', 'global_tilted_irradiance')
  url.searchParams.set('tilt', toOpenMeteoTiltDeg(roofPitchDeg).toFixed(2))
  url.searchParams.set('azimuth', toOpenMeteoAzimuthDeg(roofAzimuthDeg).toFixed(2))
  url.searchParams.set('timezone', timeZone)
  url.searchParams.set('start_date', dateIso)
  url.searchParams.set('end_date', dateIso)

  let lastError: unknown = null
  const startedAt = performance.now()

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal })
      if (!response.ok) {
        throw new Error(`Forecast API request failed with HTTP ${response.status}`)
      }

      const payload = (await response.json()) as unknown
      const samples = parseOpenMeteoTiltedIrradiancePayload(payload)
      forecastCache.set(requestKey, { samples, fetchedAtMs: Date.now() })
      recordMetric('forecast.request.duration_ms', performance.now() - startedAt, { attempt })
      return samples
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }

      lastError = error
      if (attempt < 2 && isRetriableError(error)) {
        recordEvent('forecast.request_retry', { attempt, key: requestKey })
        await delay(200 * attempt)
        continue
      }
      break
    }
  }

  if (cached) {
    recordEvent('forecast.cache_stale_fallback', { key: requestKey })
    return cached.samples
  }

  captureException(lastError, { area: 'forecast-open-meteo', key: requestKey })
  throw (lastError ?? new Error('Forecast API request failed'))
}
