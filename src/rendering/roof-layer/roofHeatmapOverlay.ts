import earcut from 'earcut'
import type { RoofMeshData, RoofShadeHeatmapFeature } from '../../types/geometry'
import { buildWorldMeshGeometry, latToMercatorY, lonToMercatorX, type WorldMeshGeometry, type WorldPoint } from './meshWorldGeometry'

const BARYCENTRIC_TOLERANCE = 1e-6
const BARYCENTRIC_DEGENERATE_RELATIVE_EPSILON = 1e-8
const HEATMAP_RENDER_EPSILON_M = 0.0025

interface WorldTriangle {
  a: WorldPoint
  b: WorldPoint
  c: WorldPoint
}

interface RoofWorldIndex {
  meshId: string | null
  world: WorldMeshGeometry
  triangles: WorldTriangle[]
  bbox: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}

export interface RoofHeatmapOverlayGeometry {
  anchorX: number
  anchorY: number
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
}

// Purpose: Encapsulates to world point behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toWorldPoint(world: WorldMeshGeometry, point: WorldPoint): WorldPoint {
  return {
    x: point.x + world.anchorX,
    y: point.y + world.anchorY,
    z: point.z,
  }
}

// Purpose: Computes clamp intensity deterministically from the provided input values.
// Why: Improves readability by isolating a single responsibility behind a named function.
function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

// Purpose: Encapsulates hsv to rgb01 behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function hsvToRgb01(hDeg: number, s: number, v: number): [number, number, number] {
  const hue = ((hDeg % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = v - c

  let rPrime = 0
  let gPrime = 0
  let bPrime = 0

  if (hue < 60) {
    rPrime = c
    gPrime = x
  } else if (hue < 120) {
    rPrime = x
    gPrime = c
  } else if (hue < 180) {
    gPrime = c
    bPrime = x
  } else if (hue < 240) {
    gPrime = x
    bPrime = c
  } else if (hue < 300) {
    rPrime = x
    bPrime = c
  } else {
    rPrime = c
    bPrime = x
  }

  return [rPrime + m, gPrime + m, bPrime + m]
}

// Purpose: Updates closing point in a controlled way.
// Why: Makes state transitions explicit and easier to reason about during edits.
function removeClosingPoint(ring: number[][]): number[][] {
  if (ring.length < 2) {
    return ring
  }

  const [firstLon, firstLat] = ring[0]
  const [lastLon, lastLat] = ring[ring.length - 1]
  if (firstLon === lastLon && firstLat === lastLat) {
    return ring.slice(0, -1)
  }
  return ring
}

// Purpose: Encapsulates ring center behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function ringCenter(ring: number[][]): [number, number] | null {
  if (ring.length === 0) {
    return null
  }

  let lonSum = 0
  let latSum = 0
  for (const [lon, lat] of ring) {
    lonSum += lon
    latSum += lat
  }

  return [lonSum / ring.length, latSum / ring.length]
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

// Purpose: Encapsulates triangle list behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function triangleList(world: WorldMeshGeometry): WorldTriangle[] {
  const triangles: WorldTriangle[] = []

  for (let i = 0; i < world.triangleIndices.length; i += 3) {
    const ia = world.triangleIndices[i]
    const ib = world.triangleIndices[i + 1]
    const ic = world.triangleIndices[i + 2]
    if (ia === undefined || ib === undefined || ic === undefined) {
      continue
    }

    const a = world.topVertices[ia]
    const b = world.topVertices[ib]
    const c = world.topVertices[ic]
    if (!a || !b || !c) {
      continue
    }

    triangles.push({
      a: toWorldPoint(world, a),
      b: toWorldPoint(world, b),
      c: toWorldPoint(world, c),
    })
  }

  return triangles
}

// Purpose: Encapsulates world bounding box behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function worldBoundingBox(world: WorldMeshGeometry): RoofWorldIndex['bbox'] {
  let minX = world.topVertices[0].x + world.anchorX
  let minY = world.topVertices[0].y + world.anchorY
  let maxX = world.topVertices[0].x + world.anchorX
  let maxY = world.topVertices[0].y + world.anchorY

  for (const vertex of world.topVertices) {
    const worldX = vertex.x + world.anchorX
    const worldY = vertex.y + world.anchorY
    minX = Math.min(minX, worldX)
    minY = Math.min(minY, worldY)
    maxX = Math.max(maxX, worldX)
    maxY = Math.max(maxY, worldY)
  }

  return { minX, minY, maxX, maxY }
}

// Purpose: Encapsulates point inside bbox behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function pointInsideBbox(x: number, y: number, bbox: RoofWorldIndex['bbox']): boolean {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
}

// Purpose: Computes interpolate roof z deterministically from the provided input values.
// Why: Improves readability by isolating a single responsibility behind a named function.
function interpolateRoofZ(roof: RoofWorldIndex, x: number, y: number): number | null {
  for (const triangle of roof.triangles) {
    const weights = barycentricWeights(x, y, triangle.a, triangle.b, triangle.c)
    if (!weights) {
      continue
    }

    const [weightA, weightB, weightC] = weights
    return weightA * triangle.a.z + weightB * triangle.b.z + weightC * triangle.c.z
  }

  return null
}

