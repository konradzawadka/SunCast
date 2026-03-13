// @vitest-environment jsdom
import { act, useEffect } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockReadStorage = vi.fn()
const mockWriteStorage = vi.fn()
const mockDecodeSharePayloadResult = vi.fn()
const mockDeserializeSharePayloadResult = vi.fn()

vi.mock('./projectState.storage', () => ({
  readStorageResult: (...args: unknown[]) => mockReadStorage(...args),
  writeStorage: (...args: unknown[]) => mockWriteStorage(...args),
}))

vi.mock('./projectState.share', async () => {
  const actual = await vi.importActual<typeof import('./projectState.share')>('./projectState.share')
  return {
    ...actual,
    deserializeSharePayloadResult: (...args: unknown[]) => mockDeserializeSharePayloadResult(...args),
  }
})

vi.mock('../../shared/utils/shareCodec', () => ({
  decodeSharePayloadResult: (...args: unknown[]) => mockDecodeSharePayloadResult(...args),
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
    mockDecodeSharePayloadResult.mockResolvedValue({ ok: true, value: '{"version":1}' })
    mockDeserializeSharePayloadResult.mockReturnValue({ ok: true, value: shared })
    mockReadStorage.mockReturnValue({ ok: true, value: createState('stored') })

    window.history.replaceState({}, '', '/#c=abc')
    const hook = renderStore()
    await hook.waitForHydrate()

    expect(hook.get().state.activeFootprintId).toBe('shared')
    expect(mockReadStorage).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('falls back to localStorage and surfaces error when hash c is invalid', async () => {
    const stored = createState('stored')
    mockDecodeSharePayloadResult.mockResolvedValue({
      ok: false,
      error: { code: 'SHARE_PAYLOAD_INVALID', message: 'Invalid shared URL payload.' },
    })
    mockReadStorage.mockReturnValue({ ok: true, value: stored })

    window.history.replaceState({}, '', '/#c=broken')
    const hook = renderStore()
    await hook.waitForHydrate()

    expect(hook.get().state.activeFootprintId).toBe('stored')
    expect(mockReadStorage).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it('exposes resetState command that clears project data', async () => {
    mockDecodeSharePayloadResult.mockResolvedValue({ ok: true, value: '{"version":1}' })
    mockDeserializeSharePayloadResult.mockReturnValue({ ok: true, value: createState('shared') })
    mockReadStorage.mockReturnValue({ ok: true, value: null })

    window.history.replaceState({}, '', '/#c=abc')
    const hook = renderStore()
    await hook.waitForHydrate()
    expect(hook.get().state.activeFootprintId).toBe('shared')

    act(() => {
      hook.get().resetState()
    })

    expect(hook.get().state.activeFootprintId).toBeNull()
    expect(Object.keys(hook.get().state.footprints)).toHaveLength(0)
    expect(hook.get().state.obstacles).toEqual({})
    hook.unmount()
  })

  it('persists canonical document state with null active ids', async () => {
    const shared = createState('shared')
    shared.footprints.another = {
      footprint: {
        id: 'another',
        vertices: [
          [3, 3],
          [4, 3],
          [4, 4],
        ],
        kwp: 5,
      },
      constraints: { vertexHeights: [] },
      pitchAdjustmentPercent: 0,
    }
    shared.selectedFootprintIds = ['shared', 'another']
    mockDecodeSharePayloadResult.mockResolvedValue({ ok: true, value: '{"version":1}' })
    mockDeserializeSharePayloadResult.mockReturnValue({ ok: true, value: shared })
    mockReadStorage.mockReturnValue({ ok: true, value: null })

    window.history.replaceState({}, '', '/#c=abc')
    const hook = renderStore()
    await hook.waitForHydrate()

    act(() => {
      hook.get().selectOnlyFootprint('another')
    })

    expect(mockWriteStorage).toHaveBeenCalled()
    const latestCall = mockWriteStorage.mock.calls.at(-1)
    expect(latestCall?.[0]).toMatchObject({
      footprints: expect.any(Object),
      obstacles: expect.any(Object),
      sunProjection: expect.any(Object),
      shadingSettings: expect.any(Object),
      activeFootprintId: null,
      activeObstacleId: null,
    })
    expect(latestCall?.[0].drawDraft).toBeUndefined()
    expect(latestCall?.[0].selectedFootprintIds).toBeUndefined()
    hook.unmount()
  })
})
