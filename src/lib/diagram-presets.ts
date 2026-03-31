import type { DiagramArrow, DiagramNode } from "@/components/force-diagram"
import { DIRECTION_FILL_COLORS, type DiagramPoint } from "@/lib/diagram"
import {
  BOX_HALF_UNITS,
  DIAGRAM_HANDLE_RADIUS,
  DIAGRAM_SELECTED_HANDLE_RADIUS,
  GRID_UNIT_PX,
} from "@/lib/force-config"
import type { ForceDirection } from "@/lib/forces"

const OBJECT_NODE_SIZE_PX = BOX_HALF_UNITS * GRID_UNIT_PX * 2
const HANDLE_HIT_RADIUS = 24

export function createObjectNode({
  id,
  point,
  onPointerDown,
  stroke,
  strokeWidth,
  className,
}: {
  id: string
  point: DiagramPoint
  onPointerDown?: DiagramNode["onPointerDown"]
  stroke?: DiagramNode["stroke"]
  strokeWidth?: DiagramNode["strokeWidth"]
  className?: DiagramNode["className"]
}): DiagramNode {
  return {
    id,
    point,
    shape: "rect",
    layer: "below-arrows",
    width: OBJECT_NODE_SIZE_PX,
    height: OBJECT_NODE_SIZE_PX,
    cornerRadius: 22,
    fill: "#0f172a",
    stroke,
    strokeWidth,
    className,
    onPointerDown,
  }
}

export function createForceEndpointHandle({
  direction,
  isSelected,
  onPointerDown,
}: {
  direction: ForceDirection
  isSelected: boolean
  onPointerDown: NonNullable<DiagramArrow["endpointHandle"]>["onPointerDown"]
}): NonNullable<DiagramArrow["endpointHandle"]> {
  return {
    radius: isSelected ? DIAGRAM_SELECTED_HANDLE_RADIUS : DIAGRAM_HANDLE_RADIUS,
    hitRadius: HANDLE_HIT_RADIUS,
    visible: false,
    fill: DIRECTION_FILL_COLORS[direction],
    stroke: "#ffffff",
    strokeWidth: isSelected ? 3.5 : 2.5,
    className: "cursor-pointer",
    onPointerDown,
  }
}
