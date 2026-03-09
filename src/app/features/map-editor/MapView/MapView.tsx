import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FootprintPolygon, RoofMeshData, VertexHeightConstraint } from '../../../../types/geometry'
import type { SunProjectionResult } from '../../../../geometry/sun/sunProjection'
import { MapOverlayControls } from './MapOverlayControls'
import { buildHashWithMapCenter } from './mapCenterFromHash'
import { useLatest } from './useLatest'
import { useMapInstance } from './useMapInstance'
import { useMapInteractions } from './useMapInteractions'
import { useMapSources } from './useMapSources'
import { useOrbitCamera } from './useOrbitCamera'
import type { PlaceSearchResult } from '../../place-search/placeSearch.types'
import { pointAtDistanceMeters } from './drawingAssist'

interface MapViewProps {
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  drawDraft: Array<[number, number]>
  isDrawing: boolean
  orbitEnabled: boolean
  onToggleOrbit: () => void
  sunProjectionResult: SunProjectionResult | null
  roofMeshes: RoofMeshData[]
  vertexConstraints: VertexHeightConstraint[]
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  onSelectVertex: (vertexIndex: number) => void
  onSelectEdge: (edgeIndex: number) => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onClearSelection: () => void
  onMoveVertex: (vertexIndex: number, point: [number, number]) => boolean
  onMoveEdge: (edgeIndex: number, delta: [number, number]) => boolean
  onMoveRejected: () => void
  onAdjustHeight: (stepM: number) => void
  showSolveHint: boolean
  onMapClick: (point: [number, number]) => void
  onCloseDrawing: () => void
  onBearingChange: (bearingDeg: number) => void
  onPitchChange: (pitchDeg: number) => void
  onGeometryDragStateChange: (dragging: boolean) => void
  mapNavigationTarget: {
    id: number
    lon: number
    lat: number
  } | null
  onPlaceSearchSelect: (result: PlaceSearchResult) => void
  onInitialized?: () => void
}

