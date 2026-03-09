import type { FootprintPolygon } from '../../types/geometry'
import { HintTooltip } from './HintTooltip'

interface FootprintPanelProps {
  footprints: FootprintPolygon[]
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  activeFootprintKwp: number | null
  onShareProject: () => Promise<void>
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onSetActiveFootprintKwp: (kwp: number) => void
  onDeleteActiveFootprint: () => void
}

export function FootprintPanel({
  footprints,
  activeFootprintId,
  selectedFootprintIds,
  activeFootprintKwp,
  onShareProject,
  onSelectFootprint,
  onSetActiveFootprintKwp,
  onDeleteActiveFootprint,
}: FootprintPanelProps) {
  return (
    <section className="panel-section footprint-panel">
      <div className="panel-section-header">
        <h3 className="panel-heading-with-hint">
          Roof Polygons{' '}
          <HintTooltip hint="Select one polygon with click. Add/remove polygon from selection with Ctrl/Cmd + click.">
            ?
          </HintTooltip>
        </h3>
        <button
          type="button"
          onClick={() => {
            void onShareProject()
          }}
          disabled={footprints.length === 0}
          aria-label="Share project"
          title="Share project URL (clipboard or native share dialog)"
          data-testid="share-project-button"
        >
          Share
        </button>
      </div>
      <p className="panel-hint">Tip: Ctrl/Cmd+A selects all polygons (except when typing in an input).</p>
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
                title="Click to select. Ctrl/Cmd + click to multi-select."
              >
                {footprint.id} ({footprint.kwp.toFixed(1)} kWp)
              </button>
            )
          })}
        </div>
      )}

      {activeFootprintId && activeFootprintKwp !== null ? (
        <label className="footprint-kwp-input">
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
            title="Installed DC power for the active polygon in kWp."
            data-testid="active-footprint-kwp-input"
          />
        </label>
      ) : null}

      <div className="footprint-panel-actions">
        <button
          type="button"
          disabled={!activeFootprintId}
          onClick={onDeleteActiveFootprint}
          title="Delete only the active polygon."
        >
          Delete Active Footprint
        </button>
      </div>
    </section>
  )
}
