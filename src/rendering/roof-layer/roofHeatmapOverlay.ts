import earcut from 'earcut'
import type { RoofMeshData, RoofShadeHeatmapFeature } from '../../types/geometry'
import { buildWorldMeshGeometry, latToMercatorY, lonToMercatorX, type WorldMeshGeometry, type WorldPoint } from './meshWorldGeometry'

const BARYCENTRIC_TOLERANCE = 1e-6
const HEATMAP_RENDER_EPSILON_M = 0.08

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
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
}

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

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

function barycentricWeights(
  x: number,
  y: number,
  a: WorldPoint,
  b: WorldPoint,
  c: WorldPoint,
): [number, number, number] | null {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
  if (Math.abs(denominator) < Number.EPSILON) {
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

    triangles.push({ a, b, c })
  }

  return triangles
}

function worldBoundingBox(world: WorldMeshGeometry): RoofWorldIndex['bbox'] {
  let minX = world.topVertices[0].x
  let minY = world.topVertices[0].y
  let maxX = world.topVertices[0].x
  let maxY = world.topVertices[0].y

  for (const vertex of world.topVertices) {
    minX = Math.min(minX, vertex.x)
    minY = Math.min(minY, vertex.y)
    maxX = Math.max(maxX, vertex.x)
    maxY = Math.max(maxY, vertex.y)
  }

  return { minX, minY, maxX, maxY }
}

function pointInsideBbox(x: number, y: number, bbox: RoofWorldIndex['bbox']): boolean {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
}

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

function heatmapColor(intensity: number): [number, number, number] {
  const t = clampIntensity(intensity)
  const minR = 0.62
  const minG = 0.72
  const minB = 0.83
  const maxR = 0.12
  const maxG = 0.23
  const maxB = 0.38

  return [
    minR + (maxR - minR) * t,
    minG + (maxG - minG) * t,
    minB + (maxB - minB) * t,
  ]
}

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

    for (const vertex of projectedVertices) {
      positions.push(vertex.x, vertex.y, vertex.z + zLift)
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
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  }
}
