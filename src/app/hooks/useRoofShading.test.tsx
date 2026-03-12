// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ComputeRoofShadeGridInput, ComputeRoofShadeGridResult } from '../../geometry/shading'
import { useRoofShading, type UseRoofShadingArgs } from './useRoofShading'

const mockComputeRoofShadeGrid = vi.fn<(input: ComputeRoofShadeGridInput) => ComputeRoofShadeGridResult>()

vi.mock('../../geometry/shading', () => ({
  computeRoofShadeGrid: (input: ComputeRoofShadeGridInput) => mockComputeRoofShadeGrid(input),
}))

function makeComputeResult(input: ComputeRoofShadeGridInput): ComputeRoofShadeGridResult {
  return {
    status: 'OK',
    statusMessage: 'ok',
    origin: null,
    sunAzimuthDeg: 180,
    sunElevationDeg: 35,
    sunDirection: { x: 0, y: 1, z: 1 },
    roofs: [
      {
        roofId: input.roofs[0]?.roofId ?? 'r1',
        shadedCellCount: 1,
        litCellCount: 0,
        cells: [
          {
            roofId: input.roofs[0]?.roofId ?? 'r1',
            sample: { x: 0, y: 0, z: 1 },
            shadeFactor: 1,
            cellPolygonLocal: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 },
              { x: 0, y: 1 },
            ],
            cellPolygon: [
              [10, 10],
              [11, 10],
              [11, 11],
              [10, 11],
            ],
          },
        ],
      },
    ],
    diagnostics: {
      roofsProcessed: 1,
      roofsSkipped: 0,
      obstaclesProcessed: input.obstacles.length,
      sampleCount: 1,
      obstacleCandidatesChecked: 1,
    },
  }
}

function renderUseRoofShading(initialArgs: UseRoofShadingArgs) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const latestRef: {
    current: ReturnType<typeof useRoofShading> | null
  } = { current: null }
  const argsRef: { current: UseRoofShadingArgs } = { current: initialArgs }

  function Probe({ args }: { args: UseRoofShadingArgs }) {
    const value = useRoofShading(args)
    const sharedRef = useRef(latestRef)
    useEffect(() => {
      sharedRef.current.current = value
    }, [value, sharedRef])
    return null
  }

  const rerender = (nextArgs?: UseRoofShadingArgs) => {
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

function makeArgs(overrides: Partial<UseRoofShadingArgs> = {}): UseRoofShadingArgs {
  return {
    enabled: true,
    roofs: [
      {
        roofId: 'roof-1',
        polygon: [
          [10, 10],
          [11, 10],
          [11, 11],
        ],
        vertexHeightsM: [1, 1.2, 1.1],
      },
    ],
    obstacles: [
      {
        id: 'obs-1',
        kind: 'tree',
        shape: {
          type: 'tree',
          center: [9.85, 10.25],
          crownRadiusM: 1.6,
          trunkRadiusM: 0.35,
        },
        heightAboveGroundM: 8,
      },
    ],
    datetimeIso: '2026-03-08T11:00',
    gridResolutionM: 0.5,
    interactionActive: false,
    interactionThrottleMs: 100,
    ...overrides,
  }
}

describe('useRoofShading', () => {
  beforeEach(() => {
    mockComputeRoofShadeGrid.mockReset()
    mockComputeRoofShadeGrid.mockImplementation((input) => makeComputeResult(input))
  })

  it('throttles recompute during interaction and switches coarse/final grid modes', () => {
    vi.useFakeTimers()
    const hook = renderUseRoofShading(makeArgs({ interactionActive: true }))

    expect(mockComputeRoofShadeGrid).toHaveBeenCalledTimes(0)
    expect(hook.get().computeState).toBe('SCHEDULED')

    act(() => {
      vi.advanceTimersByTime(99)
    })
    expect(mockComputeRoofShadeGrid).toHaveBeenCalledTimes(0)

    act(() => {
      vi.advanceTimersByTime(1)
    })

    expect(mockComputeRoofShadeGrid).toHaveBeenCalledTimes(1)
    expect(mockComputeRoofShadeGrid.mock.calls[0][0].gridResolutionM).toBeGreaterThan(0.5)
    expect(hook.get().computeMode).toBe('coarse')
    expect(hook.get().usedGridResolutionM).toBeGreaterThan(0.5)

    hook.rerender(makeArgs({ interactionActive: false }))

    expect(mockComputeRoofShadeGrid).toHaveBeenCalledTimes(2)
    expect(mockComputeRoofShadeGrid.mock.calls[1][0].gridResolutionM).toBeCloseTo(0.5)
    expect(hook.get().computeMode).toBe('final')
    expect(hook.get().heatmapFeatures).toHaveLength(1)
    expect(hook.get().heatmapFeatures[0].geometry.coordinates[0][0]).toEqual(
      hook.get().heatmapFeatures[0].geometry.coordinates[0].at(-1),
    )

    hook.unmount()
    vi.useRealTimers()
  })

  it('uses cached result when fingerprints are unchanged', () => {
    const hook = renderUseRoofShading(makeArgs({ datetimeIso: '2026-03-08T12:30' }))
    expect(mockComputeRoofShadeGrid).toHaveBeenCalledTimes(1)

    hook.rerender(
      makeArgs({
        datetimeIso: '2026-03-08T12:30',
        roofs: [
          {
            roofId: 'roof-1',
            polygon: [
              [10, 10],
              [11, 10],
              [11, 11],
            ],
            vertexHeightsM: [1, 1.2, 1.1],
          },
        ],
      }),
    )

    expect(mockComputeRoofShadeGrid).toHaveBeenCalledTimes(1)
    expect(hook.get().computeState).toBe('READY')
    hook.unmount()
  })
})
