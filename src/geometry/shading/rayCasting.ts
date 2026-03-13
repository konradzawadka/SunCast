import type { ObstaclePrism, Point3, SunDirection, Triangle3 } from './types'

const EPS = 1e-8

// Purpose: Encapsulates subtract behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function subtract(a: Point3, b: Point3): Point3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }
}

// Purpose: Encapsulates cross behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function cross(a: Point3, b: Point3): Point3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

// Purpose: Encapsulates dot behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function dot(a: Point3, b: Point3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

// Purpose: Encapsulates intersect ray triangle behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
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

// Purpose: Encapsulates intersect ray prism behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
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
