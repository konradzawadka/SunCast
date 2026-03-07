import type { RoofMeshData } from '../../../../types/geometry'

interface ScreenPoint {
  x: number
  y: number
}

interface ProjectionInputVertex {
  lon: number
  lat: number
  heightM: number
}

export interface RoofProjectionAdapter {
  projectToScreen: (vertex: ProjectionInputVertex) => ScreenPoint | null
  unprojectFromScreen: (point: ScreenPoint) => [number, number] | null
  zExaggeration?: number
}

export function buildProjectedRoofFeatures(
  _roofMeshes: RoofMeshData[],
  _adapter: RoofProjectionAdapter,
): GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Polygon>[] {
  void _roofMeshes
  void _adapter
  return []
}
