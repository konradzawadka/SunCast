import { useMemo } from 'react'
import { useProjectStore } from '../../state/project-store'

export function useProjectDocument() {
  const store = useProjectStore()

  const footprintEntries = useMemo(() => Object.values(store.state.footprints), [store.state.footprints])
  const footprints = useMemo(() => footprintEntries.map((entry) => entry.footprint), [footprintEntries])
  const sunProjection = store.sunProjection ?? store.state.sunProjection
  const shadingSettings = store.shadingSettings ?? store.state.shadingSettings

  return {
    store,
    projectDocument: store.projectDocument ?? {
      footprints: store.state.footprints,
      obstacles: store.state.obstacles,
      sunProjection,
      shadingSettings,
    },
    footprintEntries,
    footprints,
    activeFootprint: store.activeFootprint,
    activeConstraints: store.activeConstraints,
    obstacles: store.obstacles,
    activeObstacle: store.activeObstacle,
    selectedObstacles: store.selectedObstacles,
    selectedFootprintIds: store.selectedFootprintIds,
    sunProjection,
    shadingSettings,
  }
}
