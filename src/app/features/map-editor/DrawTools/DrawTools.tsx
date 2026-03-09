import { HintTooltip } from '../../../components/HintTooltip'

interface DrawToolsProps {
  isDrawing: boolean
  pointCount: number
  onStart: () => void
  onUndo: () => void
  onCancel: () => void
  onCommit: () => void
}

export function DrawTools({
  isDrawing,
  pointCount,
  onStart,
  onUndo,
  onCancel,
  onCommit,
}: DrawToolsProps) {
  return (
    <section className="panel-section">
      <h3 className="panel-heading-with-hint">
        Roof Polygon{' '}
        <HintTooltip hint="Click map to add vertices. Finish requires at least 3 points. Escape cancels drawing.">
          ?
        </HintTooltip>
      </h3>
      {!isDrawing ? (
        <button type="button" onClick={onStart} title="Start polygon drawing mode." data-testid="draw-footprint-button">
          Draw Roof Polygon
        </button>
      ) : (
        <div className="draw-actions">
          <p>Click on map to add vertices ({pointCount})</p>
          <button
            type="button"
            onClick={onUndo}
            disabled={pointCount === 0}
            title="Remove the last draft vertex."
            data-testid="draw-undo-button"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onCommit}
            disabled={pointCount < 3}
            title="Commit polygon to project."
            data-testid="draw-finish-button"
          >
            Finish Polygon
          </button>
          <button type="button" onClick={onCancel} title="Cancel drawing (Escape)." data-testid="draw-cancel-button">
            Cancel
          </button>
        </div>
      )}
    </section>
  )
}
