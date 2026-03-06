import type { FootprintPolygon } from '../../types/geometry'
import { projectPointsToLocalMeters } from '../projection/localMeters'

const COORD_EPS = 1e-12
const EDGE_LENGTH_EPSILON_M = 0.01

function segmentsIntersect(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number],
): boolean {
  const cross = (p: [number, number], q: [number, number], r: [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

  const onSegment = (p: [number, number], q: [number, number], r: [number, number]) =>
    Math.min(p[0], r[0]) <= q[0] &&
    q[0] <= Math.max(p[0], r[0]) &&
    Math.min(p[1], r[1]) <= q[1] &&
    q[1] <= Math.max(p[1], r[1])

  const d1 = cross(a1, a2, b1)
  const d2 = cross(a1, a2, b2)
  const d3 = cross(b1, b2, a1)
  const d4 = cross(b1, b2, a2)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  if (Math.abs(d1) < COORD_EPS && onSegment(a1, b1, a2)) {
    return true
  }
  if (Math.abs(d2) < COORD_EPS && onSegment(a1, b2, a2)) {
    return true
  }
  if (Math.abs(d3) < COORD_EPS && onSegment(b1, a1, b2)) {
    return true
  }
  if (Math.abs(d4) < COORD_EPS && onSegment(b1, a2, b2)) {
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
      errors.push('Roof polygon edges must be longer than 0.01 m')
      return errors
    }
  }

  for (let i = 0; i < vertices.length; i += 1) {
    const a1 = vertices[i]
    const a2 = vertices[(i + 1) % vertices.length]

    for (let j = i + 1; j < vertices.length; j += 1) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === vertices.length - 1)) {
        continue
      }

      const b1 = vertices[j]
      const b2 = vertices[(j + 1) % vertices.length]

      if (segmentsIntersect(a1, a2, b1, b2)) {
        errors.push('Roof polygon cannot self-intersect')
        return errors
      }
    }
  }

  return errors
}
