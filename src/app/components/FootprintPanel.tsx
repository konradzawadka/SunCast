import type { FootprintPolygon } from '../../types/geometry'

interface FootprintPanelProps {
  footprints: FootprintPolygon[]
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  activeFootprintKwp: number | null
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onSetActiveFootprintKwp: (kwp: number) => void
  onDeleteActiveFootprint: () => void
}

export function FootprintPanel({
  footprints,
  activeFootprintId,
  selectedFootprintIds,
  activeFootprintKwp,
  onSelectFootprint,
  onSetActiveFootprintKwp,
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
                {footprint.id} ({footprint.kwp.toFixed(1)} kWp)
              </button>
            )
          })}
        </div>
      )}

      {activeFootprintId && activeFootprintKwp !== null ? (
        <label style={{ display: 'grid', gap: '0.3rem', marginTop: '0.75rem' }}>
          Active polygon kWp
          <input
            type="number"
            min={0}
            step="0.1"
            value={activeFootprintKwp}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) {
                onSetActiveFootprintKwp(Math.max(0, next))
              }
            }}
            data-testid="active-footprint-kwp-input"
          />
        </label>
      ) : null}

      <button type="button" disabled={!activeFootprintId} onClick={onDeleteActiveFootprint}>
        Delete Active Footprint
      </button>
    </section>
  )
}
