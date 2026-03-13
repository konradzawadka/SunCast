import * as THREE from 'three'
import type { RoofMeshData } from '../../types/geometry'
import type { ShadeHeatmapFeature } from '../../app/analysis/analysis.types'
import {
  buildRoofHeatmapOverlayGeometry,
  type RoofHeatmapOverlayGeometry,
} from '../../app/features/map-editor/MapView/roof-layer/roofHeatmapOverlay'

export function toThreeHeatmapGeometry(data: RoofHeatmapOverlayGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))
  return geometry
}

export function buildHeatmapGeometry(
  roofMeshes: RoofMeshData[],
  features: ShadeHeatmapFeature[],
  zExaggeration: number,
): { geometry: THREE.BufferGeometry; anchorX: number; anchorY: number } | null {
  const overlay = buildRoofHeatmapOverlayGeometry(roofMeshes, features, zExaggeration)
  if (!overlay) {
    return null
  }
  return { geometry: toThreeHeatmapGeometry(overlay), anchorX: overlay.anchorX, anchorY: overlay.anchorY }
}

export function clearHeatmapGroup(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[group.children.length - 1]
    group.remove(child)
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
    }
  }
}
