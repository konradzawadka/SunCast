import type {
  FaceConstraints,
  FootprintPolygon,
  ProjectSunProjectionSettings,
  VertexHeightConstraint,
} from '../../types/geometry'

export interface FootprintStateEntry {
  footprint: FootprintPolygon
  constraints: FaceConstraints
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
  sunProjection: ProjectSunProjectionSettings
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
  | { type: 'CLEAR_VERTEX_HEIGHT'; vertexIndex: number }
  | { type: 'CLEAR_EDGE_HEIGHT'; edgeIndex: number }
  | { type: 'SET_SUN_PROJECTION_ENABLED'; enabled: boolean }
  | { type: 'SET_SUN_PROJECTION_DATETIME'; datetimeIso: string | null }
  | { type: 'SET_SUN_PROJECTION_DAILY_DATE'; dailyDateIso: string | null }
  | { type: 'UPSERT_IMPORTED_FOOTPRINTS'; entries: ImportedFootprintEntry[] }
  | { type: 'LOAD'; payload: ProjectState }
