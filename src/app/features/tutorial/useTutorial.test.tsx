// @vitest-environment jsdom
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTutorial } from './useTutorial'

interface TutorialSignals {
  draftVertexCount: number
  hasFinishedPolygon: boolean
  kwp: number | null
  hasEditedKwp: boolean
  constrainedVertexCount: number
  orbitEnabled: boolean
  hasEditedDatetime: boolean
}

function renderTutorialHook(signals: TutorialSignals) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const latestRef: { current: ReturnType<typeof useTutorial> | null } = { current: null }

  function HookProbe({ nextSignals }: { nextSignals: TutorialSignals }) {
    const latest = useTutorial(nextSignals)
    const sharedRef = useRef(latestRef)

    useEffect(() => {
      sharedRef.current.current = latest
    }, [latest, sharedRef])

    return null
  }

  act(() => {
    root.render(<HookProbe nextSignals={signals} />)
  })

  return {
    get: () => {
      if (!latestRef.current) {
        throw new Error('Hook did not render')
      }
      return latestRef.current
    },
    rerender: (nextSignals: TutorialSignals) => {
      act(() => {
        root.render(<HookProbe nextSignals={nextSignals} />)
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

const INITIAL_SIGNALS: TutorialSignals = {
  draftVertexCount: 0,
  hasFinishedPolygon: false,
  kwp: null,
  hasEditedKwp: false,
  constrainedVertexCount: 0,
  orbitEnabled: false,
  hasEditedDatetime: false,
}

describe('useTutorial', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('progresses through steps as signals become true', () => {
    const hook = renderTutorialHook(INITIAL_SIGNALS)
    expect(hook.get().currentStepIndex).toBe(0)

    hook.rerender({
      ...INITIAL_SIGNALS,
      draftVertexCount: 3,
      hasFinishedPolygon: true,
      kwp: 4,
      hasEditedKwp: true,
      constrainedVertexCount: 3,
      orbitEnabled: true,
      hasEditedDatetime: true,
    })

    expect(hook.get().isVisible).toBe(false)
    expect(hook.get().currentStepIndex).toBeNull()
    hook.unmount()
  })

  it('skipTutorial hides tutorial and persists disabled flag', () => {
    const hook = renderTutorialHook(INITIAL_SIGNALS)

    act(() => {
      hook.get().skipTutorial()
    })

    const raw = localStorage.getItem('suncast_uc12_tutorial_state')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ tutorialEnabled: false })
    hook.unmount()
  })

  it('startTutorial creates baseline and restarts from current progress', () => {
    const hook = renderTutorialHook({ ...INITIAL_SIGNALS, draftVertexCount: 3, hasFinishedPolygon: true })

    act(() => {
      hook.get().startTutorial()
    })

    expect(hook.get().isVisible).toBe(true)
    expect(hook.get().currentStepIndex).toBe(0)

    hook.rerender({
      ...INITIAL_SIGNALS,
      draftVertexCount: 3,
      hasFinishedPolygon: true,
      kwp: 5,
      hasEditedKwp: true,
    })

    expect(hook.get().currentStepIndex).toBe(1)
    hook.unmount()
  })

  it('nextStep advances tutorial hint manually', () => {
    const hook = renderTutorialHook(INITIAL_SIGNALS)
    expect(hook.get().currentStepIndex).toBe(0)

    act(() => {
      hook.get().nextStep()
    })

    expect(hook.get().currentStepIndex).toBe(1)
    hook.unmount()
  })
})
