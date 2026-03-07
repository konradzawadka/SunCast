// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectState } from '../../state/project-store/projectState.types'
import type { FaceConstraints } from '../../types/geometry'

const mockUseProjectStore = vi.fn()
const mockUseSolvedRoofEntries = vi.fn()

vi.mock('../../state/project-store', () => ({
  useProjectStore: () => mockUseProjectStore(),
}))

vi.mock('./useSolvedRoofEntries', () => ({
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
    clearSelectionState: vi.fn(),
    selectVertex: vi.fn(),
    selectEdge: vi.fn(),
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

import { useSunCastController } from './useSunCastController'

function renderController() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let latest: ReturnType<typeof useSunCastController> | null = null

  function HookProbe() {
    latest = useSunCastController()
    return null
  }

  act(() => {
    root.render(<HookProbe />)
  })

  return {
    get: () => {
      if (!latest) {
        throw new Error('Hook did not render')
      }
      return latest
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
      },
    },
    activeFootprintId: 'a',
    selectedFootprintIds: ['a', 'b'],
    drawDraft: [],
    isDrawing: false,
    sunProjection: {
      enabled: true,
      datetimeIso: '2026-03-07T10:00',
      dailyDateIso: '2026-03-07',
    },
  }
}

describe('useSunCastController', () => {
  it('builds selected roof inputs only from solved selected footprints', () => {
    const state = makeState()

    mockUseProjectStore.mockReturnValue({
      state,
      activeFootprint: state.footprints.a.footprint,
      activeConstraints: { vertexHeights: [] } satisfies FaceConstraints,
      selectedFootprintIds: state.selectedFootprintIds,
      sunProjection: state.sunProjection,
      startDrawing: vi.fn(),
      cancelDrawing: vi.fn(),
      addDraftPoint: vi.fn(),
      undoDraftPoint: vi.fn(),
      commitFootprint: vi.fn(),
      deleteFootprint: vi.fn(),
      moveVertex: vi.fn(),
      moveEdge: vi.fn(),
      setVertexHeight: vi.fn(),
      setVertexHeights: vi.fn(),
      setEdgeHeight: vi.fn(),
      clearVertexHeight: vi.fn(),
      clearEdgeHeight: vi.fn(),
      setSunProjectionEnabled: vi.fn(),
      setSunProjectionDatetimeIso: vi.fn(),
      setSunProjectionDailyDateIso: vi.fn(),
      setActiveFootprintKwp: vi.fn(),
      selectOnlyFootprint: vi.fn(),
      toggleFootprintSelection: vi.fn(),
      selectAllFootprints: vi.fn(),
      clearFootprintSelection: vi.fn(),
      upsertImportedFootprints: vi.fn(),
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
    hook.unmount()
  })

  it('disables production computation while geometry drag is active', () => {
    const state = makeState()
    mockUseProjectStore.mockReturnValue({
      state,
      activeFootprint: state.footprints.a.footprint,
      activeConstraints: { vertexHeights: [] } satisfies FaceConstraints,
      selectedFootprintIds: state.selectedFootprintIds,
      sunProjection: state.sunProjection,
      startDrawing: vi.fn(),
      cancelDrawing: vi.fn(),
      addDraftPoint: vi.fn(),
      undoDraftPoint: vi.fn(),
      commitFootprint: vi.fn(),
      deleteFootprint: vi.fn(),
      moveVertex: vi.fn(),
      moveEdge: vi.fn(),
      setVertexHeight: vi.fn(),
      setVertexHeights: vi.fn(),
      setEdgeHeight: vi.fn(),
      clearVertexHeight: vi.fn(),
      clearEdgeHeight: vi.fn(),
      setSunProjectionEnabled: vi.fn(),
      setSunProjectionDatetimeIso: vi.fn(),
      setSunProjectionDailyDateIso: vi.fn(),
      setActiveFootprintKwp: vi.fn(),
      selectOnlyFootprint: vi.fn(),
      toggleFootprintSelection: vi.fn(),
      selectAllFootprints: vi.fn(),
      clearFootprintSelection: vi.fn(),
      upsertImportedFootprints: vi.fn(),
    })

    mockUseSolvedRoofEntries.mockReturnValue({ entries: [], activeSolved: null, activeError: null })

    const hook = renderController()
    expect(hook.get().canvasModel.productionComputationEnabled).toBe(true)

    act(() => {
      hook.get().canvasModel.onGeometryDragStateChange(true)
    })

    expect(hook.get().canvasModel.productionComputationEnabled).toBe(false)
    hook.unmount()
  })
})
