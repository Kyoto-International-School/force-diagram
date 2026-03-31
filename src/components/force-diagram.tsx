import { type PointerEvent as ReactPointerEvent, type RefObject } from "react"

import {
  DIAGRAM_LABEL_FONT_SIZE,
  DIAGRAM_LINE_STROKE,
  GRID_UNIT_PX,
} from "@/lib/force-config"
import {
  getDiagramLabelPosition,
  getDiagramViewboxRadius,
  toSvgPoint,
  type DiagramPoint,
} from "@/lib/diagram"

export type DiagramArrow = {
  id: string
  from: DiagramPoint
  to: DiagramPoint
  stroke: string
  label?: string
  labelPlacement?: "midpoint" | "endpoint"
  labelRotateWithLine?: boolean
  labelColor?: string
  labelBoxFill?: string
  labelBoxStroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  opacity?: number
  markerEnd?: boolean
  lineHitAreaWidth?: number
  lineClassName?: string
  hitAreaClassName?: string
  onPointerDown?: (event: React.PointerEvent<SVGLineElement>) => void
  endpointHandle?: {
    radius: number
    hitRadius?: number
    visible?: boolean
    fill: string
    stroke: string
    strokeWidth: number
    className?: string
    onPointerDown?: (event: React.PointerEvent<SVGCircleElement>) => void
  }
}

export type DiagramNode = {
  id: string
  point: DiagramPoint
  shape: "circle" | "rect"
  layer?: "below-arrows" | "above-arrows"
  fill: string
  stroke?: string
  strokeWidth?: number
  radius?: number
  width?: number
  height?: number
  cornerRadius?: number
  className?: string
  onPointerDown?: (event: React.PointerEvent<SVGCircleElement | SVGRectElement>) => void
  label?: string
  labelColor?: string
  labelFontSize?: number
  labelDy?: number
  labelClassName?: string
}

type ForceDiagramProps = {
  gridRadius: number
  arrows: DiagramArrow[]
  nodes?: DiagramNode[]
  svgRef?: RefObject<SVGSVGElement | null>
  className?: string
  showAxisLabels?: boolean
  onBackgroundPointerDown?: (event: ReactPointerEvent<SVGSVGElement>) => void
}

