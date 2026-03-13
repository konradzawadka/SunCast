import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import type { FootprintPolygon } from '../../../../../types/geometry'
import {
  AUTO_FOCUS_MAX_ZOOM,
  MAX_ORBIT_PITCH_DEG,
  ORBIT_BEARING_DEG,
  ORBIT_PITCH_DEG,
} from '../mapViewConstants'
import { toBounds } from '../mapViewGeoJson'

interface UseOrbitCameraArgs {
  mapRef: RefObject<maplibregl.Map | null>
  mapLoaded: boolean
  orbitEnabled: boolean
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
}

interface UseOrbitCameraResult {
  gizmoScreenPos: { left: number; top: number } | null
  adjustOrbitCamera: (bearingDeltaDeg: number, pitchDeltaDeg: number) => void
  setOrbitCameraPose: (bearingDeg: number, pitchDeg: number) => void
}

export function useOrbitCamera({
  mapRef,
  mapLoaded,
  orbitEnabled,
  footprints,
  activeFootprint,
  selectedVertexIndex,
  selectedEdgeIndex,
}: UseOrbitCameraArgs): UseOrbitCameraResult {
  const [gizmoScreenPos, setGizmoScreenPos] = useState<{ left: number; top: number } | null>(null)

  const gizmoAnchor = useMemo(() => {
    if (!activeFootprint || activeFootprint.vertices.length < 3 || !orbitEnabled) {
      return null
    }

    if (
      selectedVertexIndex !== null &&
      selectedVertexIndex >= 0 &&
      selectedVertexIndex < activeFootprint.vertices.length
    ) {
      return activeFootprint.vertices[selectedVertexIndex]
    }

    if (selectedEdgeIndex !== null && selectedEdgeIndex >= 0 && selectedEdgeIndex < activeFootprint.vertices.length) {
      const start = activeFootprint.vertices[selectedEdgeIndex]
      const end = activeFootprint.vertices[(selectedEdgeIndex + 1) % activeFootprint.vertices.length]
      return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] as [number, number]
    }

    return null
  }, [activeFootprint, orbitEnabled, selectedEdgeIndex, selectedVertexIndex])
  const hasGizmoAnchor = orbitEnabled && gizmoAnchor !== null

  const adjustOrbitCamera = useCallback(
    (bearingDeltaDeg: number, pitchDeltaDeg: number) => {
      const map = mapRef.current
      if (!map) {
        return
      }

      const nextPitch = Math.max(0, Math.min(MAX_ORBIT_PITCH_DEG, map.getPitch() + pitchDeltaDeg))
      map.easeTo({
        bearing: map.getBearing() + bearingDeltaDeg,
        pitch: nextPitch,
        duration: 220,
      })
    },
    [mapRef],
  )

  const setOrbitCameraPose = useCallback(
    (bearingDeg: number, pitchDeg: number) => {
      const map = mapRef.current
      if (!map) {
        return
      }
      const clampedPitch = Math.max(0, Math.min(MAX_ORBIT_PITCH_DEG, pitchDeg))
      map.easeTo({
        bearing: bearingDeg,
        pitch: clampedPitch,
        duration: 220,
      })
    },
    [mapRef],
  )

  useEffect(() => {
    if (!mapLoaded) {
      return
    }

    const map = mapRef.current
    if (!map) {
      return
    }

    if (!orbitEnabled) {
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
      if (map.getLayer('footprints-fill')) {
        map.setPaintProperty('footprints-fill', 'fill-opacity', ['case', ['==', ['get', 'active'], 1], 0.24, 0.12])
      }
      map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 350,
      })
      return
    }

    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
    if (map.getLayer('footprints-fill')) {
      map.setPaintProperty('footprints-fill', 'fill-opacity', 0)
    }

    const focusFootprint = activeFootprint ?? footprints.find((candidate) => candidate.vertices.length >= 3) ?? null
    if (focusFootprint && focusFootprint.vertices.length >= 3) {
      map.fitBounds(toBounds(focusFootprint.vertices), {
        padding: 80,
        duration: 500,
        bearing: ORBIT_BEARING_DEG,
        pitch: ORBIT_PITCH_DEG,
        maxZoom: AUTO_FOCUS_MAX_ZOOM,
      })
      return
    }

    map.easeTo({
      pitch: ORBIT_PITCH_DEG,
      bearing: ORBIT_BEARING_DEG,
      duration: 500,
    })
  }, [activeFootprint, footprints, mapLoaded, mapRef, orbitEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !gizmoAnchor || !orbitEnabled) {
      return
    }

    const updateGizmoPosition = () => {
      const projected = map.project({ lng: gizmoAnchor[0], lat: gizmoAnchor[1] })
      setGizmoScreenPos({ left: projected.x, top: projected.y })
    }

    updateGizmoPosition()
    map.on('move', updateGizmoPosition)
    map.on('rotate', updateGizmoPosition)
    map.on('pitch', updateGizmoPosition)
    map.on('zoom', updateGizmoPosition)
    map.on('resize', updateGizmoPosition)

    return () => {
      map.off('move', updateGizmoPosition)
      map.off('rotate', updateGizmoPosition)
      map.off('pitch', updateGizmoPosition)
      map.off('zoom', updateGizmoPosition)
      map.off('resize', updateGizmoPosition)
    }
  }, [gizmoAnchor, mapRef, orbitEnabled])

  return { gizmoScreenPos: hasGizmoAnchor ? gizmoScreenPos : null, adjustOrbitCamera, setOrbitCameraPose }
}
