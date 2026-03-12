// @vitest-environment jsdom
import { act, useEffect } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockReadStorage = vi.fn()
const mockWriteStorage = vi.fn()
const mockDecodeSharePayload = vi.fn()
const mockDeserializeSharePayload = vi.fn()

vi.mock('./projectState.storage', () => ({
  readStorage: (...args: unknown[]) => mockReadStorage(...args),
  writeStorage: (...args: unknown[]) => mockWriteStorage(...args),
}))

vi.mock('./projectState.share', async () => {
  const actual = await vi.importActual<typeof import('./projectState.share')>('./projectState.share')
  return {
    ...actual,
    deserializeSharePayload: (...args: unknown[]) => mockDeserializeSharePayload(...args),
  }
})

vi.mock('../../shared/utils/shareCodec', () => ({
  decodeSharePayload: (...args: unknown[]) => mockDecodeSharePayload(...args),
}))

import { useProjectStore } from './useProjectStore'
import type { ProjectState } from './projectState.types'

function createState(id: string): ProjectState {
  return {
    footprints: {
      [id]: {
        footprint: {
          id,
          vertices: [
            [1, 1],
            [2, 1],
            [2, 2],
          ],
          kwp: 4.3,
        },
        constraints: { vertexHeights: [] },
        pitchAdjustmentPercent: 0,
      },
    },
    activeFootprintId: id,
    selectedFootprintIds: [id],
    drawDraft: [],
    isDrawing: false,
    obstacles: {},
    activeObstacleId: null,
    selectedObstacleIds: [],
    obstacleDrawDraft: [],
    isDrawingObstacle: false,
    sunProjection: { enabled: true, datetimeIso: null, dailyDateIso: null },
    shadingSettings: { enabled: true, gridResolutionM: 0.5 },
  }
}

function renderStore() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let latest: ReturnType<typeof useProjectStore> | null = null

  function Probe() {
    const store = useProjectStore()

    useEffect(() => {
      latest = store
    }, [store])

    return null
  }

  act(() => {
    root.render(<Probe />)
  })

  return {
    get: () => {
      if (!latest) {
        throw new Error('store not rendered')
      }
      return latest
    },
    waitForHydrate: async () => {
      await act(async () => {
        await Promise.resolve()
      })
    },
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('useProjectStore startup hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('prefers hash c URL payload over localStorage', async () => {
    const shared = createState('shared')
    mockDecodeSharePayload.mockResolvedValue('{"version":1}')
    mockDeserializeSharePayload.mockReturnValue(shared)
    mockReadStorage.mockReturnValue(createState('stored'))

    window.history.replaceState({}, '', '/#c=abc')
    const hook = renderStore()
    await hook.waitForHydrate()

    expect(hook.get().state.activeFootprintId).toBe('shared')
    expect(mockReadStorage).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('falls back to localStorage and surfaces error when hash c is invalid', async () => {
    const stored = createState('stored')
    mockDecodeSharePayload.mockRejectedValue(new Error('bad cfg'))
    mockReadStorage.mockReturnValue(stored)

    window.history.replaceState({}, '', '/#c=broken')
    const hook = renderStore()
    await hook.waitForHydrate()

    expect(hook.get().state.activeFootprintId).toBe('stored')
    expect(hook.get().startupHydrationError).toBe('Invalid shared URL. Loaded saved project instead.')
    expect(mockReadStorage).toHaveBeenCalledTimes(1)
    hook.unmount()
  })
})
