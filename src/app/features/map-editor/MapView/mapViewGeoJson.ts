import maplibregl from 'maplibre-gl'
import { obstacleShapeToPolygon } from '../../../../geometry/obstacles/obstacleModels'
import { projectPointsToLocalMeters } from '../../../../geometry/projection/localMeters'
import type { FootprintPolygon, ObstacleStateEntry, VertexHeightConstraint } from '../../../../types/geometry'
import {
  ACTIVE_OBSTACLE_EDGES_SOURCE_ID,
  ACTIVE_OBSTACLE_VERTICES_SOURCE_ID,
  ACTIVE_EDGE_LABELS_SOURCE_ID,
  ACTIVE_EDGES_SOURCE_ID,
  ACTIVE_VERTICES_SOURCE_ID,
  DRAFT_SOURCE_ID,
  FOOTPRINTS_SOURCE_ID,
  OBSTACLES_SOURCE_ID,
} from './mapViewConstants'

export type MapFeature = GeoJSON.Feature<GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon>

export interface InteractiveMapState {
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  obstacles: ObstacleStateEntry[]
  activeObstacle: ObstacleStateEntry | null
  selectedObstacleIds: string[]
  vertexConstraints: VertexHeightConstraint[]
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
}

export function toRing(vertices: Array<[number, number]>): Array<[number, number]> {
  if (vertices.length < 3) {
    return vertices
  }

  return [...vertices, vertices[0]]
}

export function edgeLengthMeters(vertices: Array<[number, number]>, edgeIndex: number): number | null {
  if (edgeIndex < 0 || edgeIndex >= vertices.length) {
    return null
  }

  const start = vertices[edgeIndex]
  const end = vertices[(edgeIndex + 1) % vertices.length]
  const { points2d } = projectPointsToLocalMeters([start, end])
  const dx = points2d[1].x - points2d[0].x
  const dy = points2d[1].y - points2d[0].y
  return Math.sqrt(dx * dx + dy * dy)
}

export function toBounds(vertices: Array<[number, number]>): maplibregl.LngLatBoundsLike {
  let minLon = vertices[0][0]
  let minLat = vertices[0][1]
  let maxLon = vertices[0][0]
  let maxLat = vertices[0][1]

  for (const [lon, lat] of vertices) {
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }

  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ]
}

export function toFootprintFeatures(
  footprints: FootprintPolygon[],
  activeFootprintId: string | null,
  selectedFootprintIds: Set<string>,
): GeoJSON.Feature<GeoJSON.Polygon>[] {
  return footprints
    .filter((footprint) => footprint.vertices.length >= 3)
    .map((footprint) => ({
      type: 'Feature',
      properties: {
        footprintId: footprint.id,
        active: activeFootprintId === footprint.id ? 1 : 0,
        selected: selectedFootprintIds.has(footprint.id) ? 1 : 0,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [toRing(footprint.vertices)],
      },
    }))
}

// Purpose: Encapsulates to obstacle features behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function toObstacleFeatures(
  obstacles: ObstacleStateEntry[],
  activeObstacleId: string | null,
  selectedObstacleIds: Set<string>,
): GeoJSON.Feature<GeoJSON.Polygon>[] {
  return obstacles
    .map((obstacle) => ({ obstacle, polygon: obstacleShapeToPolygon(obstacle.shape) }))
    .filter(({ polygon }) => polygon.length >= 3)
    .map(({ obstacle, polygon }) => ({
      type: 'Feature',
      properties: {
        obstacleId: obstacle.id,
        kind: obstacle.kind,
        active: activeObstacleId === obstacle.id ? 1 : 0,
        selected: selectedObstacleIds.has(obstacle.id) ? 1 : 0,
        heightM: obstacle.heightAboveGroundM,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [toRing(polygon)],
      },
    }))
}

export function toEdgeSourceFeatures(
  vertices: Array<[number, number]>,
  selectedEdgeIndex: number | null,
): GeoJSON.Feature<GeoJSON.LineString>[] {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = []

  for (let i = 0; i < vertices.length; i += 1) {
    features.push({
      type: 'Feature',
      properties: { edgeIndex: i, selected: selectedEdgeIndex === i ? 1 : 0 },
      geometry: {
        type: 'LineString',
        coordinates: [vertices[i], vertices[(i + 1) % vertices.length]],
      },
    })
  }

  return features
}

export function toVertexSourceFeatures(
  vertices: Array<[number, number]>,
  vertexHeights: Map<number, number>,
  selectedVertexIndex: number | null,
  selectedEdgeIndex: number | null,
): GeoJSON.Feature<GeoJSON.Point>[] {
  return vertices.map((vertex, idx) => {
    const height = vertexHeights.get(idx)
    const selectedByEdge =
      selectedEdgeIndex !== null && (idx === selectedEdgeIndex || idx === (selectedEdgeIndex + 1) % vertices.length)

    return {
      type: 'Feature',
      properties: {
        vertexIndex: idx,
        selected: selectedVertexIndex === idx || selectedByEdge ? 1 : 0,
        heightLabel: height !== undefined ? `${height.toFixed(2)} m` : '',
      },
      geometry: {
        type: 'Point',
        coordinates: vertex,
      },
    }
  })
}

