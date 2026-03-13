// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FootprintStateEntry } from '../../state/project-store/projectState.types'
import type { ObstacleStateEntry, ProjectSunProjectionSettings, ShadingSettings } from '../../types/geometry'
import { useAnalysis } from './useAnalysis'

const mockDeriveSolvedRoofs = vi.fn()
const mockDeriveSelectedRoofInputs = vi.fn()
const mockUseDerivedShadingRoofs = vi.fn()
const mockUseLiveShading = vi.fn()
const mockUseAnnualSimulation = vi.fn()
const mockUseSunProjectionPanel = vi.fn()

vi.mock('./deriveSolvedRoofs', () => ({
  deriveSolvedRoofs: (...args: unknown[]) => mockDeriveSolvedRoofs(...args),
}))

vi.mock('./deriveSelectedRoofInputs', () => ({
  deriveSelectedRoofInputs: (...args: unknown[]) => mockDeriveSelectedRoofInputs(...args),
}))

vi.mock('./deriveShadingRoofs', () => ({
  useDerivedShadingRoofs: (...args: unknown[]) => mockUseDerivedShadingRoofs(...args),
}))

vi.mock('./useLiveShading', () => ({
  useLiveShading: (...args: unknown[]) => mockUseLiveShading(...args),
}))

vi.mock('./useAnnualSimulation', () => ({
  useAnnualSimulation: (...args: unknown[]) => mockUseAnnualSimulation(...args),
}))

vi.mock('../../app/features/sun-tools/useSunProjectionPanel', () => ({
  useSunProjectionPanel: (...args: unknown[]) => mockUseSunProjectionPanel(...args),
}))

type UseAnalysisArgs = Parameters<typeof useAnalysis>[0]

