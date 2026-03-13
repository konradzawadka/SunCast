import type { ObstacleKind, ObstacleStateEntry } from '../../../types/geometry'

const OBSTACLE_KIND_OPTIONS: Array<{ value: ObstacleKind; label: string }> = [
  { value: 'building', label: 'Building' },
  { value: 'tree', label: 'Tree' },
  { value: 'pole', label: 'Pole' },
  { value: 'custom', label: 'Custom' },
]

interface ObstaclePanelProps {
  obstacles: ObstacleStateEntry[]
  activeObstacle: ObstacleStateEntry | null
  selectedObstacleIds: string[]
  onSelectObstacle: (obstacleId: string, multiSelect: boolean) => void
  onSetActiveObstacleKind: (kind: ObstacleKind) => void
  onSetActiveObstacleHeight: (heightM: number) => void
  onDeleteActiveObstacle: () => void
}

// Purpose: Encapsulates obstacle panel behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
export function ObstaclePanel({
  obstacles,
  activeObstacle,
  selectedObstacleIds,
  onSelectObstacle,
  onSetActiveObstacleKind,
  onSetActiveObstacleHeight,
  onDeleteActiveObstacle,
}: ObstaclePanelProps) {
  return (
    <section className="panel-section">
      <div className="panel-section-header">
        <h3>Obstacles</h3>
      </div>
      <p className="panel-hint">Selected: {selectedObstacleIds.length}</p>
      {obstacles.length === 0 ? (
        <p>No obstacles yet.</p>
      ) : (
        <div className="footprint-list">
          {obstacles.map((obstacle) => {
            const isActive = activeObstacle?.id === obstacle.id
            const isSelected = selectedObstacleIds.includes(obstacle.id)
            return (
              <button
                key={obstacle.id}
                type="button"
                className={`footprint-list-item${isSelected ? ' footprint-list-item-selected' : ''}${isActive ? ' footprint-list-item-active' : ''}`}
                onClick={(event) => onSelectObstacle(obstacle.id, event.ctrlKey || event.metaKey)}
                title="Click to select obstacle. Ctrl/Cmd + click to multi-select."
              >
                {obstacle.kind} ({obstacle.heightAboveGroundM.toFixed(1)} m)
              </button>
            )
          })}
        </div>
      )}

      {activeObstacle && (
        <div className="draw-actions">
          <label className="footprint-kwp-input">
            Obstacle type
            <select
              value={activeObstacle.kind}
              onChange={(event) => onSetActiveObstacleKind(event.target.value as ObstacleKind)}
            >
              {OBSTACLE_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="footprint-kwp-input">
            Height above ground (m)
            <input
              type="number"
              min={0}
              step="0.1"
              value={activeObstacle.heightAboveGroundM}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) {
                  onSetActiveObstacleHeight(Math.max(0, next))
                }
              }}
            />
          </label>

          <button type="button" onClick={onDeleteActiveObstacle}>
            Delete Active Obstacle
          </button>
        </div>
      )}
    </section>
  )
}
