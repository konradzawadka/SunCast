import { useEffect, useMemo, useRef } from 'react'
import { generateObstacleMeshResult } from '../../../geometry/mesh/generateObstacleMesh'
import { reportAppError } from '../../../shared/errors'
import type { ObstacleStateEntry } from '../../../types/geometry'

export function useObstacleMeshes(obstacles: ObstacleStateEntry[]): {
  obstacleMeshResults: ReturnType<typeof generateObstacleMeshResult>[]
  obstacleMeshes: Array<Extract<ReturnType<typeof generateObstacleMeshResult>, { ok: true }>>
} {
  const obstacleMeshResults = useMemo(() => {
    return obstacles.map((obstacle) => generateObstacleMeshResult(obstacle))
  }, [obstacles])

  const obstacleMeshErrors = useMemo(
    () => obstacleMeshResults.filter((result): result is Extract<typeof result, { ok: false }> => !result.ok),
    [obstacleMeshResults],
  )

  const obstacleMeshes = useMemo(
    () => obstacleMeshResults.filter((result): result is Extract<typeof result, { ok: true }> => result.ok),
    [obstacleMeshResults],
  )

  const reportedObstacleMeshErrorSignaturesRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const signatures = new Set<string>()
    for (const result of obstacleMeshErrors) {
      const context = result.error.context ?? {}
      const signature = `${result.error.code}:${String(context.obstacleId ?? 'unknown')}:${String(context.reason ?? '')}`
      signatures.add(signature)
      if (!reportedObstacleMeshErrorSignaturesRef.current.has(signature)) {
        reportAppError(result.error)
        reportedObstacleMeshErrorSignaturesRef.current.add(signature)
      }
    }

    for (const existing of [...reportedObstacleMeshErrorSignaturesRef.current]) {
      if (!signatures.has(existing)) {
        reportedObstacleMeshErrorSignaturesRef.current.delete(existing)
      }
    }
  }, [obstacleMeshErrors])

  return {
    obstacleMeshResults,
    obstacleMeshes,
  }
}
