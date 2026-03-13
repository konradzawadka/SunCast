import earcut from 'earcut'
import type { FootprintPolygon, RoofMeshData } from '../../types/geometry'
import { projectPointsToLocalMeters } from '../projection/localMeters'

const EDGE_LENGTH_EPSILON_M = 0.005
const TRIANGLE_AREA_EPSILON_M2 = 1e-8

interface SanitizedVertex {
  lon: number
  lat: number
  z: number
}

interface Point2 {
  x: number
  y: number
}

function distance2d(a: Point2, b: Point2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

function signedArea2d(points: Point2[]): number {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    area += a.x * b.y - b.x * a.y
  }
  return area * 0.5
}

function triangleArea2d(a: Point2, b: Point2, c: Point2): number {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * 0.5
}

function filterDegenerateTriangles(points2d: Point2[], triangleIndices: number[]): number[] {
  const filtered: number[] = []
  for (let i = 0; i < triangleIndices.length; i += 3) {
    const ia = triangleIndices[i]
    const ib = triangleIndices[i + 1]
    const ic = triangleIndices[i + 2]
    if (ia === undefined || ib === undefined || ic === undefined) {
      continue
    }

    const a = points2d[ia]
    const b = points2d[ib]
    const c = points2d[ic]
    if (!a || !b || !c) {
      continue
    }

    if (triangleArea2d(a, b, c) < TRIANGLE_AREA_EPSILON_M2) {
      continue
    }
    filtered.push(ia, ib, ic)
  }
  return filtered
}

function sanitizeFootprintVertices(
  footprint: FootprintPolygon,
  vertexHeightsM: number[],
): { vertices: SanitizedVertex[]; points2d: Point2[] } {
  if (footprint.vertices.length !== vertexHeightsM.length) {
    throw new Error('Footprint vertices and roof vertex heights must have equal length')
  }

  const { points2d } = projectPointsToLocalMeters(footprint.vertices)
  const sanitized: Array<{ point: Point2; vertex: SanitizedVertex }> = []

  for (let i = 0; i < footprint.vertices.length; i += 1) {
    const point = points2d[i]
    const [lon, lat] = footprint.vertices[i]
    const vertex = { lon, lat, z: vertexHeightsM[i] }
    const last = sanitized.at(-1)

    if (last && distance2d(last.point, point) < EDGE_LENGTH_EPSILON_M) {
      continue
    }

    sanitized.push({ point, vertex })
  }

  if (sanitized.length > 1) {
    const first = sanitized[0]
    const last = sanitized[sanitized.length - 1]
    if (distance2d(first.point, last.point) < EDGE_LENGTH_EPSILON_M) {
      sanitized.pop()
    }
  }

  if (sanitized.length < 3) {
    throw new Error('Footprint must contain at least 3 non-degenerate vertices for triangulation')
  }

  for (let i = 0; i < sanitized.length; i += 1) {
    const a = sanitized[i].point
    const b = sanitized[(i + 1) % sanitized.length].point
    if (distance2d(a, b) < EDGE_LENGTH_EPSILON_M) {
      throw new Error('Footprint contains near-zero edge length and cannot be triangulated')
    }
  }

  const normalized = [...sanitized]
  const normalizedPoints = normalized.map((entry) => entry.point)
  if (signedArea2d(normalizedPoints) < 0) {
    normalized.reverse()
  }

  return {
    vertices: normalized.map((entry) => entry.vertex),
    points2d: normalized.map((entry) => entry.point),
  }
}

export function generateRoofMesh(footprint: FootprintPolygon, vertexHeightsM: number[]): RoofMeshData {
  const { vertices, points2d } = sanitizeFootprintVertices(footprint, vertexHeightsM)

  const flatCoords = points2d.flatMap((point) => [point.x, point.y])
  const indices = filterDegenerateTriangles(points2d, earcut(flatCoords))
  if (indices.length === 0 || indices.length % 3 !== 0) {
    console.warn(
      `[generateRoofMesh] Unexpected earcut result for footprint ${footprint.id}: vertexCount=${vertices.length}, indexCount=${indices.length}`,
    )
  }

  return {
    vertices,
    triangleIndices: indices,
  }
}
