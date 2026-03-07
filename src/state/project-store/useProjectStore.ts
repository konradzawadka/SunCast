import { useEffect, useMemo, useReducer, useRef } from 'react'
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

const SOLVER_CONFIG_VERSION = 'uc6'

export function useProjectStore() {
  const [state, dispatch] = useReducer(projectStateReducer, initialProjectState)
  const hasSkippedInitialPersist = useRef(false)

  useEffect(() => {
    const stored = readStorage(DEFAULT_SUN_PROJECTION, DEFAULT_FOOTPRINT_KWP)
    if (stored) {
      dispatch({ type: 'LOAD', payload: stored })
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
      ...createProjectCommands(dispatch, () => state),
    }
  }, [state])
}
