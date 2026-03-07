import maplibregl from 'maplibre-gl'
import { projectPointsToLocalMeters } from '../../../../geometry/projection/localMeters'
import type { FootprintPolygon, VertexHeightConstraint } from '../../../../types/geometry'
import {
  ACTIVE_EDGE_LABELS_SOURCE_ID,
  ACTIVE_EDGES_SOURCE_ID,
  ACTIVE_VERTICES_SOURCE_ID,
  DRAFT_SOURCE_ID,
  FOOTPRINTS_SOURCE_ID,
} from './mapViewConstants'

export type MapFeature = GeoJSON.Feature<GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon>

export interface InteractiveMapState {
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
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

export function buildDraftFeatures(drawDraft: Array<[number, number]>): MapFeature[] {
  const features: MapFeature[] = []

  if (drawDraft.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: drawDraft,
      },
    })
  }

  for (const point of drawDraft) {
    features.push({
      type: 'Feature',
      properties: {},
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
  const edgeSource = map.getSource(ACTIVE_EDGES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  const vertexSource = map.getSource(ACTIVE_VERTICES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  const edgeLabelSource = map.getSource(ACTIVE_EDGE_LABELS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined

  if (!footprintsSource || !edgeSource || !vertexSource || !edgeLabelSource) {
    return
  }

  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

  footprintsSource.setData({
    type: 'FeatureCollection',
    features: toFootprintFeatures(state.footprints, state.activeFootprint?.id ?? null, new Set(state.selectedFootprintIds)),
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

export function syncDraftSource(map: maplibregl.Map, drawDraft: Array<[number, number]>): void {
  const source = map.getSource(DRAFT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (!source) {
    return
  }

  source.setData({
    type: 'FeatureCollection',
    features: buildDraftFeatures(drawDraft),
  })
}
