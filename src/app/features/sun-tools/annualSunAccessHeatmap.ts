import type { AnnualSunAccessResult } from '../../../geometry/shading'

const EARTH_RADIUS_M = 6378137
const DEG_TO_RAD = Math.PI / 180
const HEATMAP_CELL_SCALE = 4

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

function hsvToRgb(hDeg: number, s: number, v: number): [number, number, number] {
  const hue = ((hDeg % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = v - c

  let rPrime = 0
  let gPrime = 0
  let bPrime = 0

  if (hue < 60) {
    rPrime = c
    gPrime = x
  } else if (hue < 120) {
    rPrime = x
    gPrime = c
  } else if (hue < 180) {
    gPrime = c
    bPrime = x
  } else if (hue < 240) {
    gPrime = x
    bPrime = c
  } else if (hue < 300) {
    rPrime = x
    bPrime = c
  } else {
    rPrime = c
    bPrime = x
  }

  return [
    Math.round((rPrime + m) * 255),
    Math.round((gPrime + m) * 255),
    Math.round((bPrime + m) * 255),
  ]
}

function annualHeatmapColor(litRatio: number): string {
  const t = clamp01(litRatio)
  let hueDeg = 0
  let saturation = 0.96
  let value = 0.94

  if (t <= 0.5) {
    const local = t / 0.5
    hueDeg = 220 - 100 * local
    saturation = 0.94
    value = 0.92
  } else {
    const local = (t - 0.5) / 0.5
    const boosted = Math.pow(local, 0.8)
    hueDeg = 120 * (1 - boosted)
    saturation = 0.98
    value = 0.82 + 0.18 * boosted
  }

  const [r, g, b] = hsvToRgb(hueDeg, saturation, value)
  return `rgb(${r}, ${g}, ${b})`
}

export function toCanvasDimensions(
  result: AnnualSunAccessResult,
  gridResolutionM: number,
  maxCanvasPx: number,
): { width: number; height: number } | null {
  const points = result.heatmapCells.flatMap((cell) => cell.cellPolygon)
  if (points.length === 0 || !Number.isFinite(gridResolutionM) || gridResolutionM <= 0) {
    return null
  }

  let minLon = points[0][0]
  let maxLon = points[0][0]
  let minLat = points[0][1]
  let maxLat = points[0][1]
  let latSum = 0
  for (const [lon, lat] of points) {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    latSum += lat
  }

  const latAvg = latSum / points.length
  const lonSpanM = Math.max(0.01, (maxLon - minLon) * DEG_TO_RAD * EARTH_RADIUS_M * Math.cos(latAvg * DEG_TO_RAD))
  const latSpanM = Math.max(0.01, (maxLat - minLat) * DEG_TO_RAD * EARTH_RADIUS_M)

  const estCols = Math.max(1, Math.round(lonSpanM / gridResolutionM)) * HEATMAP_CELL_SCALE
  const estRows = Math.max(1, Math.round(latSpanM / gridResolutionM)) * HEATMAP_CELL_SCALE
  const scale = Math.min(1, maxCanvasPx / estCols, maxCanvasPx / estRows)
  const width = Math.max(1, Math.round(estCols * scale))
  const height = Math.max(1, Math.round(estRows * scale))
  return { width, height }
}

export interface HeatmapProjectedCell {
  litRatio: number
  polygon: Array<[number, number]>
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface DrawnHeatmapInfo {
  maxLitRatio: number
  projectedCells: HeatmapProjectedCell[]
}

export function drawAnnualHeatmapCanvas(
  canvas: HTMLCanvasElement,
  result: AnnualSunAccessResult,
  gridResolutionM: number,
  maxCanvasPx: number,
): DrawnHeatmapInfo | null {
  const points = result.heatmapCells.flatMap((cell) => cell.cellPolygon)
  if (points.length === 0) {
    return null
  }
  const dims = toCanvasDimensions(result, gridResolutionM, maxCanvasPx)
  if (!dims) {
    return null
  }

  canvas.width = dims.width
  canvas.height = dims.height
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#0f171b'
  context.fillRect(0, 0, canvas.width, canvas.height)

  let minLon = points[0][0]
  let maxLon = points[0][0]
  let minLat = points[0][1]
  let maxLat = points[0][1]
  for (const [lon, lat] of points) {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }

  const lonSpan = Math.max(1e-12, maxLon - minLon)
  const latSpan = Math.max(1e-12, maxLat - minLat)
  const toX = (lon: number) => ((lon - minLon) / lonSpan) * (canvas.width - 1)
  const toY = (lat: number) => (1 - (lat - minLat) / latSpan) * (canvas.height - 1)

  const projectedCells: HeatmapProjectedCell[] = []
  let maxLitRatio = 0

  for (const cell of result.heatmapCells) {
    if (cell.cellPolygon.length < 3) {
      continue
    }

    maxLitRatio = Math.max(maxLitRatio, cell.litRatio)
    const projected: Array<[number, number]> = cell.cellPolygon.map(([lon, lat]) => [toX(lon), toY(lat)])
    let minX = projected[0][0]
    let minY = projected[0][1]
    let maxX = projected[0][0]
    let maxY = projected[0][1]

    for (const [x, y] of projected) {
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }

    projectedCells.push({
      litRatio: cell.litRatio,
      polygon: projected,
      minX,
      minY,
      maxX,
      maxY,
    })

    context.beginPath()
    context.fillStyle = annualHeatmapColor(cell.litRatio)
    context.strokeStyle = 'rgba(5, 12, 15, 0.65)'
    context.lineWidth = 0.6

    const [firstX, firstY] = projected[0]
    context.moveTo(firstX, firstY)
    for (let i = 1; i < projected.length; i += 1) {
      const [x, y] = projected[i]
      context.lineTo(x, y)
    }
    context.closePath()
    context.fill()
    context.stroke()
  }

  return {
    maxLitRatio,
    projectedCells,
  }
}

function pointInPolygon(point: [number, number], polygon: Array<[number, number]>): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

export function findHoveredCell(cells: HeatmapProjectedCell[], x: number, y: number): HeatmapProjectedCell | null {
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    const cell = cells[i]
    if (x < cell.minX || x > cell.maxX || y < cell.minY || y > cell.maxY) {
      continue
    }
    if (pointInPolygon([x, y], cell.polygon)) {
      return cell
    }
  }
  return null
}
