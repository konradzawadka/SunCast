// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnnualSunAccessResult } from '../../geometry/shading'
import { useAnnualRoofSimulation, type AnnualSimulationOptions, type UseAnnualRoofSimulationArgs } from './useAnnualRoofSimulation'

const mockPrepareShadingScene = vi.fn()
const mockComputeAnnualSunAccessBatched = vi.fn()

vi.mock('../../geometry/shading', () => ({
  prepareShadingScene: (...args: unknown[]) => mockPrepareShadingScene(...args),
  computeAnnualSunAccessBatched: (...args: unknown[]) => mockComputeAnnualSunAccessBatched(...args),
}))

function makeAnnualResult(): AnnualSunAccessResult {
  return {
    roofs: [
      {
        roofId: 'roof-1',
        sunHours: 1234,
        daylightHours: 1500,
        sunAccessRatio: 0.82,
        litCellCountWeighted: 400,
        totalCellCountWeighted: 500,
      },
    ],
    heatmapCells: [
      {
        roofId: 'roof-1',
        cellPolygon: [
          [10, 10],
          [10.0001, 10],
          [10.0001, 10.0001],
          [10, 10.0001],
        ],
        litRatio: 0.82,
      },
    ],
    meta: {
      sampledDayCount: 40,
      simulatedHalfYear: true,
      stepMinutes: 30,
      sampleWindowDays: 5,
      dateStartIso: '2031-01-01',
      dateEndIso: '2031-12-31',
    },
  }
}

function makeArgs(overrides: Partial<UseAnnualRoofSimulationArgs> = {}): UseAnnualRoofSimulationArgs {
  return {
    roofs: [
      {
        roofId: 'roof-1',
        polygon: [
          [10, 10],
          [11, 10],
          [11, 11],
        ],
        vertexHeightsM: [1, 1, 1],
      },
    ],
    obstacles: [],
    gridResolutionM: 0.5,
    timeZone: 'UTC',
    ...overrides,
  }
}

function renderHook(initialArgs: UseAnnualRoofSimulationArgs) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const latestRef: {
    current: ReturnType<typeof useAnnualRoofSimulation> | null
  } = { current: null }
  const argsRef: { current: UseAnnualRoofSimulationArgs } = { current: initialArgs }

  function Probe({ args }: { args: UseAnnualRoofSimulationArgs }) {
    const value = useAnnualRoofSimulation(args)
    const sharedRef = useRef(latestRef)
    useEffect(() => {
      sharedRef.current.current = value
    }, [value, sharedRef])
    return null
  }

  const rerender = (nextArgs?: UseAnnualRoofSimulationArgs) => {
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

describe('useAnnualRoofSimulation', () => {
  beforeEach(() => {
    mockPrepareShadingScene.mockReset()
    mockComputeAnnualSunAccessBatched.mockReset()
    mockPrepareShadingScene.mockReturnValue({
      origin: { lon0: 10, lat0: 10, cosLat0: 0.99 },
      roofs: [],
      obstacles: [],
      maxObstacleHeightM: 0,
      maxShadowDistanceClampM: 120,
      diagnostics: {
        roofsProcessed: 1,
        roofsSkipped: 0,
        obstaclesProcessed: 0,
        sampleCount: 1,
        obstacleCandidatesChecked: 0,
      },
    })
    mockComputeAnnualSunAccessBatched.mockImplementation(async (_input, options?: { onProgress?: (progress: { sampledDays: number; totalSampledDays: number }) => void }) => {
      options?.onProgress?.({ sampledDays: 1, totalSampledDays: 2 })
      options?.onProgress?.({ sampledDays: 2, totalSampledDays: 2 })
      return makeAnnualResult()
    })
  })

  it('runs simulation manually and exposes ready result + heatmap features', async () => {
    vi.useFakeTimers()
    const hook = renderHook(makeArgs())
    const options: AnnualSimulationOptions = {
      year: 2031,
      dateStartIso: '2031-01-01',
      dateEndIso: '2031-12-31',
      sampleWindowDays: 5,
      stepMinutes: 30,
      halfYearMirror: true,
    }

    await act(async () => {
      const promise = hook.get().runSimulation(options)
      await vi.runAllTimersAsync()
      await promise
    })

    expect(hook.get().state).toBe('READY')
    expect(hook.get().result?.roofs[0].sunAccessRatio).toBeCloseTo(0.82, 8)
    expect(hook.get().heatmapFeatures).toHaveLength(1)
    expect(hook.get().heatmapFeatures[0].properties.intensity).toBeCloseTo(0.82, 8)
    expect(hook.get().progress.ratio).toBe(1)
    expect(mockPrepareShadingScene).toHaveBeenCalledTimes(1)
    expect(mockComputeAnnualSunAccessBatched).toHaveBeenCalledTimes(1)

    hook.unmount()
    vi.useRealTimers()
  })

  it('reuses cached results for identical geometry and options', async () => {
    vi.useFakeTimers()
    const hook = renderHook(makeArgs())
    const options: AnnualSimulationOptions = {
      year: 2026,
      dateStartIso: '2026-01-01',
      dateEndIso: '2026-12-31',
      sampleWindowDays: 5,
      stepMinutes: 30,
      halfYearMirror: true,
    }

    await act(async () => {
      const first = hook.get().runSimulation(options)
      await vi.runAllTimersAsync()
      await first
    })

    await act(async () => {
      const second = hook.get().runSimulation(options)
      await second
    })

    expect(mockPrepareShadingScene).toHaveBeenCalledTimes(1)
    expect(mockComputeAnnualSunAccessBatched).toHaveBeenCalledTimes(1)
    expect(hook.get().state).toBe('READY')

    hook.unmount()
    vi.useRealTimers()
  })

  it('returns validation error when date range is invalid', async () => {
    const hook = renderHook(makeArgs())
    const options: AnnualSimulationOptions = {
      dateStartIso: '2026-12-31',
      dateEndIso: '2026-01-01',
      sampleWindowDays: 5,
      stepMinutes: 30,
      halfYearMirror: true,
    }

    await act(async () => {
      await hook.get().runSimulation(options)
    })

    expect(hook.get().state).toBe('ERROR')
    expect(hook.get().error).toContain('valid date range')
    expect(mockPrepareShadingScene).not.toHaveBeenCalled()
    expect(mockComputeAnnualSunAccessBatched).not.toHaveBeenCalled()

    hook.unmount()
  })
})
