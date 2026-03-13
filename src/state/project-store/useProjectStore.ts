import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
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
import type { Action } from './projectState.types'
import { decodeSharePayloadResult } from '../../shared/utils/shareCodec'
import { captureException, recordEvent } from '../../shared/observability/observability'
import { createAppError, reportAppError } from '../../shared/errors'

const SOLVER_CONFIG_VERSION = 'uc7'
const GEOMETRY_REVISION_ACTION_TYPES = new Set<Action['type']>([
  'COMMIT_FOOTPRINT',
  'DELETE_FOOTPRINT',
  'MOVE_VERTEX',
  'MOVE_EDGE',
  'SET_VERTEX_HEIGHT',
  'SET_VERTEX_HEIGHTS',
  'SET_EDGE_HEIGHT',
  'CLEAR_VERTEX_HEIGHT',
  'CLEAR_EDGE_HEIGHT',
  'COMMIT_OBSTACLE',
  'DELETE_OBSTACLE',
  'SET_OBSTACLE_HEIGHT',
  'SET_OBSTACLE_KIND',
  'MOVE_OBSTACLE_VERTEX',
  'UPSERT_IMPORTED_FOOTPRINTS',
  'LOAD',
  'RESET_STATE',
])

export function useProjectStore() {
  const [state, dispatchRaw] = useReducer(projectStateReducer, initialProjectState)
  const hasSkippedInitialPersist = useRef(false)
  const stateRevisionRef = useRef(0)

  const dispatch = useCallback((action: Action) => {
    dispatchRaw(action)
    if (GEOMETRY_REVISION_ACTION_TYPES.has(action.type)) {
      stateRevisionRef.current += 1
    }
  }, [dispatchRaw])

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
    state.footprints,
    state.obstacles,
    state.sunProjection,
    state.shadingSettings,
  ])

  return useMemo(() => {
    const activeFootprint = getActiveFootprint(state)
    const projectDocument = {
      footprints: state.footprints,
      obstacles: state.obstacles,
      sunProjection: state.sunProjection,
      shadingSettings: state.shadingSettings,
    }
    const editorSession = {
      activeFootprintId: state.activeFootprintId,
      selectedFootprintIds: state.selectedFootprintIds,
      drawDraft: state.drawDraft,
      isDrawing: state.isDrawing,
      activeObstacleId: state.activeObstacleId,
      selectedObstacleIds: state.selectedObstacleIds,
      obstacleDrawDraft: state.obstacleDrawDraft,
      isDrawingObstacle: state.isDrawingObstacle,
    }

    return {
      state,
      stateRevision: stateRevisionRef.current,
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
