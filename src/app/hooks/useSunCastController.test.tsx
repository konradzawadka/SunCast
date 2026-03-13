// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectState } from '../../state/project-store/projectState.types'
import type { FaceConstraints } from '../../types/geometry'

const mockUseProjectStore = vi.fn()
const mockUseSolvedRoofEntries = vi.fn()
const mockUseRoofShading = vi.fn()
const mockUseAnnualRoofSimulation = vi.fn()
const mockClearSelectionState = vi.fn()
const mockSelectVertex = vi.fn()
const mockSelectEdge = vi.fn()

vi.mock('../../state/project-store', () => ({
  useProjectStore: () => mockUseProjectStore(),
}))
vi.mock('../../state/project-store/useProjectStore', () => ({
  useProjectStore: () => mockUseProjectStore(),
}))

vi.mock('../../app/analysis/useSolvedRoofEntries', () => ({
  useSolvedRoofEntries: (...args: unknown[]) => mockUseSolvedRoofEntries(...args),
}))

vi.mock('./useConstraintEditor', () => ({
  useConstraintEditor: () => ({
    interactionError: null,
    safeSelectedVertexIndex: null,
    safeSelectedEdgeIndex: null,
    applyVertexHeight: vi.fn(),
    applyEdgeHeight: vi.fn(),
    moveVertexIfValid: vi.fn(() => true),
    moveEdgeIfValid: vi.fn(() => true),
    applyHeightStep: vi.fn(),
    clearInteractionError: vi.fn(),
    setConstraintLimitError: vi.fn(),
    setMoveRejectedError: vi.fn(),
  }),
}))

vi.mock('./useSelectionState', () => ({
  useSelectionState: () => ({
    selectedVertexIndex: null,
    selectedEdgeIndex: null,
    clearSelectionState: mockClearSelectionState,
    selectVertex: mockSelectVertex,
    selectEdge: mockSelectEdge,
  }),
}))

vi.mock('../features/sun-tools/useSunProjectionPanel', () => ({
  useSunProjectionPanel: () => ({
    sunDatetimeRaw: '',
    sunDailyDateRaw: '2026-03-07',
    sunDailyTimeZone: 'Europe/Warsaw',
    sunDatetimeError: null,
    hasValidSunDatetime: true,
    sunProjectionResult: null,
    onSunDatetimeInputChange: vi.fn(),
  }),
}))

vi.mock('./useKeyboardShortcuts', () => ({ useKeyboardShortcuts: vi.fn() }))
vi.mock('../features/debug/useRoofDebugSimulation', () => ({ useRoofDebugSimulation: vi.fn() }))
vi.mock('./useRoofShading', () => ({
  useRoofShading: (...args: unknown[]) => mockUseRoofShading(...args),
}))
vi.mock('./useAnnualRoofSimulation', () => ({
  useAnnualRoofSimulation: (...args: unknown[]) => mockUseAnnualRoofSimulation(...args),
}))

import { useSunCastController } from './useSunCastController'

