import { useCallback, useState } from 'react'
import { buildSharePayload, serializeSharePayload } from '../../state/project-store/projectState.share'
import type { ProjectState } from '../../state/project-store/projectState.types'
import { encodeSharePayload } from '../../shared/utils/shareCodec'

const MAX_SHARE_URL_LENGTH = 3500

interface UseShareProjectArgs {
  footprints: ProjectState['footprints']
  activeFootprintId: ProjectState['activeFootprintId']
  obstacles: ProjectState['obstacles']
  activeObstacleId: ProjectState['activeObstacleId']
  sunProjection: ProjectState['sunProjection']
}

interface UseShareProjectResult {
  shareError: string | null
  shareSuccess: string | null
  onShareProject: () => Promise<void>
  resetShareStatus: () => void
}

export function useShareProject({
  footprints,
  activeFootprintId,
  obstacles,
  activeObstacleId,
  sunProjection,
}: UseShareProjectArgs): UseShareProjectResult {
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareSuccess, setShareSuccess] = useState<string | null>(null)

  const resetShareStatus = useCallback(() => {
    setShareError(null)
    setShareSuccess(null)
  }, [])

  const onShareProject = useCallback(async () => {
    setShareError(null)
    setShareSuccess(null)

    if (Object.keys(footprints).length === 0) {
      setShareError('Nothing to share yet. Add at least one footprint.')
      return
    }

    try {
      const payload = buildSharePayload({
        footprints,
        activeFootprintId,
        obstacles,
        activeObstacleId,
        sunProjection,
      })
      const encoded = await encodeSharePayload(serializeSharePayload(payload))
      const shareUrl = new URL(window.location.href)
      shareUrl.hash = `c=${encoded}`
      const shareUrlValue = shareUrl.toString()

      if (shareUrlValue.length > MAX_SHARE_URL_LENGTH) {
        setShareError('Project is too large to share as a URL.')
        return
      }

      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: 'SunCast project', url: shareUrlValue })
          setShareSuccess('Share dialog opened.')
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }
        }
      }

      if (!navigator.clipboard?.writeText) {
        setShareError('Clipboard sharing is not available in this browser.')
        return
      }

      await navigator.clipboard.writeText(shareUrlValue)
      setShareSuccess('Share URL copied to clipboard.')
    } catch {
      setShareError('Could not generate share URL.')
    }
  }, [activeFootprintId, activeObstacleId, footprints, obstacles, sunProjection])

  return {
    shareError,
    shareSuccess,
    onShareProject,
    resetShareStatus,
  }
}
