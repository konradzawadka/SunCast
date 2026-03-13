export const SATELLITE_TILES =
  'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export const ORBIT_PITCH_DEG = 60
export const ORBIT_BEARING_DEG = -20
export const MAX_ORBIT_PITCH_DEG = 85
export const AUTO_FOCUS_MAX_ZOOM = 19

export const CLICK_HIT_TOLERANCE_PX = 10
export const DRAG_HIT_TOLERANCE_PX = 12
export const DRAW_CLOSE_SNAP_TOLERANCE_PX = 16
export const ORBIT_STEER_BEARING_PER_PIXEL_DEG = 0.35
export const ORBIT_STEER_PITCH_PER_PIXEL_DEG = 0.2

export const FOOTPRINT_HIT_LAYER_ID = 'footprints-hit'
export const EDGE_HIT_LAYER_ID = 'active-footprint-edge-hit'
export const VERTEX_HIT_LAYER_ID = 'active-footprint-vertex-hit'
export const OBSTACLE_HIT_LAYER_ID = 'obstacles-hit'
export const OBSTACLE_VERTEX_HIT_LAYER_ID = 'active-obstacle-vertex-hit'
export const OBSTACLE_EDGE_HIT_LAYER_ID = 'active-obstacle-edge-hit'

export const FOOTPRINTS_SOURCE_ID = 'footprints'
export const ACTIVE_EDGES_SOURCE_ID = 'active-footprint-edges'
export const ACTIVE_VERTICES_SOURCE_ID = 'active-footprint-vertices'
export const ACTIVE_EDGE_LABELS_SOURCE_ID = 'active-footprint-edge-labels'
export const OBSTACLES_SOURCE_ID = 'obstacles'
export const ACTIVE_OBSTACLE_VERTICES_SOURCE_ID = 'active-obstacle-vertices'
export const ACTIVE_OBSTACLE_EDGES_SOURCE_ID = 'active-obstacle-edges'
export const DRAFT_SOURCE_ID = 'draft'

export const HEIGHT_STEP_M = 0.1
export const HEIGHT_STEP_SHIFT_M = 1

const HIGH_ZOOM_TOLERANCE_START = 19
const HIGH_ZOOM_TOLERANCE_END = 21
const HIGH_ZOOM_TOLERANCE_SCALE = 0.5
const MIN_HIT_TOLERANCE_PX = 5

// Purpose: Computes edit hit tolerance in pixels from base tolerance and zoom level.
// Why: Keeps sub-meter editing accurate at high zoom while preserving usability at lower zoom.
export function zoomAdaptiveHitTolerancePx(baseTolerancePx: number, zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= HIGH_ZOOM_TOLERANCE_START) {
    return baseTolerancePx
  }

  const clampedZoom = Math.min(HIGH_ZOOM_TOLERANCE_END, zoom)
  const progress = (clampedZoom - HIGH_ZOOM_TOLERANCE_START) / (HIGH_ZOOM_TOLERANCE_END - HIGH_ZOOM_TOLERANCE_START)
  const scale = 1 - (1 - HIGH_ZOOM_TOLERANCE_SCALE) * progress
  return Math.max(MIN_HIT_TOLERANCE_PX, Math.round(baseTolerancePx * scale))
}
