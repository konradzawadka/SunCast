import { useCallback, useEffect, useMemo, useState } from 'react'

const TUTORIAL_STORAGE_KEY = 'suncast_uc12_tutorial_state'
const TOTAL_STEPS = 6

interface TutorialStorageState {
  completedSteps: number
  tutorialEnabled: boolean
}

interface TutorialSignals {
  draftVertexCount: number
  hasFinishedPolygon: boolean
  kwp: number | null
  hasEditedKwp: boolean
  constrainedVertexCount: number
  orbitEnabled: boolean
  hasEditedDatetime: boolean
}

interface TutorialController {
  isVisible: boolean
  currentStepIndex: number | null
  stepCount: number
  startTutorial: () => void
  skipTutorial: () => void
  completeTutorial: () => void
}

const DEFAULT_TUTORIAL_STATE: TutorialStorageState = {
  completedSteps: 0,
  tutorialEnabled: true,
}

function sanitizeStoredState(value: unknown): TutorialStorageState {
  if (!value || typeof value !== 'object') {
    return DEFAULT_TUTORIAL_STATE
  }

  const completedRaw = (value as { completedSteps?: unknown }).completedSteps
  const enabledRaw = (value as { tutorialEnabled?: unknown }).tutorialEnabled

  const completedSteps = Number.isInteger(completedRaw)
    ? Math.max(0, Math.min(TOTAL_STEPS, Number(completedRaw)))
    : DEFAULT_TUTORIAL_STATE.completedSteps
  const tutorialEnabled =
    typeof enabledRaw === 'boolean' ? enabledRaw : DEFAULT_TUTORIAL_STATE.tutorialEnabled

  return {
    completedSteps,
    tutorialEnabled,
  }
}

function readTutorialState(): TutorialStorageState {
  if (typeof window === 'undefined') {
    return DEFAULT_TUTORIAL_STATE
  }

  const raw = window.localStorage.getItem(TUTORIAL_STORAGE_KEY)
  if (!raw) {
    return DEFAULT_TUTORIAL_STATE
  }

  try {
    return sanitizeStoredState(JSON.parse(raw) as unknown)
  } catch {
    return DEFAULT_TUTORIAL_STATE
  }
}

function getCompletedStepCount(signals: TutorialSignals): number {
  const conditions = [
    signals.draftVertexCount >= 3 || signals.hasFinishedPolygon,
    signals.hasFinishedPolygon,
    (signals.kwp ?? 0) > 0 && signals.hasEditedKwp,
    signals.constrainedVertexCount >= 3,
    signals.orbitEnabled,
    signals.hasEditedDatetime,
  ]

  let completed = 0
  for (const condition of conditions) {
    if (!condition) {
      break
    }
    completed += 1
  }

  return completed
}

export function useTutorial(signals: TutorialSignals): TutorialController {
  const [tutorialEnabled, setTutorialEnabled] = useState(() => readTutorialState().tutorialEnabled)
  const [forceCompleted, setForceCompleted] = useState(false)
  const [manualBaselineCompleted, setManualBaselineCompleted] = useState<number | null>(null)
  const persistedCompleted = readTutorialState().completedSteps

  const completedFromSignals = useMemo(() => getCompletedStepCount(signals), [signals])
  const completedSteps =
    forceCompleted
      ? TOTAL_STEPS
      : manualBaselineCompleted === null
        ? Math.max(persistedCompleted, completedFromSignals)
        : Math.min(TOTAL_STEPS, Math.max(0, completedFromSignals - manualBaselineCompleted))
  const isCompleted = completedSteps >= TOTAL_STEPS
  const tutorialVisible = tutorialEnabled && !isCompleted

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const persistedState: TutorialStorageState = {
      completedSteps: Math.min(completedSteps, TOTAL_STEPS),
      tutorialEnabled: tutorialVisible,
    }
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(persistedState))
  }, [completedSteps, tutorialVisible])

  const startTutorial = useCallback(() => {
    setForceCompleted(false)
    setTutorialEnabled(true)
    setManualBaselineCompleted(completedFromSignals)
  }, [completedFromSignals])

  const skipTutorial = useCallback(() => {
    setManualBaselineCompleted(null)
    setTutorialEnabled(false)
  }, [])

  const completeTutorial = useCallback(() => {
    setForceCompleted(true)
    setManualBaselineCompleted(null)
    setTutorialEnabled(false)
  }, [])

  const isVisible = tutorialVisible
  const currentStepIndex = isVisible ? Math.min(completedSteps, TOTAL_STEPS - 1) : null

  return {
    isVisible,
    currentStepIndex,
    stepCount: TOTAL_STEPS,
    startTutorial,
    skipTutorial,
    completeTutorial,
  }
}
