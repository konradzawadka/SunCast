import { DrawTools } from '../components/DrawTools/DrawTools'
import { FootprintPanel } from '../components/FootprintPanel'
import { RoofEditor } from '../components/RoofEditor/RoofEditor'
import { StatusPanel } from '../components/StatusPanel'
import type { FaceConstraints, FootprintPolygon, SolverWarning } from '../../types/geometry'
import { DevTools, type DebugFootprintEntryData, type ImportedFootprintConfigEntry } from './DevTools'

interface SunCastSidebarProps {
  isDrawing: boolean
  drawDraftCount: number
  footprints: FootprintPolygon[]
  activeFootprintId: string | null
  selectedFootprintIds: string[]
  activeFootprint: FootprintPolygon | null
  activeConstraints: FaceConstraints
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  footprintEntries: DebugFootprintEntryData[]
  interactionError: string | null
  solverError: string | null
  footprintErrors: string[]
  warnings: SolverWarning[]
  pitchDeg: number | null
  azimuthDeg: number | null
  roofAreaM2: number | null
  minHeightM: number | null
  maxHeightM: number | null
  fitRmsErrorM: number | null
  onStartDrawing: () => void
  onUndoDrawing: () => void
  onCancelDrawing: () => void
  onCommitDrawing: () => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onSetActiveFootprintKwp: (kwp: number) => void
  onDeleteActiveFootprint: () => void
  onSetVertex: (vertexIndex: number, heightM: number) => boolean
  onSetEdge: (edgeIndex: number, heightM: number) => boolean
  onClearVertex: (vertexIndex: number) => void
  onClearEdge: (edgeIndex: number) => void
  onConstraintLimitExceeded: () => void
  onDevSelectVertex: (vertexIndex: number) => void
  onDevSelectEdge: (edgeIndex: number) => void
  onDevClearSelection: () => void
  onDevImportEntries: (entries: ImportedFootprintConfigEntry[]) => void
}

export function SunCastSidebar({
  isDrawing,
  drawDraftCount,
  footprints,
  activeFootprintId,
  selectedFootprintIds,
  activeFootprint,
  activeConstraints,
  selectedVertexIndex,
  selectedEdgeIndex,
  footprintEntries,
  interactionError,
  solverError,
  footprintErrors,
  warnings,
  pitchDeg,
  azimuthDeg,
  roofAreaM2,
  minHeightM,
  maxHeightM,
  fitRmsErrorM,
  onStartDrawing,
  onUndoDrawing,
  onCancelDrawing,
  onCommitDrawing,
  onSelectFootprint,
  onSetActiveFootprintKwp,
  onDeleteActiveFootprint,
  onSetVertex,
  onSetEdge,
  onClearVertex,
  onClearEdge,
  onConstraintLimitExceeded,
  onDevSelectVertex,
  onDevSelectEdge,
  onDevClearSelection,
  onDevImportEntries,
}: SunCastSidebarProps) {
  return (
    <aside className="sun-cast-sidebar">
      <h2>SunCast</h2>
      <p className="subtitle">Geometry-first roof modeling on satellite imagery</p>

      <DevTools
        footprintEntries={footprintEntries}
        onSelectVertex={onDevSelectVertex}
        onSelectEdge={onDevSelectEdge}
        onClearSelection={onDevClearSelection}
        onImportEntries={onDevImportEntries}
      />

      <DrawTools
        isDrawing={isDrawing}
        pointCount={drawDraftCount}
        onStart={onStartDrawing}
        onUndo={onUndoDrawing}
        onCancel={onCancelDrawing}
        onCommit={onCommitDrawing}
      />

      <FootprintPanel
        footprints={footprints}
        activeFootprintId={activeFootprintId}
        selectedFootprintIds={selectedFootprintIds}
        activeFootprintKwp={activeFootprint?.kwp ?? null}
        onSelectFootprint={onSelectFootprint}
        onSetActiveFootprintKwp={onSetActiveFootprintKwp}
        onDeleteActiveFootprint={onDeleteActiveFootprint}
      />

      <RoofEditor
        footprint={activeFootprint}
        vertexConstraints={activeConstraints.vertexHeights}
        selectedVertexIndex={selectedVertexIndex}
        selectedEdgeIndex={selectedEdgeIndex}
        onSetVertex={onSetVertex}
        onSetEdge={onSetEdge}
        onClearVertex={onClearVertex}
        onClearEdge={onClearEdge}
        onConstraintLimitExceeded={onConstraintLimitExceeded}
      />

      <StatusPanel
        footprintErrors={footprintErrors}
        interactionError={interactionError}
        solverError={solverError}
        warnings={warnings}
        pitchDeg={pitchDeg}
        azimuthDeg={azimuthDeg}
        roofAreaM2={roofAreaM2}
        minHeightM={minHeightM}
        maxHeightM={maxHeightM}
        fitRmsErrorM={fitRmsErrorM}
      />
    </aside>
  )
}
