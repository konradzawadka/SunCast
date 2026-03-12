import { useEffect, useRef, useState, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import { RoofMeshLayer } from '../../../../rendering/roof-layer/RoofMeshLayer'
import { MAX_ORBIT_PITCH_DEG } from './mapViewConstants'
import { createMapStyle } from './createMapStyle'
import { parseMapCenterFromHash } from './mapCenterFromHash'
import { useLatest } from './useLatest'

interface UseMapInstanceArgs {
  onInitialized?: () => void
}

interface UseMapInstanceResult {
  containerRef: RefObject<HTMLDivElement | null>
  mapRef: RefObject<maplibregl.Map | null>
  roofLayerRef: RefObject<RoofMeshLayer | null>
  obstacleLayerRef: RefObject<RoofMeshLayer | null>
  mapLoaded: boolean
  mapError: string | null
}

export function useMapInstance({ onInitialized }: UseMapInstanceArgs): UseMapInstanceResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const roofLayerRef = useRef<RoofMeshLayer | null>(null)
  const obstacleLayerRef = useRef<RoofMeshLayer | null>(null)
  const mapLoadedRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const onInitializedRef = useLatest(onInitialized)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const initialCenter = parseMapCenterFromHash(window.location.hash) ?? [20.8094, 52.1677]

    const map = new maplibregl.Map({
      container: containerRef.current,
      canvasContextAttributes: {
        antialias: true,
      },
      style: createMapStyle(),
      center: initialCenter,
      zoom: 18,
      pitch: 0,
      bearing: 0,
      maxPitch: MAX_ORBIT_PITCH_DEG,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-left')

    const handleLoad = () => {
      mapLoadedRef.current = true
      setMapError(null)
      setMapLoaded(true)
      const obstacleLayer = new RoofMeshLayer('obstacle-mesh-layer', {
        topColorHex: 0x9ca3af,
        wallColorHex: 0x6b7280,
        baseColorHex: 0x4b5563,
      }, {
        top: true,
        walls: false,
        base: false,
      })
      const roofLayer = new RoofMeshLayer('roof-mesh-layer')
      obstacleLayerRef.current = obstacleLayer
      roofLayerRef.current = roofLayer
      map.addLayer(obstacleLayer)
      map.addLayer(roofLayer)
      obstacleLayer.setZExaggeration(1)
      roofLayer.setZExaggeration(1)
      onInitializedRef.current?.()
    }
    const handleError = (event: { error?: Error }) => {
      if (!mapLoadedRef.current && event.error) {
        setMapError('Map failed to load. Check connection and tile availability.')
      }
    }

    const loadTimeout = window.setTimeout(() => {
      if (!mapLoadedRef.current) {
        setMapError('Map is taking too long to load. You can continue with sidebar-only actions.')
      }
    }, 12000)

    map.on('load', handleLoad)
    map.on('error', handleError)
    mapRef.current = map

    return () => {
      window.clearTimeout(loadTimeout)
      map.off('load', handleLoad)
      map.off('error', handleError)
      map.remove()
      mapRef.current = null
      roofLayerRef.current = null
      obstacleLayerRef.current = null
      mapLoadedRef.current = false
      setMapLoaded(false)
    }
  }, [onInitializedRef])

  return { containerRef, mapRef, roofLayerRef, obstacleLayerRef, mapLoaded, mapError }
}
