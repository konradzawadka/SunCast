import type { ObstaclePrism, Point3, SunDirection, Triangle3 } from './types'

const EPS = 1e-8

function subtract(a: Point3, b: Point3): Point3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }
}

function cross(a: Point3, b: Point3): Point3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function dot(a: Point3, b: Point3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function intersectRayTriangle(origin: Point3, direction: SunDirection, triangle: Triangle3): number | null {
  const edge1 = subtract(triangle.b, triangle.a)
  const edge2 = subtract(triangle.c, triangle.a)
  const pVec = cross(direction, edge2)
  const det = dot(edge1, pVec)

  if (Math.abs(det) < EPS) {
    return null
  }

  const invDet = 1 / det
  const tVec = subtract(origin, triangle.a)
  const u = dot(tVec, pVec) * invDet
  if (u < -EPS || u > 1 + EPS) {
    return null
  }

  const qVec = cross(tVec, edge1)
  const v = dot(direction, qVec) * invDet
  if (v < -EPS || u + v > 1 + EPS) {
    return null
  }

  const t = dot(edge2, qVec) * invDet
  if (t <= EPS) {
    return null
  }

  return t
}

export function intersectRayPrism(
  origin: Point3,
  direction: SunDirection,
  prism: ObstaclePrism,
  maxDistanceM: number,
): number | null {
  let nearestHit: number | null = null

  for (const triangle of prism.triangles) {
    const t = intersectRayTriangle(origin, direction, triangle)
    if (t === null || t > maxDistanceM) {
      continue
    }

    if (nearestHit === null || t < nearestHit) {
      nearestHit = t
    }
  }

  return nearestHit
}
