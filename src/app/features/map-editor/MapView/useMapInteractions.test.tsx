// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { createRef, type RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useMapInteractions } from './useMapInteractions'

type Handler = (event: any) => void

interface MapMock {
  handlers: Record<string, Handler>
  map: {
    on: ReturnType<typeof vi.fn>
    off: ReturnType<typeof vi.fn>
    queryRenderedFeatures: ReturnType<typeof vi.fn>
    project: ReturnType<typeof vi.fn>
    getCanvas: ReturnType<typeof vi.fn>
    dragPan: { disable: ReturnType<typeof vi.fn>; enable: ReturnType<typeof vi.fn> }
    jumpTo: ReturnType<typeof vi.fn>
    getBearing: ReturnType<typeof vi.fn>
    getPitch: ReturnType<typeof vi.fn>
  }
}

function createMapMock(hitFeatures: unknown[] = []): MapMock {
  const handlers: Record<string, Handler> = {}
  const canvas = { style: { cursor: '' } }

  const map = {
    on: vi.fn((name: string, handler: Handler) => {
      handlers[name] = handler
    }),
    off: vi.fn(),
    queryRenderedFeatures: vi.fn(() => hitFeatures),
    project: vi.fn(() => ({ x: 100, y: 120 })),
    getCanvas: vi.fn(() => canvas),
    dragPan: { disable: vi.fn(), enable: vi.fn() },
    jumpTo: vi.fn(),
    getBearing: vi.fn(() => 10),
    getPitch: vi.fn(() => 20),
  }

  return { handlers, map }
}

function renderInteractions(args: { mapRef: RefObject<any>; mapLoaded: boolean; refs: any }) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  function HookProbe() {
    useMapInteractions(args)
    return null
  }

  act(() => {
    root.render(<HookProbe />)
  })

  return {
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function createRefs(overrides: Partial<any> = {}) {
  return {
    drawingRef: { current: false },
    orbitEnabledRef: { current: false },
    activeFootprintRef: {
      current: {
        id: 'a',
        vertices: [
          [10, 10],
          [20, 10],
          [20, 20],
        ],
        kwp: 4,
      },
    },
    onMapClickRef: { current: vi.fn() },
    onSelectVertexRef: { current: vi.fn() },
    onSelectEdgeRef: { current: vi.fn() },
    onSelectFootprintRef: { current: vi.fn() },
    onClearSelectionRef: { current: vi.fn() },
    onMoveVertexRef: { current: vi.fn(() => true) },
    onMoveEdgeRef: { current: vi.fn(() => true) },
    onMoveRejectedRef: { current: vi.fn() },
    onBearingChangeRef: { current: vi.fn() },
    onPitchChangeRef: { current: vi.fn() },
    onGeometryDragStateChangeRef: { current: vi.fn() },
    ...overrides,
  }
}

describe('useMapInteractions', () => {
  it('uses middle mouse for orbit steer and clamps pitch', () => {
    const { handlers, map } = createMapMock()
    const refs = createRefs({ orbitEnabledRef: { current: true } })
    const mapRef = createRef<any>()
    mapRef.current = map

    const hook = renderInteractions({ mapRef, mapLoaded: true, refs })

    act(() => {
      handlers.mousedown({
        point: { x: 100, y: 100 },
        lngLat: { lng: 10, lat: 10 },
        originalEvent: new MouseEvent('mousedown', { button: 1 }),
      })
    })

    expect(map.dragPan.disable).toHaveBeenCalled()
    expect(refs.onGeometryDragStateChangeRef.current).not.toHaveBeenCalledWith(true)

    map.getPitch.mockReturnValue(2)
    act(() => {
      handlers.mousemove({ point: { x: 110, y: 160 }, lngLat: { lng: 10, lat: 10 }, originalEvent: new MouseEvent('mousemove') })
    })

    expect(map.jumpTo).toHaveBeenCalled()
    const jumpArg = map.jumpTo.mock.calls.at(-1)?.[0]
    expect(jumpArg.pitch).toBeGreaterThanOrEqual(0)

    act(() => {
      handlers.mouseup({})
    })

    expect(map.dragPan.enable).toHaveBeenCalled()
    hook.unmount()
  })

  it('reports rejected drag when vertex move is invalid', () => {
    const hitFeatures = [{ layer: { id: 'active-footprint-vertex-hit' }, properties: { vertexIndex: 1 } }]
    const { handlers, map } = createMapMock(hitFeatures)
    const refs = createRefs({ onMoveVertexRef: { current: vi.fn(() => false) } })
    const mapRef = createRef<any>()
    mapRef.current = map

    const hook = renderInteractions({ mapRef, mapLoaded: true, refs })

    act(() => {
      handlers.mousedown({
        point: { x: 50, y: 60 },
        lngLat: { lng: 12, lat: 13 },
        originalEvent: new MouseEvent('mousedown', { button: 0 }),
      })
    })

    expect(refs.onGeometryDragStateChangeRef.current).toHaveBeenCalledWith(true)

    act(() => {
      handlers.mousemove({
        point: { x: 55, y: 70 },
        lngLat: { lng: 13, lat: 14 },
        originalEvent: new MouseEvent('mousemove'),
      })
    })

    expect(refs.onMoveVertexRef.current).toHaveBeenCalledWith(1, [13, 14])

    act(() => {
      handlers.mouseup({})
    })

    expect(refs.onMoveRejectedRef.current).toHaveBeenCalled()
    expect(refs.onGeometryDragStateChangeRef.current).toHaveBeenLastCalledWith(false)
    hook.unmount()
  })
})
