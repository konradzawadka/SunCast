import { useEffect, useRef, useState, type RefObject } from 'react'
import type maplibregl from 'maplibre-gl'
import { createMapRuntime, startLoadTimeout } from '../../../../../adapters/map-runtime/mapRuntime'
import { RoofHeatmapLayer } from '../../../../../rendering/roof-layer/RoofHeatmapLayer'
import { buildHeatmapGeometry } from '../../../../../rendering/roof-layer/heatmapGeometry'
import { WorldMeshLayer } from '../roof-layer/RoofMeshLayer'
import { MAX_ORBIT_PITCH_DEG } from '../mapViewConstants'
import { createMapStyle } from '../createMapStyle'
import { parseMapCenterFromHash } from '../mapCenterFromHash'
import { useLatest } from '../useLatest'
import { reportAppErrorCode } from '../../../../../shared/errors'

interface UseMapInstanceArgs {
  onInitialized?: () => void
}

interface UseMapInstanceResult {
  containerRef: RefObject<HTMLDivElement | null>
  mapRef: RefObject<maplibregl.Map | null>
  roofLayerRef: RefObject<WorldMeshLayer | null>
  obstacleLayerRef: RefObject<WorldMeshLayer | null>
  heatmapLayerRef: RefObject<RoofHeatmapLayer | null>
  mapLoaded: boolean
}

export { buildHeatmapGeometry }

export function useMapInstance({ onInitialized }: UseMapInstanceArgs): UseMapInstanceResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const roofLayerRef = useRef<WorldMeshLayer | null>(null)
  const obstacleLayerRef = useRef<WorldMeshLayer | null>(null)
  const heatmapLayerRef = useRef<RoofHeatmapLayer | null>(null)
  const mapLoadedRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const hasReportedMapInitErrorRef = useRef(false)
  const onInitializedRef = useLatest(onInitialized)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const initialCenter = parseMapCenterFromHash(window.location.hash) ?? [20.8094, 52.1677]

    const runtime = createMapRuntime({
      container: containerRef.current,
      style: createMapStyle(),
      center: initialCenter,
      maxPitchDeg: MAX_ORBIT_PITCH_DEG,
    })

    const { map } = runtime

    const handleLoad = () => {
      mapLoadedRef.current = true
      setMapLoaded(true)
      const obstacleLayer = new WorldMeshLayer(
        'obstacle-mesh-layer',
        {
          topColorHex: 0x9ca3af,
          wallColorHex: 0x6b7280,
          baseColorHex: 0x4b5563,
        },
        {
          top: true,
          walls: true,
          base: false,
        },
      )
      const roofLayer = new WorldMeshLayer(
        'roof-mesh-layer',
        {},
        {
          top: true,
          walls: false,
          base: false,
        },
      )
      const heatmapLayer = new RoofHeatmapLayer('roof-heatmap-layer')
      obstacleLayerRef.current = obstacleLayer
      roofLayerRef.current = roofLayer
      heatmapLayerRef.current = heatmapLayer

      map.addLayer(roofLayer)
      map.addLayer(heatmapLayer)
      map.addLayer(obstacleLayer)
      obstacleLayer.setZExaggeration(1)
      roofLayer.setZExaggeration(1)
      heatmapLayer.setZExaggeration(1)
      onInitializedRef.current?.()
    }

    const handleError = (event: { error?: Error }) => {
      if (!mapLoadedRef.current && event.error) {
        if (!hasReportedMapInitErrorRef.current) {
          hasReportedMapInitErrorRef.current = true
          reportAppErrorCode('MAP_INIT_FAILED', 'Map failed to load.', {
            cause: event.error,
            context: { area: 'map-view', reason: 'maplibre-load-error', enableStateReset: true },
          })
        }
      }
    }

    const stopLoadTimeout = startLoadTimeout(12000, () => {
      if (!mapLoadedRef.current) {
        if (!hasReportedMapInitErrorRef.current) {
          hasReportedMapInitErrorRef.current = true
          reportAppErrorCode('MAP_INIT_FAILED', 'Map load timed out.', {
            context: { area: 'map-view', reason: 'maplibre-load-timeout', enableStateReset: true },
          })
        }
      }
    })

    map.on('load', handleLoad)
    map.on('error', handleError)
    mapRef.current = map

    return () => {
      stopLoadTimeout()
      map.off('load', handleLoad)
      map.off('error', handleError)
      runtime.dispose()
      mapRef.current = null
      roofLayerRef.current = null
      obstacleLayerRef.current = null
      heatmapLayerRef.current = null
      mapLoadedRef.current = false
      setMapLoaded(false)
      hasReportedMapInitErrorRef.current = false
    }
  }, [onInitializedRef])

  return { containerRef, mapRef, roofLayerRef, obstacleLayerRef, heatmapLayerRef, mapLoaded }
}
