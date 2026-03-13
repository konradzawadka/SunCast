// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME,
  type GlobalErrorToastActionEventDetail,
} from '../../app/components/globalErrorToastActions'
import { useSunCastPresentationState } from './useSunCastPresentationState'

const mockUseProjectDocument = vi.fn()
const mockUseEditorSession = vi.fn()
const mockUseAnalysis = vi.fn()
const mockUseShareProject = vi.fn()
const mockReportAppSuccess = vi.fn()

vi.mock('../../domain/project-document/useProjectDocument', () => ({
  useProjectDocument: () => mockUseProjectDocument(),
}))

vi.mock('../editor-session/useEditorSession', () => ({
  useEditorSession: (...args: unknown[]) => mockUseEditorSession(...args),
}))

vi.mock('../analysis/useAnalysis', () => ({
  useAnalysis: (...args: unknown[]) => mockUseAnalysis(...args),
}))

vi.mock('../../app/hooks/useShareProject', () => ({
  useShareProject: (...args: unknown[]) => mockUseShareProject(...args),
}))

vi.mock('../../app/hooks/useMapNavigationTarget', () => ({
  useMapNavigationTarget: () => ({ mapNavigationTarget: null, onPlaceSearchSelect: vi.fn() }),
}))

vi.mock('../../app/hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: vi.fn() }))
vi.mock('../../app/features/debug/useRoofDebugSimulation', () => ({ useRoofDebugSimulation: vi.fn() }))
vi.mock('../../geometry/solver/validation', () => ({ validateFootprint: vi.fn(() => []) }))
vi.mock('../../geometry/mesh/generateObstacleMesh', () => ({
  generateObstacleMeshResult: vi.fn(() => ({ ok: true, value: { id: 'mesh' } })),
}))
vi.mock('../../shared/errors', () => ({
  reportAppError: vi.fn(),
  reportAppErrorCode: vi.fn(),
  reportAppSuccess: (...args: unknown[]) => mockReportAppSuccess(...args),
  startGlobalProcessingToast: vi.fn(),
  stopGlobalProcessingToast: vi.fn(),
}))

function renderHook() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const latestRef: { current: ReturnType<typeof useSunCastPresentationState> | null } = { current: null }

  function Probe() {
    const latest = useSunCastPresentationState()
    const sharedRef = useRef(latestRef)

    useEffect(() => {
      sharedRef.current.current = latest
    }, [latest, sharedRef])

    return null
  }

  act(() => {
    root.render(<Probe />)
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

describe('useSunCastPresentationState recovery flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/#c=shared')

    const store = {
      state: {
        footprints: {},
        activeFootprintId: null,
        selectedFootprintIds: [],
        drawDraft: [],
        isDrawing: false,
        obstacles: {},
        activeObstacleId: null,
        selectedObstacleIds: [],
        obstacleDrawDraft: [],
        isDrawingObstacle: false,
        sunProjection: { enabled: true, datetimeIso: null, dailyDateIso: null },
        shadingSettings: { enabled: true, gridResolutionM: 0.5 },
      },
      resetState: vi.fn(),
      selectAllFootprints: vi.fn(),
      cancelObstacleDrawing: vi.fn(),
      cancelDrawing: vi.fn(),
      upsertImportedFootprints: vi.fn(),
      moveVertex: vi.fn(),
      moveEdge: vi.fn(),
      setVertexHeight: vi.fn(),
      setVertexHeights: vi.fn(),
      setEdgeHeight: vi.fn(),
      setSunProjectionDatetimeIso: vi.fn(),
      setSunProjectionDailyDateIso: vi.fn(),
    }

    mockUseProjectDocument.mockReturnValue({
      store,
      projectDocument: {
        footprints: {},
        obstacles: {},
        sunProjection: store.state.sunProjection,
        shadingSettings: store.state.shadingSettings,
      },
      footprintEntries: [],
      footprints: [],
      activeFootprint: null,
      activeConstraints: { vertexHeights: [] },
      obstacles: [],
      activeObstacle: null,
      selectedObstacles: [],
      selectedFootprintIds: [],
      sunProjection: store.state.sunProjection,
      shadingSettings: store.state.shadingSettings,
    })

    mockUseEditorSession.mockReturnValue({
      safeSelectedVertexIndex: null,
      safeSelectedEdgeIndex: null,
      isGeometryDragActive: false,
      clearSelectionState: vi.fn(),
      mapBearingDeg: 0,
      mapPitchDeg: 0,
      interactionError: null,
    })

    mockUseAnalysis.mockReturnValue({
      solvedRoofs: { entries: [], activeSolved: null, activeError: null },
      selectedRoofInputs: [],
      shadingRoofs: [],
      sunProjection: {
        datetimeRaw: '',
        dailyDateRaw: '2026-03-01',
        dailyTimeZone: 'UTC',
        hasValidDatetime: true,
        datetimeError: null,
        result: null,
        onDatetimeInputChange: vi.fn(),
      },
      liveShading: {
        heatmapFeatures: [],
        computeState: 'IDLE',
        computeMode: 'final',
        resultStatus: null,
        statusMessage: null,
        diagnostics: null,
        usedGridResolutionM: null,
      },
      annualSimulation: {
        state: 'IDLE',
        progress: { ratio: 0, sampledDays: 0, totalSampledDays: 0 },
        result: null,
        heatmapFeatures: [],
        error: null,
        runSimulation: vi.fn(async () => undefined),
        clearSimulation: vi.fn(),
      },
      heatmap: {
        activeMode: 'live-shading',
        requestedMode: 'live-shading',
        liveFeatures: [],
        annualFeatures: [],
        mapFeatures: [],
        mapComputeState: 'IDLE',
        mapEnabled: false,
        annualVisible: false,
      },
      diagnostics: {
        solverError: null,
        warnings: [],
        shadingResultStatus: null,
        shadingStatusMessage: null,
        shadingDiagnostics: null,
      },
      productionComputationEnabled: true,
      setRequestedHeatmapMode: vi.fn(),
      computeProcessingActive: false,
      solvedMetrics: {
        basePitchDeg: null,
        azimuthDeg: null,
        roofAreaM2: null,
        minHeightM: null,
        maxHeightM: null,
        fitRmsErrorM: null,
      },
    })

    mockUseShareProject.mockReturnValue({ onShareProject: vi.fn(async () => undefined) })
  })

  it('handles reset-state action by resetting state and clearing shared hash payload', () => {
    const hook = renderHook()
    const state = hook.get()

    const resetAction = new CustomEvent<GlobalErrorToastActionEventDetail>(GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME, {
      detail: { action: 'reset-state' },
    })

    act(() => {
      window.dispatchEvent(resetAction)
    })

    expect(state.projectDocument.store.resetState).toHaveBeenCalledTimes(1)
    expect(state.editorSession.clearSelectionState).toHaveBeenCalledTimes(1)
    expect(state.analysis.setRequestedHeatmapMode).toHaveBeenCalledWith('live-shading')
    expect(window.location.hash).toBe('')
    expect(mockReportAppSuccess).toHaveBeenCalledWith('Project state reset to defaults.', {
      area: 'global-error-toast',
      source: 'reset-state',
    })

    hook.unmount()
  })
})
