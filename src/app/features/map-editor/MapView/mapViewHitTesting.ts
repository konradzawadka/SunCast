import maplibregl from 'maplibre-gl'

export function getHitFeatures(
  map: maplibregl.Map,
  point: { x: number; y: number },
  tolerancePx: number,
  layers: string[],
): maplibregl.MapGeoJSONFeature[] {
  const hitBounds: [maplibregl.PointLike, maplibregl.PointLike] = [
    [point.x - tolerancePx, point.y - tolerancePx],
    [point.x + tolerancePx, point.y + tolerancePx],
  ]

  return map.queryRenderedFeatures(hitBounds, { layers })
}

function toInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

export function getVertexHit(hits: maplibregl.MapGeoJSONFeature[], layerId: string): number | null {
  const feature = hits.find((candidate) => candidate.layer.id === layerId)
  return toInteger(feature?.properties?.vertexIndex)
}

export function getEdgeHit(hits: maplibregl.MapGeoJSONFeature[], layerId: string): number | null {
  const feature = hits.find((candidate) => candidate.layer.id === layerId)
  return toInteger(feature?.properties?.edgeIndex)
}

export function getFootprintHit(hits: maplibregl.MapGeoJSONFeature[], layerId: string): string | null {
  const feature = hits.find((candidate) => candidate.layer.id === layerId)
  const footprintId = feature?.properties?.footprintId
  return typeof footprintId === 'string' && footprintId.length > 0 ? footprintId : null
}

// Purpose: Returns obstacle hit from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function getObstacleHit(hits: maplibregl.MapGeoJSONFeature[], layerId: string): string | null {
  const feature = hits.find((candidate) => candidate.layer.id === layerId)
  const obstacleId = feature?.properties?.obstacleId
  return typeof obstacleId === 'string' && obstacleId.length > 0 ? obstacleId : null
}
