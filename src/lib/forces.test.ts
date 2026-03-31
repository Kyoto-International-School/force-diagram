import { describe, expect, it } from "vitest"

import {
  assignSideSlots,
  calculateResultant,
  generateWalkthroughPositions,
  normalizeCommittedMagnitude,
  snapDragDirection,
  snapToGridMagnitude,
  summarizeVectorMagnitude,
  type ForceItem,
} from "@/lib/forces"

function createForce(
  overrides: Partial<ForceItem> & Pick<ForceItem, "id" | "direction" | "magnitude" | "creationOrder">,
): ForceItem {
  return {
    sideSlot: 0,
    ...overrides,
  }
}

describe("snapDragDirection", () => {
  it("returns null for tiny drags near the origin", () => {
    expect(snapDragDirection(0.1, -0.1)).toBeNull()
  })

  it("prefers the horizontal axis on ties", () => {
    expect(snapDragDirection(4, 4)).toBe("right")
    expect(snapDragDirection(-4, 4)).toBe("left")
  })

  it("snaps to the dominant vertical direction", () => {
    expect(snapDragDirection(1, 3)).toBe("up")
    expect(snapDragDirection(1, -3)).toBe("down")
  })
})

describe("snapToGridMagnitude", () => {
  it("rounds to the nearest whole number", () => {
    expect(snapToGridMagnitude(4.49)).toBe(4)
    expect(snapToGridMagnitude(4.5)).toBe(5)
  })

  it("clamps to the configured bounds", () => {
    expect(snapToGridMagnitude(-2)).toBe(0)
    expect(snapToGridMagnitude(99, 20)).toBe(20)
  })
})

describe("normalizeCommittedMagnitude", () => {
  it("rejects invalid or non-positive magnitudes", () => {
    expect(normalizeCommittedMagnitude(Number.NaN)).toBeNull()
    expect(normalizeCommittedMagnitude(0)).toBeNull()
    expect(normalizeCommittedMagnitude(-3)).toBeNull()
  })

  it("rounds and clamps valid magnitudes", () => {
    expect(normalizeCommittedMagnitude(4.4)).toBe(4)
    expect(normalizeCommittedMagnitude(4.5)).toBe(5)
    expect(normalizeCommittedMagnitude(100, 20)).toBe(20)
  })
})

describe("assignSideSlots", () => {
  it("assigns slots by creation order within each direction", () => {
    const slotted = assignSideSlots([
      createForce({ id: "b", direction: "right", magnitude: 2, creationOrder: 2 }),
      createForce({ id: "a", direction: "right", magnitude: 4, creationOrder: 1 }),
      createForce({ id: "c", direction: "up", magnitude: 3, creationOrder: 3 }),
      createForce({ id: "d", direction: "right", magnitude: 1, creationOrder: 4 }),
    ])

    expect(slotted.map(({ id, sideSlot }) => ({ id, sideSlot }))).toEqual([
      { id: "a", sideSlot: 0 },
      { id: "b", sideSlot: 1 },
      { id: "c", sideSlot: 0 },
      { id: "d", sideSlot: 2 },
    ])
  })
})

describe("generateWalkthroughPositions", () => {
  it("walks the vectors in creation order", () => {
    const walkthrough = generateWalkthroughPositions([
      createForce({ id: "1", direction: "right", magnitude: 3, creationOrder: 1 }),
      createForce({ id: "2", direction: "up", magnitude: 4, creationOrder: 2 }),
      createForce({ id: "3", direction: "left", magnitude: 1, creationOrder: 3 }),
    ])

    expect(walkthrough.positions).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
    ])
    expect(walkthrough.end).toEqual({ x: 2, y: 4 })
  })
})

describe("calculateResultant", () => {
  it("combines axis totals into a resultant vector", () => {
    const resultant = calculateResultant([
      createForce({ id: "1", direction: "right", magnitude: 7, creationOrder: 1 }),
      createForce({ id: "2", direction: "left", magnitude: 3, creationOrder: 2 }),
      createForce({ id: "3", direction: "up", magnitude: 5, creationOrder: 3 }),
      createForce({ id: "4", direction: "down", magnitude: 1, creationOrder: 4 }),
    ])

    expect(resultant).toMatchObject({
      x: 4,
      y: 4,
      magnitude: Math.hypot(4, 4),
      isBalanced: false,
      directionLabel: "up and right",
    })
  })

  it("marks fully cancelled forces as balanced", () => {
    const resultant = calculateResultant([
      createForce({ id: "1", direction: "right", magnitude: 5, creationOrder: 1 }),
      createForce({ id: "2", direction: "left", magnitude: 5, creationOrder: 2 }),
    ])

    expect(resultant).toMatchObject({
      x: 0,
      y: 0,
      magnitude: 0,
      isBalanced: true,
      directionLabel: "Balanced",
    })
  })
})

describe("summarizeVectorMagnitude", () => {
  it("uses exact equality for integer magnitudes", () => {
    expect(summarizeVectorMagnitude(3, 4)).toMatchObject({
      squaredSum: 25,
      magnitude: 5,
      magnitudeText: "5",
      relationSymbol: "=",
      isApproximate: false,
    })
  })

  it("marks non-perfect squares as approximations at two decimals", () => {
    expect(summarizeVectorMagnitude(6, 14)).toMatchObject({
      squaredSum: 232,
      magnitudeText: "15.23",
      relationSymbol: "≈",
      isApproximate: true,
    })
  })
})
