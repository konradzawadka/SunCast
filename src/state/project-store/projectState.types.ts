import type {
  FaceConstraints,
  FootprintPolygon,
  ObstacleKind,
  ObstacleStateEntry,
  ProjectSunProjectionSettings,
  ShadingSettings,
  VertexHeightConstraint,
} from '../../types/geometry'

export interface FootprintStateEntry {
  footprint: FootprintPolygon
  constraints: FaceConstraints
  pitchAdjustmentPercent: number
}

export interface ImportedFootprintEntry {
  footprintId: string
  polygon: Array<[number, number]>
  vertexHeights: VertexHeightConstraint[]
}

export interface ProjectState {
  footprints: Record<string, FootprintStateEntry>
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  drawDraft: Array<[number, number]>
  isDrawing: boolean
  obstacles: Record<string, ObstacleStateEntry>
  activeObstacleId: string | null
  selectedObstacleIds: string[]
  obstacleDrawDraft: Array<[number, number]>
  isDrawingObstacle: boolean
  sunProjection: ProjectSunProjectionSettings
  shadingSettings: ShadingSettings
}

export type Action =
  | { type: 'START_DRAW' }
  | { type: 'CANCEL_DRAW' }
  | { type: 'ADD_DRAFT_POINT'; point: [number, number] }
  | { type: 'UNDO_DRAFT_POINT' }
  | { type: 'COMMIT_FOOTPRINT' }
  | { type: 'SET_ACTIVE_FOOTPRINT'; footprintId: string }
  | { type: 'SELECT_ONLY_FOOTPRINT'; footprintId: string }
  | { type: 'TOGGLE_FOOTPRINT_SELECTION'; footprintId: string }
  | { type: 'SELECT_ALL_FOOTPRINTS' }
  | { type: 'CLEAR_FOOTPRINT_SELECTION' }
  | { type: 'DELETE_FOOTPRINT'; footprintId: string }
  | { type: 'MOVE_VERTEX'; payload: { vertexIndex: number; point: [number, number] } }
  | { type: 'MOVE_EDGE'; payload: { edgeIndex: number; delta: [number, number] } }
  | { type: 'SET_VERTEX_HEIGHT'; payload: VertexHeightConstraint }
  | { type: 'SET_VERTEX_HEIGHTS'; payload: VertexHeightConstraint[] }
  | { type: 'SET_EDGE_HEIGHT'; payload: { edgeIndex: number; heightM: number } }
  | { type: 'SET_ACTIVE_FOOTPRINT_KWP'; kwp: number }
  | { type: 'SET_ACTIVE_PITCH_ADJUSTMENT_PERCENT'; pitchAdjustmentPercent: number }
  | { type: 'CLEAR_VERTEX_HEIGHT'; vertexIndex: number }
  | { type: 'CLEAR_EDGE_HEIGHT'; edgeIndex: number }
  | { type: 'SET_SUN_PROJECTION_ENABLED'; enabled: boolean }
  | { type: 'SET_SUN_PROJECTION_DATETIME'; datetimeIso: string | null }
  | { type: 'SET_SUN_PROJECTION_DAILY_DATE'; dailyDateIso: string | null }
  | { type: 'START_OBSTACLE_DRAW' }
  | { type: 'CANCEL_OBSTACLE_DRAW' }
  | { type: 'ADD_OBSTACLE_DRAFT_POINT'; point: [number, number] }
  | { type: 'UNDO_OBSTACLE_DRAFT_POINT' }
  | { type: 'COMMIT_OBSTACLE' }
  | { type: 'SET_ACTIVE_OBSTACLE'; obstacleId: string }
  | { type: 'SELECT_ONLY_OBSTACLE'; obstacleId: string }
  | { type: 'TOGGLE_OBSTACLE_SELECTION'; obstacleId: string }
  | { type: 'SELECT_ALL_OBSTACLES' }
  | { type: 'CLEAR_OBSTACLE_SELECTION' }
  | { type: 'DELETE_OBSTACLE'; obstacleId: string }
  | { type: 'SET_OBSTACLE_HEIGHT'; payload: { obstacleId: string; heightAboveGroundM: number } }
  | { type: 'SET_OBSTACLE_KIND'; payload: { obstacleId: string; kind: ObstacleKind } }
  | {
      type: 'MOVE_OBSTACLE_VERTEX'
      payload: { obstacleId: string; vertexIndex: number; point: [number, number] }
    }
  | { type: 'SET_SHADING_ENABLED'; enabled: boolean }
  | { type: 'SET_SHADING_GRID_RESOLUTION'; gridResolutionM: number }
  | { type: 'UPSERT_IMPORTED_FOOTPRINTS'; entries: ImportedFootprintEntry[] }
  | { type: 'LOAD'; payload: ProjectState }
