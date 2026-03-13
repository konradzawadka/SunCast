import { useEffect, useMemo, type RefObject } from 'react'
import type { RoofMeshData, ObstacleMeshData } from '../../../../../types/geometry'
import type { ShadeHeatmapFeature } from '../../../../analysis/analysis.types'
import { buildObstacleLayerGeometry, buildRoofLayerGeometry } from '../roof-layer/layerGeometryAdapters'
import type { WorldMeshLayer } from '../roof-layer/RoofMeshLayer'

interface HeatmapLayerBridge {
  setRoofMeshes: (meshes: RoofMeshData[]) => void
  setHeatmapFeatures: (features: ShadeHeatmapFeature[]) => void
  setVisible: (visible: boolean) => void
}

interface UseMapLayerSyncArgs {
  mapLoaded: boolean
  roofLayerRef: RefObject<WorldMeshLayer | null>
  obstacleLayerRef: RefObject<WorldMeshLayer | null>
  heatmapLayerRef: RefObject<HeatmapLayerBridge | null>
  roofMeshes: RoofMeshData[]
  obstacleMeshes: ObstacleMeshData[]
  heatmapFeatures: ShadeHeatmapFeature[]
  orbitEnabled: boolean
  meshesVisible: boolean
  shadingEnabled: boolean
  shadingComputeState: 'IDLE' | 'SCHEDULED' | 'READY'
}

export function useMapLayerSync({
  mapLoaded,
  roofLayerRef,
  obstacleLayerRef,
  heatmapLayerRef,
  roofMeshes,
  obstacleMeshes,
  heatmapFeatures,
  orbitEnabled,
  meshesVisible,
  shadingEnabled,
  shadingComputeState,
}: UseMapLayerSyncArgs): void {
  const roofGeometry = useMemo(() => buildRoofLayerGeometry(roofMeshes, 1), [roofMeshes])
  const obstacleGeometry = useMemo(() => buildObstacleLayerGeometry(obstacleMeshes, 1), [obstacleMeshes])
  const heatmapVisible = orbitEnabled && shadingEnabled && shadingComputeState === 'READY'
  const meshLayersVisible = orbitEnabled && meshesVisible

  useEffect(() => {
    if (!mapLoaded) {
      return
    }
    roofLayerRef.current?.setGeometry(roofGeometry)
  }, [mapLoaded, roofGeometry, roofLayerRef])

  useEffect(() => {
    if (!mapLoaded) {
      return
    }
    obstacleLayerRef.current?.setGeometry(obstacleGeometry)
  }, [mapLoaded, obstacleGeometry, obstacleLayerRef])

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
    heatmapLayerRef.current?.setHeatmapFeatures(heatmapFeatures)
  }, [heatmapFeatures, heatmapLayerRef, mapLoaded])

  useEffect(() => {
    if (!mapLoaded) {
      return
    }
    roofLayerRef.current?.setVisible(meshLayersVisible)
    obstacleLayerRef.current?.setVisible(meshLayersVisible)
    heatmapLayerRef.current?.setVisible(heatmapVisible)
  }, [heatmapLayerRef, heatmapVisible, mapLoaded, meshLayersVisible, obstacleLayerRef, roofLayerRef])
}
