import type { FootprintPolygon } from '../../types/geometry'
import { projectPointsToLocalMeters } from '../projection/localMeters'

const SEGMENT_COLLINEARITY_EPSILON_M2 = 1e-6
const EDGE_LENGTH_EPSILON_M = 0.005

function segmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
): boolean {
  const cross = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number },
  ) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)

  const onSegment = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number },
  ) => Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) && Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y)

  const d1 = cross(a1, a2, b1)
  const d2 = cross(a1, a2, b2)
  const d3 = cross(b1, b2, a1)
  const d4 = cross(b1, b2, a2)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  if (Math.abs(d1) < SEGMENT_COLLINEARITY_EPSILON_M2 && onSegment(a1, b1, a2)) {
    return true
  }
  if (Math.abs(d2) < SEGMENT_COLLINEARITY_EPSILON_M2 && onSegment(a1, b2, a2)) {
    return true
  }
  if (Math.abs(d3) < SEGMENT_COLLINEARITY_EPSILON_M2 && onSegment(b1, a1, b2)) {
    return true
  }
  if (Math.abs(d4) < SEGMENT_COLLINEARITY_EPSILON_M2 && onSegment(b1, a2, b2)) {
    return true
  }

  return false
}

export function validateFootprint(footprint: FootprintPolygon | null): string[] {
  if (!footprint) {
    return []
  }

  const errors: string[] = []
  const vertices = footprint.vertices

  if (vertices.length < 3) {
    errors.push('Roof polygon must have at least 3 vertices')
    return errors
  }

  const uniqueCount = new Set(vertices.map(([lon, lat]) => `${lon.toFixed(12)}:${lat.toFixed(12)}`)).size
  if (uniqueCount < 3) {
    errors.push('Roof polygon must have at least 3 distinct vertices')
    return errors
  }

  const { points2d } = projectPointsToLocalMeters(vertices)
  for (let i = 0; i < points2d.length; i += 1) {
    const current = points2d[i]
    const next = points2d[(i + 1) % points2d.length]
    const dx = next.x - current.x
    const dy = next.y - current.y
    const edgeLen = Math.sqrt(dx * dx + dy * dy)
    if (edgeLen < EDGE_LENGTH_EPSILON_M) {
      errors.push('Roof polygon edges must be longer than 0.005 m')
      return errors
    }
  }

  for (let i = 0; i < points2d.length; i += 1) {
    const a1 = points2d[i]
    const a2 = points2d[(i + 1) % points2d.length]

    for (let j = i + 1; j < points2d.length; j += 1) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === points2d.length - 1)) {
        continue
      }

      const b1 = points2d[j]
      const b2 = points2d[(j + 1) % points2d.length]

      if (segmentsIntersect(a1, a2, b1, b2)) {
        errors.push('Roof polygon cannot self-intersect')
        return errors
      }
    }
  }

  return errors
}
