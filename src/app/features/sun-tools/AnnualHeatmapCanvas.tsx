import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { AnnualSunAccessResult } from '../../../geometry/shading'
import { drawAnnualHeatmapCanvas, findHoveredCell, type DrawnHeatmapInfo } from './annualSunAccessHeatmap'

interface AnnualHeatmapCanvasProps {
  result: AnnualSunAccessResult
  gridResolutionM: number
  maxCanvasPx: number
  className: string
  wrapClassName: string
  canvasTestId: string
  tooltipTestId: string
}

export function AnnualHeatmapCanvas({
  result,
  gridResolutionM,
  maxCanvasPx,
  className,
  wrapClassName,
  canvasTestId,
  tooltipTestId,
}: AnnualHeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const drawInfoRef = useRef<DrawnHeatmapInfo | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      drawInfoRef.current = null
      return
    }
    drawInfoRef.current = drawAnnualHeatmapCanvas(canvas, result, gridResolutionM, maxCanvasPx)
  }, [gridResolutionM, maxCanvasPx, result])

  const onMouseMove = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const drawInfo = drawInfoRef.current
    if (!canvas || !wrap || !drawInfo) {
      setTooltip(null)
      return
    }

    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      setTooltip(null)
      return
    }

    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = (event.clientX - rect.left) * scaleX
    const canvasY = (event.clientY - rect.top) * scaleY
    const hoveredCell = findHoveredCell(drawInfo.projectedCells, canvasX, canvasY)
    if (!hoveredCell) {
      setTooltip(null)
      return
    }

    const wrapRect = wrap.getBoundingClientRect()
    const maxLitRatio = Math.max(1e-9, drawInfo.maxLitRatio)
    const currentPercent = hoveredCell.litRatio * 100
    const maxPercent = maxLitRatio * 100
    setTooltip({
      x: Math.max(0, event.clientX - wrapRect.left + 10),
      y: Math.max(0, event.clientY - wrapRect.top + 10),
      label: `${currentPercent.toFixed(1)}% / ${maxPercent.toFixed(1)}%`,
    })
  }

  return (
    <div className={wrapClassName} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className={className}
        data-testid={canvasTestId}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div className="annual-heatmap-tooltip" style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }} data-testid={tooltipTestId}>
          {tooltip.label}
        </div>
      )}
    </div>
  )
}
