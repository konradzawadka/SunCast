import type maplibregl from 'maplibre-gl'
import * as THREE from 'three'

interface RendererRef {
  renderer: THREE.WebGLRenderer
  refCount: number
}

const rendererByContext = new WeakMap<WebGLRenderingContext | WebGL2RenderingContext, RendererRef>()

export function acquireSharedThreeRenderer(
  map: maplibregl.Map,
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): THREE.WebGLRenderer {
  const existing = rendererByContext.get(gl)
  if (existing) {
    existing.refCount += 1
    return existing.renderer
  }

  const renderer = new THREE.WebGLRenderer({
    canvas: map.getCanvas(),
    context: gl,
    antialias: true,
    alpha: true,
  })
  renderer.autoClear = false
  rendererByContext.set(gl, { renderer, refCount: 1 })
  return renderer
}

export function releaseSharedThreeRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  const existing = rendererByContext.get(gl)
  if (!existing) {
    return
  }

  existing.refCount -= 1
  if (existing.refCount <= 0) {
    existing.renderer.dispose()
    rendererByContext.delete(gl)
  }
}
