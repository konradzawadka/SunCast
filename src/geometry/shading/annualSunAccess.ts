import { computeSolarPosition } from '../sun/sunPosition'
import { getSunriseSunset } from '../sun/dailyEstimation'
import { localMetersToLonLat } from '../projection/localMeters'
import { computeShadeSnapshot } from './computeShadeSnapshot'
import type { AnnualSunAccessInput, AnnualSunAccessProgress, AnnualSunAccessResult } from './types'

const MINUTES_PER_HOUR = 60
const MS_PER_MINUTE = 60_000

// Purpose: Computes format date iso utc deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
function formatDateIsoUtc(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Purpose: Computes parse date iso utc deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
function parseDateIsoUtc(dateIso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return null
  }
  const [yearRaw, monthRaw, dayRaw] = dateIso.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }
  const ts = Date.UTC(year, month - 1, day)
  if (!Number.isFinite(ts)) {
    return null
  }
  const normalized = new Date(ts)
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() + 1 !== month ||
    normalized.getUTCDate() !== day
  ) {
    return null
  }
  return ts
}

// Purpose: Returns date isos for year from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
function getDateIsosForYear(year: number): string[] {
  if (!Number.isInteger(year) || year < 1) {
    return []
  }

  const dates: string[] = []
  for (let ts = Date.UTC(year, 0, 1); ; ts += 86_400_000) {
    const date = new Date(ts)
    if (date.getUTCFullYear() !== year) {
      break
    }
    dates.push(formatDateIsoUtc(date))
  }
  return dates
}

// Purpose: Returns date isos for range from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
function getDateIsosForRange(startDateIso: string, endDateIso: string): string[] {
  const startTs = parseDateIsoUtc(startDateIso)
  const endTs = parseDateIsoUtc(endDateIso)
  if (startTs === null || endTs === null || endTs < startTs) {
    return []
  }

  const dates: string[] = []
  for (let ts = startTs; ts <= endTs; ts += 86_400_000) {
    dates.push(formatDateIsoUtc(new Date(ts)))
  }
  return dates
}

interface ResolvedSimulationDates {
  dateIsos: string[]
  dateStartIso: string
  dateEndIso: string
}

// Purpose: Returns simulation dates from available inputs.
// Why: Improves readability by isolating a single responsibility behind a named function.
function resolveSimulationDates(input: AnnualSunAccessInput): ResolvedSimulationDates | null {
  const hasExplicitRange = Boolean(input.dateStartIso) || Boolean(input.dateEndIso)
  if (hasExplicitRange) {
    if (!input.dateStartIso || !input.dateEndIso) {
      return null
    }
    const dateIsos = getDateIsosForRange(input.dateStartIso, input.dateEndIso)
    if (dateIsos.length === 0) {
      return null
    }
    return {
      dateIsos,
      dateStartIso: dateIsos[0],
      dateEndIso: dateIsos[dateIsos.length - 1],
    }
  }

  const year = Number.isInteger(input.year) ? Number(input.year) : new Date().getUTCFullYear()
  const dateIsos = getDateIsosForYear(year)
  if (dateIsos.length === 0) {
    return null
  }
  return {
    dateIsos,
    dateStartIso: dateIsos[0],
    dateEndIso: dateIsos[dateIsos.length - 1],
  }
}

interface SimulatedDay {
  dateIso: string
  windowWeight: number
}

// Purpose: Builds simulated days from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
function buildSimulatedDays(dateIsos: string[], sampleWindowDays: number, halfYearMirror: boolean): SimulatedDay[] {
  if (dateIsos.length === 0) {
    return []
  }

  const simulatedDays: SimulatedDay[] = []
  const totalDays = dateIsos.length
  const mirroredDays = halfYearMirror ? Math.ceil(totalDays / 2) : totalDays
  const centerDayIndex = Math.floor((totalDays - 1) / 2)

  for (let dayIndex = 0; dayIndex < mirroredDays; dayIndex += sampleWindowDays) {
    const daysInWindow = Math.min(sampleWindowDays, mirroredDays - dayIndex)
    if (daysInWindow <= 0) {
      continue
    }

    let windowWeight = daysInWindow
    if (halfYearMirror) {
      windowWeight *= 2
      const overlapsCenterDay =
        totalDays % 2 === 1 && dayIndex <= centerDayIndex && dayIndex + daysInWindow - 1 >= centerDayIndex
      if (overlapsCenterDay) {
        windowWeight -= 1
      }
    }

    simulatedDays.push({
      dateIso: dateIsos[dayIndex],
      windowWeight,
    })
  }

  return simulatedDays
}

