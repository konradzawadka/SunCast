import type { ProjectData, ProjectSunProjectionSettings, ShadingSettings } from '../../types/geometry'
import { fromStoredFootprint, toStoredFootprint } from './projectState.mappers'
import { createProjectStoragePayload, migrateProjectStoragePayload } from './projectState.schema'
import type { ProjectState } from './projectState.types'

const STORAGE_KEY = 'suncast_project'

function normalizeStoredObstacles(
  obstacles: ProjectData['obstacles'] | undefined,
): NonNullable<ProjectData['obstacles']> {
  if (!obstacles) {
    return {}
  }

  const entries = Object.values(obstacles).filter(
    (obstacle): obstacle is NonNullable<ProjectData['obstacles']>[string] =>
      Boolean(obstacle) &&
      typeof obstacle.id === 'string' &&
      Array.isArray(obstacle.polygon) &&
      Number.isFinite(obstacle.heightAboveGroundM),
  )

  return Object.fromEntries(entries.map((obstacle) => [obstacle.id, obstacle]))
}

export function readStorage(
  defaultSunProjection: ProjectSunProjectionSettings,
  defaultShadingSettings: ShadingSettings,
  defaultFootprintKwp: number,
  currentSolverConfigVersion: string,
): ProjectState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const migrated = migrateProjectStoragePayload(parsed, currentSolverConfigVersion)
    if (!migrated) {
      return null
    }

    const entries = Object.values(migrated.footprints ?? {})
    const footprints = Object.fromEntries(
      entries.map((entry) => [entry.id, fromStoredFootprint(entry, defaultFootprintKwp)]),
    )
    const obstacles = normalizeStoredObstacles(migrated.obstacles)

    return {
      footprints,
      activeFootprintId: migrated.activeFootprintId ?? null,
      selectedFootprintIds: [],
      drawDraft: [],
      isDrawing: false,
      obstacles,
      activeObstacleId: migrated.activeObstacleId && obstacles[migrated.activeObstacleId] ? migrated.activeObstacleId : null,
      selectedObstacleIds: [],
      obstacleDrawDraft: [],
      isDrawingObstacle: false,
      sunProjection: {
        enabled: migrated.sunProjection?.enabled ?? defaultSunProjection.enabled,
        datetimeIso: migrated.sunProjection?.datetimeIso ?? defaultSunProjection.datetimeIso,
        dailyDateIso: migrated.sunProjection?.dailyDateIso ?? defaultSunProjection.dailyDateIso,
      },
      shadingSettings: {
        enabled: migrated.shadingSettings?.enabled ?? defaultShadingSettings.enabled,
        gridResolutionM: migrated.shadingSettings?.gridResolutionM ?? defaultShadingSettings.gridResolutionM,
      },
    }
  } catch {
    return null
  }
}

export function writeStorage(
  state: Pick<
    ProjectState,
    'footprints' | 'activeFootprintId' | 'obstacles' | 'activeObstacleId' | 'sunProjection' | 'shadingSettings'
  >,
  currentSolverConfigVersion: string,
  defaultFootprintKwp: number,
): void {
  const footprints = Object.fromEntries(
    Object.entries(state.footprints).map(([id, entry]) => [id, toStoredFootprint(entry, defaultFootprintKwp)]),
  )

  const data: ProjectData = {
    footprints,
    activeFootprintId: state.activeFootprintId,
    obstacles: state.obstacles,
    activeObstacleId: state.activeObstacleId,
    solverConfigVersion: currentSolverConfigVersion,
    sunProjection: state.sunProjection,
    shadingSettings: state.shadingSettings,
  }

  const payload = createProjectStoragePayload(data, currentSolverConfigVersion)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
