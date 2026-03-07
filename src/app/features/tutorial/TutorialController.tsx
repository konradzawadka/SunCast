import { useEffect } from 'react'
import { TutorialOverlay } from './Tutorial/TutorialOverlay'
import type { SunCastTutorialModel } from '../../hooks/useSunCastController'
import { useTutorial } from './useTutorial'

const TUTORIAL_STEPS = [
  {
    title: 'Draw your roof polygon',
    description: 'Draw your roof by clicking on the map to place polygon corners.',
    targetSelectors: ['[data-testid="draw-footprint-button"]'],
  },
  {
    title: 'Finish polygon',
    description: 'Click Finish to complete the roof polygon.',
    targetSelectors: ['[data-testid="draw-finish-button"]'],
  },
  {
    title: 'Set kWp for the roof',
    description: 'Enter the installed PV capacity for this roof (kWp).',
    targetSelectors: ['[data-testid="active-footprint-kwp-input"]'],
  },
  {
    title: 'Set vertex heights',
    description: 'Set the height of roof corners to define the roof slope.',
    targetSelectors: ['[data-testid="vertex-heights-panel"]'],
  },
  {
    title: 'Confirm roof pitch',
    description:
      'Check the calculated roof pitch and view the roof in perspective to verify it looks correct.',
    targetSelectors: ['[data-testid="status-pitch-value"]', '[data-testid="orbit-toggle-button"]'],
  },
  {
    title: 'Adjust date with arrows',
    description:
      'In the Sun Date & Time input, use arrow keys: Up for previous day and Down for next day.',
    targetSelectors: ['[data-testid="sun-datetime-input"]'],
  },
] as const

interface TutorialControllerProps {
  model: SunCastTutorialModel
}

export function TutorialController({ model }: TutorialControllerProps) {
  const tutorial = useTutorial({
    draftVertexCount: model.draftVertexCount,
    hasFinishedPolygon: model.hasFinishedPolygon,
    kwp: model.kwp,
    hasEditedKwp: model.hasEditedKwp,
    constrainedVertexCount: model.constrainedVertexCount,
    orbitEnabled: model.orbitEnabled,
    hasEditedDatetime: model.hasEditedDatetime,
  })

  useEffect(() => {
    model.onReady({ startTutorial: tutorial.startTutorial })
  }, [model, tutorial.startTutorial])

  const activeTutorialStep = tutorial.currentStepIndex !== null ? TUTORIAL_STEPS[tutorial.currentStepIndex] : null
  if (!model.mapInitialized || !tutorial.isVisible || !activeTutorialStep) {
    return null
  }

  return (
    <TutorialOverlay
      step={activeTutorialStep}
      stepIndex={tutorial.currentStepIndex ?? 0}
      stepCount={tutorial.stepCount}
      onSkip={tutorial.skipTutorial}
      onComplete={tutorial.completeTutorial}
    />
  )
}
