import type { RoofShadeHeatmapFeature, RoofMeshData } from '../../../../../types/geometry'
import type { RoofHeatmapOverlayGeometry } from './roofHeatmapOverlay'

export interface RoofHeatmapOverlayWorkerRequest {
  requestId: number
  roofMeshes: RoofMeshData[]
  heatmapFeatures: RoofShadeHeatmapFeature[]
  zExaggeration: number
}

export interface RoofHeatmapOverlayWorkerResponse {
  requestId: number
  geometry: RoofHeatmapOverlayGeometry | null
  error?: string
}
