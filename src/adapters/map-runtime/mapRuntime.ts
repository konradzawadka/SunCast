import maplibregl from 'maplibre-gl'

export interface CreateMapRuntimeOptions {
  container: HTMLElement
  style: maplibregl.StyleSpecification
  center: [number, number]
  maxPitchDeg: number
}

export interface MapRuntime {
  map: maplibregl.Map
  dispose: () => void
}

export function createMapRuntime({ container, style, center, maxPitchDeg }: CreateMapRuntimeOptions): MapRuntime {
  const map = new maplibregl.Map({
    container,
    canvasContextAttributes: {
      antialias: true,
    },
    style,
    center,
    zoom: 18,
    pitch: 0,
    bearing: 0,
    maxPitch: maxPitchDeg,
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-left')

  return {
    map,
    dispose: () => map.remove(),
  }
}

export function startLoadTimeout(timeoutMs: number, onTimeout: () => void): () => void {
  const timeoutId = window.setTimeout(onTimeout, timeoutMs)
  return () => window.clearTimeout(timeoutId)
}
