import { useEffect, useRef } from 'react'
import { projectPointsToLocalMeters } from '../../geometry/projection/localMeters'
import { clampAzimuth, planeSlopeFromPitchAzimuth } from '../../geometry/solver/metrics'
import type { FootprintPolygon } from '../../types/geometry'
import type { SolvedEntry } from './useSolvedRoofEntries'

interface UseRoofDebugSimulationParams {
  activeFootprint: FootprintPolygon | null
  activeSolved: SolvedEntry | null
  mapBearingDeg: number
  mapPitchDeg: number
}

export function useRoofDebugSimulation({
  activeFootprint,
  activeSolved,
  mapBearingDeg,
  mapPitchDeg,
}: UseRoofDebugSimulationParams): void {
  const lastDebugSignatureRef = useRef<string>('')

  useEffect(() => {
    if (!activeFootprint || !activeSolved) {
      return
    }

    const { solution, metrics } = activeSolved
    const userRotationDeg = clampAzimuth(mapBearingDeg)
    const worldAzimuthDeg = clampAzimuth(metrics.azimuthDeg)
    const mapRelativeAzimuthDeg = ((worldAzimuthDeg - userRotationDeg + 540) % 360) - 180
    const reconstructed = planeSlopeFromPitchAzimuth(metrics.pitchDeg, worldAzimuthDeg)
    const signature = [
      activeFootprint.id,
      metrics.pitchDeg.toFixed(4),
      worldAzimuthDeg.toFixed(4),
      userRotationDeg.toFixed(4),
      mapPitchDeg.toFixed(4),
      solution.plane.p.toFixed(6),
      solution.plane.q.toFixed(6),
      solution.plane.r.toFixed(6),
    ].join('|')

    if (lastDebugSignatureRef.current === signature) {
      return
    }
    lastDebugSignatureRef.current = signature

    const { points2d } = projectPointsToLocalMeters(activeFootprint.vertices)
    const sampleRows = points2d.map((point, idx) => {
      const solvedZ = solution.vertexHeightsM[idx]
      const [lon, lat] = activeFootprint.vertices[idx]
      const fromPitchRotationZ = reconstructed.p * point.x + reconstructed.q * point.y + solution.plane.r
      return {
        vertex: idx,
        lon: Number(lon.toFixed(7)),
        lat: Number(lat.toFixed(7)),
        heightM: Number(solvedZ.toFixed(4)),
        projectedXM: Number(point.x.toFixed(3)),
        projectedYM: Number(point.y.toFixed(3)),
        simulatedHeightM: Number(fromPitchRotationZ.toFixed(4)),
        deltaM: Number((fromPitchRotationZ - solvedZ).toExponential(2)),
      }
    })

    console.groupCollapsed(`[roof-debug] ${activeFootprint.id} pitch+rotation simulation`)
    console.log({
      pitchDeg: Number(metrics.pitchDeg.toFixed(4)),
      rotateDeg: Number(userRotationDeg.toFixed(4)),
      mapPitchDeg: Number(mapPitchDeg.toFixed(4)),
      worldAzimuthDeg: Number(worldAzimuthDeg.toFixed(4)),
      mapRelativeAzimuthDeg: Number(mapRelativeAzimuthDeg.toFixed(4)),
      tanPitch: Number(Math.tan((metrics.pitchDeg * Math.PI) / 180).toFixed(6)),
      solvedPlane: {
        p: Number(solution.plane.p.toFixed(6)),
        q: Number(solution.plane.q.toFixed(6)),
        r: Number(solution.plane.r.toFixed(6)),
      },
      reconstructedFromPitchAzimuth: {
        p: Number(reconstructed.p.toFixed(6)),
        q: Number(reconstructed.q.toFixed(6)),
      },
    })
    console.table(sampleRows)
    console.groupEnd()
  }, [activeFootprint, activeSolved, mapBearingDeg, mapPitchDeg])
}
