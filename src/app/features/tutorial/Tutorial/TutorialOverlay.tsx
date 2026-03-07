import { useEffect, useRef, useState } from 'react'

interface TutorialOverlayStep {
  title: string
  description: string
  targetSelectors: readonly string[]
}

interface TutorialOverlayProps {
  step: TutorialOverlayStep
  stepIndex: number
  stepCount: number
  onSkip: () => void
  onComplete: () => void
}

type HighlightRect = {
  top: number
  left: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getTargetElement(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null
  }
  return document.querySelector<HTMLElement>(selector)
}

function toHighlightRect(element: HTMLElement): HighlightRect {
  const rect = element.getBoundingClientRect()
  const padding = 10
  return {
    top: Math.max(8, rect.top - padding),
    left: Math.max(8, rect.left - padding),
    width: Math.max(24, rect.width + padding * 2),
    height: Math.max(24, rect.height + padding * 2),
  }
}

export function TutorialOverlay({ step, stepIndex, stepCount, onSkip, onComplete }: TutorialOverlayProps) {
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([])
  const [cardStyle, setCardStyle] = useState<{ top: number; left: number }>({ top: 20, left: 20 })
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const recalc = () => {
      const targetElements = step.targetSelectors
        .map((selector) => getTargetElement(selector))
        .filter((item): item is HTMLElement => item !== null)
      const rects = targetElements.map((element) => toHighlightRect(element))
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      setHighlightRects(rects)

      if (rects.length === 0) {
        setCardStyle({ top: 18, left: Math.max(12, viewportWidth - 320) })
        return
      }

      const cardWidth = 330
      const cardHeight = cardRef.current?.offsetHeight ?? 180
      const primary = rects[0]

      const preferredLeft = primary.left + primary.width + 14
      const canPlaceRight = preferredLeft + cardWidth <= viewportWidth - 12
      const left = canPlaceRight
        ? preferredLeft
        : clamp(primary.left - cardWidth - 14, 12, Math.max(12, viewportWidth - cardWidth - 12))

      const top = clamp(primary.top - 6, 12, Math.max(12, viewportHeight - cardHeight - 12))
      setCardStyle({ top, left })
    }

    const scheduleRecalc = () => {
      requestAnimationFrame(recalc)
    }

    const domObserver = new MutationObserver(scheduleRecalc)
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    recalc()
    window.addEventListener('resize', scheduleRecalc)
    window.addEventListener('scroll', scheduleRecalc, true)
    return () => {
      domObserver.disconnect()
      window.removeEventListener('resize', scheduleRecalc)
      window.removeEventListener('scroll', scheduleRecalc, true)
    }
  }, [step.targetSelectors])

  return (
    <>
      <div className="tutorial-backdrop" aria-hidden="true" data-testid="tutorial-backdrop" />
      {highlightRects.map((rect, index) => (
        <div
          key={`tutorial-highlight-${index}`}
          className="tutorial-spotlight"
          aria-hidden="true"
          data-testid="tutorial-spotlight"
          style={{
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        />
      ))}
      <aside
        ref={cardRef}
        className="tutorial-card tutorial-card-light"
        role="dialog"
        aria-live="polite"
        aria-label={`Tutorial step ${stepIndex + 1} of ${stepCount}`}
        style={{ top: `${cardStyle.top}px`, left: `${cardStyle.left}px` }}
      >
        <p className="tutorial-step-index">
          Step {stepIndex + 1}/{stepCount}
        </p>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        <div className="tutorial-actions">
          <button type="button" onClick={onSkip}>
            Skip tutorial
          </button>
          {stepIndex === stepCount - 1 && (
            <button type="button" onClick={onComplete}>
              Finish tutorial
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
