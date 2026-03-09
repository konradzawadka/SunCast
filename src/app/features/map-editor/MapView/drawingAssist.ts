import { localMetersToLonLat, projectPointsToLocalMeters } from '../../../../geometry/projection/localMeters'

const RIGHT_ANGLE_SNAP_THRESHOLD_DEG = 14

function normalizeAzimuthDeg(deg: number): number {
  let normalized = deg % 360
  if (normalized < 0) {
    normalized += 360
  }
  return normalized
}

function angleBetweenDeg(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const aLen = Math.hypot(a.x, a.y)
  const bLen = Math.hypot(b.x, b.y)
  if (aLen === 0 || bLen === 0) {
    return 0
  }
  const dot = (a.x * b.x + a.y * b.y) / (aLen * bLen)
  const clamped = Math.max(-1, Math.min(1, dot))
  return (Math.acos(clamped) * 180) / Math.PI
}

export interface RightAngleSnapResult {
  point: [number, number]
  snapped: boolean
  angleDeg: number
}

export function segmentLengthMeters(start: [number, number], end: [number, number]): number {
  const { points2d } = projectPointsToLocalMeters([start, end])
  const dx = points2d[1].x - points2d[0].x
  const dy = points2d[1].y - points2d[0].y
  return Math.hypot(dx, dy)
}

export function segmentAzimuthDeg(start: [number, number], end: [number, number]): number | null {
  const { points2d } = projectPointsToLocalMeters([start, end])
  const dx = points2d[1].x - points2d[0].x
  const dy = points2d[1].y - points2d[0].y
  if (dx === 0 && dy === 0) {
    return null
  }
  // Compass azimuth where 0°=north and 90°=east.
  return normalizeAzimuthDeg((Math.atan2(dx, dy) * 180) / Math.PI)
}

export function angleFromSouthDeg(azimuthDeg: number): number {
  const delta = Math.abs(normalizeAzimuthDeg(azimuthDeg) - 180)
  return Math.min(delta, 360 - delta)
}

export function pointAtDistanceMeters(start: [number, number], toward: [number, number], distanceM: number): [number, number] {
  const safeDistanceM = Number.isFinite(distanceM) && distanceM > 0 ? distanceM : 0
  if (safeDistanceM === 0) {
    return toward
  }

  const { origin, points2d } = projectPointsToLocalMeters([start, toward])
  const dx = points2d[1].x - points2d[0].x
  const dy = points2d[1].y - points2d[0].y
  const currentLength = Math.hypot(dx, dy)
  if (currentLength === 0) {
    return toward
  }

  const scale = safeDistanceM / currentLength
  return localMetersToLonLat(origin, {
    x: points2d[0].x + dx * scale,
    y: points2d[0].y + dy * scale,
  })
}

export function snapDrawPointToRightAngle(
  drawDraft: Array<[number, number]>,
  rawPoint: [number, number],
  options?: { snapEnabled?: boolean },
): RightAngleSnapResult {
  if (drawDraft.length < 2) {
    return { point: rawPoint, snapped: false, angleDeg: 0 }
  }

  const previous = drawDraft[drawDraft.length - 2]
  const anchor = drawDraft[drawDraft.length - 1]
  const { origin, points2d } = projectPointsToLocalMeters([previous, anchor, rawPoint])
  const prev = points2d[0]
  const end = points2d[1]
  const cursor = points2d[2]

  const vPrev = { x: end.x - prev.x, y: end.y - prev.y }
  const vNext = { x: cursor.x - end.x, y: cursor.y - end.y }
  const angleDeg = angleBetweenDeg(vPrev, vNext)
  if (options?.snapEnabled === false) {
    return { point: rawPoint, snapped: false, angleDeg }
  }
  const distanceToRightAngle = Math.abs(angleDeg - 90)
  if (distanceToRightAngle > RIGHT_ANGLE_SNAP_THRESHOLD_DEG) {
    return { point: rawPoint, snapped: false, angleDeg }
  }

  const prevLen = Math.hypot(vPrev.x, vPrev.y)
  if (prevLen === 0) {
    return { point: rawPoint, snapped: false, angleDeg }
  }

  const unitPerp = { x: -vPrev.y / prevLen, y: vPrev.x / prevLen }
  const projected = vNext.x * unitPerp.x + vNext.y * unitPerp.y
  const snappedLocal = {
    x: end.x + unitPerp.x * projected,
    y: end.y + unitPerp.y * projected,
  }
  const snappedPoint = localMetersToLonLat(origin, snappedLocal)
  return { point: snappedPoint, snapped: true, angleDeg: 90 }
}
