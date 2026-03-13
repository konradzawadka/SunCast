import { MapView } from '../features/map-editor/MapView/MapView'
import { SunDailyChartPanel } from '../features/sun-tools/SunDailyChartPanel'
import { SunOverlayColumn } from '../features/sun-tools/SunOverlayColumn'
import { SunProjectionStatus } from '../features/sun-tools/SunProjectionStatus'
import type { SunCastCanvasModel } from '../../application/presentation/presentationModel.types'

interface SunCastCanvasProps {
  model: SunCastCanvasModel
}

export function SunCastCanvas({ model }: SunCastCanvasProps) {
  return (
    <main className="sun-cast-canvas">
      <MapView model={model} onInitialized={model.onInitialized} />

      <SunOverlayColumn
        datetimeIso={model.sunDatetimeRaw}
        timeZone={model.sunDailyTimeZone}
        selectedRoofs={model.selectedRoofInputs}
        onDatetimeInputChange={model.onSunDatetimeInputChange}
        productionComputationEnabled={model.productionComputationEnabled}
        annualSunAccess={model.annualSunAccess}
        expanded={model.hasSolvedActiveRoof && !model.isDrawingRoof && !model.isDrawingObstacle}
      >
        {model.hasSolvedActiveRoof ? (
          <>
            <SunProjectionStatus
              enabled={model.sunProjectionEnabled}
              hasDatetime={model.hasValidSunDatetime}
              onToggleEnabled={model.onToggleSunProjectionEnabled}
              result={model.sunProjectionResult}
            />
            <SunDailyChartPanel
              dateIso={model.sunDailyDateRaw}
              timeZone={model.sunDailyTimeZone}
              selectedRoofs={model.selectedRoofInputs}
              computationEnabled={model.productionComputationEnabled}
            />
          </>
        ) : (
          <section className="panel-section">
            <h3>Sun Tools</h3>
            <p>Solve a roof plane first to enable projection and daily production chart.</p>
          </section>
        )}
      </SunOverlayColumn>
    </main>
  )
}
