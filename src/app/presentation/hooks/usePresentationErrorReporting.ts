import { useEffect, useRef } from 'react'
import { reportAppErrorCode } from '../../../shared/errors'
import type { ReturnTypeUseAnalysis, ReturnTypeUseEditorSession } from './usePresentationTypes'

interface UsePresentationErrorReportingArgs {
  activeFootprintErrors: string[]
  editorSession: ReturnTypeUseEditorSession
  analysis: ReturnTypeUseAnalysis
}

export function usePresentationErrorReporting({
  activeFootprintErrors,
  editorSession,
  analysis,
}: UsePresentationErrorReportingArgs): void {
  const reportedUiErrorSignaturesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const signatures = new Set<string>()
    for (const message of activeFootprintErrors) {
      const signature = `INPUT_VALIDATION_FAILED:footprint:${message}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('INPUT_VALIDATION_FAILED', message, {
          context: { area: 'status-panel', source: 'footprint-validation' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    if (editorSession.interactionError) {
      const signature = `INTERACTION_FAILED:${editorSession.interactionError}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('INTERACTION_FAILED', editorSession.interactionError, {
          context: { area: 'status-panel', source: 'interaction' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    if (analysis.diagnostics.solverError) {
      const signature = `SOLVER_FAILED:${analysis.diagnostics.solverError}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('SOLVER_FAILED', analysis.diagnostics.solverError, {
          context: { area: 'status-panel', source: 'solver' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    if (analysis.sunProjection.datetimeError) {
      const signature = `INPUT_VALIDATION_FAILED:sun:${analysis.sunProjection.datetimeError}`
      signatures.add(signature)
      if (!reportedUiErrorSignaturesRef.current.has(signature)) {
        reportAppErrorCode('INPUT_VALIDATION_FAILED', analysis.sunProjection.datetimeError, {
          context: { area: 'sun-datetime', source: 'datetime-input' },
        })
        reportedUiErrorSignaturesRef.current.add(signature)
      }
    }

    for (const existing of [...reportedUiErrorSignaturesRef.current]) {
      const isUiValidationSignature =
        existing.startsWith('INPUT_VALIDATION_FAILED:footprint:') ||
        existing.startsWith('INPUT_VALIDATION_FAILED:sun:') ||
        existing.startsWith('INTERACTION_FAILED:') ||
        existing.startsWith('SOLVER_FAILED:')
      if (isUiValidationSignature && !signatures.has(existing)) {
        reportedUiErrorSignaturesRef.current.delete(existing)
      }
    }
  }, [activeFootprintErrors, analysis.diagnostics.solverError, analysis.sunProjection.datetimeError, editorSession.interactionError])
}
