import { useEffect, useRef, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import type { FootprintPolygon, ObstacleStateEntry, VertexHeightConstraint } from '../../../../../types/geometry'
import { AUTO_FOCUS_MAX_ZOOM } from '../mapViewConstants'
import { syncDraftSource, syncInteractiveSources, toBounds } from '../mapViewGeoJson'

interface UseMapSourcesArgs {
  mapRef: RefObject<maplibregl.Map | null>
  mapLoaded: boolean
  editMode: 'roof' | 'obstacle'
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  obstacles: ObstacleStateEntry[]
  activeObstacle: ObstacleStateEntry | null
  selectedObstacleIds: string[]
  drawDraftRoof: Array<[number, number]>
  drawDraftObstacle: Array<[number, number]>
  isDrawingRoof: boolean
  isDrawingObstacle: boolean
  draftPreviewPoint: [number, number] | null
  vertexConstraints: VertexHeightConstraint[]
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
}

export function useMapSources({
  mapRef,
  mapLoaded,
  editMode,
  footprints,
  activeFootprint,
  selectedFootprintIds,
  obstacles,
  activeObstacle,
  selectedObstacleIds,
  drawDraftRoof,
  drawDraftObstacle,
  isDrawingRoof,
  isDrawingObstacle,
  draftPreviewPoint,
  vertexConstraints,
  selectedVertexIndex,
  selectedEdgeIndex,
}: UseMapSourcesArgs): void {
  const hasAppliedInitialFootprintFocusRef = useRef(false)

  useEffect(() => {
    if (!mapLoaded) {
      return
    }

    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) {
      return
    }

    syncInteractiveSources(map, {
      footprints,
      activeFootprint,
      selectedFootprintIds,
      obstacles,
      activeObstacle,
      selectedObstacleIds,
      vertexConstraints,
      selectedVertexIndex,
      selectedEdgeIndex,
    })
  }, [
    activeFootprint,
    activeObstacle,
    footprints,
    obstacles,
    mapLoaded,
    mapRef,
    selectedEdgeIndex,
    selectedFootprintIds,
    selectedObstacleIds,
    selectedVertexIndex,
    vertexConstraints,
  ])

  useEffect(() => {
    if (!mapLoaded) {
      return
    }

    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) {
      return
    }

    const draft =
      editMode === 'obstacle'
        ? (isDrawingObstacle ? drawDraftObstacle : [])
        : (isDrawingRoof ? drawDraftRoof : [])
    const previewPoint = draft.length >= 1 ? draftPreviewPoint : null
    syncDraftSource(map, draft, previewPoint)
  }, [
    draftPreviewPoint,
    drawDraftObstacle,
    drawDraftRoof,
    editMode,
    isDrawingObstacle,
    isDrawingRoof,
    mapLoaded,
    mapRef,
  ])

  useEffect(() => {
    if (!mapLoaded || hasAppliedInitialFootprintFocusRef.current) {
      return
    }

    const map = mapRef.current
    if (!map) {
      return
    }

    const firstFootprint = footprints.find((candidate) => candidate.vertices.length >= 3)
    if (!firstFootprint) {
      return
    }

    hasAppliedInitialFootprintFocusRef.current = true
    map.fitBounds(toBounds(firstFootprint.vertices), {
      padding: 80,
      duration: 0,
      maxZoom: AUTO_FOCUS_MAX_ZOOM,
    })
  }, [footprints, mapLoaded, mapRef])
}