const DEFAULT_ARROWHEAD_SIZE = 26
const AXIS_LABEL_STEP = 5
const AXIS_LABEL_FONT_SIZE = 10
const AXIS_LABEL_MARGIN = 16
const LABEL_BOX_HEIGHT = 48
const LABEL_BOX_Y = -24
const LABEL_BOX_RADIUS = 9
const LABEL_TEXT_Y = 11
const LABEL_COLLISION_PADDING = 6
const LABEL_COLLISION_STEP = 16
const LABEL_TANGENT_STEP = 20
const LABEL_ZERO_LENGTH_OFFSET = 44
const LABEL_ENDPOINT_GAP = 10
export function ForceDiagram({
  arrows,
  className = "",
  gridRadius,
  nodes = [],
  showAxisLabels = true,
  onBackgroundPointerDown,
  svgRef,
}: ForceDiagramProps) {
  const viewBoxRadius = getDiagramViewboxRadius(gridRadius)
  const axisRadius = gridRadius * GRID_UNIT_PX
  const gridLines = []
  const labelLayouts = new Map<
    string,
    {
      position: { x: number; y: number }
      rotation: number
    }
  >()
  const nodeObstacles = nodes.map((node) => getNodeObstacle(node))
  const markerObstacles = arrows
    .filter((arrow) => arrow.markerEnd !== false)
    .map((arrow) => getMarkerObstacle(arrow))
  const occupiedBounds: LabelBounds[] = [
    ...nodeObstacles.map((node) => node.bounds),
    ...markerObstacles.map((marker) => marker.bounds),
  ]

  for (let unit = -gridRadius; unit <= gridRadius; unit += 1) {
    const position = unit * GRID_UNIT_PX

    gridLines.push(
      <line
        key={`vertical-${unit}`}
        x1={position}
        y1={-axisRadius}
        x2={position}
        y2={axisRadius}
      />,
    )
    gridLines.push(
      <line
        key={`horizontal-${unit}`}
        x1={-axisRadius}
        y1={position}
        x2={axisRadius}
        y2={position}
      />,
    )
  }

  const belowArrowNodes = nodes.filter((node) => node.layer === "below-arrows")
  const aboveArrowNodes = nodes.filter((node) => node.layer !== "below-arrows")
  const axisLabels = []

  for (let unit = -gridRadius; unit <= gridRadius; unit += 1) {
    if (unit !== 0 && unit % AXIS_LABEL_STEP !== 0) {
      continue
    }

    const position = unit * GRID_UNIT_PX

    axisLabels.push(
      <text
        key={`x-axis-${unit}`}
        x={position}
        y={axisRadius + AXIS_LABEL_MARGIN}
        textAnchor="middle"
        fill="#64748b"
        className="font-medium"
        style={{ fontSize: `${AXIS_LABEL_FONT_SIZE}px` }}
      >
        {unit}
      </text>,
    )
    axisLabels.push(
      <text
        key={`y-axis-${unit}`}
        x={-axisRadius - AXIS_LABEL_MARGIN}
        y={-position + 3}
        textAnchor="end"
        fill="#64748b"
        className="font-medium"
        style={{ fontSize: `${AXIS_LABEL_FONT_SIZE}px` }}
      >
        {unit}
      </text>,
    )
  }

  for (const arrow of arrows) {
    if (!arrow.label) {
      continue
    }

    const from = toSvgPoint(arrow.from)
    const to = toSvgPoint(arrow.to)
    const dx = to.x - from.x
    const dy = to.y - from.y
    const rawLength = Math.hypot(dx, dy)
    const length = rawLength || 1
    const isVerticalLabel = Math.abs(dy) > Math.abs(dx)
    const lineAngle = Math.atan2(dy, dx) * (180 / Math.PI)
    const readableLineAngle =
      lineAngle > 90 ? lineAngle - 180 : lineAngle < -90 ? lineAngle + 180 : lineAngle
    const rotation = arrow.labelRotateWithLine
      ? readableLineAngle
      : isVerticalLabel
        ? -90
        : 0
    const width = getArrowLabelBoxWidth(arrow.label)
    const rotatedBoundsSize = getRotatedBoundsSize(width, LABEL_BOX_HEIGHT, rotation)
    const tangentX = rawLength < 1 ? 1 : dx / length
    const tangentY = rawLength < 1 ? 0 : dy / length
    const normalX = rawLength < 1 ? 0 : -dy / length
    const normalY = rawLength < 1 ? -1 : dx / length
    const basePosition =
      rawLength < 1
        ? {
            x: from.x + LABEL_ZERO_LENGTH_OFFSET,
            y: from.y - LABEL_ZERO_LENGTH_OFFSET,
          }
        : arrow.labelPlacement === "endpoint"
          ? getEndpointLabelPosition({
              from,
              to,
              dx,
              dy,
              rotatedWidth: rotatedBoundsSize.width,
              rotatedHeight: rotatedBoundsSize.height,
            })
          : getDiagramLabelPosition(from, to)
    const tangentOffsets = [0, 1, 2, 3, 4, -1, -2]
    const normalOffsets = [0, 1, -1, 2, -2, 3, -3]
    const resolvedBasePosition = getResolvedLabelBasePosition({
      basePosition,
      width,
      height: LABEL_BOX_HEIGHT,
      rotation,
      tangentX,
      tangentY,
      normalX,
      normalY,
      nodeObstacles,
    })

    let placedPosition = resolvedBasePosition
    let placedBounds = getLabelBounds(resolvedBasePosition, width, LABEL_BOX_HEIGHT, rotation)

    for (const tangentOffset of tangentOffsets) {
      for (const normalOffset of normalOffsets) {
        const candidatePosition = {
          x:
            resolvedBasePosition.x +
            tangentX * LABEL_TANGENT_STEP * tangentOffset +
            normalX * LABEL_COLLISION_STEP * normalOffset,
          y:
            resolvedBasePosition.y +
            tangentY * LABEL_TANGENT_STEP * tangentOffset +
            normalY * LABEL_COLLISION_STEP * normalOffset,
        }
        const candidateBounds = getLabelBounds(
          candidatePosition,
          width,
          LABEL_BOX_HEIGHT,
          rotation,
        )

        if (!occupiedBounds.some((bounds) => boundsIntersect(bounds, candidateBounds))) {
          placedPosition = candidatePosition
          placedBounds = candidateBounds
          break
        }
      }

      if (
        placedPosition.x !== resolvedBasePosition.x ||
        placedPosition.y !== resolvedBasePosition.y ||
        !occupiedBounds.some((bounds) => boundsIntersect(bounds, placedBounds))
      ) {
        break
      }
    }

    occupiedBounds.push(placedBounds)
    labelLayouts.set(arrow.id, {
      position: placedPosition,
      rotation,
    })
  }

  return (
    <svg
      ref={svgRef}
      className={`force-diagram ${className}`.trim()}
      viewBox={`${-viewBoxRadius} ${-viewBoxRadius} ${viewBoxRadius * 2} ${viewBoxRadius * 2}`}
      onPointerDown={(event) => {
        event.preventDefault()
        onBackgroundPointerDown?.(event)
      }}
    >
      <rect
        x={-viewBoxRadius}
        y={-viewBoxRadius}
        width={viewBoxRadius * 2}
        height={viewBoxRadius * 2}
        fill="transparent"
      />

      <g className="stroke-slate-200" strokeWidth="1">
        {gridLines}
      </g>

      <g className="stroke-slate-300" strokeWidth="1.5">
        <line x1={-axisRadius} y1={0} x2={axisRadius} y2={0} />
        <line x1={0} y1={-axisRadius} x2={0} y2={axisRadius} />
      </g>

      {showAxisLabels ? (
        <g>
          {axisLabels}
        </g>
      ) : null}

      {belowArrowNodes.map((node) => {
        const point = toSvgPoint(node.point)

        return (
          <g key={node.id}>
            {node.shape === "circle" ? (
              <circle
                cx={point.x}
                cy={point.y}
                r={node.radius}
                fill={node.fill}
                stroke={node.stroke}
                strokeWidth={node.strokeWidth}
                className={node.className}
                onPointerDown={(event) => {
                  event.preventDefault()
                  node.onPointerDown?.(event)
                }}
              />
            ) : (
              <rect
                x={point.x - (node.width ?? 0) / 2}
                y={point.y - (node.height ?? 0) / 2}
                width={node.width}
                height={node.height}
                rx={node.cornerRadius}
                fill={node.fill}
                stroke={node.stroke}
                strokeWidth={node.strokeWidth}
                className={node.className}
                onPointerDown={(event) => {
                  event.preventDefault()
                  node.onPointerDown?.(event)
                }}
              />
            )}
            {node.label ? (
              <text
                x={point.x}
                y={point.y + (node.labelDy ?? 0)}
                textAnchor="middle"
                fill={node.labelColor ?? "#0f172a"}
                className={node.labelClassName}
                style={{ fontSize: `${node.labelFontSize ?? DIAGRAM_LABEL_FONT_SIZE}px` }}
              >
                {node.label}
              </text>
            ) : null}
          </g>
        )
      })}

      {arrows.map((arrow) => {
        const from = toSvgPoint(arrow.from)
        const to = toSvgPoint(arrow.to)
        const shaftEnd = arrow.markerEnd === false ? to : getArrowShaftEnd(from, to, arrow.strokeWidth)
        const hitAreaEnd = arrow.markerEnd === false ? to : arrow.endpointHandle ? to : shaftEnd
        const labelLayout = labelLayouts.get(arrow.id)

        return (
          <g key={arrow.id} opacity={arrow.opacity}>
            {arrow.onPointerDown ? (
              <line
                x1={from.x}
                y1={from.y}
                x2={hitAreaEnd.x}
                y2={hitAreaEnd.y}
                className={arrow.hitAreaClassName ?? "cursor-pointer stroke-transparent"}
                strokeWidth={arrow.lineHitAreaWidth ?? 18}
                strokeLinecap="round"
                onPointerDown={(event) => {
                  event.preventDefault()
                  arrow.onPointerDown?.(event)
                }}
              />
            ) : null}
            <line
              x1={from.x}
              y1={from.y}
              x2={shaftEnd.x}
              y2={shaftEnd.y}
              stroke={arrow.stroke}
              strokeWidth={arrow.strokeWidth ?? DIAGRAM_LINE_STROKE}
              strokeDasharray={arrow.strokeDasharray}
              strokeLinecap={arrow.markerEnd === false ? "round" : "butt"}
              className={arrow.lineClassName}
              onPointerDown={(event) => {
                event.preventDefault()
                arrow.onPointerDown?.(event)
              }}
            />
            {arrow.markerEnd === false ? null : (
              <polygon
                points={getArrowheadPoints(from, to, arrow.strokeWidth)}
                fill={arrow.stroke}
                stroke={arrow.stroke}
                strokeWidth={1}
                strokeLinejoin="round"
                pointerEvents="none"
              />
            )}
            {arrow.endpointHandle ? (
              <>
                <circle
                  cx={to.x}
                  cy={to.y}
                  r={arrow.endpointHandle.hitRadius ?? arrow.endpointHandle.radius}
                  fill="transparent"
                  className={arrow.endpointHandle.className}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    arrow.endpointHandle?.onPointerDown?.(event)
                  }}
                />
                {arrow.endpointHandle.visible === false ? null : (
                  <circle
                    cx={to.x}
                    cy={to.y}
                    r={arrow.endpointHandle.radius}
                    fill={arrow.endpointHandle.fill}
                    stroke={arrow.endpointHandle.stroke}
                    strokeWidth={arrow.endpointHandle.strokeWidth}
                    className={arrow.endpointHandle.className}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      arrow.endpointHandle?.onPointerDown?.(event)
                    }}
                  />
                )}
              </>
            ) : null}
            {arrow.label && labelLayout ? (
              <g
                transform={`translate(${labelLayout.position.x} ${labelLayout.position.y})${labelLayout.rotation !== 0 ? ` rotate(${labelLayout.rotation})` : ""}`}
              >
                <rect
                  x={getArrowLabelBoxX(arrow.label)}
                  y={LABEL_BOX_Y}
                  width={getArrowLabelBoxWidth(arrow.label)}
                  height={LABEL_BOX_HEIGHT}
                  rx={LABEL_BOX_RADIUS}
                  fill={arrow.labelBoxFill ?? "rgba(255,255,255,0.96)"}
                  stroke={arrow.labelBoxStroke ?? "#e2e8f0"}
                />
                <text
                  x="0"
                  y={LABEL_TEXT_Y}
                  textAnchor="middle"
                  fill={arrow.labelColor ?? "#334155"}
                  className="font-semibold"
                  style={{ fontSize: `${DIAGRAM_LABEL_FONT_SIZE}px` }}
                >
                  {arrow.label}
                </text>
              </g>
            ) : null}
          </g>
        )
      })}

      {aboveArrowNodes.map((node) => {
        const point = toSvgPoint(node.point)

        return (
          <g key={node.id}>
            {node.shape === "circle" ? (
              <circle
                cx={point.x}
                cy={point.y}
                r={node.radius}
                fill={node.fill}
                stroke={node.stroke}
                strokeWidth={node.strokeWidth}
                className={node.className}
                onPointerDown={(event) => {
                  event.preventDefault()
                  node.onPointerDown?.(event)
                }}
              />
            ) : (
              <rect
                x={point.x - (node.width ?? 0) / 2}
                y={point.y - (node.height ?? 0) / 2}
                width={node.width}
                height={node.height}
                rx={node.cornerRadius}
                fill={node.fill}
                stroke={node.stroke}
                strokeWidth={node.strokeWidth}
                className={node.className}
                onPointerDown={(event) => {
                  event.preventDefault()
                  node.onPointerDown?.(event)
                }}
              />
            )}
            {node.label ? (
              <text
                x={point.x}
                y={point.y + (node.labelDy ?? 0)}
                textAnchor="middle"
                fill={node.labelColor ?? "#0f172a"}
                className={node.labelClassName}
                style={{ fontSize: `${node.labelFontSize ?? DIAGRAM_LABEL_FONT_SIZE}px` }}
              >
                {node.label}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function getArrowLabelBoxWidth(label: string) {
  return Math.max(28, label.length * DIAGRAM_LABEL_FONT_SIZE * 0.62 + 12)
}

function getArrowLabelBoxX(label: string) {
  return -getArrowLabelBoxWidth(label) / 2
}

type LabelBounds = {
  left: number
  right: number
  top: number
  bottom: number
}

type NodeObstacle = {
  center: { x: number; y: number }
  width: number
  height: number
  bounds: LabelBounds
}

type MarkerObstacle = {
  bounds: LabelBounds
}

function getLabelBounds(
  center: { x: number; y: number },
  width: number,
  height: number,
  rotation: number,
): LabelBounds {
  const radians = (rotation * Math.PI) / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))
  const rotatedWidth = width * cosine + height * sine
  const rotatedHeight = width * sine + height * cosine

  return {
    left: center.x - rotatedWidth / 2 - LABEL_COLLISION_PADDING,
    right: center.x + rotatedWidth / 2 + LABEL_COLLISION_PADDING,
    top: center.y - rotatedHeight / 2 - LABEL_COLLISION_PADDING,
    bottom: center.y + rotatedHeight / 2 + LABEL_COLLISION_PADDING,
  }
}

function getNodeObstacle(node: DiagramNode): NodeObstacle {
  const point = toSvgPoint(node.point)
  const width = node.shape === "circle" ? (node.radius ?? 0) * 2 : node.width ?? 0
  const height = node.shape === "circle" ? (node.radius ?? 0) * 2 : node.height ?? 0

  return {
    center: point,
    width,
    height,
    bounds: {
      left: point.x - width / 2 - LABEL_COLLISION_PADDING,
      right: point.x + width / 2 + LABEL_COLLISION_PADDING,
      top: point.y - height / 2 - LABEL_COLLISION_PADDING,
      bottom: point.y + height / 2 + LABEL_COLLISION_PADDING,
    },
  }
}

function getResolvedLabelBasePosition({
  basePosition,
  width,
  height,
  rotation,
  tangentX,
  tangentY,
  normalX,
  normalY,
  nodeObstacles,
}: {
  basePosition: { x: number; y: number }
  width: number
  height: number
  rotation: number
  tangentX: number
  tangentY: number
  normalX: number
  normalY: number
  nodeObstacles: NodeObstacle[]
}) {
  const baseBounds = getLabelBounds(basePosition, width, height, rotation)
  const blockingObstacle = nodeObstacles.find((obstacle) =>
    boundsIntersect(obstacle.bounds, baseBounds),
  )

  if (!blockingObstacle) {
    return basePosition
  }

  const { width: rotatedWidth, height: rotatedHeight } = getRotatedBoundsSize(
    width,
    height,
    rotation,
  )
  const obstacleHalfAlongTangent =
    Math.abs(tangentX) * (blockingObstacle.width / 2 + LABEL_COLLISION_PADDING) +
    Math.abs(tangentY) * (blockingObstacle.height / 2 + LABEL_COLLISION_PADDING)
  const labelHalfAlongTangent =
    Math.abs(tangentX) * (rotatedWidth / 2) +
    Math.abs(tangentY) * (rotatedHeight / 2)
  const baseNormalDistance =
    (basePosition.x - blockingObstacle.center.x) * normalX +
    (basePosition.y - blockingObstacle.center.y) * normalY

  return {
    x:
      blockingObstacle.center.x +
      tangentX * (obstacleHalfAlongTangent + labelHalfAlongTangent + LABEL_COLLISION_PADDING) +
      normalX * baseNormalDistance,
    y:
      blockingObstacle.center.y +
      tangentY * (obstacleHalfAlongTangent + labelHalfAlongTangent + LABEL_COLLISION_PADDING) +
      normalY * baseNormalDistance,
  }
}

function getRotatedBoundsSize(width: number, height: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))

  return {
    width: width * cosine + height * sine,
    height: width * sine + height * cosine,
  }
}

function getEndpointLabelPosition({
  from,
  to,
  dx,
  dy,
  rotatedWidth,
  rotatedHeight,
}: {
  from: { x: number; y: number }
  to: { x: number; y: number }
  dx: number
  dy: number
  rotatedWidth: number
  rotatedHeight: number
}) {
  const isHorizontal = Math.abs(dx) >= Math.abs(dy)

  if (isHorizontal) {
    const isMiddleLane = Math.abs(from.y) < 0.001

    if (isMiddleLane) {
      return {
        x: to.x + Math.sign(dx || 1) * (LABEL_ENDPOINT_GAP + rotatedWidth / 2),
        y: to.y,
      }
    }

    const verticalDirection =
      Math.abs(to.y) > 1 ? Math.sign(to.y) : to.x < from.x ? -1 : 1

    return {
      x: to.x,
      y: to.y + verticalDirection * (LABEL_ENDPOINT_GAP + rotatedHeight / 2),
    }
  }

  const isMiddleLane = Math.abs(from.x) < 0.001

  if (isMiddleLane) {
    return {
      x: to.x,
      y: to.y + Math.sign(dy || 1) * (LABEL_ENDPOINT_GAP + rotatedHeight / 2),
    }
  }

  const horizontalDirection =
    Math.abs(to.x) > 1 ? Math.sign(to.x) : to.y < from.y ? -1 : 1

  return {
    x: to.x + horizontalDirection * (LABEL_ENDPOINT_GAP + rotatedWidth / 2),
    y: to.y,
  }
}

function getMarkerObstacle(arrow: DiagramArrow): MarkerObstacle {
  const from = toSvgPoint(arrow.from)
  const to = toSvgPoint(arrow.to)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const tangentX = dx / length
  const tangentY = dy / length
  const markerCenter = {
    x: to.x - tangentX * (DEFAULT_ARROWHEAD_SIZE * 0.375),
    y: to.y - tangentY * (DEFAULT_ARROWHEAD_SIZE * 0.375),
  }

  return {
    bounds: getLabelBounds(
      markerCenter,
      DEFAULT_ARROWHEAD_SIZE,
      DEFAULT_ARROWHEAD_SIZE,
      Math.atan2(dy, dx) * (180 / Math.PI),
    ),
  }
}

function getArrowheadPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  strokeWidth?: number,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)

  if (length < 0.001) {
    return `${to.x},${to.y} ${to.x},${to.y} ${to.x},${to.y}`
  }

  const tangentX = dx / length
  const tangentY = dy / length
  const normalX = -tangentY
  const normalY = tangentX
  const shaftThickness = strokeWidth ?? DIAGRAM_LINE_STROKE
  const arrowheadLength = DEFAULT_ARROWHEAD_SIZE + Math.max(0, shaftThickness - 1) * 1.2
  const baseCenterX = to.x - tangentX * arrowheadLength
  const baseCenterY = to.y - tangentY * arrowheadLength
  const leftX = baseCenterX + normalX * (DEFAULT_ARROWHEAD_SIZE / 2)
  const leftY = baseCenterY + normalY * (DEFAULT_ARROWHEAD_SIZE / 2)
  const rightX = baseCenterX - normalX * (DEFAULT_ARROWHEAD_SIZE / 2)
  const rightY = baseCenterY - normalY * (DEFAULT_ARROWHEAD_SIZE / 2)

  return `${to.x},${to.y} ${leftX},${leftY} ${rightX},${rightY}`
}

function getArrowShaftEnd(
  from: { x: number; y: number },
  to: { x: number; y: number },
  strokeWidth?: number,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)

  if (length < 0.001) {
    return to
  }

  const tangentX = dx / length
  const tangentY = dy / length
  const shaftThickness = strokeWidth ?? DIAGRAM_LINE_STROKE
  const arrowheadLength = DEFAULT_ARROWHEAD_SIZE + Math.max(0, shaftThickness - 1) * 1.2

  return {
    x: to.x - tangentX * arrowheadLength,
    y: to.y - tangentY * arrowheadLength,
  }
}

function boundsIntersect(left: LabelBounds, right: LabelBounds) {
  return !(
    left.right < right.left ||
    left.left > right.right ||
    left.bottom < right.top ||
    left.top > right.bottom
  )
}