export function MapView({
  footprints,
  activeFootprint,
  selectedFootprintIds,
  drawDraft,
  isDrawing,
  orbitEnabled,
  onToggleOrbit,
  sunProjectionResult,
  roofMeshes,
  vertexConstraints,
  selectedVertexIndex,
  selectedEdgeIndex,
  onSelectVertex,
  onSelectEdge,
  onSelectFootprint,
  onClearSelection,
  onMoveVertex,
  onMoveEdge,
  onMoveRejected,
  onAdjustHeight,
  showSolveHint,
  onMapClick,
  onCloseDrawing,
  onBearingChange,
  onPitchChange,
  onGeometryDragStateChange,
  mapNavigationTarget,
  onPlaceSearchSelect,
  onInitialized,
}: MapViewProps) {
  const [meshesVisible, setMeshesVisible] = useState(false)
  const [sunPerspectiveEnabled, setSunPerspectiveEnabled] = useState(false)
  const [drawLengthInput, setDrawLengthInput] = useState('')
  const [constrainedDrawLengthM, setConstrainedDrawLengthM] = useState<number | null>(null)
  const effectiveDrawLengthInput = isDrawing ? drawLengthInput : ''
  const effectiveConstrainedDrawLengthM = isDrawing ? constrainedDrawLengthM : null
  const canUseSunPerspective = orbitEnabled && sunProjectionResult !== null
  const effectiveSunPerspectiveEnabled = canUseSunPerspective && sunPerspectiveEnabled

  const parseDrawLengthInput = useCallback(() => {
    const trimmed = drawLengthInput.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [drawLengthInput])

  const commitDrawLengthInput = useCallback(() => {
    const parsed = parseDrawLengthInput()
    setConstrainedDrawLengthM(parsed)
    return parsed
  }, [parseDrawLengthInput])

  const drawingRef = useLatest(isDrawing)
  const drawDraftRef = useLatest(drawDraft)
  const orbitEnabledRef = useLatest(orbitEnabled)
  const activeFootprintRef = useLatest(activeFootprint)
  const handleDrawPointCommit = useCallback(
    (point: [number, number]) => {
      onMapClick(point)
      setDrawLengthInput('')
      setConstrainedDrawLengthM(null)
    },
    [onMapClick],
  )
  const onMapClickRef = useLatest(handleDrawPointCommit)
  const onCloseDrawingRef = useLatest(onCloseDrawing)
  const onSelectVertexRef = useLatest(onSelectVertex)
  const onSelectEdgeRef = useLatest(onSelectEdge)
  const onSelectFootprintRef = useLatest(onSelectFootprint)
  const onClearSelectionRef = useLatest(onClearSelection)
  const onMoveVertexRef = useLatest(onMoveVertex)
  const onMoveEdgeRef = useLatest(onMoveEdge)
  const onMoveRejectedRef = useLatest(onMoveRejected)
  const onBearingChangeRef = useLatest(onBearingChange)
  const onPitchChangeRef = useLatest(onPitchChange)
  const onGeometryDragStateChangeRef = useLatest(onGeometryDragStateChange)
  const interactionRefs = useMemo(
    () => ({
      drawingRef,
      drawDraftRef,
      orbitEnabledRef,
      activeFootprintRef,
      onMapClickRef,
      onCloseDrawingRef,
      onSelectVertexRef,
      onSelectEdgeRef,
      onSelectFootprintRef,
      onClearSelectionRef,
      onMoveVertexRef,
      onMoveEdgeRef,
      onMoveRejectedRef,
      onBearingChangeRef,
      onPitchChangeRef,
      onGeometryDragStateChangeRef,
    }),
    [
      activeFootprintRef,
      drawDraftRef,
      drawingRef,
      onBearingChangeRef,
      onClearSelectionRef,
      onMapClickRef,
      onCloseDrawingRef,
      onMoveEdgeRef,
      onMoveRejectedRef,
      onMoveVertexRef,
      onPitchChangeRef,
      onSelectEdgeRef,
      onSelectFootprintRef,
      onSelectVertexRef,
      orbitEnabledRef,
      onGeometryDragStateChangeRef,
    ],
  )

  const { containerRef, mapRef, roofLayerRef, mapLoaded, mapError } = useMapInstance({ onInitialized })

  const { hoveredEdgeLength, drawingAngleHint, draftPreviewPoint } = useMapInteractions({
    mapRef,
    mapLoaded,
    refs: interactionRefs,
    constrainedDrawLengthM: effectiveConstrainedDrawLengthM,
  })

  useEffect(() => {
    if (!isDrawing || orbitEnabled || !drawingAngleHint) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey) {
        return
      }
      const input = document.querySelector('[data-testid="map-draw-length-input"]') as HTMLInputElement | null
      if (!input) {
        return
      }
      if (document.activeElement === input) {
        return
      }
      event.preventDefault()
      input.focus()
      input.select()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawingAngleHint, isDrawing, orbitEnabled])

  const submitDrawLengthInput = useCallback(() => {
    if (!isDrawing || !draftPreviewPoint || drawDraft.length < 1) {
      return
    }
    const parsed = commitDrawLengthInput()
    const anchor = drawDraft[drawDraft.length - 1]
    const point = parsed !== null ? pointAtDistanceMeters(anchor, draftPreviewPoint, parsed) : draftPreviewPoint
    handleDrawPointCommit(point)
  }, [commitDrawLengthInput, draftPreviewPoint, drawDraft, handleDrawPointCommit, isDrawing])

  useMapSources({
    mapRef,
    mapLoaded,
    footprints,
    activeFootprint,
    selectedFootprintIds,
    drawDraft,
    draftPreviewPoint,
    vertexConstraints,
    selectedVertexIndex,
    selectedEdgeIndex,
  })

  const { gizmoScreenPos, adjustOrbitCamera, setOrbitCameraPose } = useOrbitCamera({
    mapRef,
    mapLoaded,
    orbitEnabled,
    footprints,
    activeFootprint,
    selectedVertexIndex,
    selectedEdgeIndex,
  })

  useEffect(() => {
    roofLayerRef.current?.setMeshes(roofMeshes)
  }, [roofLayerRef, roofMeshes])

  useEffect(() => {
    roofLayerRef.current?.setVisible(orbitEnabled && meshesVisible)
  }, [meshesVisible, orbitEnabled, roofLayerRef])

  useEffect(() => {
    if (!effectiveSunPerspectiveEnabled || !sunProjectionResult) {
      return
    }

    const normalizedBearingDeg = ((sunProjectionResult.sunAzimuthDeg + 180 + 540) % 360) - 180
    const pitchDeg = 90 - sunProjectionResult.sunElevationDeg
    setOrbitCameraPose(normalizedBearingDeg, pitchDeg)
  }, [effectiveSunPerspectiveEnabled, setOrbitCameraPose, sunProjectionResult])

  useEffect(() => {
    if (!mapLoaded || !mapNavigationTarget) {
      return
    }

    const map = mapRef.current
    if (!map) {
      return
    }

    const center: [number, number] = [mapNavigationTarget.lon, mapNavigationTarget.lat]
    map.flyTo({
      center,
      zoom: Math.max(map.getZoom(), 18),
      essential: true,
    })

    const nextHash = buildHashWithMapCenter(window.location.hash, center)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`)
  }, [mapLoaded, mapNavigationTarget, mapRef])

  return (
    <div className="map-root-wrap">
      <div ref={containerRef} className="map-root" data-testid="map-canvas" />
      {mapError && (
        <div className="map-error-overlay" data-testid="map-error-overlay">
          <p className="status-error">{mapError}</p>
          <p>Fallback mode: use sidebar tools, then refresh to retry map rendering.</p>
        </div>
      )}
      <MapOverlayControls
        orbitEnabled={orbitEnabled}
        onToggleOrbit={onToggleOrbit}
        sunPerspectiveEnabled={effectiveSunPerspectiveEnabled}
        canUseSunPerspective={canUseSunPerspective}
        onToggleSunPerspective={() => {
          if (!canUseSunPerspective) {
            return
          }
          setSunPerspectiveEnabled((enabled) => !enabled)
        }}
        meshesVisible={meshesVisible}
        onToggleMeshesVisible={() => setMeshesVisible((visible) => !visible)}
        roofMeshesCount={roofMeshes.length}
        isDrawing={isDrawing}
        hasActiveFootprint={activeFootprint !== null}
        hoveredEdgeLength={hoveredEdgeLength}
        drawingAngleHint={drawingAngleHint}
        drawLengthInput={effectiveDrawLengthInput}
        onDrawLengthInputChange={setDrawLengthInput}
        onDrawLengthInputSubmit={submitDrawLengthInput}
        gizmoScreenPos={gizmoScreenPos}
        onAdjustHeight={onAdjustHeight}
        showSolveHint={showSolveHint}
        onAdjustOrbitCamera={adjustOrbitCamera}
        onPlaceSearchSelect={onPlaceSearchSelect}
      />
    </div>
  )
}
