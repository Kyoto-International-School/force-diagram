import {
  DIRECTION_LABELS,
  DIRECTION_VECTORS,
  MAX_FORCES_PER_SIDE,
  PLAYGROUND_GRID_RADIUS,
  SIDE_SLOT_LANES,
} from "@/lib/force-config"

export type ForceDirection = keyof typeof DIRECTION_VECTORS

export type ForceItem = {
  id: string
  direction: ForceDirection
  magnitude: number
  creationOrder: number
  sideSlot: number
}

type GridPoint = {
  x: number
  y: number
}

type ForceTotals = {
  up: number
  down: number
  left: number
  right: number
  netHorizontal: number
  netVertical: number
}

type WalkthroughStep = {
  force: ForceItem
  from: GridPoint
  to: GridPoint
}

type Resultant = {
  x: number
  y: number
  magnitude: number
  isBalanced: boolean
  directionLabel: string
}

export type VectorMagnitudeSummary = {
  squaredSum: number
  magnitude: number
  magnitudeText: string
  relationSymbol: "=" | "≈"
  isApproximate: boolean
}

export type ForcePreview = {
  direction: ForceDirection
  magnitude: number
  sideSlot: number
  blocked: boolean
}

function sortForcesByCreation(forces: ForceItem[]) {
  return [...forces].sort((left, right) => left.creationOrder - right.creationOrder)
}

export function snapDragDirection(dx: number, dy: number): ForceDirection | null {
  if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) {
    return null
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left"
  }

  return dy >= 0 ? "up" : "down"
}

export function snapToGridMagnitude(distance: number, maxMagnitude = PLAYGROUND_GRID_RADIUS) {
  const snapped = Math.round(distance)
  return Math.max(0, Math.min(maxMagnitude, snapped))
}

export function normalizeCommittedMagnitude(
  magnitude: number,
  maxMagnitude = PLAYGROUND_GRID_RADIUS,
) {
  if (!Number.isFinite(magnitude)) {
    return null
  }

  const normalized = Math.round(magnitude)

  if (normalized < 1) {
    return null
  }

  return Math.min(maxMagnitude, normalized)
}

function countForcesOnSide(
  forces: ForceItem[],
  direction: ForceDirection,
  excludeForceId?: string,
) {
  return forces.filter(
    (force) => force.direction === direction && force.id !== excludeForceId,
  ).length
}

export function canAddForceToSide(forces: ForceItem[], direction: ForceDirection) {
  return countForcesOnSide(forces, direction) < MAX_FORCES_PER_SIDE
}

export function canMoveForceToSide(
  forces: ForceItem[],
  forceId: string,
  direction: ForceDirection,
) {
  return countForcesOnSide(forces, direction, forceId) < MAX_FORCES_PER_SIDE
}

export function getNextSideSlot(forces: ForceItem[], direction: ForceDirection) {
  return Math.min(countForcesOnSide(forces, direction), MAX_FORCES_PER_SIDE - 1)
}

export function assignSideSlots(forces: ForceItem[]) {
  const counters: Record<ForceDirection, number> = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
  }

  return sortForcesByCreation(forces).map((force) => {
    const nextSlot = counters[force.direction]
    counters[force.direction] += 1

    return {
      ...force,
      sideSlot: nextSlot,
    }
  })
}

function getDirectionVector(direction: ForceDirection) {
  return DIRECTION_VECTORS[direction]
}

export function getForceAnchor(force: Pick<ForceItem, "direction" | "sideSlot">) {
  const lane = SIDE_SLOT_LANES[force.sideSlot] ?? 0

  if (force.direction === "up" || force.direction === "down") {
    return {
      x: lane,
      y: 0,
    }
  }

  return {
    x: 0,
    y: lane,
  }
}

