export { computeRoofShadeGrid } from './computeRoofShadeGrid'
export { prepareShadingScene } from './prepareShadingScene'
export { computeShadeSnapshot } from './computeShadeSnapshot'
export { computeAnnualSunAccess } from './annualSunAccess'
export { computeAnnualSunAccessBatched } from './annualSunAccess'
export { normalizeObstaclesToPrisms, createPrismTriangles } from './obstacleVolumes'
export { intersectRayPrism } from './rayCasting'
export { buildRoofSurfaceFromLocalVertices, pointInPolygon, sampleRoofGrid } from './roofSampling'
export { isPointShaded } from './shadeAtPoint'
export {
  bboxesIntersect,
  bboxFromPoints,
  computeMaxShadowDistanceM,
  expandBbox,
  sunDirectionFromAzimuthElevation,
} from './shadowProjection'
export type {
  AnnualSunAccessHeatmapCell,
  AnnualSunAccessInput,
  AnnualSunAccessProgress,
  AnnualSunAccessResult,
  AnnualSunAccessRoofResult,
  BBox2,
  ComputeShadeSnapshotInput,
  ComputeShadeSnapshotResult,
  ComputeRoofShadeGridInput,
  ComputeRoofShadeGridResult,
  ObstaclePrism,
  PreparedShadingRoof,
  PreparedShadingScene,
  PrepareShadingSceneInput,
  RoofSamplePoint,
  RoofShadeCell,
  RoofShadeDiagnostics,
  RoofShadeResult,
  RoofShadeSnapshotResult,
  ShadingObstacleInput,
  ShadingRoofInput,
  SunDirection,
} from './types'
