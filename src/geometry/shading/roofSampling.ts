import { fitPlane } from '../solver/fitPlane'
import type { BBox2, LocalRoofSurface, RoofSamplePoint } from './types'
import { bboxFromPoints } from './shadowProjection'

const EDGE_EPS = 1e-8
const GRID_LOOP_EPS = 1e-6

interface RoofGridSamplingOptions {
  maxSampleCount?: number
  overflowStrategy?: 'auto-increase' | 'abort'
}

// Purpose: Encapsulates point in polygon behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const onHorizontalEdge =
      Math.abs(yi - point.y) < EDGE_EPS &&
      Math.abs(yj - point.y) < EDGE_EPS &&
      point.x >= Math.min(xi, xj) - EDGE_EPS &&
      point.x <= Math.max(xi, xj) + EDGE_EPS

    if (onHorizontalEdge) {
      return true
    }

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x <= ((xj - xi) * (point.y - yi)) / (yj - yi === 0 ? Number.EPSILON : yj - yi) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

// Purpose: Builds roof surface from local vertices from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
export function buildRoofSurfaceFromLocalVertices(
  roofId: string,
  polygonLocal: Array<{ x: number; y: number }>,
  vertexHeightsM: number[],
): LocalRoofSurface {
  if (polygonLocal.length < 3) {
    throw new Error(`Roof ${roofId} must contain at least 3 vertices`)
  }
  if (polygonLocal.length !== vertexHeightsM.length) {
    throw new Error(`Roof ${roofId} vertex count and height count mismatch`)
  }

  const fit = fitPlane(
    polygonLocal.map((point, index) => ({
      x: point.x,
      y: point.y,
      z: vertexHeightsM[index],
    })),
  )

  return {
    roofId,
    polygonLocal,
    plane: fit.plane,
    bbox: bboxFromPoints(polygonLocal),
  }
}

// Purpose: Builds cell polygon from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
function buildCellPolygon(x: number, y: number, resolutionM: number): Array<{ x: number; y: number }> {
  const half = resolutionM / 2
  return [
    { x: x - half, y: y - half },
    { x: x + half, y: y - half },
    { x: x + half, y: y + half },
    { x: x - half, y: y + half },
    { x: x - half, y: y - half },
  ]
}

// Purpose: Computes compute grid axis count deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
function computeGridAxisCount(minValue: number, maxValue: number, step: number): number {
  if (minValue > maxValue || step <= 0) {
    return 0
  }

  return Math.floor((maxValue - minValue + GRID_LOOP_EPS) / step) + 1
}

// Purpose: Computes normalized sample cap deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
function normalizedSampleCap(value: number | undefined): number | null {
  if (!Number.isFinite(value) || value === undefined) {
    return null
  }

  const floored = Math.floor(value)
  return floored > 0 ? floored : null
}

// Purpose: Computes sample roof grid deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
export function sampleRoofGrid(
  roof: LocalRoofSurface,
  resolutionM: number,
  options: RoofGridSamplingOptions = {},
): RoofSamplePoint[] {
  if (!Number.isFinite(resolutionM) || resolutionM <= 0) {
    throw new Error('Grid resolution must be a finite positive number')
  }

  const samples: RoofSamplePoint[] = []
  const sampleCap = normalizedSampleCap(options.maxSampleCount)
  const overflowStrategy = options.overflowStrategy ?? 'auto-increase'
  let effectiveResolutionM = resolutionM
  let half = effectiveResolutionM / 2
  const minXBase = roof.bbox.minX
  const maxXBase = roof.bbox.maxX
  const minYBase = roof.bbox.minY
  const maxYBase = roof.bbox.maxY
  let minX = minXBase + half
  let maxX = maxXBase - half
  let minY = minYBase + half
  let maxY = maxYBase - half

  if (minX > maxX || minY > maxY) {
    return samples
  }

  if (sampleCap !== null) {
    const estimatedCount = computeGridAxisCount(minX, maxX, effectiveResolutionM) * computeGridAxisCount(minY, maxY, effectiveResolutionM)
    if (estimatedCount > sampleCap) {
      if (overflowStrategy === 'abort') {
        return samples
      }

      const scale = Math.sqrt(estimatedCount / sampleCap)
      effectiveResolutionM = resolutionM * scale
      half = effectiveResolutionM / 2
      minX = minXBase + half
      maxX = maxXBase - half
      minY = minYBase + half
      maxY = maxYBase - half

      if (minX > maxX || minY > maxY) {
        return samples
      }
    }
  }

  for (let y = minY; y <= maxY + GRID_LOOP_EPS; y += effectiveResolutionM) {
    for (let x = minX; x <= maxX + GRID_LOOP_EPS; x += effectiveResolutionM) {
      if (!pointInPolygon({ x, y }, roof.polygonLocal)) {
        continue
      }

      samples.push({
        roofId: roof.roofId,
        x,
        y,
        z: roof.plane.p * x + roof.plane.q * y + roof.plane.r,
        cellPolygonLocal: buildCellPolygon(x, y, effectiveResolutionM),
      })

      if (sampleCap !== null && samples.length >= sampleCap) {
        return samples
      }
    }
  }

  return samples
}

// Purpose: Encapsulates roof bbox behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function roofBbox(roof: LocalRoofSurface): BBox2 {
  return roof.bbox
}
