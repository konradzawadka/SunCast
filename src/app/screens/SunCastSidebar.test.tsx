// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { SunCastSidebar } from './SunCastSidebar'
import type { SunCastSidebarModel } from '../hooks/useSunCastController'

vi.mock('../components/FootprintPanel', () => ({ FootprintPanel: () => <div data-testid="footprint-panel" /> }))
vi.mock('../features/sidebar/RoofEditor', () => ({ RoofEditor: () => <div data-testid="roof-editor-panel" /> }))
vi.mock('../features/sidebar/ObstaclePanel', () => ({ ObstaclePanel: () => <div data-testid="obstacle-panel" /> }))
vi.mock('../features/sidebar/StatusPanel', () => ({ StatusPanel: () => null }))
vi.mock('../features/debug/DevTools', () => ({ DevTools: () => null }))

function makeModel(overrides: Partial<SunCastSidebarModel> = {}): SunCastSidebarModel {
  return {
    editMode: 'roof',
    isDrawingRoof: false,
    isDrawingObstacle: false,
    drawDraftCountRoof: 0,
    drawDraftCountObstacle: 0,
    footprints: [],
    activeFootprintId: null,
    selectedFootprintIds: [],
    activeFootprint: null,
    obstacles: [],
    activeObstacle: null,
    selectedObstacleIds: [],
    activeConstraints: { vertexHeights: [] },
    selectedVertexIndex: null,
    selectedEdgeIndex: null,
    footprintEntries: [],
    interactionError: null,
    solverError: null,
    footprintErrors: [],
    warnings: [],
    basePitchDeg: null,
    pitchAdjustmentPercent: 0,
    adjustedPitchDeg: null,
    azimuthDeg: null,
    roofAreaM2: null,
    minHeightM: null,
    maxHeightM: null,
    fitRmsErrorM: null,
    activeFootprintLatDeg: null,
    activeFootprintLonDeg: null,
    onSetEditMode: vi.fn(),
    onStartDrawing: vi.fn(),
    onUndoDrawing: vi.fn(),
    onCancelDrawing: vi.fn(),
    onCommitDrawing: vi.fn(),
    onStartObstacleDrawing: vi.fn(),
    onUndoObstacleDrawing: vi.fn(),
    onCancelObstacleDrawing: vi.fn(),
    onCommitObstacleDrawing: vi.fn(),
    onSelectFootprint: vi.fn(),
    onSelectObstacle: vi.fn(),
    onSetActiveFootprintKwp: vi.fn(),
    onSetActiveObstacleHeight: vi.fn(),
    onSetActiveObstacleKind: vi.fn(),
    onSetPitchAdjustmentPercent: vi.fn(),
    onDeleteActiveFootprint: vi.fn(),
    onDeleteActiveObstacle: vi.fn(),
    onSetVertex: vi.fn(() => true),
    onSetEdge: vi.fn(() => true),
    onClearVertex: vi.fn(),
    onClearEdge: vi.fn(),
    onConstraintLimitExceeded: vi.fn(),
    onStartTutorial: vi.fn(),
    onShareProject: vi.fn(async () => {}),
    onDevSelectVertex: vi.fn(),
    onDevSelectEdge: vi.fn(),
    onDevClearSelection: vi.fn(),
    onDevImportEntries: vi.fn(),
    ...overrides,
  }
}

function renderSidebar(model: SunCastSidebarModel) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(<SunCastSidebar model={model} />)
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

function getModeButtons(container: HTMLElement) {
  const buttons = Array.from(container.querySelectorAll('.draw-mode-button')) as HTMLButtonElement[]
  const roofModeButton = buttons.find((button) => button.textContent?.includes('Roof Mode')) ?? null
  const obstacleModeButton = buttons.find((button) => button.textContent?.includes('Obstacle Mode')) ?? null
  return { roofModeButton, obstacleModeButton }
}

describe('SunCastSidebar tutorial intro', () => {
  it('opens intro overlay from start tutorial button', () => {
    const model = makeModel()
    const view = renderSidebar(model)

    const trigger = view.container.querySelector('[data-testid="start-tutorial-button"]') as HTMLButtonElement | null
    expect(trigger).not.toBeNull()

    act(() => {
      trigger?.click()
    })

    const introStartButton = view.container.querySelector(
      '[data-testid="start-interactive-tutorial-button"]',
    ) as HTMLButtonElement | null
    expect(introStartButton).not.toBeNull()
    view.unmount()
  })

  it('starts interactive tutorial from intro overlay', () => {
    const onStartTutorial = vi.fn()
    const model = makeModel({ onStartTutorial })
    const view = renderSidebar(model)

    const trigger = view.container.querySelector('[data-testid="start-tutorial-button"]') as HTMLButtonElement
    act(() => {
      trigger.click()
    })

    const introStartButton = view.container.querySelector(
      '[data-testid="start-interactive-tutorial-button"]',
    ) as HTMLButtonElement
    act(() => {
      introStartButton.click()
    })

    expect(onStartTutorial).toHaveBeenCalledTimes(1)
    expect(view.container.querySelector('[data-testid="start-interactive-tutorial-button"]')).toBeNull()
    view.unmount()
  })
})

describe('SunCastSidebar editor tabs', () => {
  it('shows roof editor when edit mode is roof', () => {
    const model = makeModel({ editMode: 'roof' })
    const view = renderSidebar(model)

    const { roofModeButton, obstacleModeButton } = getModeButtons(view.container)
    expect(roofModeButton?.classList.contains('draw-mode-button-active')).toBe(true)
    expect(obstacleModeButton?.classList.contains('draw-mode-button-active')).toBe(false)
    expect(view.container.querySelector('[data-testid="footprint-panel"]')).not.toBeNull()
    expect(view.container.querySelector('[data-testid="roof-editor-panel"]')).not.toBeNull()
    expect(view.container.querySelector('[data-testid="obstacle-panel"]')).toBeNull()
    view.unmount()
  })

  it('shows obstacle panel when edit mode is obstacle', () => {
    const model = makeModel({ editMode: 'obstacle' })
    const view = renderSidebar(model)

    const { roofModeButton, obstacleModeButton } = getModeButtons(view.container)
    expect(roofModeButton?.classList.contains('draw-mode-button-active')).toBe(false)
    expect(obstacleModeButton?.classList.contains('draw-mode-button-active')).toBe(true)
    expect(view.container.querySelector('[data-testid="footprint-panel"]')).toBeNull()
    expect(view.container.querySelector('[data-testid="roof-editor-panel"]')).toBeNull()
    expect(view.container.querySelector('[data-testid="obstacle-panel"]')).not.toBeNull()
    view.unmount()
  })

  it('switches edit mode from tab clicks', () => {
    const onSetEditMode = vi.fn()
    const model = makeModel({ editMode: 'roof', onSetEditMode })
    const view = renderSidebar(model)

    const { obstacleModeButton } = getModeButtons(view.container)
    expect(obstacleModeButton).not.toBeNull()

    act(() => {
      obstacleModeButton?.click()
    })

    expect(onSetEditMode).toHaveBeenCalledWith('obstacle')
    view.unmount()
  })
})
