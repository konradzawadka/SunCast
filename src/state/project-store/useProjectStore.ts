import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createProjectCommands } from './projectState.commands'
import {
  DEFAULT_FOOTPRINT_KWP,
  DEFAULT_SUN_PROJECTION,
  initialProjectState,
  projectStateReducer,
} from './projectState.reducer'
import {
  getActiveConstraints,
  getActiveFootprint,
  getSelectedFootprintIds,
  isFootprintSelected,
} from './projectState.selectors'
import { readStorage, writeStorage } from './projectState.storage'
import { deserializeSharePayload } from './projectState.share'
import { decodeSharePayload } from '../../shared/utils/shareCodec'
import { captureException, recordEvent } from '../../shared/observability/observability'

const SOLVER_CONFIG_VERSION = 'uc6'

export function useProjectStore() {
  const [state, dispatch] = useReducer(projectStateReducer, initialProjectState)
  const hasSkippedInitialPersist = useRef(false)
  const [startupHydrationError, setStartupHydrationError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      const hashPayload = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const shareParam = new URLSearchParams(hashPayload).get('c')
      if (shareParam) {
        try {
          const decoded = await decodeSharePayload(shareParam)
          const shared = deserializeSharePayload(decoded, DEFAULT_SUN_PROJECTION, DEFAULT_FOOTPRINT_KWP)
          if (!cancelled) {
            dispatch({ type: 'LOAD', payload: shared })
          }
          return
        } catch {
          if (!cancelled) {
            setStartupHydrationError('Invalid shared URL. Loaded saved project instead.')
            recordEvent('startup.hydration.hash_failed')
          }
        }
      }

      const stored = readStorage(DEFAULT_SUN_PROJECTION, DEFAULT_FOOTPRINT_KWP, SOLVER_CONFIG_VERSION)
      if (stored && !cancelled) {
        dispatch({ type: 'LOAD', payload: stored })
        recordEvent('startup.hydration.storage_loaded')
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

    writeStorage(
      {
        footprints: state.footprints,
        activeFootprintId: state.activeFootprintId,
        sunProjection: state.sunProjection,
      },
      SOLVER_CONFIG_VERSION,
      DEFAULT_FOOTPRINT_KWP,
    )
  }, [state.activeFootprintId, state.footprints, state.sunProjection])

  return useMemo(() => {
    const activeFootprint = getActiveFootprint(state)

    return {
      state,
      activeFootprint,
      activeConstraints: getActiveConstraints(state),
      selectedFootprintIds: getSelectedFootprintIds(state),
      isFootprintSelected: (footprintId: string) => isFootprintSelected(state, footprintId),
      sunProjection: state.sunProjection,
      startupHydrationError,
      ...createProjectCommands(dispatch, () => state),
    }
  }, [startupHydrationError, state])
}
