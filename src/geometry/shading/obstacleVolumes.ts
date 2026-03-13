import earcut from 'earcut'
import type { LocalOrigin } from '../projection/localMeters'
import { lonLatToLocalMeters } from '../projection/localMeters'
import type { ObstaclePrism, Point3, ShadingObstacleInput, Triangle3 } from './types'
import { bboxFromPoints } from './shadowProjection'
import { cylinderToPolygon } from '../obstacles/obstacleModels'

// Purpose: Builds prism triangles from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
export function createPrismTriangles(polygonLocal: Array<{ x: number; y: number }>, topZ: number): Triangle3[] {
  const triangles: Triangle3[] = []

  for (let i = 0; i < polygonLocal.length; i += 1) {
    const a = polygonLocal[i]
    const b = polygonLocal[(i + 1) % polygonLocal.length]

    const aBottom: Point3 = { x: a.x, y: a.y, z: 0 }
    const bBottom: Point3 = { x: b.x, y: b.y, z: 0 }
    const aTop: Point3 = { x: a.x, y: a.y, z: topZ }
    const bTop: Point3 = { x: b.x, y: b.y, z: topZ }

    triangles.push({ a: aBottom, b: bBottom, c: bTop })
    triangles.push({ a: aBottom, b: bTop, c: aTop })
  }

  const flatCoords = polygonLocal.flatMap((point) => [point.x, point.y])
  const topIndices = earcut(flatCoords)
  for (let i = 0; i < topIndices.length; i += 3) {
    const a = polygonLocal[topIndices[i]]
    const b = polygonLocal[topIndices[i + 1]]
    const c = polygonLocal[topIndices[i + 2]]
    triangles.push({
      a: { x: a.x, y: a.y, z: topZ },
      b: { x: b.x, y: b.y, z: topZ },
      c: { x: c.x, y: c.y, z: topZ },
    })
  }

  return triangles
}

// Purpose: Computes normalize obstacles to prisms deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
export function normalizeObstaclesToPrisms(origin: LocalOrigin, obstacles: ShadingObstacleInput[]): ObstaclePrism[] {
  const prisms: ObstaclePrism[] = []

  for (const obstacle of obstacles) {
    const heightAboveGroundM = Number.isFinite(obstacle.heightAboveGroundM)
      ? Math.max(0, obstacle.heightAboveGroundM)
      : 0

    const obstaclePolygon = obstacle.shape === 'prism' ? obstacle.polygon : cylinderToPolygon(obstacle.center, obstacle.radiusM)
    if (obstaclePolygon.length < 3) {
      continue
    }

    const polygonLocal = obstaclePolygon.map((point) => lonLatToLocalMeters(origin, point))

    prisms.push({
      id: obstacle.id,
      kind: obstacle.kind,
      heightAboveGroundM,
      polygonLocal,
      bbox: bboxFromPoints(polygonLocal),
      triangles: createPrismTriangles(polygonLocal, heightAboveGroundM),
    })
  }

  return prisms
}
