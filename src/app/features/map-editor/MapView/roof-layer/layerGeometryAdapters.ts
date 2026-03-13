import earcut from 'earcut'
import type { ObstacleMeshData, RoofHeatmapFeature, RoofMeshData } from '../../../../../types/geometry'
import { buildWorldMeshGeometry, latToMercatorY, lonToMercatorX, type WorldMeshGeometry, type WorldPoint } from './meshWorldGeometry'

const BARYCENTRIC_TOLERANCE = 1e-6
const BARYCENTRIC_DEGENERATE_RELATIVE_EPSILON = 1e-8
const HEATMAP_RENDER_EPSILON_M = 0.025
const EARTH_CIRCUMFERENCE_M = 40075016.68557849
const DEG_TO_RAD = Math.PI / 180

interface WorldTriangle {
  a: WorldPoint
  b: WorldPoint
  c: WorldPoint
}

// Purpose: Encapsulates to world point behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toWorldPoint(geometry: WorldMeshGeometry, point: WorldPoint): WorldPoint {
  return {
    x: point.x + geometry.anchorX,
    y: point.y + geometry.anchorY,
    z: point.z,
  }
}

interface IndexedRoofGeometry {
  roofId: string | null
  geometry: WorldMeshGeometry
  triangles: WorldTriangle[]
  bbox: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}

// Purpose: Encapsulates meter in mercator coordinate units behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function meterInMercatorCoordinateUnits(latDeg: number): number {
  return 1 / (EARTH_CIRCUMFERENCE_M * Math.cos(latDeg * DEG_TO_RAD))
}

// Purpose: Encapsulates barycentric weights behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function barycentricWeights(
  x: number,
  y: number,
  a: WorldPoint,
  b: WorldPoint,
  c: WorldPoint,
): [number, number, number] | null {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
  const edgeCAx = a.x - c.x
  const edgeCAy = a.y - c.y
  const edgeCBx = b.x - c.x
  const edgeCBy = b.y - c.y
  const denominatorScale = edgeCAx * edgeCAx + edgeCAy * edgeCAy + edgeCBx * edgeCBx + edgeCBy * edgeCBy
  if (denominatorScale <= 0 || Math.abs(denominator) <= BARYCENTRIC_DEGENERATE_RELATIVE_EPSILON * denominatorScale) {
    return null
  }

  const weightA = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator
  const weightB = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator
  const weightC = 1 - weightA - weightB
  if (
    weightA < -BARYCENTRIC_TOLERANCE ||
    weightB < -BARYCENTRIC_TOLERANCE ||
    weightC < -BARYCENTRIC_TOLERANCE
  ) {
    return null
  }

  return [weightA, weightB, weightC]
}

// Purpose: Encapsulates to triangle list behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toTriangleList(geometry: WorldMeshGeometry): WorldTriangle[] {
  const triangles: WorldTriangle[] = []
  for (let i = 0; i < geometry.triangleIndices.length; i += 3) {
    const ia = geometry.triangleIndices[i]
    const ib = geometry.triangleIndices[i + 1]
    const ic = geometry.triangleIndices[i + 2]
    if (ia === undefined || ib === undefined || ic === undefined) {
      continue
    }
    const a = geometry.topVertices[ia]
    const b = geometry.topVertices[ib]
    const c = geometry.topVertices[ic]
    if (!a || !b || !c) {
      continue
    }
    triangles.push({
      a: toWorldPoint(geometry, a),
      b: toWorldPoint(geometry, b),
      c: toWorldPoint(geometry, c),
    })
  }
  return triangles
}

// Purpose: Encapsulates to bounding box behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toBoundingBox(geometry: WorldMeshGeometry): IndexedRoofGeometry['bbox'] {
  let minX = (geometry.topVertices[0]?.x ?? 0) + geometry.anchorX
  let minY = (geometry.topVertices[0]?.y ?? 0) + geometry.anchorY
  let maxX = (geometry.topVertices[0]?.x ?? 0) + geometry.anchorX
  let maxY = (geometry.topVertices[0]?.y ?? 0) + geometry.anchorY
  for (const vertex of geometry.topVertices) {
    const worldX = vertex.x + geometry.anchorX
    const worldY = vertex.y + geometry.anchorY
    minX = Math.min(minX, worldX)
    minY = Math.min(minY, worldY)
    maxX = Math.max(maxX, worldX)
    maxY = Math.max(maxY, worldY)
  }
  return { minX, minY, maxX, maxY }
}

