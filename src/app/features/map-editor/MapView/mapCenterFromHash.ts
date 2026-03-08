const MIN_LAT = -90
const MAX_LAT = 90
const MIN_LON = -180
const MAX_LON = 180

export type MapCenter = [number, number]

export function parseMapCenterFromHash(hash: string): MapCenter | null {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash
  if (!normalized) {
    return null
  }

  const params = new URLSearchParams(normalized)
  const latRaw = params.get('lat')
  const lonRaw = params.get('lon') ?? params.get('lng')

  if (!latRaw || !lonRaw) {
    return null
  }

  const lat = Number(latRaw)
  const lon = Number(lonRaw)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }
  if (lat < MIN_LAT || lat > MAX_LAT || lon < MIN_LON || lon > MAX_LON) {
    return null
  }

  return [lon, lat]
}

function formatCoord(value: number): string {
  return value.toFixed(6)
}

export function buildHashWithMapCenter(hash: string, center: MapCenter): string {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(normalized)
  const [lon, lat] = center
  params.set('lat', formatCoord(lat))
  params.set('lon', formatCoord(lon))
  return `#${params.toString()}`
}
