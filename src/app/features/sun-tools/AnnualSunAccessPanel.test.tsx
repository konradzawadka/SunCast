// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnnualSunAccessPanel } from './AnnualSunAccessPanel'

const getContextMock = vi.fn()

function renderPanel() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  const annualResult = {
    roofs: [
      {
        roofId: 'roof-1',
        sunHours: 1000,
        daylightHours: 1200,
        frontSideHours: 1100,
        sunAccessRatio: 0.8333,
        litCellCountWeighted: 1000,
        totalCellCountWeighted: 1200,
      },
    ],
    heatmapCells: [
      {
        roofId: 'roof-1',
        cellPolygon: [
          [20, 52],
          [20.00001, 52],
          [20.00001, 52.00001],
          [20, 52.00001],
        ] as Array<[number, number]>,
        litRatio: 0.75,
      },
    ],
    meta: {
      sampledDayCount: 7,
      simulatedHalfYear: true,
      stepMinutes: 30,
      sampleWindowDays: 5,
      dateStartIso: '2026-01-01',
      dateEndIso: '2026-12-31',
    },
  }

  act(() => {
    root.render(
      <AnnualSunAccessPanel
        selectedRoofCount={1}
        gridResolutionM={0.1}
        state="READY"
        progressRatio={1}
        result={annualResult}
        isAnnualHeatmapVisible={true}
        onGridResolutionChange={vi.fn()}
        onRunSimulation={vi.fn(async () => undefined)}
        onClearSimulation={vi.fn()}
        onShowAnnualHeatmap={vi.fn()}
        onHideAnnualHeatmap={vi.fn()}
      />,
    )
  })

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('AnnualSunAccessPanel', () => {
  beforeEach(() => {
    getContextMock.mockReset()
    getContextMock.mockReturnValue({
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContextMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders annual heatmap canvas preview when simulation result is available', () => {
    const view = renderPanel()
    const canvas = view.container.querySelector('[data-testid="annual-sim-heatmap-canvas"]') as HTMLCanvasElement | null
    const overlayOpenButton = view.container.querySelector(
      '[data-testid="annual-sim-heatmap-overlay-open"]',
    ) as HTMLButtonElement | null
    expect(canvas).not.toBeNull()
    expect(overlayOpenButton).not.toBeNull()
    expect(getContextMock).toHaveBeenCalledWith('2d')
    expect((canvas?.width ?? 0) > 0).toBe(true)
    expect((canvas?.height ?? 0) > 0).toBe(true)
    view.unmount()
  })
})
