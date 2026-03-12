// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { createRef, type RefObject } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useMapInteractions } from './useMapInteractions'

type Handler = (event: unknown) => void
type UseMapInteractionsArgs = Parameters<typeof useMapInteractions>[0]
type InteractionRefs = UseMapInteractionsArgs['refs']

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

function renderInteractions(args: {
  mapRef: RefObject<unknown>
  mapLoaded: boolean
  refs: InteractionRefs
}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  function HookProbe() {
    useMapInteractions({
      mapRef: args.mapRef as UseMapInteractionsArgs['mapRef'],
      mapLoaded: args.mapLoaded,
      refs: args.refs,
      constrainedDrawLengthM: null,
    })
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

function createRefs(overrides: Partial<InteractionRefs> = {}): InteractionRefs {
  return {
    drawingRef: { current: false },
    drawDraftRef: { current: [] as Array<[number, number]> },
    editModeRef: { current: 'roof' },
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
    activeObstacleRef: { current: null },
    onMapClickRef: { current: vi.fn() },
    onCloseDrawingRef: { current: vi.fn() },
    onSelectVertexRef: { current: vi.fn() },
    onSelectEdgeRef: { current: vi.fn() },
    onSelectFootprintRef: { current: vi.fn() },
    onSelectObstacleRef: { current: vi.fn() },
    onClearSelectionRef: { current: vi.fn() },
    onMoveVertexRef: { current: vi.fn(() => true) },
    onMoveEdgeRef: { current: vi.fn(() => true) },
    onMoveObstacleVertexRef: { current: vi.fn(() => true) },
    onMoveRejectedRef: { current: vi.fn() },
    onBearingChangeRef: { current: vi.fn() },
    onPitchChangeRef: { current: vi.fn() },
    onGeometryDragStateChangeRef: { current: vi.fn() },
    ...overrides,
  }
}

describe('useMapInteractions', () => {
  it('snaps draft click to a right angle when near 90 degrees', () => {
    const { handlers, map } = createMapMock()
    const onMapClick = vi.fn()
    const refs = createRefs({
      drawingRef: { current: true },
      drawDraftRef: { current: [[0, 0], [0.001, 0]] as Array<[number, number]> },
      onMapClickRef: { current: onMapClick },
    })
    const mapRef = createRef<unknown>()
    mapRef.current = map

    const hook = renderInteractions({ mapRef, mapLoaded: true, refs })

    act(() => {
      handlers.click({
        point: { x: 40, y: 50 },
        lngLat: { lng: 0.00105, lat: 0.0003 },
        originalEvent: new MouseEvent('click'),
      })
    })

    expect(onMapClick).toHaveBeenCalledTimes(1)
    const snapped = onMapClick.mock.calls[0][0] as [number, number]
    expect(snapped[0]).toBeCloseTo(0.001, 6)
    hook.unmount()
  })

  it('disables right-angle snap while shift is pressed during draw click', () => {
    const { handlers, map } = createMapMock()
    const onMapClick = vi.fn()
    const refs = createRefs({
      drawingRef: { current: true },
      drawDraftRef: { current: [[0, 0], [0.001, 0]] as Array<[number, number]> },
      onMapClickRef: { current: onMapClick },
    })
    const mapRef = createRef<unknown>()
    mapRef.current = map

    const hook = renderInteractions({ mapRef, mapLoaded: true, refs })

    act(() => {
      handlers.click({
        point: { x: 40, y: 50 },
        lngLat: { lng: 0.00105, lat: 0.0003 },
        originalEvent: new MouseEvent('click', { shiftKey: true }),
      })
    })

    expect(onMapClick).toHaveBeenCalledTimes(1)
    const unsnapped = onMapClick.mock.calls[0][0] as [number, number]
    expect(unsnapped[0]).toBeCloseTo(0.00105, 6)
    expect(unsnapped[1]).toBeCloseTo(0.0003, 6)
    hook.unmount()
  })

  it('closes drawing when clicking near the first draft point', () => {
    const { handlers, map } = createMapMock()
    const onMapClick = vi.fn()
    const onCloseDrawing = vi.fn()
    map.project.mockImplementation(({ lng, lat }: { lng: number; lat: number }) => ({
      x: lng * 1000,
      y: lat * 1000,
    }))
    const refs = createRefs({
      drawingRef: { current: true },
      drawDraftRef: { current: [[0, 0], [0.001, 0], [0.001, 0.001]] as Array<[number, number]> },
      onMapClickRef: { current: onMapClick },
      onCloseDrawingRef: { current: onCloseDrawing },
    })
    const mapRef = createRef<unknown>()
    mapRef.current = map

    const hook = renderInteractions({ mapRef, mapLoaded: true, refs })

    act(() => {
      handlers.click({
        point: { x: 40, y: 50 },
        lngLat: { lng: 0.00001, lat: 0.00001 },
        originalEvent: new MouseEvent('click'),
      })
    })

    expect(onCloseDrawing).toHaveBeenCalledTimes(1)
    expect(onMapClick).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('does not close drawing on first-point snap while shift is pressed', () => {
    const { handlers, map } = createMapMock()
    const onMapClick = vi.fn()
    const onCloseDrawing = vi.fn()
    map.project.mockImplementation(({ lng, lat }: { lng: number; lat: number }) => ({
      x: lng * 1000,
      y: lat * 1000,
    }))
    const refs = createRefs({
      drawingRef: { current: true },
      drawDraftRef: { current: [[0, 0], [0.001, 0], [0.001, 0.001]] as Array<[number, number]> },
      onMapClickRef: { current: onMapClick },
      onCloseDrawingRef: { current: onCloseDrawing },
    })
    const mapRef = createRef<unknown>()
    mapRef.current = map

    const hook = renderInteractions({ mapRef, mapLoaded: true, refs })

    act(() => {
      handlers.click({
        point: { x: 40, y: 50 },
        lngLat: { lng: 0.00001, lat: 0.00001 },
        originalEvent: new MouseEvent('click', { shiftKey: true }),
      })
    })

    expect(onCloseDrawing).not.toHaveBeenCalled()
    expect(onMapClick).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it('uses resize cursor on editable edge hover', () => {
    const hitFeatures = [{ layer: { id: 'active-footprint-edge-hit' }, properties: { edgeIndex: 0 } }]
    const { handlers, map } = createMapMock(hitFeatures)
    const refs = createRefs()
    const mapRef = createRef<unknown>()
    mapRef.current = map

    const hook = renderInteractions({ mapRef, mapLoaded: true, refs })

    act(() => {
      handlers.mousemove({
        point: { x: 40, y: 50 },
        lngLat: { lng: 10, lat: 10 },
        originalEvent: new MouseEvent('mousemove'),
      })
    })

    const getCanvas = map.getCanvas as unknown as () => { style: { cursor: string } }
    expect(getCanvas().style.cursor).toBe('ew-resize')
    hook.unmount()
  })

  it('uses middle mouse for orbit steer and clamps pitch', () => {
    const { handlers, map } = createMapMock()
    const refs = createRefs({ orbitEnabledRef: { current: true } })
    const mapRef = createRef<unknown>()
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
    const mapRef = createRef<unknown>()
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

  it('selects obstacle in obstacle edit mode', () => {
    const hitFeatures = [{ layer: { id: 'obstacles-hit' }, properties: { obstacleId: 'ob-1' } }]
    const { handlers, map } = createMapMock(hitFeatures)
    const refs = createRefs({
      editModeRef: { current: 'obstacle' },
    })
    const mapRef = createRef<unknown>()
    mapRef.current = map

    const hook = renderInteractions({ mapRef, mapLoaded: true, refs })

    act(() => {
      handlers.click({
        point: { x: 40, y: 50 },
        lngLat: { lng: 10, lat: 10 },
        originalEvent: new MouseEvent('click'),
      })
    })

    expect(refs.onSelectObstacleRef.current).toHaveBeenCalledWith('ob-1', false)
    hook.unmount()
  })
})