interface AnnualAccumulator {
  roofAccumById: Map<
    string,
    {
      roofId: string
      sunHours: number
      daylightHours: number
      frontSideHours: number
      litCellCountWeighted: number
      totalCellCountWeighted: number
    }
  >
  cellAccumByRoof: Map<
    string,
    Array<{
      litHours: number
      daylightHours: number
      frontSideHours: number
    }>
  >
  sampledDayCount: number
}

// Purpose: Builds accumulator from the provided inputs.
// Why: Centralizes object/geometry construction and avoids duplicated assembly logic.
function createAccumulator(input: AnnualSunAccessInput): AnnualAccumulator {
  return {
    roofAccumById: new Map(
      input.scene.roofs.map((roof) => [
        roof.roofId,
        {
          roofId: roof.roofId,
          sunHours: 0,
          daylightHours: 0,
          frontSideHours: 0,
          litCellCountWeighted: 0,
          totalCellCountWeighted: 0,
        },
      ]),
    ),
    cellAccumByRoof: new Map(
      input.scene.roofs.map((roof) => [
        roof.roofId,
        roof.samples.map(() => ({
          litHours: 0,
          daylightHours: 0,
          frontSideHours: 0,
        })),
      ]),
    ),
    sampledDayCount: 0,
  }
}

// Purpose: Encapsulates process simulated day behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function processSimulatedDay(input: AnnualSunAccessInput, stepMinutes: number, simulatedDay: SimulatedDay, accum: AnnualAccumulator): void {
  const window = getSunriseSunset({
    dateIso: simulatedDay.dateIso,
    timeZone: input.timeZone,
    latDeg: input.scene.origin.lat0,
    lonDeg: input.scene.origin.lon0,
  })

  if (!window) {
    return
  }

  accum.sampledDayCount += 1
  const stepHours = stepMinutes / MINUTES_PER_HOUR
  const weightedStepHours = stepHours * simulatedDay.windowWeight

  for (let timestamp = window.sunriseTs; timestamp <= window.sunsetTs; timestamp += stepMinutes * MS_PER_MINUTE) {
    const solar = computeSolarPosition(new Date(timestamp).toISOString(), input.scene.origin.lat0, input.scene.origin.lon0)
    const snapshot = computeShadeSnapshot({
      scene: input.scene,
      sunAzimuthDeg: solar.sunAzimuthDeg,
      sunElevationDeg: solar.sunElevationDeg,
      lowSunElevationThresholdDeg: input.lowSunElevationThresholdDeg,
      maxShadowDistanceClampM: input.maxShadowDistanceClampM,
    })

    if (snapshot.status !== 'OK') {
      continue
    }

    for (const roofSnapshot of snapshot.roofs) {
      const roofAccum = accum.roofAccumById.get(roofSnapshot.roofId)
      if (!roofAccum) {
        continue
      }

      const cellCount = roofSnapshot.shadeFactors.length
      if (cellCount === 0) {
        continue
      }

      const litFraction = roofSnapshot.litCellCount / cellCount
      roofAccum.sunHours += litFraction * weightedStepHours
      roofAccum.daylightHours += weightedStepHours
      if (roofSnapshot.isSunFacing) {
        roofAccum.frontSideHours += weightedStepHours
      }
      roofAccum.litCellCountWeighted += roofSnapshot.litCellCount * weightedStepHours
      roofAccum.totalCellCountWeighted += cellCount * weightedStepHours

      const roofCells = accum.cellAccumByRoof.get(roofSnapshot.roofId)
      if (!roofCells) {
        continue
      }

      for (let i = 0; i < roofSnapshot.shadeFactors.length; i += 1) {
        roofCells[i].daylightHours += weightedStepHours
        if (roofSnapshot.isSunFacing) {
          roofCells[i].frontSideHours += weightedStepHours
        }
        if (roofSnapshot.shadeFactors[i] === 0) {
          roofCells[i].litHours += weightedStepHours
        }
      }
    }
  }
}

