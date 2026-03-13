import { useMemo, useState } from 'react'
import { projectPointsToLocalMeters } from '../../geometry/projection/localMeters'
import { validateFootprint } from '../../geometry/solver/validation'
import type { FaceConstraints, FootprintPolygon, LngLat, VertexHeightConstraint } from '../../types/geometry'

interface UseConstraintEditorParams {
  activeFootprint: FootprintPolygon | null
  activeConstraints: FaceConstraints
  isDrawing: boolean
  selectedVertexIndex: number | null
  selectedEdgeIndex: number | null
  setVertexHeight: (vertexIndex: number, heightM: number) => boolean
  setVertexHeights: (constraints: VertexHeightConstraint[]) => boolean
  setEdgeHeight: (edgeIndex: number, heightM: number) => boolean
  moveVertex: (vertexIndex: number, point: LngLat) => void
  moveEdge: (edgeIndex: number, delta: LngLat) => void
}

const SEGMENT_LENGTH_EPSILON_M = 0.005

function squaredDistancePointToSegment(
  point: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
): number {
  const vx = segmentEnd.x - segmentStart.x
  const vy = segmentEnd.y - segmentStart.y
  const wx = point.x - segmentStart.x
  const wy = point.y - segmentStart.y
  const vv = vx * vx + vy * vy
  if (vv <= SEGMENT_LENGTH_EPSILON_M * SEGMENT_LENGTH_EPSILON_M) {
    const dx = point.x - segmentStart.x
    const dy = point.y - segmentStart.y
    return dx * dx + dy * dy
  }
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv))
  const projX = segmentStart.x + t * vx
  const projY = segmentStart.y + t * vy
  const dx = point.x - projX
  const dy = point.y - projY
  return dx * dx + dy * dy
}

function selectFallbackVertexForEdge(vertices: LngLat[], edgeIndex: number): number | null {
  const end = (edgeIndex + 1) % vertices.length
  const { points2d } = projectPointsToLocalMeters(vertices)
  const segmentStart = points2d[edgeIndex]
  const segmentEnd = points2d[end]

  let fallbackVertexIndex: number | null = null
  let maxDistanceSq = -1
  for (let idx = 0; idx < points2d.length; idx += 1) {
    if (idx === edgeIndex || idx === end) {
      continue
    }
    const distanceSq = squaredDistancePointToSegment(points2d[idx], segmentStart, segmentEnd)
    if (distanceSq > maxDistanceSq) {
      maxDistanceSq = distanceSq
      fallbackVertexIndex = idx
    }
  }
  return fallbackVertexIndex
}