function renderHook(initialArgs: UseAnalysisArgs) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const latestRef: { current: ReturnType<typeof useAnalysis> | null } = { current: null }
  const argsRef: { current: UseAnalysisArgs } = { current: initialArgs }

  function Probe({ args }: { args: UseAnalysisArgs }) {
    const latest = useAnalysis(args)
    const sharedRef = useRef(latestRef)

    useEffect(() => {
      sharedRef.current.current = latest
    }, [latest, sharedRef])

    return null
  }

  const rerender = (nextArgs?: UseAnalysisArgs) => {
    if (nextArgs) {
      argsRef.current = nextArgs
    }
    act(() => {
      root.render(<Probe args={argsRef.current} />)
    })
  }

  rerender(initialArgs)

  return {
    get: () => {
      if (!latestRef.current) {
        throw new Error('Hook did not render')
      }
      return latestRef.current
    },
    rerender,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function makeArgs(overrides: Partial<UseAnalysisArgs> = {}): UseAnalysisArgs {
  const footprintEntriesById: Record<string, FootprintStateEntry> = {
    roofA: {
      footprint: {
        id: 'roofA',
        vertices: [
          [10, 10],
          [11, 10],
          [11, 11],
        ],
        kwp: 4,
      },
      constraints: { vertexHeights: [] },
      pitchAdjustmentPercent: 0,
    },
  }
  const sunProjection: ProjectSunProjectionSettings = {
    enabled: true,
    datetimeIso: '2026-03-08T11:00',
    dailyDateIso: '2026-03-08',
  }
  const shadingSettings: ShadingSettings = {
    enabled: true,
    gridResolutionM: 0.5,
  }

  return {
    footprintEntries: Object.values(footprintEntriesById),
    footprintEntriesById,
    activeFootprintId: 'roofA',
    selectedFootprintIds: ['roofA'],
    activeFootprintVertices: footprintEntriesById.roofA.footprint.vertices,
    obstacles: [] as ObstacleStateEntry[],
    sunProjection,
    shadingSettings,
    hasVertexOrEdgeSelection: false,
    isGeometryDragActive: false,
    setSunProjectionDatetimeIso: vi.fn(),
    setSunProjectionDailyDateIso: vi.fn(),
    ...overrides,
  }
}

describe('useAnalysis', () => {
  beforeEach(() => {
    mockDeriveSolvedRoofs.mockReset()
    mockDeriveSelectedRoofInputs.mockReset()
    mockUseDerivedShadingRoofs.mockReset()
    mockUseLiveShading.mockReset()
    mockUseAnnualSimulation.mockReset()
    mockUseSunProjectionPanel.mockReset()

    mockDeriveSolvedRoofs.mockReturnValue({
      entries: [],
      activeSolved: null,
      activeError: null,
    })
    mockDeriveSelectedRoofInputs.mockReturnValue([{ footprintId: 'roofA' }])
    mockUseDerivedShadingRoofs.mockReturnValue([
      {
        roofId: 'roofA',
        polygon: [
          [10, 10],
          [11, 10],
          [11, 11],
        ],
        vertexHeightsM: [1, 1, 1],
      },
    ])
    mockUseSunProjectionPanel.mockReturnValue({
      sunDatetimeRaw: '2026-03-08T11:00',
      sunDailyDateRaw: '2026-03-08',
      sunDailyTimeZone: 'UTC',
      sunDatetimeError: null,
      hasValidSunDatetime: true,
      sunProjectionResult: null,
      onSunDatetimeInputChange: vi.fn(),
    })
    mockUseLiveShading.mockReturnValue({
      heatmapFeatures: [{ type: 'Feature', properties: { roofId: 'roofA', shade: 1, intensity: 0.2 }, geometry: { type: 'Polygon', coordinates: [] } }],
      computeState: 'READY',
      computeMode: 'final',
      resultStatus: 'OK',
      statusMessage: null,
      diagnostics: null,
      usedGridResolutionM: 0.5,
    })
    mockUseAnnualSimulation.mockReturnValue({
      state: 'IDLE',
      progress: { ratio: 0, sampledDays: 0, totalSampledDays: 0 },
      result: null,
      heatmapFeatures: [],
      error: null,
      runSimulation: vi.fn(async () => undefined),
      clearSimulation: vi.fn(),
    })
  })

  it('wires shading execution from document/session guards', () => {
    const hook = renderHook(
      makeArgs({
        hasVertexOrEdgeSelection: true,
        isGeometryDragActive: true,
      }),
    )

    expect(mockUseLiveShading).toHaveBeenCalledTimes(1)
    expect(mockUseLiveShading.mock.calls[0][0]).toMatchObject({
      enabled: false,
      gridResolutionM: 0.5,
      datetimeIso: '2026-03-08T11:00',
    })
    expect(hook.get().productionComputationEnabled).toBe(false)
    hook.unmount()
  })

  it('exposes annual heatmap as map output when annual mode is requested and ready', () => {
    mockUseAnnualSimulation.mockReturnValue({
      state: 'READY',
      progress: { ratio: 1, sampledDays: 12, totalSampledDays: 12 },
      result: { roofs: [], heatmapCells: [], meta: { sampledDayCount: 1, simulatedHalfYear: false, stepMinutes: 30, sampleWindowDays: 1, dateStartIso: '2026-01-01', dateEndIso: '2026-01-01' } },
      heatmapFeatures: [{ type: 'Feature', properties: { roofId: 'roofA', shade: 0, intensity: 0.9 }, geometry: { type: 'Polygon', coordinates: [] } }],
      error: null,
      runSimulation: vi.fn(async () => undefined),
      clearSimulation: vi.fn(),
    })

    const hook = renderHook(makeArgs())
    act(() => {
      hook.get().setRequestedHeatmapMode('annual-sun-access')
    })

    expect(hook.get().heatmap.activeMode).toBe('annual-sun-access')
    expect(hook.get().heatmap.mapFeatures).toEqual(hook.get().annualSimulation.heatmapFeatures)
    expect(hook.get().heatmap.mapEnabled).toBe(true)
    expect(hook.get().heatmap.annualVisible).toBe(true)
    hook.unmount()
  })
})
