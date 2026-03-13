import type { ProjectState } from '../../state/project-store/projectState.types'

// Runtime-only editor state that should never be treated as canonical persisted data.
export interface EditorSessionState {
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  drawDraft: Array<[number, number]>
  isDrawing: boolean
  activeObstacleId: string | null
  selectedObstacleIds: string[]
  obstacleDrawDraft: Array<[number, number]>
  isDrawingObstacle: boolean
}

export const initialEditorSessionState: EditorSessionState = {
  activeFootprintId: null,
  selectedFootprintIds: [],
  drawDraft: [],
  isDrawing: false,
  activeObstacleId: null,
  selectedObstacleIds: [],
  obstacleDrawDraft: [],
  isDrawingObstacle: false,
}

export function toEditorSessionState(
  state: Pick<
    ProjectState,
    | 'activeFootprintId'
    | 'selectedFootprintIds'
    | 'drawDraft'
    | 'isDrawing'
    | 'activeObstacleId'
    | 'selectedObstacleIds'
    | 'obstacleDrawDraft'
    | 'isDrawingObstacle'
  >,
): EditorSessionState {
  return {
    activeFootprintId: state.activeFootprintId,
    selectedFootprintIds: state.selectedFootprintIds,
    drawDraft: state.drawDraft,
    isDrawing: state.isDrawing,
    activeObstacleId: state.activeObstacleId,
    selectedObstacleIds: state.selectedObstacleIds,
    obstacleDrawDraft: state.obstacleDrawDraft,
    isDrawingObstacle: state.isDrawingObstacle,
  }
}
