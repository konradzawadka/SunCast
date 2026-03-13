import type { RoofMeshData, RoofMetrics, SolvedRoofPlane } from '../../types/geometry'

export interface SolvedEntry {
  footprintId: string
  solution: SolvedRoofPlane
  mesh: RoofMeshData
  metrics: RoofMetrics
}
