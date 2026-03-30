import {
  GRID_UNIT_PX,
  WALKTHROUGH_HORIZONTAL_LABEL_OFFSET,
  WALKTHROUGH_VERTICAL_LABEL_OFFSET,
} from "@/lib/force-config"
import type { ForceDirection } from "@/lib/forces"

export type DiagramPoint = {
  x: number
  y: number
}

const VIEWBOX_PADDING_UNITS = 2.2

export const DIRECTION_STROKE_COLORS: Record<ForceDirection, string> = {
  up: "#2563eb",
  down: "#ef4444",
  left: "#2563eb",
  right: "#ef4444",
}

export const DIRECTION_FILL_COLORS: Record<ForceDirection, string> = {
  up: "#2563eb",
  down: "#ef4444",
  left: "#2563eb",
  right: "#ef4444",
}

export function getDiagramViewboxRadius(gridRadius: number) {
  return (gridRadius + VIEWBOX_PADDING_UNITS) * GRID_UNIT_PX
}

export function toSvgPoint(point: DiagramPoint) {
  return {
    x: point.x * GRID_UNIT_PX,
    y: point.y * -GRID_UNIT_PX,
  }
}

export function getPointFromDiagramClient(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
  gridRadius: number,
) {
  if (!svg) {
    return null
  }

  const bounds = svg.getBoundingClientRect()
  const xRatio = (clientX - bounds.left) / bounds.width
  const yRatio = (clientY - bounds.top) / bounds.height
  const viewBoxRadius = getDiagramViewboxRadius(gridRadius)
  const svgX = -viewBoxRadius + xRatio * viewBoxRadius * 2
  const svgY = -viewBoxRadius + yRatio * viewBoxRadius * 2

  return {
    x: svgX / GRID_UNIT_PX,
    y: -svgY / GRID_UNIT_PX,
  }
}

export function getDiagramLabelPosition(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const normalX = -dy / length
  const normalY = dx / length
  const offset =
    Math.abs(dx) >= Math.abs(dy)
      ? WALKTHROUGH_HORIZONTAL_LABEL_OFFSET
      : WALKTHROUGH_VERTICAL_LABEL_OFFSET

  return {
    x: (from.x + to.x) / 2 + normalX * offset,
    y: (from.y + to.y) / 2 + normalY * offset,
  }
}
