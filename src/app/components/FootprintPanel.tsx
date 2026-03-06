import type { FootprintPolygon } from '../../types/geometry'

interface FootprintPanelProps {
  footprints: FootprintPolygon[]
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onDeleteActiveFootprint: () => void
}

export function FootprintPanel({
  footprints,
  activeFootprintId,
  selectedFootprintIds,
  onSelectFootprint,
  onDeleteActiveFootprint,
}: FootprintPanelProps) {
  return (
    <section className="panel-section">
      <h3>Roof Polygons</h3>
      {footprints.length === 0 ? (
        <p>No roof polygons yet.</p>
      ) : (
        <div className="footprint-list">
          {footprints.map((footprint) => {
            const isActive = footprint.id === activeFootprintId
            const isSelected = selectedFootprintIds.includes(footprint.id)
            return (
              <button
                key={footprint.id}
                type="button"
                className={`footprint-list-item${isSelected ? ' footprint-list-item-selected' : ''}${isActive ? ' footprint-list-item-active' : ''}`}
                onClick={(event) => onSelectFootprint(footprint.id, event.ctrlKey || event.metaKey)}
              >
                {footprint.id}
              </button>
            )
          })}
        </div>
      )}

      <button type="button" disabled={!activeFootprintId} onClick={onDeleteActiveFootprint}>
        Delete Active Footprint
      </button>
    </section>
  )
}
