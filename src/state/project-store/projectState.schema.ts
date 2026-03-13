import type { ProjectData } from '../../types/geometry'

export const PROJECT_STORAGE_SCHEMA_VERSION = 3

interface ProjectStoragePayloadV3 extends ProjectData {
  schemaVersion: 3
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readSchemaVersion(value: Record<string, unknown>): number {
  return Number.isInteger(value.schemaVersion) ? Number(value.schemaVersion) : 1
}

function toProjectData(value: Record<string, unknown>): ProjectData | null {
  const footprints = value.footprints
  if (!isRecord(footprints)) {
    return null
  }

  const activeFootprintId = value.activeFootprintId
  if (activeFootprintId !== null && activeFootprintId !== undefined && typeof activeFootprintId !== 'string') {
    return null
  }

  const solverConfigVersion =
    typeof value.solverConfigVersion === 'string' ? value.solverConfigVersion : undefined
  const obstacles = value.obstacles
  if (obstacles !== undefined && !isRecord(obstacles)) {
    return null
  }

  const activeObstacleId = value.activeObstacleId
  if (activeObstacleId !== null && activeObstacleId !== undefined && typeof activeObstacleId !== 'string') {
    return null
  }

  const sunProjectionRaw = value.sunProjection
  const sunProjection =
    isRecord(sunProjectionRaw) &&
    typeof sunProjectionRaw.enabled === 'boolean' &&
    (sunProjectionRaw.datetimeIso === null || typeof sunProjectionRaw.datetimeIso === 'string') &&
    (sunProjectionRaw.dailyDateIso === null || typeof sunProjectionRaw.dailyDateIso === 'string')
      ? {
          enabled: sunProjectionRaw.enabled,
          datetimeIso: sunProjectionRaw.datetimeIso,
          dailyDateIso: sunProjectionRaw.dailyDateIso,
        }
      : undefined
  const shadingSettingsRaw = value.shadingSettings
  const gridResolutionM = isRecord(shadingSettingsRaw) ? Number(shadingSettingsRaw.gridResolutionM) : NaN
  const shadingSettings =
    isRecord(shadingSettingsRaw) &&
    typeof shadingSettingsRaw.enabled === 'boolean' &&
    Number.isFinite(gridResolutionM)
      ? {
          enabled: shadingSettingsRaw.enabled,
          gridResolutionM,
        }
      : undefined

  return {
    footprints: footprints as ProjectData['footprints'],
    activeFootprintId: (activeFootprintId as string | null | undefined) ?? null,
    obstacles: (obstacles as ProjectData['obstacles']) ?? undefined,
    activeObstacleId: (activeObstacleId as string | null | undefined) ?? null,
    solverConfigVersion,
    sunProjection,
    shadingSettings,
  }
}

export function migrateProjectStoragePayload(
  raw: unknown,
  currentSolverConfigVersion: string,
): ProjectStoragePayloadV3 | null {
  if (!isRecord(raw)) {
    return null
  }

  const schemaVersion = readSchemaVersion(raw)
  if (schemaVersion > PROJECT_STORAGE_SCHEMA_VERSION) {
    return null
  }

  const projectData = toProjectData(raw)
  if (!projectData) {
    return null
  }

  const sourceSolverVersion = projectData.solverConfigVersion
  const solverConfigVersion =
    sourceSolverVersion && sourceSolverVersion.trim().length > 0
      ? sourceSolverVersion
      : currentSolverConfigVersion

  return {
    schemaVersion: PROJECT_STORAGE_SCHEMA_VERSION,
    footprints: projectData.footprints,
    activeFootprintId: projectData.activeFootprintId,
    obstacles: projectData.obstacles,
    activeObstacleId: projectData.activeObstacleId,
    solverConfigVersion,
    sunProjection: projectData.sunProjection,
    shadingSettings: projectData.shadingSettings,
  }
}

export function createProjectStoragePayload(
  data: ProjectData,
  currentSolverConfigVersion: string,
): ProjectStoragePayloadV3 {
  return {
    schemaVersion: PROJECT_STORAGE_SCHEMA_VERSION,
    footprints: data.footprints,
    activeFootprintId: data.activeFootprintId,
    obstacles: data.obstacles,
    activeObstacleId: data.activeObstacleId,
    solverConfigVersion: currentSolverConfigVersion,
    sunProjection: data.sunProjection,
    shadingSettings: data.shadingSettings,
  }
}
