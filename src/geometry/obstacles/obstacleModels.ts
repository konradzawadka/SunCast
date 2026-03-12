import type { LngLat, ObstacleKind, ObstacleShape, ObstacleStateEntry } from '../../types/geometry'
import { buildLocalOrigin, localMetersToLonLat, lonLatToLocalMeters } from '../projection/localMeters'

const MIN_RADIUS_M = 0.2
const CYLINDER_POLYGON_SEGMENTS = 14
const DEFAULT_TREE_TRUNK_RATIO = 0.22

export type VisualObstacleModel =
  | {
      id: string
      kind: ObstacleKind
      shape: 'prism'
      polygon: LngLat[]
      heightAboveGroundM: number
    }
  | {
      id: string
      kind: ObstacleKind
      shape: 'cylinder'
      center: LngLat
      radiusM: number
      heightAboveGroundM: number
    }
  | {
      id: string
      kind: ObstacleKind
      shape: 'tree'
      center: LngLat
      crownRadiusM: number
      trunkRadiusM: number
      heightAboveGroundM: number
    }

export type ShadingObstacleVolume =
  | {
      id: string
      kind: ObstacleKind
      shape: 'prism'
      polygon: LngLat[]
      heightAboveGroundM: number
    }
  | {
      id: string
      kind: ObstacleKind
      shape: 'cylinder'
      center: LngLat
      radiusM: number
      heightAboveGroundM: number
    }

function clampHeight(heightAboveGroundM: number): number {
  return Number.isFinite(heightAboveGroundM) ? Math.max(0, heightAboveGroundM) : 0
}

function clampRadius(value: number): number {
  return Number.isFinite(value) ? Math.max(MIN_RADIUS_M, value) : MIN_RADIUS_M
}

function centroid(points: LngLat[]): LngLat {
  if (points.length === 0) {
    return [0, 0]
  }
  const sum = points.reduce(
    (acc, point) => {
      acc.lon += point[0]
      acc.lat += point[1]
      return acc
    },
    { lon: 0, lat: 0 },
  )
  return [sum.lon / points.length, sum.lat / points.length]
}

export function cylinderToPolygon(center: LngLat, radiusM: number, segments = CYLINDER_POLYGON_SEGMENTS): LngLat[] {
  const safeSegments = Math.max(8, Math.floor(segments))
  const safeRadiusM = clampRadius(radiusM)
  const origin = buildLocalOrigin([center])
  const centerLocal = lonLatToLocalMeters(origin, center)
  const polygon: LngLat[] = []

  for (let idx = 0; idx < safeSegments; idx += 1) {
    const theta = (idx / safeSegments) * Math.PI * 2
    polygon.push(
      localMetersToLonLat(origin, {
        x: centerLocal.x + Math.cos(theta) * safeRadiusM,
        y: centerLocal.y + Math.sin(theta) * safeRadiusM,
      }),
    )
  }
  return polygon
}

function polygonToCenterRadius(polygon: LngLat[]): { center: LngLat; radiusM: number } {
  const center = centroid(polygon)
  const origin = buildLocalOrigin([center, ...polygon])
  const centerLocal = lonLatToLocalMeters(origin, center)
  let radiusM = MIN_RADIUS_M

  for (const point of polygon) {
    const pointLocal = lonLatToLocalMeters(origin, point)
    const dx = pointLocal.x - centerLocal.x
    const dy = pointLocal.y - centerLocal.y
    radiusM = Math.max(radiusM, Math.hypot(dx, dy))
  }

  return { center, radiusM }
}

export function obstacleShapeToPolygon(shape: ObstacleShape): LngLat[] {
  if (shape.type === 'polygon-prism') {
    return shape.polygon
  }
  if (shape.type === 'cylinder') {
    return cylinderToPolygon(shape.center, shape.radiusM)
  }
  return cylinderToPolygon(shape.center, shape.crownRadiusM)
}

export function obstacleShapeVertexCount(shape: ObstacleShape): number {
  return shape.type === 'polygon-prism' ? shape.polygon.length : 0
}

export function createObstacleShapeForKind(kind: ObstacleKind, polygonHint: LngLat[]): ObstacleShape {
  if (kind === 'building' || kind === 'custom') {
    return { type: 'polygon-prism', polygon: polygonHint }
  }

  const { center, radiusM } = polygonToCenterRadius(polygonHint)
  if (kind === 'pole') {
    return { type: 'cylinder', center, radiusM }
  }
  return {
    type: 'tree',
    center,
    crownRadiusM: radiusM,
    trunkRadiusM: clampRadius(radiusM * DEFAULT_TREE_TRUNK_RATIO),
  }
}

export function withObstacleKind(entry: ObstacleStateEntry, nextKind: ObstacleKind): ObstacleStateEntry {
  const shapePolygon = obstacleShapeToPolygon(entry.shape)
  return {
    ...entry,
    kind: nextKind,
    shape: createObstacleShapeForKind(nextKind, shapePolygon),
  }
}

export function withMovedObstacleShapeVertex(entry: ObstacleStateEntry, vertexIndex: number, point: LngLat): ObstacleStateEntry {
  if (entry.shape.type !== 'polygon-prism') {
    return entry
  }

  const vertexCount = entry.shape.polygon.length
  if (vertexIndex < 0 || vertexIndex >= vertexCount) {
    return entry
  }

  const nextPolygon = [...entry.shape.polygon]
  nextPolygon[vertexIndex] = point
  return {
    ...entry,
    shape: {
      type: 'polygon-prism',
      polygon: nextPolygon,
    },
  }
}

export function toVisualObstacleModel(obstacle: ObstacleStateEntry): VisualObstacleModel {
  const heightAboveGroundM = clampHeight(obstacle.heightAboveGroundM)
  if (obstacle.shape.type === 'polygon-prism') {
    return {
      id: obstacle.id,
      kind: obstacle.kind,
      shape: 'prism',
      polygon: obstacle.shape.polygon,
      heightAboveGroundM,
    }
  }
  if (obstacle.shape.type === 'cylinder') {
    return {
      id: obstacle.id,
      kind: obstacle.kind,
      shape: 'cylinder',
      center: obstacle.shape.center,
      radiusM: clampRadius(obstacle.shape.radiusM),
      heightAboveGroundM,
    }
  }
  return {
    id: obstacle.id,
    kind: obstacle.kind,
    shape: 'tree',
    center: obstacle.shape.center,
    crownRadiusM: clampRadius(obstacle.shape.crownRadiusM),
    trunkRadiusM: clampRadius(obstacle.shape.trunkRadiusM),
    heightAboveGroundM,
  }
}

export function toShadingObstacleVolume(obstacle: ObstacleStateEntry): ShadingObstacleVolume {
  const heightAboveGroundM = clampHeight(obstacle.heightAboveGroundM)
  if (obstacle.shape.type === 'polygon-prism') {
    return {
      id: obstacle.id,
      kind: obstacle.kind,
      shape: 'prism',
      polygon: obstacle.shape.polygon,
      heightAboveGroundM,
    }
  }
  if (obstacle.shape.type === 'cylinder') {
    return {
      id: obstacle.id,
      kind: obstacle.kind,
      shape: 'cylinder',
      center: obstacle.shape.center,
      radiusM: clampRadius(obstacle.shape.radiusM),
      heightAboveGroundM,
    }
  }
  return {
    id: obstacle.id,
    kind: obstacle.kind,
    shape: 'cylinder',
    center: obstacle.shape.center,
    radiusM: clampRadius(obstacle.shape.crownRadiusM),
    heightAboveGroundM,
  }
}