function renderController() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const latestRef: { current: ReturnType<typeof useSunCastController> | null } = { current: null }

  function HookProbe() {
    const latest = useSunCastController()
    const sharedRef = useRef(latestRef)

    useEffect(() => {
      sharedRef.current.current = latest
    }, [latest, sharedRef])

    return null
  }

  act(() => {
    root.render(<HookProbe />)
  })

  return {
    get: () => {
      if (!latestRef.current) {
        throw new Error('Hook did not render')
      }
      return latestRef.current
    },
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function makeState(): ProjectState {
  return {
    footprints: {
      a: {
        footprint: {
          id: 'a',
          vertices: [
            [10, 10],
            [20, 10],
            [20, 20],
          ],
          kwp: 4,
        },
        constraints: { vertexHeights: [] },
        pitchAdjustmentPercent: 10,
      },
      b: {
        footprint: {
          id: 'b',
          vertices: [
            [30, 30],
            [40, 30],
            [40, 40],
          ],
          kwp: 5,
        },
        constraints: { vertexHeights: [] },
        pitchAdjustmentPercent: 0,
      },
    },
    activeFootprintId: 'a',
    selectedFootprintIds: ['a', 'b'],
    drawDraft: [],
    isDrawing: false,
    obstacles: {},
    activeObstacleId: null,
    selectedObstacleIds: [],
    obstacleDrawDraft: [],
    isDrawingObstacle: false,
    sunProjection: {
      enabled: true,
      datetimeIso: '2026-03-07T10:00',
      dailyDateIso: '2026-03-07',
    },
    shadingSettings: {
      enabled: true,
      gridResolutionM: 0.5,
    },
  }
}

describe('useSunCastController', () => {
  beforeEach(() => {
    mockClearSelectionState.mockReset()
    mockSelectVertex.mockReset()
    mockSelectEdge.mockReset()
    mockUseRoofShading.mockReset()
    mockUseAnnualRoofSimulation.mockReset()
    mockUseRoofShading.mockReturnValue({
      heatmapFeatures: [],
      computeState: 'IDLE',
      computeMode: 'final',
      resultStatus: null,
      statusMessage: null,
      diagnostics: null,
      usedGridResolutionM: null,
    })
    mockUseAnnualRoofSimulation.mockReturnValue({
      state: 'IDLE',
      progress: { ratio: 0, sampledDays: 0, totalSampledDays: 0 },
      result: null,
      heatmapFeatures: [],
      error: null,
      runSimulation: vi.fn(async () => undefined),
      clearSimulation: vi.fn(),
    })
  })

  it('builds selected roof inputs only from solved selected footprints', () => {
    const state = makeState()

    mockUseProjectStore.mockReturnValue({
      state,
      activeFootprint: state.footprints.a.footprint,
      activeConstraints: { vertexHeights: [] } satisfies FaceConstraints,
      selectedFootprintIds: state.selectedFootprintIds,
      obstacles: [],
      activeObstacle: null,
      selectedObstacles: [],
      sunProjection: state.sunProjection,
      startDrawing: vi.fn(),
      cancelDrawing: vi.fn(),
      addDraftPoint: vi.fn(),
      undoDraftPoint: vi.fn(),
      commitFootprint: vi.fn(),
      startObstacleDrawing: vi.fn(),
      cancelObstacleDrawing: vi.fn(),
      addObstacleDraftPoint: vi.fn(),
      undoObstacleDraftPoint: vi.fn(),
      commitObstacle: vi.fn(),
      deleteFootprint: vi.fn(),
      deleteObstacle: vi.fn(),
      moveVertex: vi.fn(),
      moveEdge: vi.fn(),
      moveObstacleVertex: vi.fn(() => true),
      setVertexHeight: vi.fn(),
      setVertexHeights: vi.fn(),
      setEdgeHeight: vi.fn(),
      setObstacleHeight: vi.fn(() => true),
      setObstacleKind: vi.fn(() => true),
      clearVertexHeight: vi.fn(),
      clearEdgeHeight: vi.fn(),
      setSunProjectionEnabled: vi.fn(),
      setSunProjectionDatetimeIso: vi.fn(),
      setSunProjectionDailyDateIso: vi.fn(),
      setActiveFootprintKwp: vi.fn(),
      setActivePitchAdjustmentPercent: vi.fn(),
      selectOnlyFootprint: vi.fn(),
      toggleFootprintSelection: vi.fn(),
      selectAllFootprints: vi.fn(),
      clearFootprintSelection: vi.fn(),
      selectOnlyObstacle: vi.fn(),
      toggleObstacleSelection: vi.fn(),
      clearObstacleSelection: vi.fn(),
      upsertImportedFootprints: vi.fn(),
      startupHydrationError: null,
      startupDegradedMessages: [],
    })

    mockUseSolvedRoofEntries.mockReturnValue({
      entries: [
        {
          footprintId: 'a',
          solution: { plane: { normal: [0, 0, 1], offsetM: 2 }, vertexHeightsM: [1, 1, 1], warnings: [] },
          mesh: { positions: new Float32Array(), indices: new Uint32Array() },
          metrics: {
            pitchDeg: 21,
            azimuthDeg: 187,
            roofAreaM2: 10,
            minHeightM: 1,
            maxHeightM: 2,
          },
        },
      ],
      activeSolved: null,
      activeError: null,
    })

    const hook = renderController()
    expect(hook.get().canvasModel.selectedRoofInputs).toHaveLength(1)
    expect(hook.get().canvasModel.selectedRoofInputs[0].footprintId).toBe('a')
    expect(hook.get().canvasModel.selectedRoofInputs[0].kwp).toBe(4)
    expect(hook.get().canvasModel.selectedRoofInputs[0].roofPitchDeg).toBeCloseTo(23.1, 6)
    hook.unmount()
  })

  it('routes selection/edit actions through session boundary commands', () => {
    const state = makeState()
    const selectOnlyFootprint = vi.fn()
    const toggleFootprintSelection = vi.fn()

    mockUseProjectStore.mockReturnValue({
      state,
      activeFootprint: state.footprints.a.footprint,
      activeConstraints: { vertexHeights: [] } satisfies FaceConstraints,
      selectedFootprintIds: state.selectedFootprintIds,
      obstacles: [],
      activeObstacle: null,
      selectedObstacles: [],
      sunProjection: state.sunProjection,
      startDrawing: vi.fn(),
      cancelDrawing: vi.fn(),
      addDraftPoint: vi.fn(),
      undoDraftPoint: vi.fn(),
      commitFootprint: vi.fn(),
      startObstacleDrawing: vi.fn(),
      cancelObstacleDrawing: vi.fn(),
      addObstacleDraftPoint: vi.fn(),
      undoObstacleDraftPoint: vi.fn(),
      commitObstacle: vi.fn(),
      deleteFootprint: vi.fn(),
      deleteObstacle: vi.fn(),
      moveVertex: vi.fn(),
      moveEdge: vi.fn(),
      moveObstacleVertex: vi.fn(() => true),
      setVertexHeight: vi.fn(),
      setVertexHeights: vi.fn(),
      setEdgeHeight: vi.fn(),
      setObstacleHeight: vi.fn(() => true),
      setObstacleKind: vi.fn(() => true),
      clearVertexHeight: vi.fn(),
      clearEdgeHeight: vi.fn(),
      setSunProjectionEnabled: vi.fn(),
      setSunProjectionDatetimeIso: vi.fn(),
      setSunProjectionDailyDateIso: vi.fn(),
      setActiveFootprintKwp: vi.fn(),
      setActivePitchAdjustmentPercent: vi.fn(),
      selectOnlyFootprint,
      toggleFootprintSelection,
      selectAllFootprints: vi.fn(),
      clearFootprintSelection: vi.fn(),
      selectOnlyObstacle: vi.fn(),
      toggleObstacleSelection: vi.fn(),
      clearObstacleSelection: vi.fn(),
      upsertImportedFootprints: vi.fn(),
      startupHydrationError: null,
      startupDegradedMessages: [],
    })

    mockUseSolvedRoofEntries.mockReturnValue({
      entries: [],
      activeSolved: null,
      activeError: null,
    })

    const hook = renderController()
    act(() => {
      hook.get().canvasModel.onSelectFootprint('a', false)
      hook.get().canvasModel.onSelectFootprint('b', true)
    })

    expect(selectOnlyFootprint).toHaveBeenCalledWith('a')
    expect(toggleFootprintSelection).toHaveBeenCalledWith('b')
    expect(mockClearSelectionState).toHaveBeenCalledTimes(2)
    hook.unmount()
  })

  it('disables production computation while geometry drag is active', () => {
    const state = makeState()
    mockUseProjectStore.mockReturnValue({
      state,
      activeFootprint: state.footprints.a.footprint,
      activeConstraints: { vertexHeights: [] } satisfies FaceConstraints,
      selectedFootprintIds: state.selectedFootprintIds,
      obstacles: [],
      activeObstacle: null,
      selectedObstacles: [],
      sunProjection: state.sunProjection,
      startDrawing: vi.fn(),
      cancelDrawing: vi.fn(),
      addDraftPoint: vi.fn(),
      undoDraftPoint: vi.fn(),
      commitFootprint: vi.fn(),
      startObstacleDrawing: vi.fn(),
      cancelObstacleDrawing: vi.fn(),
      addObstacleDraftPoint: vi.fn(),
      undoObstacleDraftPoint: vi.fn(),
      commitObstacle: vi.fn(),
      deleteFootprint: vi.fn(),
      deleteObstacle: vi.fn(),
      moveVertex: vi.fn(),
      moveEdge: vi.fn(),
      moveObstacleVertex: vi.fn(() => true),
      setVertexHeight: vi.fn(),
      setVertexHeights: vi.fn(),
      setEdgeHeight: vi.fn(),
      setObstacleHeight: vi.fn(() => true),
      setObstacleKind: vi.fn(() => true),
      clearVertexHeight: vi.fn(),
      clearEdgeHeight: vi.fn(),
      setSunProjectionEnabled: vi.fn(),
      setSunProjectionDatetimeIso: vi.fn(),
      setSunProjectionDailyDateIso: vi.fn(),
      setActiveFootprintKwp: vi.fn(),
      setActivePitchAdjustmentPercent: vi.fn(),
      selectOnlyFootprint: vi.fn(),
      toggleFootprintSelection: vi.fn(),
      selectAllFootprints: vi.fn(),
      clearFootprintSelection: vi.fn(),
      selectOnlyObstacle: vi.fn(),
      toggleObstacleSelection: vi.fn(),
      clearObstacleSelection: vi.fn(),
      upsertImportedFootprints: vi.fn(),
      startupHydrationError: null,
      startupDegradedMessages: [],
    })

    mockUseSolvedRoofEntries.mockReturnValue({ entries: [], activeSolved: null, activeError: null })

    const hook = renderController()
    expect(hook.get().canvasModel.productionComputationEnabled).toBe(true)
    expect(mockUseRoofShading).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        interactionActive: false,
      }),
    )

    act(() => {
      hook.get().canvasModel.onGeometryDragStateChange(true)
    })

    expect(hook.get().canvasModel.productionComputationEnabled).toBe(false)
    expect(mockUseRoofShading).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: false,
        interactionActive: true,
      }),
    )

    act(() => {
      hook.get().canvasModel.onGeometryDragStateChange(false)
    })

    expect(mockUseRoofShading).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        interactionActive: false,
      }),
    )
    hook.unmount()
  })
})