export function getForceEndpoint(force: Pick<ForceItem, "direction" | "sideSlot" | "magnitude">) {
  const anchor = getForceAnchor(force)
  const vector = getDirectionVector(force.direction)

  return {
    x: anchor.x + vector.x * force.magnitude,
    y: anchor.y + vector.y * force.magnitude,
  }
}

export function calculateTotals(forces: ForceItem[]): ForceTotals {
  const totals = forces.reduce<Pick<ForceTotals, "up" | "down" | "left" | "right">>(
    (runningTotals, force) => {
      runningTotals[force.direction] += force.magnitude
      return runningTotals
    },
    {
      up: 0,
      down: 0,
      left: 0,
      right: 0,
    },
  )

  return {
    ...totals,
    netHorizontal: totals.right - totals.left,
    netVertical: totals.up - totals.down,
  }
}

export function generateWalkthroughPositions(forces: ForceItem[]) {
  const orderedForces = sortForcesByCreation(forces)
  const steps: WalkthroughStep[] = []
  const positions: GridPoint[] = [{ x: 0, y: 0 }]

  let current: GridPoint = { x: 0, y: 0 }

  for (const force of orderedForces) {
    const vector = getDirectionVector(force.direction)
    const nextPosition = {
      x: current.x + vector.x * force.magnitude,
      y: current.y + vector.y * force.magnitude,
    }

    steps.push({
      force,
      from: current,
      to: nextPosition,
    })
    positions.push(nextPosition)
    current = nextPosition
  }

  return {
    positions,
    steps,
    end: current,
  }
}

export function calculateResultant(forces: ForceItem[]) {
  const totals = calculateTotals(forces)
  const magnitude = Math.hypot(totals.netHorizontal, totals.netVertical)

  return {
    x: totals.netHorizontal,
    y: totals.netVertical,
    magnitude,
    isBalanced: totals.netHorizontal === 0 && totals.netVertical === 0,
    directionLabel: formatResultantDirection(totals.netHorizontal, totals.netVertical),
  } satisfies Resultant
}

export function formatAxisNet(value: number, positiveDirection: ForceDirection, negativeDirection: ForceDirection) {
  if (value === 0) {
    return "0 N"
  }

  const direction = value > 0 ? positiveDirection : negativeDirection
  return `${Math.abs(value)} N ${direction}`
}

export function formatMagnitude(value: number) {
  return `${formatMagnitudeValue(value)} N`
}

export function formatMagnitudeValue(value: number, precision = 2) {
  if (Number.isInteger(value)) {
    return value.toString()
  }

  return value.toFixed(precision)
}

export function summarizeVectorMagnitude(
  x: number,
  y: number,
  precision = 2,
): VectorMagnitudeSummary {
  const magnitude = Math.hypot(x, y)
  const squaredSum = x ** 2 + y ** 2
  const roundedMagnitude = Number(formatMagnitudeValue(magnitude, precision))
  const isApproximate =
    !Number.isInteger(magnitude) &&
    Math.abs(magnitude - roundedMagnitude) > 10 ** (-(precision + 1))

  return {
    squaredSum,
    magnitude,
    magnitudeText: formatMagnitudeValue(magnitude, precision),
    relationSymbol: isApproximate ? "≈" : "=",
    isApproximate,
  }
}

function formatResultantDirection(horizontal: number, vertical: number) {
  if (horizontal === 0 && vertical === 0) {
    return "Balanced"
  }

  const parts: string[] = []

  if (vertical !== 0) {
    parts.push(vertical > 0 ? "up" : "down")
  }

  if (horizontal !== 0) {
    parts.push(horizontal > 0 ? "right" : "left")
  }

  return parts.join(" and ")
}

export function getForceLabel(force: Pick<ForceItem, "direction" | "magnitude">) {
  return `${DIRECTION_LABELS[force.direction]} ${force.magnitude} N`
}

export function getDirectionalMagnitudeFromPoint(point: GridPoint, direction: ForceDirection) {
  const vector = getDirectionVector(direction)
  return vector.x * point.x + vector.y * point.y
}
