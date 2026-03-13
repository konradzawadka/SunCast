import type { WorldMeshGeometry, WorldPoint } from './meshWorldGeometry'

export interface LayerAnchor {
  x: number
  y: number
}

// Purpose: Resolves layer anchor from the provided geometries.
// Why: Keeps per-layer coordinates near zero to improve numeric stability.
export function resolveLayerAnchor(geometry: Array<Pick<WorldMeshGeometry, 'anchorX' | 'anchorY'>>): LayerAnchor {
  if (geometry.length === 0) {
    return { x: 0, y: 0 }
  }

  let sumX = 0
  let sumY = 0
  for (const entry of geometry) {
    sumX += entry.anchorX
    sumY += entry.anchorY
  }

  return {
    x: sumX / geometry.length,
    y: sumY / geometry.length,
  }
}

// Purpose: Converts anchored world point to layer-relative coordinate.
// Why: Avoids adding large world anchors per-vertex in GPU object transforms.
export function toLayerRelativePoint(
  worldAnchorX: number,
  worldAnchorY: number,
  point: WorldPoint,
  layerAnchor: LayerAnchor,
): WorldPoint {
  return {
    x: worldAnchorX + point.x - layerAnchor.x,
    y: worldAnchorY + point.y - layerAnchor.y,
    z: point.z,
  }
}
