import type { ProjectData, ProjectSunProjectionSettings } from '../../types/geometry'
import { fromStoredFootprint, toStoredFootprint } from './projectState.mappers'
import { createProjectStoragePayload, migrateProjectStoragePayload } from './projectState.schema'
import type { ProjectState } from './projectState.types'

const STORAGE_KEY = 'suncast_project'

export function readStorage(
  defaultSunProjection: ProjectSunProjectionSettings,
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

    return {
      footprints,
      activeFootprintId: migrated.activeFootprintId ?? null,
      selectedFootprintIds: [],
      drawDraft: [],
      isDrawing: false,
      sunProjection: {
        enabled: migrated.sunProjection?.enabled ?? defaultSunProjection.enabled,
        datetimeIso: migrated.sunProjection?.datetimeIso ?? defaultSunProjection.datetimeIso,
        dailyDateIso: migrated.sunProjection?.dailyDateIso ?? defaultSunProjection.dailyDateIso,
      },
    }
  } catch {
    return null
  }
}

export function writeStorage(
  state: Pick<ProjectState, 'footprints' | 'activeFootprintId' | 'sunProjection'>,
  currentSolverConfigVersion: string,
  defaultFootprintKwp: number,
): void {
  const footprints = Object.fromEntries(
    Object.entries(state.footprints).map(([id, entry]) => [id, toStoredFootprint(entry, defaultFootprintKwp)]),
  )

  const data: ProjectData = {
    footprints,
    activeFootprintId: state.activeFootprintId,
    solverConfigVersion: currentSolverConfigVersion,
    sunProjection: state.sunProjection,
  }

  const payload = createProjectStoragePayload(data, currentSolverConfigVersion)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
