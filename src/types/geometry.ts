export type LngLat = [number, number]

export interface FootprintPolygon {
  id: string
  vertices: LngLat[]
}

export interface VertexHeightConstraint {
  vertexIndex: number
  heightM: number
}

export interface EdgeHeightConstraint {
  edgeIndex: number
  heightM: number
}

export interface FaceConstraints {
  vertexHeights: VertexHeightConstraint[]
  edgeHeights?: EdgeHeightConstraint[]
}

export interface RoofPlane {
  p: number
  q: number
  r: number
}

export type SolverErrorCode =
  | 'FOOTPRINT_INVALID'
  | 'CONSTRAINTS_INSUFFICIENT'
  | 'CONSTRAINTS_COLLINEAR'
  | 'CONSTRAINTS_OVERCONSTRAINED'
  | 'CONSTRAINTS_CONFLICTING'

export type SolverWarningCode =
  | 'CONSTRAINTS_OVERDETERMINED'
  | 'CONSTRAINTS_RESIDUAL_HIGH'
  | 'CONSTRAINT_INDEX_INVALID'

export interface SolverWarning {
  code: SolverWarningCode
  message: string
}

export interface SolvedRoofPlane {
  plane: RoofPlane
  vertexHeightsM: number[]
  usedLeastSquares: boolean
  rmsErrorM: number
  warnings: SolverWarning[]
}

export interface ProjectData {
  footprint: FootprintPolygon | null
  constraints: FaceConstraints
  solverConfigVersion?: string
}

export interface RoofMeshData {
  vertices: Array<{ lon: number; lat: number; z: number }>
  triangleIndices: number[]
}

export interface RoofMetrics {
  pitchDeg: number
  azimuthDeg: number
  minHeightM: number
  maxHeightM: number
  roofAreaM2: number
}
