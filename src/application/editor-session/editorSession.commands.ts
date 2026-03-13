import type { ProjectCommands } from '../../state/project-store/projectState.commands'

export type EditorSessionCommands = Pick<
  ProjectCommands,
  | 'startDrawing'
  | 'cancelDrawing'
  | 'addDraftPoint'
  | 'undoDraftPoint'
  | 'startObstacleDrawing'
  | 'cancelObstacleDrawing'
  | 'addObstacleDraftPoint'
  | 'undoObstacleDraftPoint'
  | 'setActiveFootprint'
  | 'setActiveObstacle'
  | 'selectOnlyFootprint'
  | 'toggleFootprintSelection'
  | 'selectAllFootprints'
  | 'clearFootprintSelection'
  | 'selectOnlyObstacle'
  | 'toggleObstacleSelection'
  | 'selectAllObstacles'
  | 'clearObstacleSelection'
>
