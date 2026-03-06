import type { FootprintPolygon } from '../../types/geometry'

interface FootprintPanelProps {
  footprints: FootprintPolygon[]
  activeFootprintId: string | null
  onSelectFootprint: (footprintId: string) => void
  onDeleteActiveFootprint: () => void
}

export function FootprintPanel({
  footprints,
  activeFootprintId,
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
            return (
              <button
                key={footprint.id}
                type="button"
                className={`footprint-list-item${isActive ? ' footprint-list-item-active' : ''}`}
                onClick={() => onSelectFootprint(footprint.id)}
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
