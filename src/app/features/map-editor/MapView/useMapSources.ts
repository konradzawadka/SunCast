import { useEffect, useRef, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import type { FootprintPolygon, VertexHeightConstraint } from '../../../../types/geometry'
import { AUTO_FOCUS_MAX_ZOOM } from './mapViewConstants'
import { syncDraftSource, syncInteractiveSources, toBounds } from './mapViewGeoJson'

interface UseMapSourcesArgs {
  mapRef: RefObject<maplibregl.Map | null>
  mapLoaded: boolean
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  drawDraft: Array<[number, number]>
  vertexConstraints: VertexHeightConstraint[]
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
}

export function useMapSources({
  mapRef,
  mapLoaded,
  footprints,
  activeFootprint,
  selectedFootprintIds,
  drawDraft,
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
      vertexConstraints,
      selectedVertexIndex,
      selectedEdgeIndex,
    })
  }, [
    activeFootprint,
    footprints,
    mapLoaded,
    mapRef,
    selectedEdgeIndex,
    selectedFootprintIds,
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

    syncDraftSource(map, drawDraft)
  }, [drawDraft, mapLoaded, mapRef])

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