export function toEdgeHeightLabelFeatures(
  vertices: Array<[number, number]>,
  vertexHeights: Map<number, number>,
): GeoJSON.Feature<GeoJSON.Point>[] {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []

  for (let i = 0; i < vertices.length; i += 1) {
    const next = (i + 1) % vertices.length
    const hA = vertexHeights.get(i)
    const hB = vertexHeights.get(next)
    if (hA === undefined || hB === undefined || hA !== hB) {
      continue
    }

    const a = vertices[i]
    const b = vertices[next]
    features.push({
      type: 'Feature',
      properties: {
        edgeIndex: i,
        edgeHeightLabel: `${hA.toFixed(2)} m`,
      },
      geometry: {
        type: 'Point',
        coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      },
    })
  }

  return features
}

// Purpose: Encapsulates to obstacle vertex source features behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function toObstacleVertexSourceFeatures(
  obstacle: ObstacleStateEntry | null,
): GeoJSON.Feature<GeoJSON.Point>[] {
  if (!obstacle || obstacle.shape.type !== 'polygon-prism') {
    return []
  }

  return obstacle.shape.polygon.map((vertex, idx) => ({
    type: 'Feature',
    properties: {
      obstacleId: obstacle.id,
      vertexIndex: idx,
    },
    geometry: {
      type: 'Point',
      coordinates: vertex,
    },
  }))
}

// Purpose: Encapsulates to obstacle edge source features behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function toObstacleEdgeSourceFeatures(
  obstacle: ObstacleStateEntry | null,
): GeoJSON.Feature<GeoJSON.LineString>[] {
  if (!obstacle || obstacle.shape.type !== 'polygon-prism') {
    return []
  }

  return toEdgeSourceFeatures(obstacle.shape.polygon, null)
}

export function buildDraftFeatures(drawDraft: Array<[number, number]>, draftPreviewPoint: [number, number] | null): MapFeature[] {
  const features: MapFeature[] = []
  const draftLineCoords =
    draftPreviewPoint && drawDraft.length >= 1 ? [...drawDraft, draftPreviewPoint] : drawDraft
  const selectedDraftPointIndex =
    draftPreviewPoint === null
      ? -1
      : drawDraft.findIndex((point) => point[0] === draftPreviewPoint[0] && point[1] === draftPreviewPoint[1])

  if (draftLineCoords.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: draftLineCoords,
      },
    })
  }

  for (const [idx, point] of drawDraft.entries()) {
    features.push({
      type: 'Feature',
      properties: {
        selected: idx === selectedDraftPointIndex ? 1 : 0,
      },
      geometry: {
        type: 'Point',
        coordinates: point,
      },
    })
  }

  return features
}

export function syncInteractiveSources(map: maplibregl.Map, state: InteractiveMapState): void {
  const footprintsSource = map.getSource(FOOTPRINTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  const obstaclesSource = map.getSource(OBSTACLES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  const edgeSource = map.getSource(ACTIVE_EDGES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  const vertexSource = map.getSource(ACTIVE_VERTICES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  const edgeLabelSource = map.getSource(ACTIVE_EDGE_LABELS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  const obstacleVertexSource = map.getSource(ACTIVE_OBSTACLE_VERTICES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  const obstacleEdgeSource = map.getSource(ACTIVE_OBSTACLE_EDGES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined

  if (
    !footprintsSource ||
    !obstaclesSource ||
    !edgeSource ||
    !vertexSource ||
    !edgeLabelSource ||
    !obstacleVertexSource ||
    !obstacleEdgeSource
  ) {
    return
  }

  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

  footprintsSource.setData({
    type: 'FeatureCollection',
    features: toFootprintFeatures(state.footprints, state.activeFootprint?.id ?? null, new Set(state.selectedFootprintIds)),
  })
  obstaclesSource.setData({
    type: 'FeatureCollection',
    features: toObstacleFeatures(state.obstacles, state.activeObstacle?.id ?? null, new Set(state.selectedObstacleIds)),
  })
  obstacleVertexSource.setData({
    type: 'FeatureCollection',
    features: toObstacleVertexSourceFeatures(state.activeObstacle),
  })
  obstacleEdgeSource.setData({
    type: 'FeatureCollection',
    features: toObstacleEdgeSourceFeatures(state.activeObstacle),
  })

  if (!state.activeFootprint || state.activeFootprint.vertices.length < 3) {
    edgeSource.setData(empty)
    vertexSource.setData(empty)
    edgeLabelSource.setData(empty)
    return
  }

  const heightMap = new Map<number, number>(
    state.vertexConstraints.map((constraint) => [constraint.vertexIndex, constraint.heightM]),
  )

  edgeSource.setData({
    type: 'FeatureCollection',
    features: toEdgeSourceFeatures(state.activeFootprint.vertices, state.selectedEdgeIndex),
  })

  vertexSource.setData({
    type: 'FeatureCollection',
    features: toVertexSourceFeatures(
      state.activeFootprint.vertices,
      heightMap,
      state.selectedVertexIndex,
      state.selectedEdgeIndex,
    ),
  })

  edgeLabelSource.setData({
    type: 'FeatureCollection',
    features: toEdgeHeightLabelFeatures(state.activeFootprint.vertices, heightMap),
  })
}

export function syncDraftSource(
  map: maplibregl.Map,
  drawDraft: Array<[number, number]>,
  draftPreviewPoint: [number, number] | null,
): void {
  const source = map.getSource(DRAFT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (!source) {
    return
  }

  source.setData({
    type: 'FeatureCollection',
    features: buildDraftFeatures(drawDraft, draftPreviewPoint),
  })
}
