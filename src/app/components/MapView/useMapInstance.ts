import { useEffect, useRef, useState, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import { RoofMeshLayer } from '../../../rendering/roof-layer/RoofMeshLayer'
import { MAX_ORBIT_PITCH_DEG } from './mapViewConstants'
import { createMapStyle } from './createMapStyle'
import { useLatest } from './useLatest'

interface UseMapInstanceArgs {
  onInitialized?: () => void
}

interface UseMapInstanceResult {
  containerRef: RefObject<HTMLDivElement | null>
  mapRef: RefObject<maplibregl.Map | null>
  roofLayerRef: RefObject<RoofMeshLayer | null>
  mapLoaded: boolean
}

export function useMapInstance({ onInitialized }: UseMapInstanceArgs): UseMapInstanceResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const roofLayerRef = useRef<RoofMeshLayer | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const onInitializedRef = useLatest(onInitialized)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      canvasContextAttributes: {
        antialias: true,
      },
      style: createMapStyle(),
      center: [-73.989, 40.733],
      zoom: 18,
      pitch: 0,
      bearing: 0,
      maxPitch: MAX_ORBIT_PITCH_DEG,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    const handleLoad = () => {
      setMapLoaded(true)
      const roofLayer = new RoofMeshLayer('roof-mesh-layer')
      roofLayerRef.current = roofLayer
      map.addLayer(roofLayer)
      roofLayer.setZExaggeration(1)
      onInitializedRef.current?.()
    }

    map.on('load', handleLoad)
    mapRef.current = map

    return () => {
      map.off('load', handleLoad)
      map.remove()
      mapRef.current = null
      roofLayerRef.current = null
      setMapLoaded(false)
    }
  }, [onInitializedRef])

  return { containerRef, mapRef, roofLayerRef, mapLoaded }
}
