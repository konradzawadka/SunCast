import type { BBox2, SunDirection } from './types'

const DEG_TO_RAD = Math.PI / 180

// Purpose: Encapsulates sun direction from azimuth elevation behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function sunDirectionFromAzimuthElevation(sunAzimuthDeg: number, sunElevationDeg: number): SunDirection {
  const azimuthRad = sunAzimuthDeg * DEG_TO_RAD
  const elevationRad = sunElevationDeg * DEG_TO_RAD

  return {
    x: Math.sin(azimuthRad) * Math.cos(elevationRad),
    y: Math.cos(azimuthRad) * Math.cos(elevationRad),
    z: Math.sin(elevationRad),
  }
}

// Purpose: Computes compute max shadow distance m deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
export function computeMaxShadowDistanceM(
  maxObstacleHeightM: number,
  sunElevationDeg: number,
  maxShadowDistanceClampM: number,
): number {
  if (!Number.isFinite(maxObstacleHeightM) || maxObstacleHeightM <= 0) {
    return 0
  }

  const elevationRad = sunElevationDeg * DEG_TO_RAD
  const tanElevation = Math.tan(elevationRad)
  if (!Number.isFinite(tanElevation) || tanElevation <= 1e-6) {
    return maxShadowDistanceClampM
  }

  return Math.min(maxObstacleHeightM / tanElevation, maxShadowDistanceClampM)
}

// Purpose: Encapsulates bbox from points behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function bboxFromPoints(points: Array<{ x: number; y: number }>): BBox2 {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const point of points) {
    if (point.x < minX) {
      minX = point.x
    }
    if (point.y < minY) {
      minY = point.y
    }
    if (point.x > maxX) {
      maxX = point.x
    }
    if (point.y > maxY) {
      maxY = point.y
    }
  }

  return { minX, minY, maxX, maxY }
}

// Purpose: Encapsulates expand bbox behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function expandBbox(bbox: BBox2, marginM: number): BBox2 {
  return {
    minX: bbox.minX - marginM,
    minY: bbox.minY - marginM,
    maxX: bbox.maxX + marginM,
    maxY: bbox.maxY + marginM,
  }
}

// Purpose: Encapsulates bboxes intersect behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function bboxesIntersect(a: BBox2, b: BBox2): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY)
}
