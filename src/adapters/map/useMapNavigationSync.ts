import { useEffect, type RefObject } from 'react'
import maplibregl from 'maplibre-gl'
import { buildHashWithMapCenter } from '../../app/features/map-editor/MapView/mapCenterFromHash'

interface MapNavigationTarget {
  id: number
  lon: number
  lat: number
}

interface UseMapNavigationSyncArgs {
  mapRef: RefObject<maplibregl.Map | null>
  mapLoaded: boolean
  mapNavigationTarget: MapNavigationTarget | null
}

export function useMapNavigationSync({ mapRef, mapLoaded, mapNavigationTarget }: UseMapNavigationSyncArgs): void {
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
}