// Purpose: Returns roof index for feature from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
function resolveRoofIndexForFeature(
  featureRoofId: string,
  featureRing: number[][],
  roofs: RoofWorldIndex[],
): RoofWorldIndex | null {
  const center = ringCenter(featureRing)
  if (!center) {
    return null
  }

  const [centerLon, centerLat] = center
  const centerX = lonToMercatorX(centerLon)
  const centerY = latToMercatorY(centerLat)

  const roofsMatchingId = roofs.filter((roof) => roof.meshId === featureRoofId)
  const candidateRoofs = roofsMatchingId.length > 0 ? roofsMatchingId : roofs

  for (const roof of candidateRoofs) {
    if (!pointInsideBbox(centerX, centerY, roof.bbox)) {
      continue
    }

    if (interpolateRoofZ(roof, centerX, centerY) !== null) {
      return roof
    }
  }

  return null
}

// Purpose: Encapsulates heatmap color behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function heatmapColor(intensity: number): [number, number, number] {
  const t = clampIntensity(intensity)
  if (t <= 0.5) {
    const local = t / 0.5
    const hueDeg = 220 - 100 * local
    return hsvToRgb01(hueDeg, 0.94, 0.92)
  }

  const local = (t - 0.5) / 0.5
  const boosted = Math.pow(local, 0.8)
  const hueDeg = 120 * (1 - boosted)
  const value = 0.82 + 0.18 * boosted
  return hsvToRgb01(hueDeg, 0.98, value)
}

// Purpose: Encapsulates to roof world index behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function toRoofWorldIndex(meshes: RoofMeshData[], zExaggeration: number): RoofWorldIndex[] {
  const roofs: RoofWorldIndex[] = []

  for (const mesh of meshes) {
    const world = buildWorldMeshGeometry(mesh, zExaggeration)
    if (!world) {
      continue
    }

    const triangles = triangleList(world)
    if (triangles.length === 0) {
      continue
    }

    roofs.push({
      meshId: mesh.id ?? null,
      world,
      triangles,
      bbox: worldBoundingBox(world),
    })
  }

  return roofs
}

// Purpose: Builds roof heatmap overlay geometry from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
export function buildRoofHeatmapOverlayGeometry(
  roofMeshes: RoofMeshData[],
  heatmapFeatures: RoofShadeHeatmapFeature[],
  zExaggeration: number,
): RoofHeatmapOverlayGeometry | null {
  if (roofMeshes.length === 0 || heatmapFeatures.length === 0) {
    return null
  }

  const roofIndices = toRoofWorldIndex(roofMeshes, zExaggeration)
  if (roofIndices.length === 0) {
    return null
  }

  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  let anchorX = 0
  let anchorY = 0
  let hasAnchor = false

  for (const feature of heatmapFeatures) {
    const intensity = clampIntensity(feature.properties.intensity)
    if (intensity <= 0) {
      continue
    }

    const exteriorRing = removeClosingPoint(feature.geometry.coordinates[0] ?? [])
    if (exteriorRing.length < 3) {
      continue
    }

    const roof = resolveRoofIndexForFeature(feature.properties.roofId, exteriorRing, roofIndices)
    if (!roof) {
      continue
    }

    const projectedVertices: Array<{ x: number; y: number; z: number }> = []
    for (const [lon, lat] of exteriorRing) {
      const worldX = lonToMercatorX(lon)
      const worldY = latToMercatorY(lat)
      const worldZ = interpolateRoofZ(roof, worldX, worldY)
      if (worldZ === null) {
        projectedVertices.length = 0
        break
      }

      projectedVertices.push({
        x: worldX,
        y: worldY,
        z: worldZ,
      })
    }

    if (projectedVertices.length < 3) {
      continue
    }

    const flatCoords = projectedVertices.flatMap((vertex) => [vertex.x, vertex.y])
    const polygonIndices = earcut(flatCoords)
    if (polygonIndices.length < 3) {
      continue
    }

    const startIndex = positions.length / 3
    const [r, g, b] = heatmapColor(intensity)
    const zLift = HEATMAP_RENDER_EPSILON_M * roof.world.unitsPerMeter

    if (!hasAnchor && projectedVertices.length > 0) {
      anchorX = projectedVertices[0].x
      anchorY = projectedVertices[0].y
      hasAnchor = true
    }

    for (const vertex of projectedVertices) {
      positions.push(vertex.x - anchorX, vertex.y - anchorY, vertex.z + zLift)
      colors.push(r, g, b)
    }

    for (const polygonIndex of polygonIndices) {
      indices.push(startIndex + polygonIndex)
    }
  }

  if (indices.length === 0 || positions.length === 0) {
    return null
  }

  return {
    anchorX,
    anchorY,
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  }
}