// Purpose: Encapsulates finalize result behavior in one reusable function.
// Why: Improves readability by isolating a single responsibility behind a named function.
function finalizeResult(
  input: AnnualSunAccessInput,
  accum: AnnualAccumulator,
  stepMinutes: number,
  sampleWindowDays: number,
  dateStartIso: string,
  dateEndIso: string,
): AnnualSunAccessResult {
  const roofs = Array.from(accum.roofAccumById.values()).map((roof) => {
    const sunAccessRatio = roof.frontSideHours > 0 ? roof.sunHours / roof.frontSideHours : 0
    return {
      ...roof,
      sunAccessRatio,
    }
  })

  const heatmapCells: AnnualSunAccessResult['heatmapCells'] = []
  for (const roof of input.scene.roofs) {
    const roofCellAccum = accum.cellAccumByRoof.get(roof.roofId)
    if (!roofCellAccum) {
      continue
    }

    for (let i = 0; i < roof.samples.length; i += 1) {
      const sample = roof.samples[i]
      const cellAccum = roofCellAccum[i]
      const litRatio = cellAccum.frontSideHours > 0 ? cellAccum.litHours / cellAccum.frontSideHours : 0
      heatmapCells.push({
        roofId: roof.roofId,
        cellPolygon: sample.cellPolygonLocal.map((point) => localMetersToLonLat(input.scene.origin, point)),
        litRatio,
      })
    }
  }

  return {
    roofs,
    heatmapCells,
    meta: {
      sampledDayCount: accum.sampledDayCount,
      simulatedHalfYear: input.halfYearMirror,
      stepMinutes,
      sampleWindowDays,
      dateStartIso,
      dateEndIso,
    },
  }
}

export interface ComputeAnnualSunAccessBatchedOptions {
  onProgress?: (progress: AnnualSunAccessProgress) => void
  onYield?: () => Promise<void>
}

// Purpose: Computes compute annual sun access batched deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
export async function computeAnnualSunAccessBatched(
  input: AnnualSunAccessInput,
  options: ComputeAnnualSunAccessBatchedOptions = {},
): Promise<AnnualSunAccessResult | null> {
  const stepMinutes = Math.max(1, Math.floor(input.stepMinutes))
  const sampleWindowDays = Math.max(1, Math.floor(input.sampleWindowDays))
  const simulationDates = resolveSimulationDates(input)
  if (!simulationDates || input.scene.roofs.length === 0) {
    return null
  }
  const dateIsos = simulationDates.dateIsos

  const simulatedDays = buildSimulatedDays(dateIsos, sampleWindowDays, input.halfYearMirror)
  if (simulatedDays.length === 0) {
    return null
  }

  const accum = createAccumulator(input)
  options.onProgress?.({ sampledDays: 0, totalSampledDays: simulatedDays.length })

  for (let i = 0; i < simulatedDays.length; i += 1) {
    processSimulatedDay(input, stepMinutes, simulatedDays[i], accum)
    options.onProgress?.({ sampledDays: i + 1, totalSampledDays: simulatedDays.length })
    if (options.onYield) {
      await options.onYield()
    }
  }

  return finalizeResult(
    input,
    accum,
    stepMinutes,
    sampleWindowDays,
    simulationDates.dateStartIso,
    simulationDates.dateEndIso,
  )
}

// Purpose: Computes compute annual sun access deterministically from the provided input values.
// Why: Keeps domain rules explicit, testable, and deterministic.
export function computeAnnualSunAccess(input: AnnualSunAccessInput): AnnualSunAccessResult | null {
  const stepMinutes = Math.max(1, Math.floor(input.stepMinutes))
  const sampleWindowDays = Math.max(1, Math.floor(input.sampleWindowDays))
  const simulationDates = resolveSimulationDates(input)
  if (!simulationDates || input.scene.roofs.length === 0) {
    return null
  }
  const dateIsos = simulationDates.dateIsos

  const simulatedDays = buildSimulatedDays(dateIsos, sampleWindowDays, input.halfYearMirror)
  if (simulatedDays.length === 0) {
    return null
  }

  const accum = createAccumulator(input)
  for (const simulatedDay of simulatedDays) {
    processSimulatedDay(input, stepMinutes, simulatedDay, accum)
  }

  return finalizeResult(
    input,
    accum,
    stepMinutes,
    sampleWindowDays,
    simulationDates.dateStartIso,
    simulationDates.dateEndIso,
  )
}
