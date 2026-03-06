import type { LngLat } from '../../types/geometry'

export interface LocalOrigin {
  lon0: number
  lat0: number
  cosLat0: number
}

export interface Point2 {
  x: number
  y: number
}

const EARTH_RADIUS_M = 6378137
const DEG_TO_RAD = Math.PI / 180

export function buildLocalOrigin(points: LngLat[]): LocalOrigin {
  if (points.length === 0) {
    throw new Error('Cannot build local origin from empty point set')
  }

  const sum = points.reduce(
    (acc, [lon, lat]) => {
      acc.lon += lon
      acc.lat += lat
      return acc
    },
    { lon: 0, lat: 0 },
  )

  const lon0 = sum.lon / points.length
  const lat0 = sum.lat / points.length

  return {
    lon0,
    lat0,
    cosLat0: Math.cos(lat0 * DEG_TO_RAD),
  }
}

export function lonLatToLocalMeters(origin: LocalOrigin, point: LngLat): Point2 {
  const dLon = (point[0] - origin.lon0) * DEG_TO_RAD
  const dLat = (point[1] - origin.lat0) * DEG_TO_RAD

  return {
    x: dLon * EARTH_RADIUS_M * origin.cosLat0,
    y: dLat * EARTH_RADIUS_M,
  }
}

export function projectPointsToLocalMeters(points: LngLat[]): { origin: LocalOrigin; points2d: Point2[] } {
  const origin = buildLocalOrigin(points)
  const points2d = points.map((point) => lonLatToLocalMeters(origin, point))
  return { origin, points2d }
}
