import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FootprintPolygon, ObstacleStateEntry, RoofMeshData, VertexHeightConstraint } from '../../../../types/geometry'
import type { SunProjectionResult } from '../../../../geometry/sun/sunProjection'
import type { RoofShadingComputeState, ShadeHeatmapFeature } from '../../../hooks/useRoofShading'
import { MapOverlayControls } from './MapOverlayControls'
import { buildHashWithMapCenter } from './mapCenterFromHash'
import { useLatest } from './useLatest'
import { useMapInstance } from './useMapInstance'
import { useMapInteractions } from './useMapInteractions'
import { useMapSources } from './useMapSources'
import { useOrbitCamera } from './useOrbitCamera'
import type { PlaceSearchResult } from '../../place-search/placeSearch.types'
import { pointAtDistanceMeters } from './drawingAssist'
import { buildObstacleLayerGeometry, buildRoofLayerGeometry } from '../../../../rendering/roof-layer/layerGeometryAdapters'

interface MapViewProps {
  editMode: 'roof' | 'obstacle'
  footprints: FootprintPolygon[]
  activeFootprint: FootprintPolygon | null
  selectedFootprintIds: string[]
  drawDraftRoof: Array<[number, number]>
  isDrawingRoof: boolean
  obstacles: ObstacleStateEntry[]
  activeObstacle: ObstacleStateEntry | null
  selectedObstacleIds: string[]
  drawDraftObstacle: Array<[number, number]>
  isDrawingObstacle: boolean
  orbitEnabled: boolean
  onToggleOrbit: () => void
  sunProjectionResult: SunProjectionResult | null
  shadingEnabled: boolean
  shadingHeatmapFeatures: ShadeHeatmapFeature[]
  shadingComputeState: RoofShadingComputeState
  roofMeshes: RoofMeshData[]
  obstacleMeshes: RoofMeshData[]
  vertexConstraints: VertexHeightConstraint[]
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  onSelectVertex: (vertexIndex: number) => void
  onSelectEdge: (edgeIndex: number) => void
  onSelectFootprint: (footprintId: string, multiSelect: boolean) => void
  onSelectObstacle: (obstacleId: string, multiSelect: boolean) => void
  onClearSelection: () => void
  onMoveVertex: (vertexIndex: number, point: [number, number]) => boolean
  onMoveEdge: (edgeIndex: number, delta: [number, number]) => boolean
  onMoveObstacleVertex: (obstacleId: string, vertexIndex: number, point: [number, number]) => boolean
  onMoveRejected: () => void
  onAdjustHeight: (stepM: number) => void
  showSolveHint: boolean
  onMapClick: (point: [number, number]) => void
  onCloseDrawing: () => void
  onObstacleMapClick: (point: [number, number]) => void
  onCloseObstacleDrawing: () => void
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
  editMode,
  footprints,
  activeFootprint,
  selectedFootprintIds,
  drawDraftRoof,
  isDrawingRoof,
  obstacles,
  activeObstacle,
  selectedObstacleIds,
  drawDraftObstacle,
  isDrawingObstacle,
  orbitEnabled,
  onToggleOrbit,
  sunProjectionResult,
  shadingEnabled,
  shadingHeatmapFeatures,
  shadingComputeState,
  roofMeshes,
  obstacleMeshes,
  vertexConstraints,
  selectedVertexIndex,
  selectedEdgeIndex,
  onSelectVertex,
  onSelectEdge,
  onSelectFootprint,
  onSelectObstacle,
  onClearSelection,
  onMoveVertex,
  onMoveEdge,
  onMoveObstacleVertex,
  onMoveRejected,
  onAdjustHeight,
  showSolveHint,
  onMapClick,
  onCloseDrawing,
  onObstacleMapClick,
  onCloseObstacleDrawing,
  onBearingChange,
  onPitchChange,
  onGeometryDragStateChange,
  mapNavigationTarget,
  onPlaceSearchSelect,
  onInitialized,
}: MapViewProps) {
  const isDrawing = editMode === 'roof' ? isDrawingRoof : isDrawingObstacle
  const drawDraft = editMode === 'roof' ? drawDraftRoof : drawDraftObstacle
  const [meshesVisible, setMeshesVisible] = useState(true)
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
  const editModeRef = useLatest(editMode)
  const orbitEnabledRef = useLatest(orbitEnabled)
  const activeFootprintRef = useLatest(activeFootprint)
  const activeObstacleRef = useLatest(activeObstacle)
  const handleDrawPointCommit = useCallback(
    (point: [number, number]) => {
      if (editMode === 'obstacle') {
        onObstacleMapClick(point)
      } else {
        onMapClick(point)
      }
      setDrawLengthInput('')
      setConstrainedDrawLengthM(null)
    },
    [editMode, onMapClick, onObstacleMapClick],
  )
  const onMapClickRef = useLatest(handleDrawPointCommit)
  const onCloseDrawingRef = useLatest(() => {
    if (editMode === 'obstacle') {
      onCloseObstacleDrawing()
    } else {
      onCloseDrawing()
    }
  })
  const onSelectVertexRef = useLatest(onSelectVertex)
  const onSelectEdgeRef = useLatest(onSelectEdge)
  const onSelectFootprintRef = useLatest(onSelectFootprint)
  const onSelectObstacleRef = useLatest(onSelectObstacle)
  const onClearSelectionRef = useLatest(onClearSelection)
  const onMoveVertexRef = useLatest(onMoveVertex)
  const onMoveEdgeRef = useLatest(onMoveEdge)
  const onMoveObstacleVertexRef = useLatest(onMoveObstacleVertex)
  const onMoveRejectedRef = useLatest(onMoveRejected)
  const onBearingChangeRef = useLatest(onBearingChange)
  const onPitchChangeRef = useLatest(onPitchChange)
  const onGeometryDragStateChangeRef = useLatest(onGeometryDragStateChange)
  const interactionRefs = useMemo(
    () => ({
      drawingRef,
      drawDraftRef,
      editModeRef,
      orbitEnabledRef,
      activeFootprintRef,
      activeObstacleRef,
      onMapClickRef,
      onCloseDrawingRef,
      onSelectVertexRef,
      onSelectEdgeRef,
      onSelectFootprintRef,
      onSelectObstacleRef,
      onClearSelectionRef,
      onMoveVertexRef,
      onMoveEdgeRef,
      onMoveObstacleVertexRef,
      onMoveRejectedRef,
      onBearingChangeRef,
      onPitchChangeRef,
      onGeometryDragStateChangeRef,
    }),
    [
      activeFootprintRef,
      activeObstacleRef,
      drawDraftRef,
      drawingRef,
      editModeRef,
      onBearingChangeRef,
      onClearSelectionRef,
      onMapClickRef,
      onCloseDrawingRef,
      onMoveEdgeRef,
      onMoveObstacleVertexRef,
      onMoveRejectedRef,
      onMoveVertexRef,
      onPitchChangeRef,
      onSelectEdgeRef,
      onSelectFootprintRef,
      onSelectObstacleRef,
      onSelectVertexRef,
      orbitEnabledRef,
      onGeometryDragStateChangeRef,
    ],
  )

  const { containerRef, mapRef, roofLayerRef, obstacleLayerRef, heatmapLayerRef, mapLoaded, mapError } = useMapInstance({
    onInitialized,
  })

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
    if (!mapLoaded) {
      return
    }
    roofLayerRef.current?.setGeometry(buildRoofLayerGeometry(roofMeshes, 1))
  }, [mapLoaded, roofLayerRef, roofMeshes])

  useEffect(() => {
    if (!mapLoaded) {
      return
    }
    obstacleLayerRef.current?.setGeometry(buildObstacleLayerGeometry(obstacleMeshes, 1))
  }, [mapLoaded, obstacleLayerRef, obstacleMeshes])

  useEffect(() => {
    if (!mapLoaded) {
      return
    }
    heatmapLayerRef.current?.setRoofMeshes(roofMeshes)
  }, [heatmapLayerRef, mapLoaded, roofMeshes])

  useEffect(() => {
    if (!mapLoaded) {
      return
    }
    heatmapLayerRef.current?.setHeatmapFeatures(shadingHeatmapFeatures)
  }, [heatmapLayerRef, mapLoaded, shadingHeatmapFeatures])

  useEffect(() => {
    if (!mapLoaded) {
      return
    }
    roofLayerRef.current?.setVisible(orbitEnabled && meshesVisible)
    obstacleLayerRef.current?.setVisible(orbitEnabled && meshesVisible)
    heatmapLayerRef.current?.setVisible(orbitEnabled && shadingEnabled && shadingComputeState === 'READY')
  }, [
    heatmapLayerRef,
    mapLoaded,
    meshesVisible,
    orbitEnabled,
    roofLayerRef,
    obstacleLayerRef,
    shadingComputeState,
    shadingEnabled,
  ])

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
        meshCount={roofMeshes.length + obstacleMeshes.length}
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
