import { useEffect, useMemo, useReducer, useRef } from 'react'
import { createProjectCommands } from './projectState.commands'
import {
  DEFAULT_FOOTPRINT_KWP,
  DEFAULT_SHADING_SETTINGS,
  DEFAULT_SUN_PROJECTION,
  initialProjectState,
  projectStateReducer,
} from './projectState.reducer'
import {
  getActiveConstraints,
  getActiveFootprint,
  getActiveObstacle,
  getObstacleEntries,
  getSelectedFootprintIds,
  getSelectedObstacleEntries,
  getShadingReadyFootprintEntries,
  isFootprintSelected,
} from './projectState.selectors'
import { readStorageResult, writeStorage } from './projectState.storage'
import { deserializeSharePayloadResult } from './projectState.share'
import { decodeSharePayloadResult } from '../../shared/utils/shareCodec'
import { captureException, recordEvent } from '../../shared/observability/observability'
import { createAppError, reportAppError } from '../../shared/errors'
import { selectEditorSession } from '../../application/editor-session/editorSession.selectors'
import { selectProjectDocument } from '../../domain/project-document/projectDocument.selectors'

const SOLVER_CONFIG_VERSION = 'uc7'

export function useProjectStore() {
  const [state, dispatch] = useReducer(projectStateReducer, initialProjectState)
  const hasSkippedInitialPersist = useRef(false)

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      const hashPayload = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const shareParam = new URLSearchParams(hashPayload).get('c')
      if (shareParam) {
        const decoded = await decodeSharePayloadResult(shareParam)
        if (decoded.ok) {
          const shared = deserializeSharePayloadResult(
            decoded.value,
            DEFAULT_SUN_PROJECTION,
            DEFAULT_FOOTPRINT_KWP,
            DEFAULT_SHADING_SETTINGS,
          )
          if (!cancelled && shared.ok) {
            try {
              dispatch({ type: 'LOAD', payload: shared.value })
            } catch (cause) {
              reportAppError(
                createAppError('SHARE_PAYLOAD_INVALID', 'Shared project state is invalid.', {
                  cause,
                  context: { area: 'startup-hydration', source: 'hash', enableStateReset: true },
                }),
              )
            }
            return
          }
          if (!cancelled && !shared.ok) {
            reportAppError(shared.error)
            recordEvent('startup.hydration.hash_failed', { code: shared.error.code })
          }
        } else if (!cancelled) {
          reportAppError(decoded.error)
          recordEvent('startup.hydration.hash_failed', { code: decoded.error.code })
        }
      }

      const stored = readStorageResult(
        DEFAULT_SUN_PROJECTION,
        DEFAULT_SHADING_SETTINGS,
        DEFAULT_FOOTPRINT_KWP,
        SOLVER_CONFIG_VERSION,
      )
      if (stored.ok && stored.value && !cancelled) {
        try {
          dispatch({ type: 'LOAD', payload: stored.value })
          recordEvent('startup.hydration.storage_loaded')
        } catch (cause) {
          reportAppError(
            createAppError('STORAGE_CORRUPTED', 'Stored project state is invalid.', {
              cause,
              context: { area: 'startup-hydration', source: 'storage', enableStateReset: true },
            }),
          )
        }
      } else if (!stored.ok && !cancelled) {
        reportAppError(stored.error)
      }
    }

    void hydrate().catch((error: unknown) => {
      captureException(error, { area: 'startup-hydration' })
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hasSkippedInitialPersist.current) {
      hasSkippedInitialPersist.current = true
      return
    }

    const projectDocument = {
      footprints: state.footprints,
      obstacles: state.obstacles,
      sunProjection: state.sunProjection,
      shadingSettings: state.shadingSettings,
    }

    writeStorage(
      {
        ...projectDocument,
        // Active ids belong to editor session; keep persisted payload canonical.
        activeFootprintId: null,
        activeObstacleId: null,
      },
      SOLVER_CONFIG_VERSION,
      DEFAULT_FOOTPRINT_KWP,
    )
  }, [
    state.activeFootprintId,
    state.footprints,
    state.activeObstacleId,
    state.obstacles,
    state.sunProjection,
    state.shadingSettings,
  ])

  return useMemo(() => {
    const activeFootprint = getActiveFootprint(state)
    const projectDocument = selectProjectDocument(state)
    const editorSession = selectEditorSession(state)

    return {
      state,
      projectDocument,
      editorSession,
      activeFootprint,
      activeConstraints: getActiveConstraints(state),
      selectedFootprintIds: getSelectedFootprintIds(state),
      isFootprintSelected: (footprintId: string) => isFootprintSelected(state, footprintId),
      obstacles: getObstacleEntries(state),
      activeObstacle: getActiveObstacle(state),
      selectedObstacles: getSelectedObstacleEntries(state),
      shadingReadyFootprints: getShadingReadyFootprintEntries(state),
      sunProjection: state.sunProjection,
      shadingSettings: state.shadingSettings,
      ...createProjectCommands(dispatch, () => state),
    }
  }, [state])
}
