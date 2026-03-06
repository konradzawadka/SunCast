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
      <h3>Roof Polygon</h3>
      {!isDrawing ? (
        <button type="button" onClick={onStart} data-testid="draw-footprint-button">
          Draw Roof Polygon
        </button>
      ) : (
        <div className="draw-actions">
          <p>Click on map to add vertices ({pointCount})</p>
          <button type="button" onClick={onUndo} disabled={pointCount === 0} data-testid="draw-undo-button">
            Undo
          </button>
          <button type="button" onClick={onCommit} disabled={pointCount < 3} data-testid="draw-finish-button">
            Finish Polygon
          </button>
          <button type="button" onClick={onCancel} data-testid="draw-cancel-button">
            Cancel
          </button>
        </div>
      )}
    </section>
  )
}
