import { intersectRayPrism } from './rayCasting'
import type { ObstaclePrism, SunDirection } from './types'

interface ShadeAtPointInput {
  sample: {
    x: number
    y: number
    z: number
  }
  sunDirection: SunDirection
  obstacles: ObstaclePrism[]
  maxShadowDistanceM: number
}

// Purpose: Computes normalized distance limit deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
function normalizedDistanceLimit(maxShadowDistanceM: number, direction: SunDirection): number {
  const horizontalMagnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
  if (horizontalMagnitude <= 1e-8) {
    return Number.POSITIVE_INFINITY
  }

  return maxShadowDistanceM / horizontalMagnitude
}

// Purpose: Encapsulates obstacle can block sample behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function obstacleCanBlockSample(
  sample: { x: number; y: number; z: number },
  direction: SunDirection,
  obstacle: ObstaclePrism,
  maxShadowDistanceM: number,
): boolean {
  if (obstacle.heightAboveGroundM <= 0 || obstacle.heightAboveGroundM <= sample.z) {
    return false
  }

  const horizontalMagnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
  if (horizontalMagnitude <= 1e-8) {
    return true
  }

  const unitDirX = direction.x / horizontalMagnitude
  const unitDirY = direction.y / horizontalMagnitude

  const relativeMinX = obstacle.bbox.minX - sample.x
  const relativeMaxX = obstacle.bbox.maxX - sample.x
  const relativeMinY = obstacle.bbox.minY - sample.y
  const relativeMaxY = obstacle.bbox.maxY - sample.y

  const minProjectionX = unitDirX >= 0 ? relativeMinX * unitDirX : relativeMaxX * unitDirX
  const maxProjectionX = unitDirX >= 0 ? relativeMaxX * unitDirX : relativeMinX * unitDirX
  const minProjectionY = unitDirY >= 0 ? relativeMinY * unitDirY : relativeMaxY * unitDirY
  const maxProjectionY = unitDirY >= 0 ? relativeMaxY * unitDirY : relativeMinY * unitDirY

  const minProjection = minProjectionX + minProjectionY
  const maxProjection = maxProjectionX + maxProjectionY

  return maxProjection >= -1e-6 && minProjection <= maxShadowDistanceM + 1e-6
}

// Purpose: Checks whether point shaded and returns a boolean result.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function isPointShaded(input: ShadeAtPointInput): boolean {
  if (input.sunDirection.z <= 0) {
    return true
  }

  const rayDistanceLimit = normalizedDistanceLimit(input.maxShadowDistanceM, input.sunDirection)
  if (rayDistanceLimit <= 0) {
    return false
  }

  const rayOrigin = {
    x: input.sample.x,
    y: input.sample.y,
    z: input.sample.z + 1e-4,
  }

  for (const obstacle of input.obstacles) {
    if (!obstacleCanBlockSample(input.sample, input.sunDirection, obstacle, input.maxShadowDistanceM)) {
      continue
    }

    const hitDistance = intersectRayPrism(rayOrigin, input.sunDirection, obstacle, rayDistanceLimit)
    if (hitDistance !== null) {
      return true
    }
  }

  return false
}
