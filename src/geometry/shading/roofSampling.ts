import { fitPlane } from '../solver/fitPlane'
import type { BBox2, LocalRoofSurface, RoofSamplePoint } from './types'
import { bboxFromPoints } from './shadowProjection'

const EDGE_EPS = 1e-8

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

export function sampleRoofGrid(roof: LocalRoofSurface, resolutionM: number): RoofSamplePoint[] {
  if (!Number.isFinite(resolutionM) || resolutionM <= 0) {
    throw new Error('Grid resolution must be a finite positive number')
  }

  const samples: RoofSamplePoint[] = []
  const half = resolutionM / 2
  const minX = roof.bbox.minX + half
  const maxX = roof.bbox.maxX - half
  const minY = roof.bbox.minY + half
  const maxY = roof.bbox.maxY - half

  if (minX > maxX || minY > maxY) {
    return samples
  }

  for (let y = minY; y <= maxY + 1e-6; y += resolutionM) {
    for (let x = minX; x <= maxX + 1e-6; x += resolutionM) {
      if (!pointInPolygon({ x, y }, roof.polygonLocal)) {
        continue
      }

      samples.push({
        roofId: roof.roofId,
        x,
        y,
        z: roof.plane.p * x + roof.plane.q * y + roof.plane.r,
        cellPolygonLocal: buildCellPolygon(x, y, resolutionM),
      })
    }
  }

  return samples
}

export function roofBbox(roof: LocalRoofSurface): BBox2 {
  return roof.bbox
}
