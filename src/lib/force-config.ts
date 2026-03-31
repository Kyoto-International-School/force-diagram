export const GRID_UNIT_PX = 28
export const PLAYGROUND_GRID_RADIUS = 20
export const BOX_HALF_UNITS = 2
export const MAX_FORCES_PER_SIDE = 3
export const DIAGRAM_LABEL_FONT_SIZE = 36
export const DIAGRAM_LINE_STROKE = 16
export const DIAGRAM_SELECTED_LINE_STROKE = 20
export const DIAGRAM_HANDLE_RADIUS = 6
export const DIAGRAM_SELECTED_HANDLE_RADIUS = 7.5
export const WALKTHROUGH_HORIZONTAL_LABEL_OFFSET = 28
export const WALKTHROUGH_VERTICAL_LABEL_OFFSET = 28

// Slots stay deterministic by assigning center first, then the outer lanes.
export const SIDE_SLOT_LANES = [0, -1, 1] as const

export const DIRECTION_VECTORS = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const

export const DIRECTION_LABELS = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
} as const