export function useConstraintEditor({
  activeFootprint,
  activeConstraints,
  isDrawing,
  selectedVertexIndex,
  selectedEdgeIndex,
  setVertexHeight,
  setVertexHeights,
  setEdgeHeight,
  moveVertex,
  moveEdge,
}: UseConstraintEditorParams) {
  const [interactionError, setInteractionError] = useState<string | null>(null)

  const vertexCount = activeFootprint?.vertices.length ?? 0
  const safeSelectedVertexIndex =
    !activeFootprint ||
    isDrawing ||
    selectedVertexIndex === null ||
    selectedVertexIndex < 0 ||
    selectedVertexIndex >= vertexCount
      ? null
      : selectedVertexIndex
  const safeSelectedEdgeIndex =
    !activeFootprint || isDrawing || selectedEdgeIndex === null || selectedEdgeIndex < 0 || selectedEdgeIndex >= vertexCount
      ? null
      : selectedEdgeIndex

  const constraintMap = useMemo(
    () => new Map(activeConstraints.vertexHeights.map((constraint) => [constraint.vertexIndex, constraint.heightM])),
    [activeConstraints.vertexHeights],
  )

  const applyVertexHeight = (vertexIndex: number, heightM: number): boolean => {
    const applied = setVertexHeight(vertexIndex, heightM)
    if (!applied) {
      setInteractionError('Failed to apply vertex height')
      return false
    }
    setInteractionError(null)
    return true
  }

  const applyEdgeHeight = (edgeIndex: number, heightM: number): boolean => {
    if (!activeFootprint || edgeIndex < 0 || edgeIndex >= activeFootprint.vertices.length) {
      setInteractionError('Failed to apply edge height')
      return false
    }
    const applied = setEdgeHeight(edgeIndex, heightM)
    if (!applied) {
      setInteractionError('Failed to apply edge height')
      return false
    }

    const end = (edgeIndex + 1) % activeFootprint.vertices.length
    const postEdgeIndices = new Set(activeConstraints.vertexHeights.map((constraint) => constraint.vertexIndex))
    postEdgeIndices.add(edgeIndex)
    postEdgeIndices.add(end)

    if (postEdgeIndices.size === 2 && activeFootprint.vertices.length >= 3) {
      const fallbackVertexIndex = selectFallbackVertexForEdge(activeFootprint.vertices, edgeIndex)
      if (fallbackVertexIndex !== null) {
        setVertexHeight(fallbackVertexIndex, 0)
      }
    }

    setInteractionError(null)
    return true
  }

  const moveVertexIfValid = (vertexIndex: number, point: LngLat): boolean => {
    if (!activeFootprint) {
      return false
    }
    const nextVertices = [...activeFootprint.vertices]
    if (vertexIndex < 0 || vertexIndex >= nextVertices.length) {
      return false
    }
    nextVertices[vertexIndex] = point
    const errors = validateFootprint({ ...activeFootprint, vertices: nextVertices })
    if (errors.length > 0) {
      return false
    }
    moveVertex(vertexIndex, point)
    setInteractionError(null)
    return true
  }

  const moveEdgeIfValid = (edgeIndex: number, delta: LngLat): boolean => {
    if (!activeFootprint) {
      return false
    }
    const vertexTotal = activeFootprint.vertices.length
    if (edgeIndex < 0 || edgeIndex >= vertexTotal) {
      return false
    }
    const [deltaLon, deltaLat] = delta
    const start = edgeIndex
    const end = (edgeIndex + 1) % vertexTotal
    const nextVertices = [...activeFootprint.vertices]
    nextVertices[start] = [nextVertices[start][0] + deltaLon, nextVertices[start][1] + deltaLat]
    nextVertices[end] = [nextVertices[end][0] + deltaLon, nextVertices[end][1] + deltaLat]
    const errors = validateFootprint({ ...activeFootprint, vertices: nextVertices })
    if (errors.length > 0) {
      return false
    }
    moveEdge(edgeIndex, delta)
    setInteractionError(null)
    return true
  }

  const applyHeightStep = (stepM: number) => {
    if (!activeFootprint) {
      return
    }

    if (safeSelectedVertexIndex !== null) {
      const current = constraintMap.get(safeSelectedVertexIndex) ?? 0
      applyVertexHeight(safeSelectedVertexIndex, current + stepM)
      return
    }

    if (safeSelectedEdgeIndex !== null) {
      const vertexTotal = activeFootprint.vertices.length
      const start = safeSelectedEdgeIndex
      const end = (safeSelectedEdgeIndex + 1) % vertexTotal
      const nextStart = (constraintMap.get(start) ?? 0) + stepM
      const nextEnd = (constraintMap.get(end) ?? 0) + stepM
      const applied = setVertexHeights([
        { vertexIndex: start, heightM: nextStart },
        { vertexIndex: end, heightM: nextEnd },
      ])
      if (!applied) {
        setInteractionError('Failed to adjust edge heights')
        return
      }
      setInteractionError(null)
    }
  }

  return {
    interactionError,
    safeSelectedVertexIndex,
    safeSelectedEdgeIndex,
    applyVertexHeight,
    applyEdgeHeight,
    moveVertexIfValid,
    moveEdgeIfValid,
    applyHeightStep,
    clearInteractionError: () => setInteractionError(null),
    setConstraintLimitError: () => setInteractionError('Failed to apply height constraints'),
    setMoveRejectedError: () => setInteractionError('Roof polygon cannot self-intersect'),
  }
}