// Purpose: Encapsulates to indexed roof geometry behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toIndexedRoofGeometry(roofs: RoofMeshData[]): IndexedRoofGeometry[] {
  const result: IndexedRoofGeometry[] = []
  for (const roof of roofs) {
    const geometry = buildWorldMeshGeometry(roof, 1)
    if (!geometry) {
      continue
    }
    const triangles = toTriangleList(geometry)
    if (triangles.length === 0) {
      continue
    }
    result.push({
      roofId: roof.id ?? null,
      geometry,
      triangles,
      bbox: toBoundingBox(geometry),
    })
  }
  return result
}

// Purpose: Encapsulates point in bbox behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function pointInBbox(x: number, y: number, bbox: IndexedRoofGeometry['bbox']): boolean {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
}

// Purpose: Computes interpolate z deterministically from the provided input values.
// Why: Improves readability by isolating a single responsibility behind a named function.
function interpolateZ(roof: IndexedRoofGeometry, x: number, y: number): number | null {
  for (const triangle of roof.triangles) {
    const weights = barycentricWeights(x, y, triangle.a, triangle.b, triangle.c)
    if (!weights) {
      continue
    }
    const [wa, wb, wc] = weights
    return wa * triangle.a.z + wb * triangle.b.z + wc * triangle.c.z
  }
  return null
}

// Purpose: Returns roof for feature from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
function findRoofForFeature(feature: RoofHeatmapFeature, roofs: IndexedRoofGeometry[]): IndexedRoofGeometry | null {
  const ring = feature.geometry.coordinates[0] ?? []
  if (ring.length === 0) {
    return null
  }
  const [lon, lat] = ring[0]
  const x = lonToMercatorX(lon)
  const y = latToMercatorY(lat)
  const byId = roofs.filter((roof) => roof.roofId === feature.properties.roofId)
  const candidates = byId.length > 0 ? byId : roofs

  for (const roof of candidates) {
    if (!pointInBbox(x, y, roof.bbox)) {
      continue
    }
    if (interpolateZ(roof, x, y) !== null) {
      return roof
    }
  }
  return null
}

// Purpose: Builds roof layer geometry from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
export function buildRoofLayerGeometry(meshes: RoofMeshData[], zExaggeration: number): WorldMeshGeometry[] {
  return meshes.flatMap((mesh) => {
    const geometry = buildWorldMeshGeometry(mesh, zExaggeration)
    return geometry ? [geometry] : []
  })
}

// Purpose: Builds obstacle layer geometry from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
export function buildObstacleLayerGeometry(meshes: ObstacleMeshData[], zExaggeration: number): WorldMeshGeometry[] {
  return meshes.flatMap((mesh) => {
    const geometry = buildWorldMeshGeometry(mesh, zExaggeration)
    return geometry ? [geometry] : []
  })
}

// Purpose: Builds heatmap layer geometry from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
export function buildHeatmapLayerGeometry(
  features: RoofHeatmapFeature[],
  roofs: RoofMeshData[],
): WorldMeshGeometry[] {
  if (features.length === 0 || roofs.length === 0) {
    return []
  }

  const indexedRoofs = toIndexedRoofGeometry(roofs)
  if (indexedRoofs.length === 0) {
    return []
  }

  const result: WorldMeshGeometry[] = []
  for (const feature of features) {
    const ring = feature.geometry.coordinates[0] ?? []
    const ringWithoutClosure =
      ring.length > 1 && ring[0]?.[0] === ring[ring.length - 1]?.[0] && ring[0]?.[1] === ring[ring.length - 1]?.[1]
        ? ring.slice(0, -1)
        : ring
    if (ringWithoutClosure.length < 3) {
      continue
    }

    const roof = findRoofForFeature(feature, indexedRoofs)
    if (!roof) {
      continue
    }

    const topVertices: WorldPoint[] = []
    const shape: number[] = []
    let valid = true

    for (const [lon, lat] of ringWithoutClosure) {
      const x = lonToMercatorX(lon)
      const y = latToMercatorY(lat)
      const z = interpolateZ(roof, x, y)
      if (z === null) {
        valid = false
        break
      }
      topVertices.push({
        x: x - roof.geometry.anchorX,
        y: y - roof.geometry.anchorY,
        z: z + HEATMAP_RENDER_EPSILON_M * meterInMercatorCoordinateUnits(lat),
      })
      shape.push(x, y)
    }

    if (!valid || topVertices.length < 3) {
      continue
    }

    const triangleIndices = earcut(shape)
    if (triangleIndices.length < 3) {
      continue
    }

    const baseVertices = topVertices.map((vertex) => ({ ...vertex }))
    result.push({
      triangleIndices,
      topVertices,
      baseVertices,
      anchorX: roof.geometry.anchorX,
      anchorY: roof.geometry.anchorY,
      unitsPerMeter: roof.geometry.unitsPerMeter,
    })
  }

  return result
}
