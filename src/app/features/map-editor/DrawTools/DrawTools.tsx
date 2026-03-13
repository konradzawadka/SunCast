import { HintTooltip } from '../../../components/HintTooltip'

export type DrawEditMode = 'roof' | 'obstacle'

interface DrawToolsProps {
  editMode: DrawEditMode
  isDrawingRoof: boolean
  isDrawingObstacle: boolean
  roofPointCount: number
  obstaclePointCount: number
  onSetEditMode: (mode: DrawEditMode) => void
  onStartRoofDrawing: () => void
  onUndoRoofDrawing: () => void
  onCancelRoofDrawing: () => void
  onCommitRoofDrawing: () => void
  onStartObstacleDrawing: () => void
  onUndoObstacleDrawing: () => void
  onCancelObstacleDrawing: () => void
  onCommitObstacleDrawing: () => void
}

// Purpose: Encapsulates draw mode buttons behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function DrawModeButtons({ editMode, onSetEditMode }: Pick<DrawToolsProps, 'editMode' | 'onSetEditMode'>) {
  return (
    <div className="draw-mode-toggle" role="group" aria-label="Drawing mode">
      <button
        type="button"
        className={`draw-mode-button${editMode === 'roof' ? ' draw-mode-button-active' : ''}`}
        onClick={() => onSetEditMode('roof')}
      >
        Roof Mode
      </button>
      <button
        type="button"
        className={`draw-mode-button${editMode === 'obstacle' ? ' draw-mode-button-active' : ''}`}
        onClick={() => onSetEditMode('obstacle')}
      >
        Obstacle Mode
      </button>
    </div>
  )
}

export function DrawTools({
  editMode,
  isDrawingRoof,
  isDrawingObstacle,
  roofPointCount,
  obstaclePointCount,
  onSetEditMode,
  onStartRoofDrawing,
  onUndoRoofDrawing,
  onCancelRoofDrawing,
  onCommitRoofDrawing,
  onStartObstacleDrawing,
  onUndoObstacleDrawing,
  onCancelObstacleDrawing,
  onCommitObstacleDrawing,
}: DrawToolsProps) {
  if (editMode === 'obstacle') {
    return (
      <section className="panel-section">
        <h3 className="panel-heading-with-hint">
          Obstacle Polygon{' '}
          <HintTooltip hint="Draw obstacle footprints for trees/buildings/poles. Set type and height in Obstacle panel.">
            ?
          </HintTooltip>
        </h3>
        <DrawModeButtons editMode={editMode} onSetEditMode={onSetEditMode} />
        {!isDrawingObstacle ? (
          <button
            type="button"
            onClick={onStartObstacleDrawing}
            title="Start obstacle polygon drawing mode."
            data-testid="draw-obstacle-button"
          >
            Draw Obstacle Polygon
          </button>
        ) : (
          <div className="draw-actions">
            <p>Click on map to add obstacle vertices ({obstaclePointCount})</p>
            <button
              type="button"
              onClick={onUndoObstacleDrawing}
              disabled={obstaclePointCount === 0}
              title="Remove the last obstacle draft vertex."
              data-testid="draw-obstacle-undo-button"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={onCommitObstacleDrawing}
              disabled={obstaclePointCount < 3}
              title="Commit obstacle polygon to project."
              data-testid="draw-obstacle-finish-button"
            >
              Finish Obstacle
            </button>
            <button
              type="button"
              onClick={onCancelObstacleDrawing}
              title="Cancel obstacle drawing (Escape)."
              data-testid="draw-obstacle-cancel-button"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="panel-section">
      <h3 className="panel-heading-with-hint">
        Roof Polygon{' '}
        <HintTooltip hint="Click map to add vertices. Finish requires at least 3 points. Escape cancels drawing.">
          ?
        </HintTooltip>
      </h3>
      <DrawModeButtons editMode={editMode} onSetEditMode={onSetEditMode} />
      {!isDrawingRoof ? (
        <button type="button" onClick={onStartRoofDrawing} title="Start polygon drawing mode." data-testid="draw-footprint-button">
          Draw Roof Polygon
        </button>
      ) : (
        <div className="draw-actions">
          <p>Click on map to add vertices ({roofPointCount})</p>
          <button
            type="button"
            onClick={onUndoRoofDrawing}
            disabled={roofPointCount === 0}
            title="Remove the last draft vertex."
            data-testid="draw-undo-button"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onCommitRoofDrawing}
            disabled={roofPointCount < 3}
            title="Commit polygon to project."
            data-testid="draw-finish-button"
          >
            Finish Polygon
          </button>
          <button type="button" onClick={onCancelRoofDrawing} title="Cancel drawing (Escape)." data-testid="draw-cancel-button">
            Cancel
          </button>
        </div>
      )}
    </section>
  )
}
